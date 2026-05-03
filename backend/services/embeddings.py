from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
from numpy.typing import NDArray
from PIL import Image
from sentence_transformers import SentenceTransformer

from settings import EMBEDDING_MODEL

# CLIP models produce 512-dim embeddings; pure-text models like MiniLM produce 384.
# Downstream code expects 512 (matches the DB VECTOR(512) column).

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


def embed_text(text: str) -> NDArray[np.float32]:
    model = _get_model()
    vector = model.encode([text], convert_to_numpy=True)[0]
    return np.asarray(vector, dtype=np.float32)


def embed_batch(texts: list[str], batch_size: int = 32) -> list[NDArray[np.float32]]:
    """Embed many texts in one call. Sentence-Transformers batches internally;
    this is significantly faster than looping over embed_text()."""
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(texts, convert_to_numpy=True, batch_size=batch_size)
    return [np.asarray(v, dtype=np.float32) for v in vectors]


def embed_image(image_path: str | Path) -> NDArray[np.float32]:
    model = _get_model()
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        vector = model.encode([img], convert_to_numpy=True)[0]
    return np.asarray(vector, dtype=np.float32)
