from pathlib import Path
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

msgs = pd.read_parquet(DATA_DIR / "messages_cleaned.parquet")

chats = (
    msgs.groupby(["chat_id", "chat_name", "is_group"], as_index=False)
        .agg(
            message_count=("message_id", "count"),
            last_timestamp_unix=("timestamp_unix", "max"),
            participants=("participants", "first"),
        )
        .sort_values("last_timestamp_unix", ascending=False)
)

out = DATA_DIR / "chats_cleaned.parquet"
chats.to_parquet(out, index=False)
print("✅ Wrote", out, "rows:", len(chats))
