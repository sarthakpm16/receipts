"""
iMessage Assistant - Local Processing Module
Handles embeddings, drama detection, and conversation summaries.
All processing is done locally with no API calls.
"""

import pandas as pd
import numpy as np
import json
import os
from pathlib import Path
from collections import Counter
from typing import List, Dict, Tuple, Optional
import faiss
from sentence_transformers import SentenceTransformer
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from tqdm import tqdm
import pickle

# Configuration
DATA_DIR = Path(__file__).parent / "data"
EMBEDDINGS_DIR = Path(__file__).parent / "embeddings"
CSV_PATH = DATA_DIR / "messages_cleaned.csv"
FAISS_INDEX_PATH = EMBEDDINGS_DIR / "faiss_index"
EMBEDDINGS_MAP_PATH = EMBEDDINGS_DIR / "message_id_map.pkl"
DRAMA_SUMMARY_PATH = DATA_DIR / "drama_summary.json"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
EMBEDDINGS_DIR.mkdir(exist_ok=True)

# Global variables for caching
_text_model = None
_sentiment_analyzer = None
_faiss_index = None
_message_id_map = None
_embeddings_array = None


def load_data() -> pd.DataFrame:
    """
    Step 1: Load Data
    Load messages_cleaned.csv using pandas.
    Ensure text is string type and no missing message_id.
    """
    print("Loading data from CSV...")
    df = pd.read_csv(CSV_PATH)
    
    # Ensure text is string type
    df['text'] = df['text'].astype(str)
    
    # Remove rows with missing message_id
    initial_count = len(df)
    df = df.dropna(subset=['message_id'])
    removed_count = initial_count - len(df)
    if removed_count > 0:
        print(f"Removed {removed_count} rows with missing message_id")
    
    # Ensure message_id is unique
    df = df.drop_duplicates(subset=['message_id'])
    
    print(f"Loaded {len(df)} messages")
    return df


def generate_text_embeddings(df: pd.DataFrame) -> Tuple[np.ndarray, Dict[int, str]]:
    """
    Step 2: Generate Text Embeddings
    Use sentence-transformers (all-MiniLM-L6-v2) to generate embeddings for all messages.
    Save the embeddings in a numpy array linked to message_id.
    Build a FAISS index for semantic search.
    """
    global _text_model
    
    print("Generating text embeddings...")
    
    # Load model (cached after first load)
    if _text_model is None:
        print("Loading sentence-transformer model (all-MiniLM-L6-v2)...")
        _text_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Generate embeddings for all messages
    texts = df['text'].tolist()
    embeddings = _text_model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    
    # Create mapping from index to message_id
    message_id_map = {i: str(msg_id) for i, msg_id in enumerate(df['message_id'])}
    
    print(f"Generated {len(embeddings)} embeddings with dimension {embeddings.shape[1]}")
    
    return embeddings, message_id_map


def build_faiss_index(embeddings: np.ndarray, message_id_map: Dict[int, str]) -> faiss.Index:
    """
    Build FAISS index for semantic search.
    """
    print("Building FAISS index...")
    
    dimension = embeddings.shape[1]
    
    # Normalize embeddings for cosine similarity
    faiss.normalize_L2(embeddings)
    
    # Create FAISS index (using Inner Product for cosine similarity after normalization)
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings.astype('float32'))
    
    print(f"FAISS index built with {index.ntotal} vectors")
    
    return index


def save_embeddings(embeddings: np.ndarray, message_id_map: Dict[int, str], index: faiss.Index):
    """
    Save embeddings, FAISS index, and message_id mapping.
    """
    print("Saving embeddings and FAISS index...")
    
    # Save FAISS index
    faiss.write_index(index, str(FAISS_INDEX_PATH))
    
    # Save message_id mapping
    with open(EMBEDDINGS_MAP_PATH, 'wb') as f:
        pickle.dump(message_id_map, f)
    
    # Save embeddings array
    np.save(EMBEDDINGS_DIR / "embeddings.npy", embeddings)
    
    print(f"Saved FAISS index to {FAISS_INDEX_PATH}")
    print(f"Saved message_id map to {EMBEDDINGS_MAP_PATH}")


def load_embeddings() -> Tuple[faiss.Index, Dict[int, str], np.ndarray]:
    """
    Load saved embeddings and FAISS index.
    """
    global _faiss_index, _message_id_map, _embeddings_array
    
    if _faiss_index is None and FAISS_INDEX_PATH.exists():
        print("Loading FAISS index...")
        _faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        
        with open(EMBEDDINGS_MAP_PATH, 'rb') as f:
            _message_id_map = pickle.load(f)
        
        embeddings_path = EMBEDDINGS_DIR / "embeddings.npy"
        if embeddings_path.exists():
            _embeddings_array = np.load(embeddings_path)
    
    return _faiss_index, _message_id_map, _embeddings_array


