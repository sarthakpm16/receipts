#!/usr/bin/env python3
import re, sqlite3, sys, plistlib
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
INPUT = BASE / "input"
WORK = BASE / "work"
DATA = BASE / "data"

CHAT_DB = INPUT / "chat.db"
WAL = INPUT / "chat.db-wal"
SHM = INPUT / "chat.db-shm"
VCF = INPUT / "contacts.vcf"

WORK_DB = WORK / "chat.db"
OUT_DB = DATA / "processed.db"

APPLE_EPOCH = 978307200  # 2001-01-01

def norm_handle(s):
    if not s: return ""
    s = s.strip()
    if "@" in s: return s.lower()
    digits = re.sub(r"\D+", "", s)
    if len(digits) == 10: return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"): return "+" + digits
    return s

def parse_vcf(text):
    contacts = {}
    cards = re.split(r"END:VCARD\s*", text, flags=re.I)
    for card in cards:
        if "BEGIN:VCARD" not in card.upper(): continue

        name = ""
        m = re.search(r"^FN[^:]*:(.*)$", card, flags=re.M | re.I)
        if m: name = m.group(1).strip()
        if not name:
            m = re.search(r"^N[^:]*:(.*)$", card, flags=re.M | re.I)
            if m:
                parts = m.group(1).split(";")
                name = " ".join(p for p in parts[:2] if p).strip()
        if not name: name = "Unknown"

        for m in re.finditer(r"^TEL[^:]*:(.*)$", card, flags=re.M | re.I):
            h = norm_handle(m.group(1))
            if h and h not in contacts: contacts[h] = name

        for m in re.finditer(r"^EMAIL[^:]*:(.*)$", card, flags=re.M | re.I):
            h = norm_handle(m.group(1))
            if h and h not in contacts: contacts[h] = name

    return contacts

def extract_text_from_attributed_body(blob):
    """
    attributedBody is usually an NSKeyedArchiver plist blob.
    We try to parse it, then harvest all strings from $objects.
    Fallback: heuristic string extraction from bytes.
    """
    if not blob:
        return ""

    # 1) Try plistlib (often works on modern macOS)
    try:
        obj = plistlib.loads(blob)
        strings = []
        def walk(x):
            if isinstance(x, str):
                strings.append(x)
            elif isinstance(x, dict):
                for v in x.values(): walk(v)
            elif isinstance(x, (list, tuple)):
                for v in x: walk(v)
        walk(obj)

        # Filter obvious noise keys and join unique-ish strings
        cleaned = []
        seen = set()
        for s in strings:
            s = s.strip()
            if not s: 
                continue
            if s.startswith("$"): 
                continue
            if s in seen:
                continue
            seen.add(s)
            cleaned.append(s)

        # If we got something that looks like real text, return it
        joined = " ".join(cleaned).strip()
        if joined:
            return joined
    except Exception:
        pass

    # 2) Fallback: pull readable ASCII/UTF-8-ish runs from bytes
    try:
        text = blob.decode("utf-8", errors="ignore")
    except Exception:
        text = str(blob)

    # grab long-ish printable sequences
    parts = re.findall(r"[ -~]{3,}", text)  # printable ASCII runs
    parts = [p.strip() for p in parts if p.strip()]
    # remove common noise
    noise = {"NSString", "NSAttributedString", "NSDictionary", "NSObject"}
    parts = [p for p in parts if p not in noise]
    final_text = " ".join(parts[:20]).strip()
    cleaned_text = final_text.removeprefix("streamtyped").split("__kIMMessagePartAttributeName")[0].strip()

    cleaned_text = re.sub(r'(?:\bNSMutable(?:Attributed)?String\b\s*)+', '', cleaned_text)
    cleaned_text = re.sub(r'^[^A-Za-z]+', '', cleaned_text)
    return cleaned_text

