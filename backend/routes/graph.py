from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from services.repository import fetch_graph, insert_link

router = APIRouter()


class LinkCreateRequest(BaseModel):
    from_id: uuid.UUID
    to_id: uuid.UUID


@router.post("/links")
async def create_link(payload: LinkCreateRequest):
    await insert_link(from_id=payload.from_id, to_id=payload.to_id)
    return {"ok": True}


@router.get("/graph")
async def get_graph():
    nodes, edges = await fetch_graph()
    return {"nodes": nodes, "edges": edges}
