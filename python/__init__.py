"""
iMessage Assistant - Python Processing Module
"""

from .imessage_processor import (
    process_all,
    search_messages,
    get_drama_summary,
    get_all_chat_names,
    load_data,
    detect_drama,
)

__all__ = [
    'process_all',
    'search_messages',
    'get_drama_summary',
    'get_all_chat_names',
    'load_data',
    'detect_drama',
]