def main():
    if not CHAT_DB.exists():
        print("❌ Missing input/chat.db"); sys.exit(1)

    WORK.mkdir(exist_ok=True)
    DATA.mkdir(exist_ok=True)

    # Copy into work/ to avoid locks + include WAL/SHM
    WORK_DB.write_bytes(CHAT_DB.read_bytes())
    if WAL.exists(): (WORK / "chat.db-wal").write_bytes(WAL.read_bytes())
    if SHM.exists(): (WORK / "chat.db-shm").write_bytes(SHM.read_bytes())

    contacts = {}
    if VCF.exists():
        contacts = parse_vcf(VCF.read_text(errors="ignore"))
        print(f"Loaded contacts: {len(contacts)}")
    else:
        print("No contacts.vcf found")

    if OUT_DB.exists(): OUT_DB.unlink()

    src = sqlite3.connect(str(WORK_DB))
    src.row_factory = sqlite3.Row
    out = sqlite3.connect(str(OUT_DB))

    out.executescript("""
    PRAGMA journal_mode=WAL;

    CREATE TABLE contacts(
      handle TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE threads(
      chat_id INTEGER PRIMARY KEY,
      title TEXT,
      last_message_at TEXT
    );

    CREATE TABLE thread_members(
      chat_id INTEGER,
      member_handle TEXT,
      member_name TEXT
    );
    CREATE INDEX idx_thread_members_chat ON thread_members(chat_id);

    CREATE TABLE messages(
      message_id INTEGER PRIMARY KEY,
      chat_id INTEGER,
      sent_at TEXT,
      sender_name TEXT,
      text TEXT
    );
    CREATE INDEX idx_messages_chat_time ON messages(chat_id, sent_at);
    """)

    out.executemany("INSERT OR IGNORE INTO contacts VALUES (?,?)", contacts.items())
    out.commit()
    name_map = {h: n for h, n in out.execute("SELECT handle, name FROM contacts")}

    def name_for(handle):
        h = norm_handle(handle)
        return name_map.get(h, h)

    # members
    members_by_chat = {}
    for r in src.execute("""
      SELECT chj.chat_id, h.id AS handle
      FROM chat_handle_join chj
      JOIN handle h ON h.ROWID = chj.handle_id
      ORDER BY chj.chat_id
    """):
        cid = r["chat_id"]
        h = norm_handle(r["handle"])
        if h:
            members_by_chat.setdefault(cid, []).append(h)

    batch = []
    for cid, handles in members_by_chat.items():
        for h in handles:
            batch.append((cid, h, name_for(h)))
    out.executemany("INSERT INTO thread_members(chat_id, member_handle, member_name) VALUES (?,?,?)", batch)
    out.commit()

    # threads
    chats = src.execute(f"""
      WITH latest AS (
        SELECT cmj.chat_id, MAX(m.date) AS max_date
        FROM chat_message_join cmj
        JOIN message m ON m.ROWID = cmj.message_id
        GROUP BY cmj.chat_id
      )
      SELECT
        c.ROWID AS chat_id,
        c.display_name,
        c.chat_identifier,
        datetime(l.max_date/1000000000 + {APPLE_EPOCH}, 'unixepoch','localtime') AS last_message_at
      FROM chat c
      JOIN latest l ON l.chat_id = c.ROWID
      ORDER BY l.max_date DESC
    """).fetchall()

    for c in chats:
        cid = c["chat_id"]
        display = (c["display_name"] or "").strip()
        ident = (c["chat_identifier"] or "").strip()

        if display:
            title = display
        elif ident and not ident.startswith("chat"):
            title = name_for(ident)
        else:
            parts = [name_for(h) for h in members_by_chat.get(cid, [])]
            title = ", ".join(parts[:5]) if parts else (ident or f"chat_{cid}")

        out.execute("INSERT INTO threads(chat_id, title, last_message_at) VALUES (?,?,?)",
                    (cid, title, c["last_message_at"]))
    out.commit()

    # messages (IMPORTANT: pull attributedBody too)
    msg_rows = src.execute(f"""
      SELECT DISTINCT
        m.ROWID AS message_id,
        cmj.chat_id AS chat_id,
        datetime(m.date/1000000000 + {APPLE_EPOCH}, 'unixepoch','localtime') AS sent_at,
        m.is_from_me,
        h.id AS handle,
        m.text AS text,
        m.attributedBody AS attributed_body
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      LEFT JOIN handle h ON h.ROWID = m.handle_id
    """)

    batch = []
    for r in msg_rows:
        if r["is_from_me"] == 1:
            sender = "ME"
        else:
            sender = name_for(r["handle"]) if r["handle"] else "UNKNOWN"

        text = r["text"]
        if not text and r["attributed_body"]:
            text = extract_text_from_attributed_body(r["attributed_body"])
        if not text:
            text = ""

        batch.append((r["message_id"], r["chat_id"], r["sent_at"], sender, text))

        if len(batch) >= 5000:
            out.executemany("INSERT OR REPLACE INTO messages VALUES (?,?,?,?,?)", batch)
            out.commit()
            batch.clear()

    if batch:
        out.executemany("INSERT OR REPLACE INTO messages VALUES (?,?,?,?,?)", batch)
        out.commit()

    src.close()
    out.close()
    print("✅ Done → data/processed.db (includes your sent texts too)")

if __name__ == "__main__":
    main()