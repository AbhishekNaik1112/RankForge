from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.embeddings import embed_image, embed_text
from services.extractors import detect_content_type, extract_body
from services.ranking import (
    cosine_distance_to_similarity,
    final_score,
    freshness_boost,
    fts_rank_to_score,
)
from services.repository import (
    ContentRow,
    delete_content,
    get_content,
    hybrid_candidates,
    insert_content,
    list_content,
    get_max_pagerank,
)
from services.thumbnails import make_thumbnail
from settings import (
    SEARCH_CANDIDATES,
    SEARCH_LIMIT,
    WEIGHT_FRESHNESS,
    WEIGHT_FTS,
    WEIGHT_PAGERANK,
    WEIGHT_SEMANTIC,
)

router = APIRouter()
logger = structlog.get_logger(__name__)


class IngestFileRequest(BaseModel):
    source_path: str = Field(min_length=1)
    title: str | None = None  # falls back to filename


class IngestTextRequest(BaseModel):
    title: str = Field(min_length=1)
    body: str = Field(min_length=1)


class ContentResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: str | None
    content_type: str
    source_path: str | None
    mime_type: str | None
    file_size: int | None
    thumbnail_path: str | None


class SearchResult(BaseModel):
    id: uuid.UUID
    title: str
    body: str | None
    content_type: str
    thumbnail_path: str | None
    semantic_similarity: float
    keyword_match: float
    pagerank_norm: float
    freshness_boost: float
    final_score: float


def _to_response(row: ContentRow) -> ContentResponse:
    return ContentResponse(
        id=row.id,
        title=row.title,
        body=row.body,
        content_type=row.content_type,
        source_path=row.source_path,
        mime_type=row.mime_type,
        file_size=row.file_size,
        thumbnail_path=row.thumbnail_path,
    )


def _guess_mime(content_type: str, path: Path) -> str | None:
    # Lightweight mime inference. Good enough for the UI to render type icons.
    suffix = path.suffix.lower()
    mime_map = {
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    }
    return mime_map.get(suffix)


@router.post("/content/ingest", response_model=ContentResponse)
async def ingest_file(payload: IngestFileRequest):
    src = Path(payload.source_path)
    if not src.is_file():
        raise HTTPException(status_code=400, detail=f"File not found: {payload.source_path}")

    try:
        content_type = detect_content_type(src)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    title = payload.title or src.stem
    file_size = src.stat().st_size
    mime_type = _guess_mime(content_type, src)

    if content_type == "image":
        embedding = await asyncio.to_thread(embed_image, src)
        body = None
        thumb = await asyncio.to_thread(make_thumbnail, src, src.parent)
        thumbnail_path = str(thumb)
    else:
        body = await asyncio.to_thread(extract_body, src, content_type)
        if not body.strip():
            raise HTTPException(
                status_code=422,
                detail=f"No extractable text in {content_type} file (scanned PDFs are not supported).",
            )
        embedding = await asyncio.to_thread(embed_text, body)
        thumbnail_path = None

    row = await insert_content(
        title=title,
        body=body,
        content_type=content_type,
        source_path=str(src.resolve()),
        mime_type=mime_type,
        file_size=file_size,
        thumbnail_path=thumbnail_path,
        embedding=embedding,
    )
    logger.info(
        "ingest_file",
        id=str(row.id),
        content_type=content_type,
        file_size=file_size,
        body_chars=len(body) if body else 0,
    )
    return _to_response(row)


@router.post("/content/paste", response_model=ContentResponse)
async def ingest_text(payload: IngestTextRequest):
    embedding = await asyncio.to_thread(embed_text, f"{payload.title}\n{payload.body}")
    row = await insert_content(
        title=payload.title,
        body=payload.body,
        content_type="text",
        source_path=None,
        mime_type="text/plain",
        file_size=len(payload.body.encode("utf-8")),
        thumbnail_path=None,
        embedding=embedding,
    )
    return _to_response(row)


@router.get("/content", response_model=list[ContentResponse])
async def list_all_content():
    return [_to_response(r) for r in await list_content()]


@router.get("/content/search", response_model=list[SearchResult])
async def search_content(
    q: str = Query(min_length=1, description="Search query"),
    limit: int = Query(default=SEARCH_LIMIT, ge=1, le=50),
    candidates: int = Query(default=SEARCH_CANDIDATES, ge=1, le=500),
):
    query_vec = await asyncio.to_thread(embed_text, q)
    rows = await hybrid_candidates(
        query_embedding=query_vec, query_text=q, limit=candidates
    )

    if not rows:
        return []

    max_pr = await get_max_pagerank()
    max_fts = max((r.fts_rank for r in rows if r.fts_rank is not None), default=0.0)

    results: list[SearchResult] = []
    for row in rows:
        semantic = cosine_distance_to_similarity(row.cosine_distance)
        fts = fts_rank_to_score(row.fts_rank, max_fts)
        pr_norm = (float(row.pagerank) / max_pr) if (row.pagerank is not None and max_pr > 0) else 0.0
        fresh = freshness_boost(row.created_at)
        score = final_score(
            semantic_similarity=semantic,
            fts_score=fts,
            pagerank_norm=pr_norm,
            freshness=fresh,
            w_semantic=WEIGHT_SEMANTIC,
            w_fts=WEIGHT_FTS,
            w_pagerank=WEIGHT_PAGERANK,
            w_freshness=WEIGHT_FRESHNESS,
        )

        results.append(
            SearchResult(
                id=row.id,
                title=row.title,
                body=row.body,
                content_type=row.content_type,
                thumbnail_path=row.thumbnail_path,
                semantic_similarity=semantic,
                keyword_match=fts,
                pagerank_norm=pr_norm,
                freshness_boost=fresh,
                final_score=score,
            )
        )

    results.sort(key=lambda r: r.final_score, reverse=True)
    logger.info(
        "search",
        query=q,
        candidates=len(rows),
        returned=min(limit, len(results)),
        top_score=results[0].final_score if results else None,
    )
    return results[:limit]


@router.get("/content/{content_id}", response_model=ContentResponse)
async def read_content(content_id: uuid.UUID):
    row = await get_content(content_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return _to_response(row)


@router.delete("/content/{content_id}")
async def remove_content(content_id: uuid.UUID):
    paths = await delete_content(content_id)
    if paths is None:
        raise HTTPException(status_code=404, detail="Content not found")

    # Unlink files best-effort. Main process owns the disk, but backend also cleans up
    # if running locally — safe because paths are absolute and validated by presence.
    for p in (paths.source_path, paths.thumbnail_path):
        if p:
            try:
                os.unlink(p)
            except (FileNotFoundError, PermissionError):
                pass
    return {"ok": True}
