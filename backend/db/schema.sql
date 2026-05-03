-- RankForge schema v2: multimodal ingestion + FTS
--
-- ⚠️  This file is now a CONSOLIDATED REFERENCE only — it is NOT executed
-- at runtime. Schema changes go through Alembic migrations under
-- backend/db/migrations/versions/. The FastAPI lifespan calls
-- backend/db/init_db.py:init_db() on startup, which applies pending
-- migrations idempotently. Use `python -m db.init_db --reset` to wipe
-- and rebuild during development.
--
-- This file is kept up-to-date as a single-place reference for the
-- current consolidated schema (every column + index after all
-- migrations are applied). Update it whenever you add a migration.

CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS content_rank CASCADE;
DROP TABLE IF EXISTS content_links CASCADE;
DROP TABLE IF EXISTS content CASCADE;

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
);

CREATE TABLE content_links (
  from_id UUID REFERENCES content(id) ON DELETE CASCADE,
  to_id UUID REFERENCES content(id) ON DELETE CASCADE
);

CREATE TABLE content_rank (
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  pagerank FLOAT NOT NULL
);

CREATE INDEX content_links_from_idx ON content_links(from_id);
CREATE INDEX content_links_to_idx ON content_links(to_id);
CREATE UNIQUE INDEX content_rank_content_id_uniq ON content_rank(content_id);

-- Vector index (cosine distance) sized for CLIP 512-dim embeddings
CREATE INDEX content_embedding_hnsw
  ON content
  USING hnsw (embedding vector_cosine_ops);

-- FTS index over generated tsvector column
CREATE INDEX content_tsv_gin ON content USING gin (tsv);

-- Type filter helper (library filtering by content_type)
CREATE INDEX content_type_idx ON content(content_type);
