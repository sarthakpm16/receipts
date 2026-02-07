from pathlib import Path

from dotenv import load_dotenv

# Load .env and .env.local from project root so GEMINI_API_KEY is available
_root = Path(__file__).resolve().parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root / ".env.local")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.imessage_store import list_threads, get_messages
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
    thread_ids: list[int] | None = None


@app.get("/")
def root():
    return {"ok": True, "hint": "GET /threads, GET /threads/{chat_id}/messages, POST /ask"}


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


@app.post("/ask")
def ask_endpoint(body: AskBody):
    """Semantic Q&A over your messages. Requires GEMINI_API_KEY."""
    try:
        return ask(query=body.query.strip(), thread_ids=body.thread_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
