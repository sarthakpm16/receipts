from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.imessage_store import list_threads, get_messages

app = FastAPI(title="iMessage Local API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev; later you can lock this down
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"ok": True, "hint": "GET /threads or GET /threads/{chat_id}/messages"}

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
