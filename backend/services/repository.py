from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from numpy.typing import NDArray

from db.client import get_conn


@dataclass(frozen=True)
class ContentRow:
    id: uuid.UUID
    title: str
    body: str
    created_at: datetime


@dataclass(frozen=True)
class SearchCandidate:
    id: uuid.UUID
    title: str
    body: str
    created_at: datetime
    cosine_distance: float
    pagerank: float | None


def insert_content(*, title: str, body: str, embedding: NDArray[np.float32]) -> ContentRow:
    content_id = uuid.uuid4()
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO content (id, title, body, embedding)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, body, created_at
            """,
            (content_id, title, body, embedding),
        ).fetchone()
    return ContentRow(id=row[0], title=row[1], body=row[2], created_at=row[3])


def get_content(content_id: uuid.UUID) -> ContentRow | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, title, body, created_at FROM content WHERE id = %s",
            (content_id,),
        ).fetchone()
    if row is None:
        return None
    return ContentRow(id=row[0], title=row[1], body=row[2], created_at=row[3])


def insert_link(*, from_id: uuid.UUID, to_id: uuid.UUID) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO content_links (from_id, to_id) VALUES (%s, %s)",
            (from_id, to_id),
        )


def fetch_graph() -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    with get_conn() as conn:
        nodes = conn.execute("SELECT id, title FROM content ORDER BY created_at DESC").fetchall()
        edges = conn.execute("SELECT from_id, to_id FROM content_links").fetchall()

    node_list = [{"id": str(n[0]), "title": n[1]} for n in nodes]
    edge_list = [{"from": str(e[0]), "to": str(e[1])} for e in edges]
    return node_list, edge_list


def fetch_links_adjacency() -> dict[str, list[str]]:
    with get_conn() as conn:
        all_nodes = conn.execute("SELECT id FROM content").fetchall()
        rows = conn.execute("SELECT from_id, to_id FROM content_links").fetchall()

    graph: dict[str, list[str]] = {str(node_id[0]): [] for node_id in all_nodes}
    for from_id, to_id in rows:
        graph.setdefault(str(from_id), []).append(str(to_id))
    return graph


def upsert_pageranks(pageranks: dict[str, float]) -> int:
    if not pageranks:
        return 0

    values = [(uuid.UUID(k), float(v)) for k, v in pageranks.items()]

    with get_conn() as conn:
        conn.executemany(
            """
            INSERT INTO content_rank (content_id, pagerank)
            VALUES (%s, %s)
            ON CONFLICT (content_id) DO UPDATE SET pagerank = EXCLUDED.pagerank
            """,
            values,
        )

    return len(values)


def get_max_pagerank() -> float:
    with get_conn() as conn:
        row = conn.execute("SELECT COALESCE(MAX(pagerank), 0) FROM content_rank").fetchone()
    return float(row[0] or 0.0)


def semantic_candidates(*, query_embedding: NDArray[np.float32], limit: int) -> list[SearchCandidate]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.title, c.body, c.created_at,
                   (c.embedding <=> %s) AS cosine_distance,
                   r.pagerank
            FROM content c
            LEFT JOIN content_rank r ON r.content_id = c.id
            WHERE c.embedding IS NOT NULL
            ORDER BY c.embedding <=> %s
            LIMIT %s
            """,
            (query_embedding, query_embedding, limit),
        ).fetchall()

    return [
        SearchCandidate(
            id=row[0],
            title=row[1],
            body=row[2],
            created_at=row[3],
            cosine_distance=float(row[4]),
            pagerank=float(row[5]) if row[5] is not None else None,
        )
        for row in rows
    ]
