"""initial schema (multimodal + FTS + CLIP 512-dim)

Revision ID: 0001
Revises:
Create Date: 2026-05-03

Mirrors backend/db/schema.sql at the time Alembic was adopted.
For databases that already have this schema (created via the legacy
init_db.py), db/init_db.py stamps them at HEAD instead of re-running
this migration — see _stamp_or_upgrade() there.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op


revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        """
        CREATE TABLE content (
            id UUID PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT,
            content_type TEXT NOT NULL DEFAULT 'text',
            source_path TEXT,
            mime_type TEXT,
            file_size BIGINT,
            thumbnail_path TEXT,
            embedding VECTOR(512),
            tsv TSVECTOR GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
            ) STORED,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE content_links (
            from_id UUID REFERENCES content(id) ON DELETE CASCADE,
            to_id UUID REFERENCES content(id) ON DELETE CASCADE
        )
        """
    )

    op.execute(
        """
        CREATE TABLE content_rank (
            content_id UUID REFERENCES content(id) ON DELETE CASCADE,
            pagerank FLOAT NOT NULL
        )
        """
    )

    op.execute("CREATE INDEX content_links_from_idx ON content_links(from_id)")
    op.execute("CREATE INDEX content_links_to_idx ON content_links(to_id)")
    op.execute(
        "CREATE UNIQUE INDEX content_rank_content_id_uniq ON content_rank(content_id)"
    )
    op.execute(
        "CREATE INDEX content_embedding_hnsw ON content "
        "USING hnsw (embedding vector_cosine_ops)"
    )
    op.execute("CREATE INDEX content_tsv_gin ON content USING gin (tsv)")
    op.execute("CREATE INDEX content_type_idx ON content(content_type)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS content_rank CASCADE")
    op.execute("DROP TABLE IF EXISTS content_links CASCADE")
    op.execute("DROP TABLE IF EXISTS content CASCADE")
