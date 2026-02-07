"""
Semantic "Ask" mode: gather message context and call Gemini to answer questions.
Set GEMINI_API_KEY in the environment (get one at https://aistudio.google.com/apikey).
"""

import os
from app.imessage_store import list_threads, get_messages

# Max characters of message context to send (to stay under model limits)
MAX_CONTEXT_CHARS = 30_000

_gemini_client = None


def _get_client():
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY (or GOOGLE_API_KEY) not set. Get one at https://aistudio.google.com/apikey")
    from google import genai
    _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def _build_context(thread_ids=None, max_chars=MAX_CONTEXT_CHARS):
    """Build a single text blob of messages for the model. Optionally restrict to thread_ids."""
    threads = list_threads(limit=80)
    if thread_ids is not None:
        thread_ids_set = set(thread_ids)
        threads = [t for t in threads if t["chat_id"] in thread_ids_set]
    parts = []
    total = 0
    for t in threads:
        block = [f"## Thread: {t['title']} (chat_id={t['chat_id']})"]
        try:
            msgs = get_messages(t["chat_id"], limit=50)
        except Exception:
            continue
        for m in reversed(msgs):  # chronological
            line = f"{m['sender_name']}: {m['text']}"
            if total + len(line) + 2 > max_chars:
                break
            block.append(line)
            total += len(line) + 2
        if len(block) > 1:
            parts.append("\n".join(block))
        if total >= max_chars:
            break
    return "\n\n".join(parts) if parts else ""


def ask(query: str, thread_ids: list[int] | None = None) -> dict:
    """
    Answer a question using message context and Gemini.
    Returns {"answer": str, "sources": [{"chat_id": int, "title": str}]}.
    """
    context = _build_context(thread_ids=thread_ids)
    if not context.strip():
        return {
            "answer": "No messages were found to search. Make sure data/processed.db exists and has messages.",
            "sources": [],
        }

    prompt = f"""You are a helpful assistant. You have access to the following iMessage conversation threads (thread title and messages). Answer the user's question using ONLY information from these messages. If the answer is not in the messages, say so clearly. Be concise.

--- MESSAGES ---
{context}
--- END MESSAGES ---

Question: {query}

Answer:"""

    client = _get_client()
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    answer = (response.text or "").strip()

    # Build sources list from threads we included
    threads = list_threads(limit=80)
    if thread_ids is not None:
        thread_ids_set = set(thread_ids)
        threads = [t for t in threads if t["chat_id"] in thread_ids_set]
    sources = [{"chat_id": t["chat_id"], "title": t["title"]} for t in threads[:15]]

    return {"answer": answer, "sources": sources}
