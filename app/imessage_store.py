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


def get_messages_in_range(chat_id: int, start_date: str, end_date: str):
    """
    Get messages in a thread within a date range (inclusive).
    start_date, end_date: "YYYY-MM-DD". Times are treated as start of day and end of day.
    """
    con = connect()
    start_ts = f"{start_date} 00:00:00"
    end_ts = f"{end_date} 23:59:59"
    rows = con.execute(
        """SELECT sent_at, sender_name, text FROM messages
           WHERE chat_id = ? AND sent_at >= ? AND sent_at <= ?
           ORDER BY sent_at ASC""",
        (chat_id, start_ts, end_ts),
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]

def search_exact(query: str, context_size: int = 2, chat_id: int = None):
    """
    Search for exact keyword matches and return context windows around each match.
    
    Args:
        query: The keyword to search for
        context_size: Number of messages to include before and after the match (default: 2)
        chat_id: Optional chat_id to filter results to a specific thread
        
    Returns:
        List of match results, each containing:
        - chat_id, title: Thread info
        - match_message_id: ID of the message containing the match
        - messages: List of messages in the context window (includes context + match)
        - match_index: Index of the matching message in the messages list
    """
    con = connect()
    
    # Find all messages containing the query (case-insensitive)
    query_pattern = f"%{query}%"
    
    # Build SQL query with optional chat_id filter
    sql = """
        SELECT m.message_id, m.chat_id, m.sent_at, m.sender_name, m.text, t.title
        FROM messages m
        JOIN threads t ON m.chat_id = t.chat_id
        WHERE m.text LIKE ? COLLATE NOCASE
    """
    params = [query_pattern]
    
    if chat_id is not None:
        sql += " AND m.chat_id = ?"
        params.append(chat_id)
    
    sql += " ORDER BY m.sent_at DESC"
    
    matches = con.execute(sql, params).fetchall()
    
    results = []
    
    for match in matches:
        match_id = match['message_id']
        chat_id = match['chat_id']
        match_time = match['sent_at']
        title = match['title']
        
        # Get context window: messages before and after the match
        # Get messages in the same chat around the match timestamp
        context_messages = con.execute(
            """
            SELECT message_id, sent_at, sender_name, text,
                   CASE WHEN message_id = ? THEN 1 ELSE 0 END as is_match
            FROM messages
            WHERE chat_id = ?
            ORDER BY sent_at
            """,
            (match_id, chat_id)
        ).fetchall()
        
        # Find the index of the matching message
        match_index = None
        for i, msg in enumerate(context_messages):
            if msg['message_id'] == match_id:
                match_index = i
                break
        
        if match_index is None:
            continue
            
        # Extract context window
        start_index = max(0, match_index - context_size)
        end_index = min(len(context_messages), match_index + context_size + 1)
        window = context_messages[start_index:end_index]
        
        # Format messages
        messages = []
        window_match_index = None
        for i, msg in enumerate(window):
            messages.append({
                'message_id': msg['message_id'],
                'sent_at': msg['sent_at'],
                'sender_name': msg['sender_name'],
                'text': msg['text'],
                'is_match': bool(msg['is_match'])
            })
            if msg['is_match']:
                window_match_index = i
        
        results.append({
            'chat_id': chat_id,
            'title': title,
            'match_message_id': match_id,
            'match_index': window_match_index,
            'messages': messages,
            'has_more_before': start_index > 0,
            'has_more_after': end_index < len(context_messages),
            'total_messages_in_thread': len(context_messages)
        })
    
    con.close()
    return results

def get_expanded_context(chat_id: int, message_id: int, before: int = 10, after: int = 10):
    """
    Get expanded context around a specific message.
    
    Args:
        chat_id: The chat/thread ID
        message_id: The central message ID
        before: Number of messages to fetch before
        after: Number of messages to fetch after
        
    Returns:
        Dict with messages before, the target message, and messages after
    """
    con = connect()
    
    # Get all messages in chronological order
    all_messages = con.execute(
        """
        SELECT message_id, sent_at, sender_name, text
        FROM messages
        WHERE chat_id = ?
        ORDER BY sent_at
        """,
        (chat_id,)
    ).fetchall()
    
    # Find target message index
    target_index = None
    for i, msg in enumerate(all_messages):
        if msg['message_id'] == message_id:
            target_index = i
            break
    
    if target_index is None:
        con.close()
        return {'messages': []}
    
    # Get expanded window
    start = max(0, target_index - before)
    end = min(len(all_messages), target_index + after + 1)
    window = all_messages[start:end]
    
    messages = [dict(msg) for msg in window]
    
    con.close()
    return {
        'messages': messages,
        'target_index': target_index - start,
        'has_more_before': start > 0,
        'has_more_after': end < len(all_messages)
    }
