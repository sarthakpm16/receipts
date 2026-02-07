import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "processed.db"

def connect():
    if not DB_PATH.exists():
        raise FileNotFoundError("data/processed.db not found. Run: make imessage")
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con

def list_threads(limit=50):
    con = connect()
    rows = con.execute(
        "SELECT chat_id, title, last_message_at FROM threads ORDER BY last_message_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]

def get_messages(chat_id: int, limit=50):
    con = connect()
    rows = con.execute(
        "SELECT sent_at, sender_name, text FROM messages WHERE chat_id=? ORDER BY sent_at DESC LIMIT ?",
        (chat_id, limit)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]
