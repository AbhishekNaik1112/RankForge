CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  embedding VECTOR(384),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_links (
  from_id UUID REFERENCES content(id),
  to_id UUID REFERENCES content(id)
);

CREATE TABLE IF NOT EXISTS content_rank (
  content_id UUID REFERENCES content(id),
  pagerank FLOAT NOT NULL
);

CREATE INDEX IF NOT EXISTS content_links_from_idx ON content_links(from_id);
CREATE INDEX IF NOT EXISTS content_links_to_idx ON content_links(to_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_rank_content_id_uniq ON content_rank(content_id);

-- Vector index (cosine distance)
CREATE INDEX IF NOT EXISTS content_embedding_hnsw
  ON content
  USING hnsw (embedding vector_cosine_ops);
