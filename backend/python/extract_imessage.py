from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd

# ---------- Paths ----------
HOME = Path.home()
SRC_DIR = HOME / "Library" / "Messages"
SRC_DB = SRC_DIR / "chat.db"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TMP_DIR = PROJECT_ROOT / "tmp"
DATA_DIR = PROJECT_ROOT / "data"
TMP_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

APPLE_EPOCH_OFFSET = 978307200  # seconds between 1970-01-01 and 2001-01-01


# ---------- Helpers ----------
def safe_copy_chat_db() -> Path:
    """
    Copy chat.db (and WAL/SHM if present) into tmp/ so we read a stable snapshot.
    """
    if not SRC_DB.exists():
        raise FileNotFoundError(f"chat.db not found at {SRC_DB}")

    dst_db = TMP_DIR / "chat.db"
    shutil.copy2(SRC_DB, dst_db)

    for suffix in ["-wal", "-shm"]:
        src = SRC_DIR / f"chat.db{suffix}"
        if src.exists():
            shutil.copy2(src, TMP_DIR / f"chat.db{suffix}")

    return dst_db


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def normalize_apple_time_to_unix_seconds(x):
    """
    Normalize various Apple timestamp encodings to Unix seconds.
    Handles:
      - nanoseconds since 2001
      - seconds since 2001
      - already-unix seconds
    """
    if x is None:
        return None
    try:
        x = float(x)
    except Exception:
        return None

    # Likely nanoseconds since 2001
    if x > 1e12:
        return (x / 1e9) + APPLE_EPOCH_OFFSET

    # Likely seconds since 2001
    if x < 2_000_000_000:
        return x + APPLE_EPOCH_OFFSET

    # Otherwise already unix seconds
    return x


def unix_seconds_to_iso(x):
    if x is None:
        return None
    return datetime.fromtimestamp(x, tz=timezone.utc).isoformat()


def resolve_attachment_path(p: str | None) -> str | None:
    if not p:
        return None
    p = str(p)
    if p.startswith("/"):
        return p
    if p.startswith("~/"):
        return str(Path.home() / p[2:])
    # If it's relative-ish, assume it's under ~/Library/Messages/
    return str((HOME / "Library" / "Messages" / p).resolve())


# ---------- Extraction ----------
def extract_messages(conn: sqlite3.Connection) -> pd.DataFrame:
    """
    Pull messages joined to chats + handle (sender).
    Uses message.ROWID as stable primary key.
    """
    q = """
    SELECT
      m.ROWID                       AS message_id,
      c.ROWID                       AS chat_id,
      c.chat_identifier             AS chat_identifier,
      c.display_name                AS display_name,

      m.text                        AS text,
      m.is_from_me                  AS is_from_me,
      m.handle_id                   AS handle_id,
      h.id                          AS sender_handle,

      m.date                        AS date_raw,
      m.date_read                   AS date_read_raw,
      m.date_delivered              AS date_delivered_raw
    FROM message m
    JOIN chat_message_join cmj
      ON cmj.message_id = m.ROWID
    JOIN chat c
      ON c.ROWID = cmj.chat_id
    LEFT JOIN handle h
      ON h.ROWID = m.handle_id
    """
    return pd.read_sql_query(q, conn)


def extract_chat_participants(conn: sqlite3.Connection) -> dict[int, list[str]]:
    """
    Map chat_id -> list of participant handles.
    """
    q = """
    SELECT
      chj.chat_id AS chat_id,
      h.id        AS participant_handle
    FROM chat_handle_join chj
    JOIN handle h
      ON h.ROWID = chj.handle_id
    """
    df = pd.read_sql_query(q, conn)
    parts = (
        df.groupby("chat_id")["participant_handle"]
        .apply(lambda s: sorted({x for x in s if x is not None}))
        .to_dict()
    )
    # ensure ints for keys (pandas can make them numpy types)
    return {int(k): v for k, v in parts.items()}


