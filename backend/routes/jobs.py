from __future__ import annotations

import structlog
from fastapi import APIRouter, Query

from routes.content import search_content
from services.pagerank import compute_pagerank
from services.repository import fetch_links_adjacency, upsert_pageranks

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.post("/jobs/pagerank")
def run_pagerank_job():
    logger.info("pagerank_start")
    graph = fetch_links_adjacency()
    ranks = compute_pagerank(graph)
    updated = upsert_pageranks(ranks)
    logger.info("pagerank_done", nodes=len(ranks), updated=updated)
    return {"ok": True, "updated": updated, "nodes": len(ranks)}


@router.get("/ranked-results")
def ranked_results(
    q: str = Query(min_length=1, description="Search query"),
    limit: int = Query(default=None, ge=1, le=50),
):
    # Thin alias of /content/search
    if limit is None:
        return search_content(q=q)
    return search_content(q=q, limit=limit)
