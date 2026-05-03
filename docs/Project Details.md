# AI-Powered Content Discovery Platform

### Hybrid Ranking using PageRank + Semantic AI Search

---

## 1. Project Overview

This project is a **full-stack AI system** that ranks internal content using a **hybrid approach**:

* **Graph authority** → PageRank algorithm
* **Semantic relevance** → AI text embeddings
* **Final ranking** → Weighted combination of both

The system mimics how modern search engines combine **classical algorithms** with **machine learning**.

---

## 2. Core Problem Statement

Traditional content platforms rank items by:

* recency
* popularity
* manual pinning

These approaches fail to capture:

* **structural importance**
* **knowledge authority**
* **semantic intent**

This project solves that by:

1. Modeling content as a **directed graph**
2. Running **PageRank** to compute authority
3. Using **AI embeddings** to compute relevance
4. Merging both into a single ranking score

---

## 3. High-Level Architecture

```
Frontend (Next.js)
   ↓
Backend API (Node.js / FastAPI)
   ↓
PostgreSQL (Neon)
   ├─ Content
   ├─ Content Links (Graph)
   ├─ PageRank Scores
   └─ pgvector Embeddings
```

Background jobs:

* PageRank recomputation
* Embedding generation
* Link graph updates

---

## 4. Tech Stack (Free Tier Only)

### Frontend

* **Next.js**
* Tailwind CSS
* React Flow (graph visualization)
* Hosted on **Vercel**

### Backend

* **Node.js** *or* **FastAPI**
* REST APIs
* In-process background jobs
* Hosted on **Railway**

### Database

* **Neon**
* PostgreSQL + pgvector

### AI Layer

* **Sentence‑Transformers**
* Model: `all-MiniLM-L6-v2`
* CPU-only, zero cost

---

## 5. Data Model

### Content Table

```sql
CREATE TABLE content (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  embedding VECTOR(384),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Content Link Graph

```sql
CREATE TABLE content_links (
  from_id UUID REFERENCES content(id),
  to_id UUID REFERENCES content(id)
);
```

### PageRank Scores

```sql
CREATE TABLE content_rank (
  content_id UUID REFERENCES content(id),
  pagerank FLOAT NOT NULL
);
```

---

## 6. PageRank Algorithm (Reference Implementation)

### Concept

Each content item is a **node**.
Each internal reference is a **directed edge**.

PageRank formula:

```
PR(A) = (1 - d)/N + d * Σ(PR(B) / Out(B))
```

Where:

* `d` = damping factor (0.85)
* `N` = number of nodes
* `B` = nodes linking to A

---

### PageRank Reference Code (Python)

> This is **reference code** intended for clarity.
> Claude can adapt this into production code.

```python
def compute_pagerank(graph, damping=0.85, iterations=30):
    """
    graph: dict[str, list[str]]
      {
        "A": ["B", "C"],
        "B": ["C"],
        "C": ["A"]
      }
    returns: dict[str, float]
    """

    nodes = list(graph.keys())
    n = len(nodes)

    # Initialize PageRank
    pagerank = {node: 1.0 / n for node in nodes}

    for _ in range(iterations):
        new_rank = {}
        for node in nodes:
            inbound_sum = 0.0
            for other, outgoing in graph.items():
                if node in outgoing and len(outgoing) > 0:
                    inbound_sum += pagerank[other] / len(outgoing)

            new_rank[node] = ((1 - damping) / n) + (damping * inbound_sum)

        pagerank = new_rank

    return pagerank
```

---

### Production Notes

* Convert DB rows → adjacency list
* Run this in a **background job**
* Persist results in `content_rank`
* Normalize scores between `0–1`

---

## 7. AI Embedding Flow

### Content Ingestion

1. Save content
2. Generate embedding using Sentence-Transformers
3. Store in `embedding` column

### Search Query

1. Generate query embedding
2. Perform vector similarity search
3. Retrieve Top-N candidates

---

## 8. Hybrid Ranking Formula

Final ranking score:

```
final_score =
  (0.6 × semantic_similarity)
+ (0.3 × normalized_pagerank)
+ (0.1 × freshness_boost)
```

Where:

* Semantic similarity → cosine similarity
* PageRank → authority score
* Freshness → time decay

---

## 9. API Endpoints (Expected)

### Content

* `POST /content`
* `GET /content/:id`
* `GET /content/search?q=`

### Graph

* `POST /links`
* `GET /graph`

### Ranking

* `POST /jobs/pagerank`
* `GET /ranked-results`

---

## 10. Background Jobs

| Job                  | Frequency           |
| -------------------- | ------------------- |
| Embedding generation | On content creation |
| PageRank recompute   | Every 6–12 hours    |
| Graph refresh        | On link updates     |

---

## 11. Frontend Features

* Semantic search bar
* Ranked content list
* “Why this ranked?” explanation
* Graph visualization (nodes + edges)

---

## 12. Folder Structure (Suggested)

```
/frontend
  /app
  /components
  /lib/api.ts

/backend
  /routes
  /services
    pagerank.py
    embeddings.py
  /jobs
    recompute_pagerank.py
  /db
```

---

## 13. Why This Project Is Interview-Strong

* Combines **graph theory + AI**
* Demonstrates system design
* Uses real-world ranking logic
* Entirely free-tier
* Easily extensible to personalization

---

## 14. Resume-Ready Description

> Designed and built an AI-powered content discovery platform combining PageRank graph algorithms with semantic vector search using PostgreSQL + pgvector, deployed end-to-end on free-tier infrastructure.

---

## 15. Claude Usage Instruction (IMPORTANT)

> Claude:
>
> * Treat PageRank as a background batch job
> * Use PostgreSQL + pgvector
> * Keep ranking logic modular
> * Do not call paid APIs
> * Optimize for clarity over premature optimization