def extract_attachments(conn: sqlite3.Connection) -> pd.DataFrame:
    q = """
    SELECT
      maj.message_id               AS message_id,
      a.ROWID                      AS attachment_id,
      a.filename                   AS filename,
      a.mime_type                  AS mime_type,
      a.transfer_name              AS transfer_name,
      a.total_bytes                AS total_bytes,
      a.is_sticker                 AS is_sticker
    FROM message_attachment_join maj
    JOIN attachment a
      ON a.ROWID = maj.attachment_id
    """
    return pd.read_sql_query(q, conn)


# ---------- Cleaning ----------
def clean_messages(messages_df: pd.DataFrame, participants_by_chat: dict[int, list[str]]) -> pd.DataFrame:
    df = messages_df.copy()

    # timestamps
    df["timestamp_unix"] = df["date_raw"].apply(normalize_apple_time_to_unix_seconds)
    df["timestamp"] = df["timestamp_unix"].apply(unix_seconds_to_iso)

    df["date_read_unix"] = df["date_read_raw"].apply(normalize_apple_time_to_unix_seconds)
    df["date_read"] = df["date_read_unix"].apply(unix_seconds_to_iso)

    df["date_delivered_unix"] = df["date_delivered_raw"].apply(normalize_apple_time_to_unix_seconds)
    df["date_delivered"] = df["date_delivered_unix"].apply(unix_seconds_to_iso)

    # participants list
    def parts(chat_id):
        return participants_by_chat.get(int(chat_id), [])
    df["participants"] = df["chat_id"].apply(parts)
    df["participant_count"] = df["participants"].apply(len)

    # group heuristic: >2 handles usually implies group (may include you)
    df["is_group"] = df["participant_count"].apply(lambda n: n > 2)

    # sender field
    df["is_from_me"] = df["is_from_me"].fillna(0).astype(int)
    df["sender_handle"] = df["sender_handle"].fillna("")
    df["sender"] = df.apply(lambda r: "me" if r["is_from_me"] == 1 else (r["sender_handle"] or "unknown"), axis=1)

    # chat_name fallback
    def compute_chat_name(row):
        if row.get("display_name"):
            return row["display_name"]
        parts = row.get("participants") or []
        if len(parts) <= 2:
            # 1:1 chat fallback: use chat_identifier or sender
            return row.get("chat_identifier") or (row["sender"] if row["sender"] != "me" else "Direct Chat")
        return f"Group: {len(parts)} people"

    df["chat_name"] = df.apply(compute_chat_name, axis=1)

    # basic text cleanup
    df["text"] = df["text"].fillna("").astype(str)

    keep = [
        "message_id", "chat_id", "chat_name", "chat_identifier",
        "is_group", "participants", "participant_count",
        "sender", "is_from_me",
        "text",
        "timestamp", "timestamp_unix",
        "date_read", "date_delivered",
    ]
    df = df[keep].sort_values(["timestamp_unix", "message_id"])
    return df


def clean_attachments(att_df: pd.DataFrame) -> pd.DataFrame:
    df = att_df.copy()
    df["filename_resolved"] = df["filename"].apply(resolve_attachment_path)
    return df


# ---------- Main ----------
def main():
    db_copy = safe_copy_chat_db()
    conn = connect(db_copy)

    msgs_raw = extract_messages(conn)
    participants_by_chat = extract_chat_participants(conn)
    atts_raw = extract_attachments(conn)

    msgs = clean_messages(msgs_raw, participants_by_chat)
    atts = clean_attachments(atts_raw)

    msgs_path = DATA_DIR / "messages_cleaned.parquet"
    atts_path = DATA_DIR / "attachments_cleaned.parquet"

    msgs.to_parquet(msgs_path, index=False)
    atts.to_parquet(atts_path, index=False)

    print("\n✅ Wrote outputs:")
    print(" -", msgs_path, "rows:", len(msgs))
    print(" -", atts_path, "rows:", len(atts))
    print("\nSanity sample (first 5 messages):")
    print(msgs[["chat_name", "sender", "timestamp", "text"]].head(5).to_string(index=False))

    conn.close()


if __name__ == "__main__":
    main()
