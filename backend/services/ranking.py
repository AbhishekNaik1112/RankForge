from __future__ import annotations

import math
from datetime import datetime, timezone


def clamp01(value: float) -> float:
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def cosine_distance_to_similarity(distance: float) -> float:
    # pgvector cosine distance is typically (1 - cosine_similarity)
    return clamp01(1.0 - float(distance))


def freshness_boost(created_at: datetime, *, half_life_days: float = 30.0) -> float:
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_days = max(0.0, (now - created_at).total_seconds() / 86400.0)
    # Exponential decay: 1.0 for new, approaches 0 as it gets older
    decay = math.exp(-age_days / max(1e-6, half_life_days))
    return clamp01(decay)


def final_score(
    *,
    semantic_similarity: float,
    pagerank_norm: float,
    freshness: float,
    w_semantic: float,
    w_pagerank: float,
    w_freshness: float,
) -> float:
    return (
        (w_semantic * semantic_similarity)
        + (w_pagerank * pagerank_norm)
        + (w_freshness * freshness)
    )
