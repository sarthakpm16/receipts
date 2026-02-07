# iMessage Assistant - Python Processing Module

Local, privacy-first processing for iMessage data including embeddings, drama detection, and conversation summaries.

## Setup

### Prerequisites

- Python 3.8+
- macOS (for iMessage data access)

### Installation

```bash
cd python
pip install -r requirements.txt
```

## Data Format

Place your cleaned CSV file at `python/data/messages_cleaned.csv` with the following columns:

- `message_id` (unique ID, required)
- `chat_name` (group or one-on-one)
- `sender`
- `text`
- `timestamp`
- `chat_type` (one-on-one or group)
- `attachment_path` (optional, may be null)

## Usage

### Full Processing Pipeline

Run the complete processing pipeline:

```python
from imessage_processor import process_all

# This will:
# 1. Load data from CSV
# 2. Generate text embeddings
# 3. Build FAISS index
# 4. Detect drama threads
# 5. Generate conversation summaries
df, summaries = process_all()
```

Or run from command line:

```bash
python imessage_processor.py
```

### Query Functions for UI

#### Semantic Search

```python
from imessage_processor import search_messages

# Search for messages semantically
results = search_messages("deadline approaching", top_k=5)

for result in results:
    print(f"Chat: {result['chat_name']}")
    print(f"Sender: {result['sender']}")
    print(f"Text: {result['text']}")
    print(f"Similarity: {result['similarity_score']}")
```

#### Get Drama Summary

```python
from imessage_processor import get_drama_summary, get_all_chat_names

# Get all chat names
chat_names = get_all_chat_names()

# Get summary for a specific chat
summary = get_drama_summary("Family Group Chat")

if summary:
    print(f"Total Messages: {summary['total_messages']}")
    print(f"Average Sentiment: {summary['avg_sentiment']}")
    print(f"Top Drama Threads: {len(summary['top_drama_threads'])}")
    for thread in summary['top_drama_threads'][:3]:
        print(f"  - Sentiment: {thread['sentiment_avg']:.2f}")
        print(f"    Summary: {thread['summary']}")
```

## Output Files

After processing, the following files will be created:

- `embeddings/faiss_index` - FAISS index for semantic search
- `embeddings/message_id_map.pkl` - Mapping from index to message IDs
- `embeddings/embeddings.npy` - Saved embeddings array
- `embeddings/image_embeddings.pkl` - Image embeddings (if any images found)
- `data/drama_summary.json` - Conversation summaries with drama detection

## Features

- **Local Processing**: All computation happens locally, no API calls
- **Semantic Search**: FAISS-based vector search for finding relevant messages
- **Drama Detection**: VADER sentiment analysis to identify negative conversation threads
- **Conversation Summaries**: Extract key topics, drama threads, and sentiment trends
- **Multimodal Support**: Optional CLIP embeddings for image attachments
- **Caching**: Embeddings and indices are cached for fast subsequent queries

## Performance

- First run: Generates embeddings and builds indices (may take several minutes)
- Subsequent queries: Fast semantic search using cached FAISS index
- Memory efficient: Uses normalized embeddings and efficient indexing

## Privacy

- All processing is done locally
- No data is sent to external APIs
- Models are downloaded once and cached locally
- All intermediate data stored in local files
