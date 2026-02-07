from pathlib import Path

from dotenv import load_dotenv

# Load .env and .env.local from project root so GEMINI_API_KEY is available
_root = Path(__file__).resolve().parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root / ".env.local")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.genai.errors import ClientError
from app.imessage_store import list_threads, get_messages, search_exact, get_expanded_context
from app.ask_service import ask

app = FastAPI(title="iMessage Local API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev; later you can lock this down
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskBody(BaseModel):
    query: str
    chat_id: int
    period_start: str  # YYYY-MM-DD
    period_end: str    # YYYY-MM-DD (same day only; free tier token limit)


@app.get("/")
def root():
    return {"ok": True, "hint": "GET /threads, GET /threads/{chat_id}/messages, POST /ask, GET /search"}


@app.get("/threads")
def threads(limit: int = 50):
    try:
        return {"threads": list_threads(limit=limit)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/threads/{chat_id}/messages")
def messages(chat_id: int, limit: int = 50):
    try:
        return {"chat_id": chat_id, "messages": get_messages(chat_id=chat_id, limit=limit)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/search")
def search(query: str, context_size: int = 2, chat_id: int = None, title: str = None):
    """
    Search for exact keyword matches and return context windows.
    
    Args:
        query: The keyword to search for
        context_size: Number of messages before/after to include (default: 2)
        chat_id: Optional chat_id to filter to a specific thread
        title: Optional thread title to filter results (for contact/group filtering)
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    try:
        # If title is provided, find the chat_id first
        filter_chat_id = chat_id
        if title and not chat_id:
            from app.imessage_store import connect
            con = connect()
            result = con.execute(
                "SELECT chat_id FROM threads WHERE title = ?",
                (title,)
            ).fetchone()
            con.close()
            if result:
                filter_chat_id = result['chat_id']
        
        results = search_exact(query.strip(), context_size=context_size, chat_id=filter_chat_id)
        return {"query": query, "results": results, "count": len(results)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/expand")
def expand(chat_id: int, message_id: int, before: int = 10, after: int = 10):
    """
    Get expanded context around a specific message.
    
    Args:
        chat_id: The thread/chat ID
        message_id: The central message ID
        before: Number of messages to load before (default: 10)
        after: Number of messages to load after (default: 10)
    """
    try:
        result = get_expanded_context(chat_id, message_id, before, after)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ask")
def ask_endpoint(body: AskBody):
    """Semantic Q&A over one thread in a single-day window. Requires GEMINI_API_KEY."""
    try:
        return ask(
            query=body.query.strip(),
            chat_id=body.chat_id,
            period_start=body.period_start.strip(),
            period_end=body.period_end.strip(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ClientError as e:
        status = getattr(e, "status_code", None) or (e.args[0] if e.args else None)
        if status == 429 or "RESOURCE_EXHAUSTED" in str(e):
            raise HTTPException(
                status_code=429,
                detail="Gemini API quota exceeded. If the error says 'limit: 0', set GEMINI_MODEL=gemini-2.5-flash-lite or gemini-1.5-flash (models with free quota). See https://ai.google.dev/gemini-api/docs/rate-limits",
            )
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e!s}")
