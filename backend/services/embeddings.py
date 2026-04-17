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


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL)


def embed_text(text: str) -> NDArray[np.float32]:
    model = _get_model()
    vector = model.encode([text], convert_to_numpy=True)[0]
    return np.asarray(vector, dtype=np.float32)


def embed_image(image_path: str | Path) -> NDArray[np.float32]:
    model = _get_model()
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        vector = model.encode([img], convert_to_numpy=True)[0]
    return np.asarray(vector, dtype=np.float32)
