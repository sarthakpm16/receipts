.PHONY: imessage import verify

imessage: import verify

import:
	python3 scripts/import_imessage.py

verify:
	sqlite3 data/processed.db "SELECT chat_id, title, last_message_at FROM threads ORDER BY last_message_at DESC LIMIT 20;"
