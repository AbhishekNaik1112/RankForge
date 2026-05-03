"""Cross-encoder reranker.

After RRF gives us a coarse top-K ordering, we rerank the head with a
cross-encoder that scores each (query, document) pair jointly. This catches
semantic nuance that bag-of-signals fusion misses (e.g., negation, paraphrase
beyond what CLIP sees in 77 tokens).

Model: BAAI/bge-reranker-v2-m3 — multilingual, ~568 MB on disk, ~30-50 ms
per pair on CPU. We rerank only the top RERANKER_TOP_N candidates so latency
stays in the 500-800 ms range per search.

Lifecycle mirrors embeddings.py: lazy load via lru_cache, eager warmup at
startup, is_loaded() reflected in /health.
"""
from __future__ import annotations

import uuid
from functools import lru_cache

import structlog
from sentence_transformers import CrossEncoder

logger = structlog.get_logger(__name__)

RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"

_model_loaded = False


@lru_cache(maxsize=1)
def _get_model() -> CrossEncoder:
    global _model_loaded
    logger.info("reranker_loading", model=RERANKER_MODEL)
    model = CrossEncoder(RERANKER_MODEL, max_length=512)
    _model_loaded = True
    logger.info("reranker_loaded", model=RERANKER_MODEL)
    return model


def is_model_loaded() -> bool:
    """True once the cross-encoder has been instantiated and is ready to score."""
    return _model_loaded


def warmup() -> None:
    """Eagerly load the reranker. Called from FastAPI lifespan after the
    embedding model is loaded so /health flips to ready only when both are up."""
    _get_model()


def rerank(
    query: str,
    docs: list[tuple[uuid.UUID, str]],
    top_n: int,
) -> list[uuid.UUID]:
    """Score each (query, doc_text) pair, return ids sorted desc, sliced to top_n.

    Empty or single-doc inputs short-circuit. `top_n <= 0` disables and returns
    the original order untouched (used for benchmarks and the kill-switch).
    """
    if top_n <= 0 or len(docs) <= 1:
        return [doc_id for doc_id, _ in docs]

    model = _get_model()
    pairs = [(query, text) for _, text in docs]
    scores = model.predict(pairs)
    ranked = sorted(zip(docs, scores), key=lambda x: float(x[1]), reverse=True)
    return [doc_id for (doc_id, _), _ in ranked[:top_n]]
