# Receipts App

A monorepo project with separate frontend and backend directories to minimize merge conflicts between team members.

## Project Structure

```
receipts/
├── frontend/          # Next.js TypeScript frontend
│   ├── src/
│   │   └── app/      # Next.js App Router
│   ├── package.json
│   └── tsconfig.json
├── backend/           # Express.js TypeScript backend
│   ├── src/
│   │   └── index.ts  # Backend entry point
│   ├── package.json
│   └── tsconfig.json
├── python/            # Python ML processing module
│   ├── imessage_processor.py  # Main processing script
│   ├── data/          # CSV data and outputs
│   ├── embeddings/    # FAISS indices and embeddings
│   └── requirements.txt
└── package.json       # Root workspace configuration
```

## Getting Started

### Install Dependencies

Install all dependencies for both frontend and backend:

```bash
npm install
```

This will install dependencies for both workspaces automatically.

### Development

Run both frontend and backend in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Frontend only (runs on http://localhost:3000)
npm run dev:frontend

# Backend only (runs on http://localhost:3001)
npm run dev:backend
```

### Building

Build both frontend and backend:

```bash
npm run build
```

Or build separately:

```bash
npm run build:frontend
npm run build:backend
```

## Workspace Commands

You can also run commands directly in each workspace:

```bash
# Frontend
cd frontend
npm run dev

# Backend
cd backend
npm run dev
```

## Python ML Module

The `python/` directory contains the iMessage processing module for embeddings, drama detection, and conversation summaries.

### Setup

```bash
cd python
pip install -r requirements.txt
```

### Usage

See `python/README.md` for detailed documentation.

Quick start:

```python
from imessage_processor import process_all, search_messages, get_drama_summary

# Process all data
df, summaries = process_all()

# Search messages
results = search_messages("deadline", top_k=5)

# Get drama summary
summary = get_drama_summary("Chat Name")
```

## Team Workflow

- **Frontend developer**: Work in the `frontend/` directory
- **Backend developer**: Work in the `backend/` directory
- **ML/Python developer**: Work in the `python/` directory

This separation minimizes merge conflicts as each team member works in their own directory.
