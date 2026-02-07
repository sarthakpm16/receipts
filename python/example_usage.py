"""
Example usage of the iMessage processor module.
This demonstrates how to use the processing functions in a UI application.
"""

from imessage_processor import (
    process_all,
    search_messages,
    get_drama_summary,
    get_all_chat_names,
)

def main():
    """
    Example workflow for processing and querying iMessage data.
    """
    
    # Step 1: Process all data (run once, or when data updates)
    print("Processing iMessage data...")
    print("=" * 60)
    df, summaries = process_all()
    
    # Step 2: Example semantic search queries
    print("\n" + "=" * 60)
    print("Example: Semantic Search")
    print("=" * 60)
    
    queries = [
        "deadline",
        "meeting tomorrow",
        "urgent",
        "thanks",
    ]
    
    for query in queries:
        print(f"\nSearching for: '{query}'")
        results = search_messages(query, top_k=3)
        
        if results:
            for i, result in enumerate(results, 1):
                print(f"\n  Result {i}:")
                print(f"    Chat: {result['chat_name']}")
                print(f"    Sender: {result['sender']}")
                print(f"    Text: {result['text'][:80]}...")
                print(f"    Similarity: {result['similarity_score']:.3f}")
        else:
            print("  No results found")
    
    # Step 3: Example drama summaries
    print("\n" + "=" * 60)
    print("Example: Drama Summaries")
    print("=" * 60)
    
    chat_names = get_all_chat_names()
    print(f"\nFound {len(chat_names)} chats")
    
    # Show summary for first few chats
    for chat_name in chat_names[:3]:
        print(f"\n{'=' * 60}")
        print(f"Chat: {chat_name}")
        print("=" * 60)
        
        summary = get_drama_summary(chat_name)
        if summary:
            print(f"Total Messages: {summary['total_messages']}")
            print(f"Average Sentiment: {summary['avg_sentiment']:.3f}")
            print(f"Top Drama Threads: {len(summary['top_drama_threads'])}")
            print(f"Top Keywords: {', '.join(summary['top_keywords'][:10])}")
            
            if summary['top_drama_threads']:
                print("\nMost Dramatic Threads:")
                for i, thread in enumerate(summary['top_drama_threads'][:3], 1):
                    print(f"\n  Thread {i}:")
                    print(f"    Sentiment: {thread['sentiment_avg']:.3f}")
                    print(f"    Length: {thread['thread_length']} messages")
                    print(f"    Summary: {thread['summary'][:100]}...")
        else:
            print("No summary available")


if __name__ == "__main__":
    main()
