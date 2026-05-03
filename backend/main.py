from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request

from routes.content import router as content_router
from routes.graph import router as graph_router
from routes.jobs import router as jobs_router
from services.embeddings import is_model_loaded, warmup
from services.logging import setup_logging


logger = structlog.get_logger("rankforge.app")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging(log_dir=os.environ.get("LOG_DIR") or None)
    logger.info("startup", log_dir=os.environ.get("LOG_DIR"))

    # Eager-load the embedding model so the first ingest doesn't block ~30 s.
    # /health reports model_ready=False until this completes.
    warmup()
    logger.info("model_loaded")

    yield

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
    return {"ok": True, "model_ready": is_model_loaded()}