def generate_image_embeddings(df: pd.DataFrame) -> Optional[Dict[str, np.ndarray]]:
    """
    Step 3 (Optional): Image Embeddings
    If attachment_path is present and is an image, generate CLIP embeddings.
    Store image embeddings and link to message IDs for multimodal search.
    """
    try:
        import torch
        from transformers import CLIPProcessor, CLIPModel
        from PIL import Image
    except ImportError:
        print("CLIP dependencies not available. Skipping image embeddings.")
        return None
    
    print("Generating image embeddings (if any)...")
    
    # Filter messages with image attachments
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    image_messages = df[
        df['attachment_path'].notna() & 
        df['attachment_path'].astype(str).str.lower().str.endswith(tuple(image_extensions))
    ]
    
    if len(image_messages) == 0:
        print("No image attachments found.")
        return None
    
    print(f"Found {len(image_messages)} messages with image attachments")
    
    # Load CLIP model
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    image_embeddings = {}
    
    for idx, row in tqdm(image_messages.iterrows(), total=len(image_messages), desc="Processing images"):
        attachment_path = row['attachment_path']
        message_id = str(row['message_id'])
        
        try:
            if os.path.exists(attachment_path):
                image = Image.open(attachment_path)
                inputs = processor(images=image, return_tensors="pt")
                with torch.no_grad():
                    image_features = model.get_image_features(**inputs)
                image_embeddings[message_id] = image_features.numpy().flatten()
        except Exception as e:
            print(f"Error processing image {attachment_path}: {e}")
            continue
    
    # Save image embeddings
    if image_embeddings:
        with open(EMBEDDINGS_DIR / "image_embeddings.pkl", 'wb') as f:
            pickle.dump(image_embeddings, f)
        print(f"Saved {len(image_embeddings)} image embeddings")
    
    return image_embeddings


