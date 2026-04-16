from __future__ import annotations

from functools import lru_cache

import numpy as np
from numpy.typing import NDArray
from sentence_transformers import SentenceTransformer

from settings import EMBEDDING_MODEL


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL)


def embed_text(text: str) -> NDArray[np.float32]:
    model = _get_model()
    vector = model.encode([text])[0]
    return np.asarray(vector, dtype=np.float32)
