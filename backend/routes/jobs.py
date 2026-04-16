from __future__ import annotations

from fastapi import APIRouter, Query

from routes.content import search_content
from services.pagerank import compute_pagerank
from services.repository import fetch_links_adjacency, upsert_pageranks

router = APIRouter()


@router.post("/jobs/pagerank")
def run_pagerank_job():
    graph = fetch_links_adjacency()
    ranks = compute_pagerank(graph)
    updated = upsert_pageranks(ranks)
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
