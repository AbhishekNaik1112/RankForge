from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from pathlib import Path

import numpy as np
import structlog
from numpy.typing import NDArray
from PIL import Image
from sentence_transformers import SentenceTransformer

from settings import EMBEDDING_MODEL

# CLIP models produce 512-dim embeddings; pure-text models like MiniLM produce 384.
# Downstream code expects 512 (matches the DB VECTOR(512) column).

logger = structlog.get_logger(__name__)

# CLIP truncates input at 77 BPE tokens. ~280 chars of typical English ≈ 77
# tokens; dense Unicode (CJK, emoji-heavy) hits 77 sooner. We warn above this
# threshold; the embed itself succeeds but the suffix is silently dropped.
CLIP_CHAR_WARN_THRESHOLD = 280

_model_loaded = False


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    global _model_loaded
    model = SentenceTransformer(EMBEDDING_MODEL)
    _model_loaded = True
    return model


def is_model_loaded() -> bool:
    """True once the embedding model has been instantiated and is ready to encode."""
    return _model_loaded


def warmup() -> None:
    """Eagerly load the model. Called from FastAPI lifespan so the first ingest
    doesn't pay the ~30 s cold-start cost. Safe to call multiple times."""
    _get_model()


def _normalize_text(text: str) -> str:
    """NFKC normalize, strip, and collapse internal whitespace.

    Without this, two visually-identical strings can produce different
    embeddings (NFC vs NFD, smart vs ascii quotes, repeated whitespace, BOMs,
    fullwidth vs ascii digits, etc.). Applied uniformly at ingest and query
    time so the same string always maps to the same vector.
    """
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.replace("​", "").replace("﻿", "")
    return re.sub(r"\s+", " ", normalized).strip()


def embed_text(text: str) -> NDArray[np.float32]:
    model = _get_model()
    normalized = _normalize_text(text)
    if len(normalized) > CLIP_CHAR_WARN_THRESHOLD:
        logger.warning(
            "embed_text_long_input",
            char_count=len(normalized),
            warn_threshold=CLIP_CHAR_WARN_THRESHOLD,
            note="CLIP truncates at 77 tokens; long input loses information silently",
        )
    vector = model.encode([normalized], convert_to_numpy=True)[0]
    return np.asarray(vector, dtype=np.float32)


def embed_batch(texts: list[str], batch_size: int = 32) -> list[NDArray[np.float32]]:
    """Embed many texts in one call. Sentence-Transformers batches internally;
    this is significantly faster than looping over embed_text()."""
    if not texts:
        return []
    model = _get_model()
    normalized = [_normalize_text(t) for t in texts]
    over_threshold = sum(1 for t in normalized if len(t) > CLIP_CHAR_WARN_THRESHOLD)
    if over_threshold > 0:
        logger.warning(
            "embed_batch_truncations",
            chunks_over_threshold=over_threshold,
            total_chunks=len(normalized),
        )
    vectors = model.encode(normalized, convert_to_numpy=True, batch_size=batch_size)
    return [np.asarray(v, dtype=np.float32) for v in vectors]


def embed_image(image_path: str | Path) -> NDArray[np.float32]:
    model = _get_model()
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        vector = model.encode([img], convert_to_numpy=True)[0]
    return np.asarray(vector, dtype=np.float32)
