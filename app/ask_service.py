"""
Semantic "Ask" mode: gather message context and call Gemini to answer questions.
Requires a single thread (chat_id) and a 1-day window.

Rate limit root cause: we were using gemini-2.0-flash, which has 0 free-tier quota
(limit: 0 in 429 errors). Use a model that has free quota instead.

Env:
  GEMINI_API_KEY (or GOOGLE_API_KEY) - required
  GEMINI_MODEL - optional; default gemini-2.5-flash-lite (free tier: 15 RPM, 1000 RPD).
                 If you see 429 with "limit: 0", try gemini-1.5-flash or check
                 https://ai.google.dev/gemini-api/docs/rate-limits
"""

import os
import time
from datetime import datetime

from app.imessage_store import list_threads, get_messages_in_range

# Free tier: small context = fewer input tokens = stay under TPM and avoid burning quota
MAX_CONTEXT_CHARS = 6_000
MAX_PERIOD_DAYS = 1

# In-memory cache: (query_lower, chat_id, period_start, period_end) -> {answer, sources}
# TTL 1 hour so repeated identical asks don't hit the API
_ask_cache: dict[tuple[str, int, str, str], tuple[dict, float]] = {}
_CACHE_TTL_SECONDS = 3600
# Don't block the request for 30s on 429; return fast so the UI can show "try again later"
_RETRY_AFTER_429_SECONDS = 0

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


def _parse_date(s: str) -> datetime:
    """Parse YYYY-MM-DD to datetime for comparison."""
    return datetime.strptime(s.strip()[:10], "%Y-%m-%d")


def _build_context(chat_id: int, period_start: str, period_end: str, max_chars: int = MAX_CONTEXT_CHARS) -> tuple[str, str, list[dict]]:
    """
    Build a single text blob of messages for one thread in the given date range.
    Returns (context_text, thread_title, messages_used). messages_used is list of
    dicts with sent_at, sender_name, text (same order as in context).
    """
    threads = list_threads(limit=500)
    thread = next((t for t in threads if t["chat_id"] == chat_id), None)
    if not thread:
        return "", "", []
    try:
        msgs = get_messages_in_range(chat_id, period_start, period_end)
    except Exception:
        return "", thread["title"], []
    block = [f"## Thread: {thread['title']} ({period_start} to {period_end})"]
    used: list[dict] = []
    total = 0
    for m in msgs:
        line = f"{m['sender_name']}: {m['text']}"
        if total + len(line) + 2 > max_chars:
            break
        block.append(line)
        used.append(dict(m))
        total += len(line) + 2
    if len(block) <= 1:
        return "", thread["title"], []
    return "\n".join(block), thread["title"], used


def _find_highlight(messages_used: list[dict], answer: str, chat_id: int, title: str) -> dict | None:
    """
    Find which message the model pointed to (answer quotes or references it).
    Return highlight with 2 msgs before, match, 2 msgs after (same as exact search).
    """
    if not messages_used or not answer or answer.strip().lower() in ("none", "no messages", "no message."):
        return None
    answer_lower = answer.lower()
    best_i: int | None = None
    best_len = 0
    for i, m in enumerate(messages_used):
        text = (m.get("text") or "").strip()
        if not text:
            continue
        # Prefer message whose text appears in answer (quoted) or longest overlap
        if text.lower() in answer_lower:
            if len(text) > best_len:
                best_len = len(text)
                best_i = i
        elif answer_lower in text.lower():
            if len(text) > best_len:
                best_len = len(text)
                best_i = i
    if best_i is None:
        # Fallback: first message that has a substantial substring in common
        for i, m in enumerate(messages_used):
            text = (m.get("text") or "").strip()
            if len(text) < 5:
                continue
            words = set(text.lower().split())
            answer_words = set(answer_lower.split())
            if words & answer_words and len(words & answer_words) >= 1:
                best_i = i
                break
    if best_i is None:
        return None
    start = max(0, best_i - 2)
    end = min(len(messages_used), best_i + 3)
    window = messages_used[start:end]
    match_index_in_window = best_i - start
    messages_out = []
    for j, m in enumerate(window):
        messages_out.append({
            "sent_at": m.get("sent_at", ""),
            "sender_name": m.get("sender_name", ""),
            "text": m.get("text", ""),
            "is_match": j == match_index_in_window,
        })
    return {"chat_id": chat_id, "title": title, "messages": messages_out}


def _get_model() -> str:
    """Model with free-tier quota. gemini-2.0-flash often has limit: 0 on free tier."""
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite").strip() or "gemini-2.5-flash-lite"


def _call_gemini(prompt: str):
    """Call Gemini once. Raises google.genai.errors.ClientError on 429/other errors."""
    client = _get_client()
    model = _get_model()
    return client.models.generate_content(model=model, contents=prompt)


def ask(query: str, chat_id: int, period_start: str, period_end: str) -> dict:
    """
    Answer a question using messages from a single thread in a 1-day window.
    Caches results for the same (query, chat_id, day) to avoid burning quota.
    period_start, period_end: "YYYY-MM-DD" (inclusive); range must be 1 day only (same day).
    Returns {"answer": str, "sources": [{"chat_id": int, "title": str}]}.
    """
    from google.genai.errors import ClientError

    start = _parse_date(period_start)
    end = _parse_date(period_end)
    if start > end:
        raise ValueError("period_start must be on or before period_end")
    delta = (end - start).days
    if delta > 0:
        raise ValueError("Date range must be a single day (free tier). Pick one day.")

    # Cache key: same question + thread + day → return cached if fresh
    key = (query.strip().lower(), chat_id, period_start, period_end)
    now = time.monotonic()
    if key in _ask_cache:
        cached, cached_at = _ask_cache[key]
        if now - cached_at < _CACHE_TTL_SECONDS:
            return cached
        del _ask_cache[key]

    context, title, messages_used = _build_context(chat_id, period_start, period_end)
    if not context.strip():
        return {
            "answer": f"No messages in this thread on {period_start}. Try a different day or thread.",
            "sources": [],
            "highlight": None,
        }

    # Minimal prompt: point to the exact text that answers the question (saves tokens)
    prompt = f"""Question: {query}

Messages:
{context}

Which message(s) answer the question best? Quote the exact text, or say "none"."""

    last_error = None
    for attempt in range(2):  # initial try + one retry on 429 (if retry delay > 0)
        try:
            response = _call_gemini(prompt)
            answer = (response.text or "").strip()
            sources = [{"chat_id": chat_id, "title": title}] if title else []
            highlight = _find_highlight(messages_used, answer, chat_id, title)
            result = {"answer": answer, "sources": sources, "highlight": highlight}
            _ask_cache[key] = (result, time.monotonic())
            return result
        except ClientError as e:
            last_error = e
            status = getattr(e, "status_code", None) or (e.args[0] if e.args else None)
            if (status == 429 or "RESOURCE_EXHAUSTED" in str(e)) and attempt == 0 and _RETRY_AFTER_429_SECONDS > 0:
                time.sleep(_RETRY_AFTER_429_SECONDS)
                continue
            raise
    if last_error:
        raise last_error
    return {"answer": "", "sources": []}  # unreachable
