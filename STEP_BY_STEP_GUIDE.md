# RankForge — Step-by-Step Build Guide

This guide turns the design in [Project Details.md](Project%20Details.md) into an implementable, free-tier friendly project.

## What you’re building
A hybrid search/ranking system:
- **Semantic relevance** via embeddings (`all-MiniLM-L6-v2`, 384-dim)
- **Graph authority** via PageRank over internal links
- **Final rank** via weighted score

Target architecture:
```
Frontend (Next.js) -> Backend API (FastAPI or Node) -> Neon Postgres (pgvector)
```

---

## 0) Prereqs (Windows)
Install:
- Git
- Node.js LTS
- Python 3.11+ (recommended)
- A Postgres client (psql) or a DB GUI (optional, but helpful)

Accounts (free tier):
- Neon (Postgres)
- Railway (backend hosting)
- Vercel (frontend hosting)

---

## 1) Create the repo structure
In the repo root, create the folders from the suggested structure:
```
/frontend
/backend
  /routes
  /services
  /jobs
  /db
```

Recommended minimal files:
- `frontend/` (Next.js app)
- `backend/` (FastAPI app)
- `backend/services/pagerank.py`
- `backend/services/embeddings.py`
- `backend/jobs/recompute_pagerank.py`

---

## 2) Set up Neon Postgres + pgvector
### 2.1 Create Neon project
1. Create a Neon project.
2. Copy the connection string (you’ll use it as `DATABASE_URL`).

### 2.2 Enable pgvector
Run in Neon SQL editor (or via `psql`):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.3 Create tables
Use the schema from the project spec:
```sql
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
```

### 2.4 Add indexes (recommended)
Vector index (cosine distance):
```sql
-- Use HNSW for good recall/speed balance
CREATE INDEX IF NOT EXISTS content_embedding_hnsw
  ON content
  USING hnsw (embedding vector_cosine_ops);
```

Basic join/index helpers:
```sql
CREATE INDEX IF NOT EXISTS content_links_from_idx ON content_links(from_id);
CREATE INDEX IF NOT EXISTS content_links_to_idx ON content_links(to_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_rank_content_id_uniq ON content_rank(content_id);
```

---

## 3) Backend (recommended path: FastAPI)
FastAPI keeps embeddings + PageRank in Python (simple, consistent with your reference code).

### 3.1 Create a Python environment
From `backend/`:
- Create a venv
- Install dependencies

Suggested dependencies:
- `fastapi`
- `uvicorn[standard]`
- `psycopg[binary]` (psycopg 3)
- `pgvector`
- `sentence-transformers`
- `numpy`
- `python-dotenv` (optional)

### 3.2 Define configuration
Use env vars:
- `DATABASE_URL`
- `EMBEDDING_MODEL=all-MiniLM-L6-v2`

### 3.3 Implement embedding service
Core idea:
- On `POST /content`, generate embedding for `(title + "\n" + body)`
- Store it in `content.embedding` (vector(384))

