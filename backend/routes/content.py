from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.embeddings import embed_text
from services.ranking import (
    cosine_distance_to_similarity,
    final_score,
    freshness_boost,
)
from services.repository import get_content, insert_content, semantic_candidates, get_max_pagerank
from settings import (
    SEARCH_CANDIDATES,
    SEARCH_LIMIT,
    WEIGHT_FRESHNESS,
    WEIGHT_PAGERANK,
    WEIGHT_SEMANTIC,
)

router = APIRouter()


class ContentCreateRequest(BaseModel):
    title: str = Field(min_length=1)
    body: str = Field(min_length=1)


class ContentResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: str


class SearchResult(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    semantic_similarity: float
    pagerank_norm: float
    freshness_boost: float
    final_score: float


@router.post("/content", response_model=ContentResponse)
def create_content(payload: ContentCreateRequest):
    text = f"{payload.title}\n{payload.body}"
    embedding = embed_text(text)
    row = insert_content(title=payload.title, body=payload.body, embedding=embedding)
    return ContentResponse(id=row.id, title=row.title, body=row.body)


@router.get("/content/{content_id}", response_model=ContentResponse)
def read_content(content_id: uuid.UUID):
    row = get_content(content_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return ContentResponse(id=row.id, title=row.title, body=row.body)


@router.get("/content/search", response_model=list[SearchResult])
def search_content(
    q: str = Query(min_length=1, description="Search query"),
    limit: int = Query(default=SEARCH_LIMIT, ge=1, le=50),
    candidates: int = Query(default=SEARCH_CANDIDATES, ge=1, le=500),
):
    query_vec = embed_text(q)
    rows = semantic_candidates(query_embedding=query_vec, limit=candidates)

    max_pr = get_max_pagerank()
    results: list[SearchResult] = []

    for row in rows:
        semantic = cosine_distance_to_similarity(row.cosine_distance)
        pr_norm = (float(row.pagerank) / max_pr) if (row.pagerank is not None and max_pr > 0) else 0.0
        fresh = freshness_boost(row.created_at)
        score = final_score(
            semantic_similarity=semantic,
            pagerank_norm=pr_norm,
            freshness=fresh,
            w_semantic=WEIGHT_SEMANTIC,
            w_pagerank=WEIGHT_PAGERANK,
            w_freshness=WEIGHT_FRESHNESS,
        )

        results.append(
            SearchResult(
                id=row.id,
                title=row.title,
                body=row.body,
                semantic_similarity=semantic,
                pagerank_norm=pr_norm,
                freshness_boost=fresh,
                final_score=score,
            )
        )

    results.sort(key=lambda r: r.final_score, reverse=True)
    return results[:limit]
