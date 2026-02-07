from pathlib import Path
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

msgs = pd.read_parquet(DATA_DIR / "messages_cleaned.parquet")

# Keep only text messages; newest 5000 for fast UI iteration
preview = msgs[msgs["text"].str.len() > 0].sort_values("timestamp_unix").tail(5000)

out = DATA_DIR / "messages_preview.parquet"
preview.to_parquet(out, index=False)
print("✅ Wrote", out, "rows:", len(preview))
