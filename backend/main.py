from fastapi import FastAPI

from routes.content import router as content_router
from routes.graph import router as graph_router
from routes.jobs import router as jobs_router

app = FastAPI(title="RankForge API", version="0.1.0")

app.include_router(content_router)
app.include_router(graph_router)
app.include_router(jobs_router)


@app.get("/health")
def health():
    return {"ok": True}