def detect_drama(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 4: Drama Detection
    Perform sentiment analysis on text using VADER.
    Add a column sentiment to the DataFrame.
    Detect "drama threads" by identifying consecutive messages with strongly negative sentiment.
    """
    global _sentiment_analyzer
    
    print("Performing sentiment analysis...")
    
    if _sentiment_analyzer is None:
        _sentiment_analyzer = SentimentIntensityAnalyzer()
    
    # Calculate sentiment scores
    sentiment_scores = []
    for text in tqdm(df['text'], desc="Analyzing sentiment"):
        scores = _sentiment_analyzer.polarity_scores(text)
        sentiment_scores.append(scores)
    
    # Add sentiment columns
    df['sentiment_compound'] = [s['compound'] for s in sentiment_scores]
    df['sentiment_positive'] = [s['pos'] for s in sentiment_scores]
    df['sentiment_negative'] = [s['neg'] for s in sentiment_scores]
    df['sentiment_neutral'] = [s['neu'] for s in sentiment_scores]
    
    print(f"Sentiment analysis complete. Negative messages: {(df['sentiment_compound'] < -0.5).sum()}")
    
    return df


def find_drama_threads(df: pd.DataFrame) -> List[Dict]:
    """
    Identify consecutive messages or threads where sentiment is strongly negative.
    Aggregate by chat_name and time to find top dramatic conversations.
    """
    print("Detecting drama threads...")
    
    # Sort by chat_name and timestamp
    df_sorted = df.sort_values(['chat_name', 'timestamp']).copy()
    
    # Identify negative messages
    df_sorted['is_negative'] = df_sorted['sentiment_compound'] < -0.5
    
    drama_threads = []
    
    # Group by chat_name
    for chat_name, chat_df in df_sorted.groupby('chat_name'):
        chat_df = chat_df.reset_index(drop=True)
        
        # Find consecutive negative message sequences
        current_thread = []
        for idx, row in chat_df.iterrows():
            if row['is_negative']:
                current_thread.append({
                    'message_id': str(row['message_id']),
                    'text': row['text'],
                    'sender': row['sender'],
                    'timestamp': row['timestamp'],
                    'sentiment': row['sentiment_compound']
                })
            else:
                # End of thread
                if len(current_thread) >= 2:  # At least 2 consecutive negative messages
                    avg_sentiment = np.mean([m['sentiment'] for m in current_thread])
                    drama_threads.append({
                        'chat_name': chat_name,
                        'message_ids': [m['message_id'] for m in current_thread],
                        'messages': current_thread,
                        'sentiment_avg': float(avg_sentiment),
                        'thread_length': len(current_thread)
                    })
                current_thread = []
        
        # Handle thread at end of chat
        if len(current_thread) >= 2:
            avg_sentiment = np.mean([m['sentiment'] for m in current_thread])
            drama_threads.append({
                'chat_name': chat_name,
                'message_ids': [m['message_id'] for m in current_thread],
                'messages': current_thread,
                'sentiment_avg': float(avg_sentiment),
                'thread_length': len(current_thread)
            })
    
    # Sort by sentiment (most negative first) and thread length
    drama_threads.sort(key=lambda x: (x['sentiment_avg'], -x['thread_length']))
    
    print(f"Found {len(drama_threads)} drama threads")
    
    return drama_threads


def extract_keywords(df: pd.DataFrame, drama_threads: List[Dict], top_n: int = 20) -> List[str]:
    """
    Extract top recurring keywords in negative threads.
    """
    print("Extracting keywords from drama threads...")
    
    # Get all message IDs from drama threads
    drama_message_ids = set()
    for thread in drama_threads:
        drama_message_ids.update(thread['message_ids'])
    
    # Filter dataframe to drama messages
    drama_df = df[df['message_id'].astype(str).isin(drama_message_ids)]
    
    # Simple keyword extraction (split by whitespace, remove short words)
    all_words = []
    for text in drama_df['text']:
        words = text.lower().split()
        # Filter out very short words and common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'}
        words = [w.strip('.,!?;:()[]{}"\'-') for w in words if len(w) > 3 and w not in stop_words]
        all_words.extend(words)
    
    # Count keywords
    word_counter = Counter(all_words)
    top_keywords = [word for word, count in word_counter.most_common(top_n)]
    
    print(f"Extracted {len(top_keywords)} top keywords")
    
    return top_keywords


def generate_conversation_summaries(df: pd.DataFrame, drama_threads: List[Dict], top_keywords: List[str]) -> Dict:
    """
    Step 5: Conversation Summaries
    Generate extractive summaries for each chat highlighting:
    - Most negative/dramatic threads
    - Key topics and recurring keywords
    - Sentiment over time
    """
    print("Generating conversation summaries...")
    
    summaries = {}
    
    # Group by chat_name
    for chat_name, chat_df in df.groupby('chat_name'):
        chat_df = chat_df.sort_values('timestamp')
        
        # Get drama threads for this chat
        chat_drama_threads = [t for t in drama_threads if t['chat_name'] == chat_name]
        chat_drama_threads = sorted(chat_drama_threads, key=lambda x: x['sentiment_avg'])[:10]  # Top 10 most dramatic
        
        # Calculate sentiment over time (simplified - by message order)
        sentiment_over_time = [
            {
                'timestamp': str(row['timestamp']),
                'sentiment': float(row['sentiment_compound']),
                'message_id': str(row['message_id'])
            }
            for _, row in chat_df.iterrows()
        ]
        
        # Format drama threads for output
        formatted_threads = []
        for thread in chat_drama_threads:
            # Create a summary from the messages
            messages_text = ' '.join([m['text'][:100] for m in thread['messages'][:3]])  # First 3 messages, truncated
            summary = f"{messages_text}..." if len(messages_text) > 200 else messages_text
            
            formatted_threads.append({
                'message_ids': thread['message_ids'],
                'summary': summary,
                'sentiment_avg': thread['sentiment_avg'],
                'thread_length': thread['thread_length']
            })
        
        summaries[chat_name] = {
            'chat_name': chat_name,
            'top_drama_threads': formatted_threads,
            'sentiment_over_time': sentiment_over_time[:100],  # Limit to 100 points for performance
            'top_keywords': top_keywords,
            'total_messages': len(chat_df),
            'avg_sentiment': float(chat_df['sentiment_compound'].mean())
        }
    
    return summaries


def save_drama_summary(summaries: Dict):
    """
    Save drama summary to JSON file.
    """
    print(f"Saving drama summary to {DRAMA_SUMMARY_PATH}...")
    
    # Convert to list format for JSON
    summary_list = list(summaries.values())
    
    with open(DRAMA_SUMMARY_PATH, 'w', encoding='utf-8') as f:
        json.dump(summary_list, f, indent=2, ensure_ascii=False)
    
    print(f"Saved summaries for {len(summary_list)} chats")


def process_all():
    """
    Main processing function that runs all steps.
    """
    print("=" * 60)
    print("iMessage Assistant - Local Processing")
    print("=" * 60)
    
    # Step 1: Load Data
    df = load_data()
    
    # Step 2: Generate Text Embeddings
    embeddings, message_id_map = generate_text_embeddings(df)
    
    # Build and save FAISS index
    index = build_faiss_index(embeddings, message_id_map)
    save_embeddings(embeddings, message_id_map, index)
    
    # Step 3 (Optional): Image Embeddings
    generate_image_embeddings(df)
    
    # Step 4: Drama Detection
    df = detect_drama(df)
    drama_threads = find_drama_threads(df)
    
    # Extract keywords
    top_keywords = extract_keywords(df, drama_threads)
    
    # Step 5: Conversation Summaries
    summaries = generate_conversation_summaries(df, drama_threads, top_keywords)
    save_drama_summary(summaries)
    
    print("=" * 60)
    print("Processing complete!")
    print("=" * 60)
    
    return df, summaries


# ============================================================================
# Step 6: Query Functions for UI
# ============================================================================

def search_messages(query: str, top_k: int = 5) -> List[Dict]:
    """
    Search messages using semantic search.
    
    Args:
        query: Search query string
        top_k: Number of results to return
    
    Returns:
        List of dictionaries with message_id, text, sender, timestamp, chat_name
    """
    global _text_model, _faiss_index, _message_id_map, _embeddings_array
    
    # Load model and index if not already loaded
    if _text_model is None:
        _text_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    if _faiss_index is None:
        _faiss_index, _message_id_map, _embeddings_array = load_embeddings()
        
        if _faiss_index is None:
            raise ValueError("FAISS index not found. Please run process_all() first.")
    
    # Load original dataframe to get message details
    df = pd.read_csv(CSV_PATH)
    
    # Embed query
    query_embedding = _text_model.encode([query], convert_to_numpy=True)
    faiss.normalize_L2(query_embedding)
    
    # Search FAISS index
    distances, indices = _faiss_index.search(query_embedding.astype('float32'), top_k)
    
    # Get results
    results = []
    for idx, dist in zip(indices[0], distances[0]):
        if idx < 0:  # Invalid index
            continue
        
        message_id = _message_id_map.get(idx)
        if message_id:
            message_row = df[df['message_id'].astype(str) == message_id]
            if not message_row.empty:
                row = message_row.iloc[0]
                results.append({
                    'message_id': str(row['message_id']),
                    'text': str(row['text']),
                    'sender': str(row['sender']),
                    'timestamp': str(row['timestamp']),
                    'chat_name': str(row['chat_name']),
                    'similarity_score': float(dist)
                })
    
    return results


def get_drama_summary(chat_name: str) -> Optional[Dict]:
    """
    Get drama summary for a specific chat.
    
    Args:
        chat_name: Name of the chat to get summary for
    
    Returns:
        Dictionary with top drama threads, sentiment timeline, and keywords
    """
    if not DRAMA_SUMMARY_PATH.exists():
        raise ValueError("Drama summary not found. Please run process_all() first.")
    
    with open(DRAMA_SUMMARY_PATH, 'r', encoding='utf-8') as f:
        summaries = json.load(f)
    
    # Find summary for this chat
    for summary in summaries:
        if summary['chat_name'] == chat_name:
            return summary
    
    return None


def get_all_chat_names() -> List[str]:
    """
    Get list of all chat names from the drama summary.
    """
    if not DRAMA_SUMMARY_PATH.exists():
        # Fallback to CSV if summary doesn't exist
        df = pd.read_csv(CSV_PATH)
        return df['chat_name'].unique().tolist()
    
    with open(DRAMA_SUMMARY_PATH, 'r', encoding='utf-8') as f:
        summaries = json.load(f)
    
    return [s['chat_name'] for s in summaries]


if __name__ == "__main__":
    # Run full processing pipeline
    df, summaries = process_all()
    
    # Example usage of query functions
    print("\n" + "=" * 60)
    print("Example: Searching for messages")
    print("=" * 60)
    results = search_messages("deadline", top_k=3)
    for result in results:
        print(f"\nChat: {result['chat_name']}")
        print(f"Sender: {result['sender']}")
        print(f"Text: {result['text'][:100]}...")
        print(f"Similarity: {result['similarity_score']:.3f}")
    
    print("\n" + "=" * 60)
    print("Example: Getting drama summary")
    print("=" * 60)
    chat_names = get_all_chat_names()
    if chat_names:
        summary = get_drama_summary(chat_names[0])
        if summary:
            print(f"\nChat: {summary['chat_name']}")
            print(f"Total Messages: {summary['total_messages']}")
            print(f"Average Sentiment: {summary['avg_sentiment']:.3f}")
            print(f"Top Drama Threads: {len(summary['top_drama_threads'])}")
            print(f"Top Keywords: {', '.join(summary['top_keywords'][:10])}")
