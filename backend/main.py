from __future__ import annotations

import asyncio
import os
import sys
import time
from contextlib import asynccontextmanager

# psycopg's async mode requires the Selector event loop on Windows.
# Must be set before uvicorn creates its loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import structlog
from fastapi import FastAPI, Request

from db.client import close_pool, open_pool
from db.init_db import init_db
from routes.content import router as content_router
from routes.graph import router as graph_router
from routes.jobs import router as jobs_router
from services.embeddings import is_model_loaded as embeddings_loaded, warmup as embeddings_warmup
from services.logging import setup_logging
from services.reranker import is_model_loaded as reranker_loaded, warmup as reranker_warmup


logger = structlog.get_logger("rankforge.app")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging(log_dir=os.environ.get("LOG_DIR") or None)
    logger.info("startup", log_dir=os.environ.get("LOG_DIR"))

    # Apply pending migrations (idempotent; no-op if already at HEAD).
    # Sync — runs once at startup, alembic isn't async-aware.
    init_db()

    # Open the async DB pool. Routes/repository require this.
    await open_pool()
    logger.info("pool_open")

    # Eager-load the embedding model so the first ingest doesn't block ~30 s.
    # /health reports model_ready=False until both this AND the reranker are loaded.
    embeddings_warmup()
    logger.info("embeddings_loaded")

    # Cross-encoder reranker (BAAI/bge-reranker-v2-m3, ~568 MB). Loaded after
    # the embedding model so the splash screen completes the bigger download
    # first; startup time grows by ~5-10 s on warm cache, ~30 s on cold.
    reranker_warmup()
    logger.info("reranker_loaded")

    yield

    await close_pool()
    logger.info("shutdown")


app = FastAPI(title="RankForge API", version="0.1.0", lifespan=lifespan)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = int((time.monotonic() - start) * 1000)
    structlog.get_logger("rankforge.http").info(
        "request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        elapsed_ms=elapsed_ms,
    )
    return response


app.include_router(content_router)
app.include_router(graph_router)
app.include_router(jobs_router)


@app.get("/health")
def health():
    # model_ready flips true only when BOTH the embedding model and the
    # reranker are loaded — the splash screen / waitForReady polls this
    # and unblocks the UI when it's true.
    return {
        "ok": True,
        "model_ready": embeddings_loaded() and reranker_loaded(),
        "embeddings_ready": embeddings_loaded(),
        "reranker_ready": reranker_loaded(),
    }
