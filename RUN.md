# How to run this project

**Already processed?** If you ran the import (or equivalent) outside Cursor and have **`data/processed.db`** in this project, skip to [Run the FastAPI backend](#3-run-the-fastapi-backend-threads--messages-api) and then [Run the frontend](#4-install-and-run-the-frontend). You only need the import step when you have raw `input/chat.db` and `input/contacts.vcf` and no `data/processed.db` yet.

---

## 1. Put your data in `input/` (only if you need to import)

If you still need to run the import:

- **`input/chat.db`** — Your iMessage database (copy from your Mac or export).
- **`input/contacts.vcf`** — Your contacts file (you already have this).

If you have WAL mode files, you can also add:
- `input/chat.db-wal`
- `input/chat.db-shm`

---

## 2. Import messages and contacts (skip if you already have `data/processed.db`)

Only run this if you have raw **`input/chat.db`** and **`input/contacts.vcf`** and do **not** yet have **`data/processed.db`**. If you already processed outside Cursor and put `processed.db` in **`data/`**, skip this step.

From the **project root** (where `package.json` and `scripts/` are):

```bash
python scripts/import_imessage.py
```

On macOS/Linux you can use the Makefile instead:

```bash
make imessage
```

This will:

- Read `input/chat.db` and optionally `input/contacts.vcf`
- Resolve contact names from the VCF
- Build threads and messages
- Write **`data/processed.db`** (SQLite)

You should see: **`Done → data/processed.db`**

**Check that it worked:**

```bash
sqlite3 data/processed.db "SELECT chat_id, title, last_message_at FROM threads ORDER BY last_message_at DESC LIMIT 10;"
```

(On Windows without `sqlite3` in PATH, use a SQLite GUI or skip this step.)

---

## 3. Run the FastAPI backend (threads + messages API)

From the **project root**, in a terminal:

```bash
pip install -r app/requirements.txt
uvicorn app.main:app --reload
```

API runs at **http://localhost:8000**:

- **GET /** — health / hint
- **GET /threads** — list threads (from `data/processed.db`)
- **GET /threads/{chat_id}/messages** — messages for a thread
- **POST /ask** — semantic Q&A over your messages (uses Gemini; see below)

### Ask mode (semantic Q&A)

The **Ask** tab in the app sends your question plus recent message context to **Google Gemini** and shows a short answer and which chats were used. To enable it:

1. Get an API key: [Google AI Studio](https://aistudio.google.com/apikey)
2. Put it in a file the backend can read (project root):
   - Create or edit **`.env`** or **`.env.local`** in the project root (same folder as `package.json`).
   - Add one line: **`GEMINI_API_KEY=your-key-here`** (no quotes unless the key has spaces).
3. Restart the API: `uvicorn app.main:app --reload`

The backend loads `.env` and `.env.local` automatically. Alternatively you can set the variable in the terminal before starting the API:  
`$env:GEMINI_API_KEY="your-key"` (PowerShell) or `export GEMINI_API_KEY=your-key` (macOS/Linux).

If `GEMINI_API_KEY` is not set, the Ask endpoint returns 400 with a message to set it.

### If you see `ModuleNotFoundError: No module named 'anyio._backends'` (500 on /threads)

This usually means a broken or mixed install of `anyio` (e.g. user vs system site-packages). Fix it by using a **virtual environment** and reinstalling:

```bash
# From project root
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Windows (Cmd) or macOS/Linux
# .venv\Scripts\activate   or   source .venv/bin/activate

pip install -r app/requirements.txt
uvicorn app.main:app --reload
```

If you already use a venv and still see the error, try:

```bash
pip install --upgrade anyio starlette fastapi uvicorn
```

---

## 4. Install and run the frontend

In **another terminal**, from the project root:

```bash
npm install
npm run dev:frontend
```

Or from the frontend folder:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Summary

| Step | When | Command | Result |
|------|------|---------|--------|
| 1 | Only if importing from raw files | Put `chat.db` + `contacts.vcf` in `input/` | Data ready to import |
| 2 | Only if you don’t have `data/processed.db` | `python scripts/import_imessage.py` | Creates `data/processed.db` |
| 3 | Always | `pip install -r app/requirements.txt` then `uvicorn app.main:app --reload` | FastAPI at http://localhost:8000 |
| 4 | Always | `npm run dev:frontend` | Frontend at http://localhost:3000 |

If you already have **`data/processed.db`**, run **step 3** (FastAPI) and **step 4** (frontend). The Node backend (`npm run dev:backend`) is optional and runs on port 3001 if you still use it.

---

## Using real data in the UI

The FastAPI app (**`app/main.py`**) already exposes **`data/processed.db`** via:

- **GET /threads** — list of threads
- **GET /threads/{chat_id}/messages** — messages for a chat

Wire the frontend to **http://localhost:8000** (e.g. fetch `/threads` and `/threads/{id}/messages`) instead of `mockSearchData` to show your real threads and messages.
