from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "clip-ViT-B-32").strip()

HOST = os.environ.get("HOST", "0.0.0.0").strip()
PORT = _get_int("PORT", 8000)

# Hybrid ranking weights (should sum to ~1.0)
WEIGHT_SEMANTIC = _get_float("WEIGHT_SEMANTIC", 0.5)
WEIGHT_FTS = _get_float("WEIGHT_FTS", 0.2)
WEIGHT_PAGERANK = _get_float("WEIGHT_PAGERANK", 0.2)
WEIGHT_FRESHNESS = _get_float("WEIGHT_FRESHNESS", 0.1)

SEARCH_CANDIDATES = _get_int("SEARCH_CANDIDATES", 50)
SEARCH_LIMIT = _get_int("SEARCH_LIMIT", 10)


def require_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in."
        )
    return DATABASE_URL
