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
    body: str | None
    content_type: str
    source_path: str | None
    mime_type: str | None
    file_size: int | None
    thumbnail_path: str | None
    created_at: datetime


@dataclass(frozen=True)
class SearchCandidate:
    id: uuid.UUID
    title: str
    body: str | None
    content_type: str
    thumbnail_path: str | None
    created_at: datetime
    cosine_distance: float | None  # None if the row came only from FTS (no vector hit)
    fts_rank: float | None         # None if the row came only from semantic (no FTS hit)
    pagerank: float | None


@dataclass(frozen=True)
class DeletedPaths:
    source_path: str | None
    thumbnail_path: str | None


def insert_content(
    *,
    title: str,
    body: str | None,
    content_type: str,
    source_path: str | None,
    mime_type: str | None,
    file_size: int | None,
    thumbnail_path: str | None,
    embedding: NDArray[np.float32],
) -> ContentRow:
    content_id = uuid.uuid4()
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO content (
                id, title, body, content_type, source_path,
                mime_type, file_size, thumbnail_path, embedding
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, title, body, content_type, source_path,
                      mime_type, file_size, thumbnail_path, created_at
            """,
            (
                content_id,
                title,
                body,
                content_type,
                source_path,
                mime_type,
                file_size,
                thumbnail_path,
                embedding,
            ),
        ).fetchone()
    return ContentRow(
        id=row[0],
        title=row[1],
        body=row[2],
        content_type=row[3],
        source_path=row[4],
        mime_type=row[5],
        file_size=row[6],
        thumbnail_path=row[7],
        created_at=row[8],
    )


def get_content(content_id: uuid.UUID) -> ContentRow | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, title, body, content_type, source_path,
                   mime_type, file_size, thumbnail_path, created_at
            FROM content WHERE id = %s
            """,
            (content_id,),
        ).fetchone()
    if row is None:
        return None
    return ContentRow(
        id=row[0],
        title=row[1],
        body=row[2],
        content_type=row[3],
        source_path=row[4],
        mime_type=row[5],
        file_size=row[6],
        thumbnail_path=row[7],
        created_at=row[8],
    )


def list_content() -> list[ContentRow]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, title, body, content_type, source_path,
                   mime_type, file_size, thumbnail_path, created_at
            FROM content ORDER BY created_at DESC
            """
        ).fetchall()
    return [
        ContentRow(
            id=r[0], title=r[1], body=r[2], content_type=r[3], source_path=r[4],
            mime_type=r[5], file_size=r[6], thumbnail_path=r[7], created_at=r[8],
        )
        for r in rows
    ]


def delete_content(content_id: uuid.UUID) -> DeletedPaths | None:
    """Delete a content row and return the file paths the caller should unlink."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT source_path, thumbnail_path FROM content WHERE id = %s",
            (content_id,),
        ).fetchone()
        if row is None:
            return None
        conn.execute("DELETE FROM content WHERE id = %s", (content_id,))
    return DeletedPaths(source_path=row[0], thumbnail_path=row[1])


def insert_link(*, from_id: uuid.UUID, to_id: uuid.UUID) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO content_links (from_id, to_id) VALUES (%s, %s)",
            (from_id, to_id),
        )


def fetch_graph() -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    with get_conn() as conn:
        nodes = conn.execute(
            "SELECT id, title, content_type FROM content ORDER BY created_at DESC"
        ).fetchall()
        edges = conn.execute("SELECT from_id, to_id FROM content_links").fetchall()

    node_list = [{"id": str(n[0]), "title": n[1], "content_type": n[2]} for n in nodes]
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

    with get_conn() as conn, conn.cursor() as cur:
        cur.executemany(
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


def hybrid_candidates(
    *,
    query_embedding: NDArray[np.float32],
    query_text: str,
    limit: int,
) -> list[SearchCandidate]:
    """Fetch candidates using semantic ANN and FTS in a single query (UNION), then merge.

    Each row has either a `cosine_distance` (from semantic search),
    an `fts_rank` (from FTS), or both (when a row matches in both).
    Downstream scoring combines both signals with PageRank and freshness.
    """
    with get_conn() as conn:
        rows = conn.execute(
            """
            WITH semantic AS (
                SELECT c.id,
                       (c.embedding <=> %(vec)s) AS cosine_distance,
                       NULL::float AS fts_rank
                FROM content c
                WHERE c.embedding IS NOT NULL
                ORDER BY c.embedding <=> %(vec)s
                LIMIT %(limit)s
            ),
            keyword AS (
                SELECT c.id,
                       NULL::float AS cosine_distance,
                       ts_rank_cd(c.tsv, plainto_tsquery('english', %(q)s)) AS fts_rank
                FROM content c
                WHERE c.tsv @@ plainto_tsquery('english', %(q)s)
                ORDER BY fts_rank DESC
                LIMIT %(limit)s
            ),
            merged AS (
                SELECT id,
                       MIN(cosine_distance) AS cosine_distance,
                       MAX(fts_rank) AS fts_rank
                FROM (SELECT * FROM semantic UNION ALL SELECT * FROM keyword) u
                GROUP BY id
            )
            SELECT c.id, c.title, c.body, c.content_type, c.thumbnail_path, c.created_at,
                   m.cosine_distance, m.fts_rank, r.pagerank
            FROM merged m
            JOIN content c ON c.id = m.id
            LEFT JOIN content_rank r ON r.content_id = c.id
            """,
            {"vec": query_embedding, "q": query_text, "limit": limit},
        ).fetchall()

    return [
        SearchCandidate(
            id=r[0],
            title=r[1],
            body=r[2],
            content_type=r[3],
            thumbnail_path=r[4],
            created_at=r[5],
            cosine_distance=float(r[6]) if r[6] is not None else None,
            fts_rank=float(r[7]) if r[7] is not None else None,
            pagerank=float(r[8]) if r[8] is not None else None,
        )
        for r in rows
    ]
