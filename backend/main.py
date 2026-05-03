from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from routes.content import router as content_router
from routes.graph import router as graph_router
from routes.jobs import router as jobs_router
from services.embeddings import is_model_loaded, warmup


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Eager-load the embedding model so the first ingest doesn't block ~30 s.
    # /health reports model_ready=False until this completes.
    warmup()
    yield


app = FastAPI(title="RankForge API", version="0.1.0", lifespan=lifespan)

app.include_router(content_router)
app.include_router(graph_router)
app.include_router(jobs_router)


@app.get("/health")
def health():
    return {"ok": True, "model_ready": is_model_loaded()}