Sentence-Transformers usage pattern:
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
vec = model.encode([text])[0]  # 384-d
```

Postgres driver note (pgvector-python): register vector types when using psycopg:
```python
from pgvector.psycopg import register_vector
register_vector(conn)
```

### 3.4 Implement semantic search query
At query time:
1. Embed the query string
2. Use vector similarity to pull candidates

Example SQL pattern:
```sql
SELECT id, title, body
FROM content
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1
LIMIT $2;
```
Notes:
- `<=>` is cosine distance when using `vector_cosine_ops` indexing.
- Distance smaller = closer. Convert to similarity if you want a $0..1$ score.

### 3.5 Implement PageRank job (batch)
You already have a reference implementation conceptually. Production flow:
1. Read `content_links` from DB.
2. Build adjacency list: `from_id -> [to_id...]`.
3. Compute PageRank for all nodes.
4. Persist into `content_rank`.
5. Normalize PageRank to `0..1` for combination.

**Important modeling notes**
- Include nodes that have no outgoing edges.
- Handle dangling nodes (no outlinks) by treating them as linking to all nodes or by distributing their rank evenly each iteration.

### 3.6 Hybrid ranking endpoint
Create `GET /content/search?q=` (or `GET /ranked-results?q=`) that:
1. Finds Top-N by semantic search (e.g., N=50)
2. Joins in PageRank from `content_rank`
3. Adds a freshness boost
4. Produces final score:

$$
final\_score = 0.6\cdot semantic + 0.3\cdot pagerank\_norm + 0.1\cdot freshness
$$

Freshness boost (simple, deterministic):
- Compute age in days from `created_at`
- Map to a 0..1 value (e.g., exponential decay or capped linear)

### 3.7 “Why this ranked?” explanation
Return per result:
- `semantic_similarity`
- `pagerank_norm`
- `freshness_boost`
- `final_score`
So the UI can show a breakdown.

### 3.8 Background jobs
Two approaches (both free-tier friendly):
- **In-process**: trigger on-demand via endpoints
  - `POST /jobs/pagerank` recomputes PageRank
  - Embeddings generated synchronously at content creation
- **Light scheduling**: Railway cron / scheduled trigger (if available) calling `POST /jobs/pagerank` every 6–12 hours

FastAPI background task pattern (for non-blocking work) exists, but for PageRank you usually want a real job (it can be heavier than a quick background task).

---

## 4) API surface (aligns with the spec)
Implement these first:

### Content
- `POST /content`
  - body: `{ "title": "...", "body": "..." }`
  - behavior: insert row + generate embedding
- `GET /content/{id}`
- `GET /content/search?q=...`
  - behavior: semantic search + hybrid rerank

### Graph
- `POST /links`
  - body: `{ "from_id": "uuid", "to_id": "uuid" }`
- `GET /graph`
  - returns nodes + edges for visualization

### Ranking
- `POST /jobs/pagerank`
- `GET /ranked-results?q=...`
  - optional alias of `/content/search`

---

## 5) Frontend (Next.js + Tailwind)
### 5.1 Create Next.js app
Create in `frontend/`.

### 5.2 Minimal screens (as per spec)
Build only what’s listed:
- Semantic search bar
- Ranked content list
- “Why this ranked?” explanation (breakdown)
- Graph visualization (React Flow) using `GET /graph`

Suggested UI flow:
1. Search input calls backend search endpoint
2. Render results ordered by `final_score`
3. Each result can show the score breakdown

---

## 6) Local development workflow
1. Start backend (FastAPI) on `http://localhost:8000`
2. Start frontend (Next.js) on `http://localhost:3000`
3. Point frontend to backend via env var (e.g., `NEXT_PUBLIC_API_BASE_URL`)

Basic smoke tests:
- Create 3–10 content items
- Add some links between them
- Run `POST /jobs/pagerank`
- Search and verify:
  - semantically relevant docs appear
  - authority affects ordering

---

## 7) Deployment (free-tier)
### 7.1 Neon
- Keep DB on Neon
- Store the Neon connection string as `DATABASE_URL` in Railway

### 7.2 Railway (backend)
- Deploy `backend/`
- Set env vars: `DATABASE_URL`, `EMBEDDING_MODEL`
- Expose port for FastAPI
- Optional: schedule a call to `POST /jobs/pagerank` every 6–12 hours

### 7.3 Vercel (frontend)
- Deploy `frontend/`
- Set `NEXT_PUBLIC_API_BASE_URL` to your Railway backend URL

---

## 8) Practical implementation choices (keep it simple)
- Choose **FastAPI** for the backend to keep embeddings + PageRank in one language.
- Use **HNSW** index for `content.embedding`.
- Treat PageRank as a **batch job** and persist results.
- Keep ranking logic modular:
  - `services/embeddings.py`
  - `services/pagerank.py`
  - `services/ranking.py` (combiner)

---

## 9) Optional: Node.js backend alternative (if you prefer JS)
If you choose Node instead:
- Use `pg` + `pgvector/pg` and register types:
```js
import pgvector from 'pgvector/pg';
await pgvector.registerTypes(client);
```
- Keep embeddings in Python as a separate service (more moving parts), or use a JS embedding model (but your spec prefers Sentence-Transformers CPU and free).

---

## 10) Checklist
- [ ] Neon DB created, `vector` extension enabled
- [ ] Tables created: `content`, `content_links`, `content_rank`
- [ ] Backend endpoints implemented (Content, Graph, Ranking)
- [ ] Embeddings stored in `VECTOR(384)`
- [ ] Vector search returns Top-N candidates
- [ ] PageRank job persists normalized scores
- [ ] Hybrid rank merges semantic + authority + freshness
- [ ] Frontend renders ranked list + explanation + graph

