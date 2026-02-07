from pathlib import Path
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

MESSAGES_PATH = DATA_DIR / "messages_cleaned.parquet"
ATTACHMENTS_PATH = DATA_DIR / "attachments_cleaned.parquet"

def load_messages() -> pd.DataFrame:
    return pd.read_parquet(MESSAGES_PATH)

def load_attachments() -> pd.DataFrame:
    return pd.read_parquet(ATTACHMENTS_PATH)

def load_messages_with_attachments() -> pd.DataFrame:
    m = load_messages()
    a = load_attachments()
    return m.merge(a, on="message_id", how="left")
