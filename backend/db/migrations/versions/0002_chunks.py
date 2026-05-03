"""content_chunks table for chunk-level retrieval

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-03

Adds chunk-level storage so semantic + FTS retrieval can hit small,
CLIP-friendly chunks of long documents (CLIP-B/32 truncates text at
77 tokens; embedding a whole PDF as one vector loses everything past
~the first paragraph).

Cascading FK from content_chunks.content_id → content.id means deleting
a content row also deletes its chunks. No separate delete_chunks() call
needed at the application layer.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op


revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE content_chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
            ord INT NOT NULL,
            body TEXT NOT NULL,
            embedding VECTOR(512),
            tsv TSVECTOR GENERATED ALWAYS AS (
                to_tsvector('english', body)
            ) STORED,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(content_id, ord)
        )
        """
    )

    op.execute(
        "CREATE INDEX content_chunks_embedding_hnsw ON content_chunks "
        "USING hnsw (embedding vector_cosine_ops)"
    )
    op.execute(
        "CREATE INDEX content_chunks_tsv_gin ON content_chunks USING gin (tsv)"
    )
    op.execute(
        "CREATE INDEX content_chunks_content_id_idx ON content_chunks(content_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS content_chunks CASCADE")
