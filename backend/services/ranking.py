"""Hybrid ranking helpers.

The combiner is **Reciprocal Rank Fusion (RRF)** — replaces the previous
linear-blend of normalized scores. RRF treats each signal as a ranked list,
gives a doc credit `w_i / (k + rank_i)` for appearing at position `rank_i`,
and sums across signals. Two structural wins over linear blend:

1. **No score-scale calibration needed.** ts_rank_cd outputs ~0.01 while
   cosine_similarity outputs ~0.7 — linear blend silently weighted FTS lower
   than its weight suggested. RRF doesn't care about scale.
2. **Caps per-signal contribution.** A doc that's #1 on PageRank can only
   contribute `w_pr/(k+1)` from that signal. The hub can no longer steamroll
   queries by being a flat +0.2 boost on every result.

The per-signal score helpers (`cosine_distance_to_similarity`,
`fts_rank_to_score`, `freshness_boost`) are kept for **UI display only** —
the underlying signal values are useful in the score-breakdown bars; the
ranking logic itself is rank-based.
"""
from __future__ import annotations

import math
from collections.abc import Callable, Iterable
from datetime import datetime, timezone
from typing import Hashable, TypeVar

T = TypeVar("T")


def clamp01(value: float) -> float:
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def cosine_distance_to_similarity(distance: float | None) -> float:
    if distance is None:
        return 0.0
    return clamp01(1.0 - float(distance))


def fts_rank_to_score(rank: float | None, max_rank: float) -> float:
    """Normalize ts_rank_cd output to [0, 1] within the current candidate set."""
    if rank is None or max_rank <= 0.0:
        return 0.0
    return clamp01(float(rank) / float(max_rank))


def freshness_boost(created_at: datetime, *, half_life_days: float = 30.0) -> float:
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_days = max(0.0, (now - created_at).total_seconds() / 86400.0)
    decay = math.exp(-age_days / max(1e-6, half_life_days))
    return clamp01(decay)


def compute_ranks(
    items: Iterable[T],
    *,
    id_of: Callable[[T], Hashable],
    key: Callable[[T], float | None],
    reverse: bool = False,
) -> dict[Hashable, int]:
    """Build a {item_id: 1-indexed rank} map for `items` sorted by `key`.

    Items where `key(item) is None` are excluded — they didn't appear in
    that signal's ranked list at all. The caller can interpret a missing
    map entry as "no contribution from this signal".

    `reverse=True` for signals where higher = better (FTS rank, PageRank,
    freshness). `reverse=False` for signals where lower = better (cosine
    distance).
    """
    sortable: list[tuple[Hashable, float]] = []
    for it in items:
        k = key(it)
        if k is None:
            continue
        sortable.append((id_of(it), float(k)))
    sortable.sort(key=lambda x: x[1], reverse=reverse)
    return {item_id: i + 1 for i, (item_id, _) in enumerate(sortable)}


def rrf_score(
    *,
    ranks: dict[str, int | None],
    weights: dict[str, float],
    k: int = 60,
) -> float:
    """Reciprocal Rank Fusion.

    `ranks[signal]` is the 1-indexed position of the doc in that signal's
    sorted list, or None if the doc didn't appear there. Signals with None
    rank contribute zero. `k=60` is the canonical default
    (Elastic, OpenSearch, Azure all use it).
    """
    score = 0.0
    for signal, rank in ranks.items():
        if rank is None:
            continue
        score += weights.get(signal, 0.0) / (k + rank)
    return score
