# Performance notes

Audit snapshot of the RankForge codebase as of the multimodal ingestion commit. **Nothing here is fixed yet** — this doc is a backlog of known performance issues with file references and concrete fix ideas so follow-up work can pick them up without re-auditing.

Severity scale:
- **HIGH** — noticeable under normal usage or obviously bad at moderate scale (100–1K items)
- **MEDIUM** — measurable impact; painful at higher scale
- **LOW** — real but minor; fix when touching the area for other reasons
- **INFO** — worth knowing; not actionable today

---

## Backend (FastAPI + Python + Neon)

### HIGH

#### 1. All endpoints are synchronous — single-threaded serialization
- **Where:** [`backend/routes/content.py`](backend/routes/content.py), [`backend/routes/graph.py`](backend/routes/graph.py), [`backend/routes/jobs.py`](backend/routes/jobs.py)
- **Problem:** Every route is `def`, not `async def`. Uvicorn runs on a single worker (default) and FastAPI dispatches sync routes to a thread pool, but CPU-bound work (CLIP embedding, PDF extraction) still blocks for the duration. Drop 10 files at once → 10 × (extract + embed + insert) happens in series, taking ~10 seconds instead of ~1–2.
- **Fix:** Make the routes `async def`, wrap CPU-heavy calls (`embed_text`, `extract_body`, `make_thumbnail`) in `asyncio.to_thread(...)`. Search latency will also improve because the query embed + DB round-trip stop fighting for the main thread.
- **Effort:** ~2 hours. Touches every route + repository signature.

#### 2. No DB connection pooling
- **Where:** [`backend/db/client.py`](backend/db/client.py) — `get_conn()` calls `psycopg.connect()` on every request
- **Problem:** Neon is over-the-internet Postgres. A fresh TCP + TLS handshake per query adds ~50–150ms round-trip before any SQL runs. Search path opens **2** connections (`hybrid_candidates` + `get_max_pagerank`), so every search pays ~200ms of pure overhead.
- **Fix:** Switch to `psycopg_pool.ConnectionPool` (sync) or `AsyncConnectionPool` (async). Minimum pool size 2, max 10. Reuses TLS session.
- **Effort:** ~1 hour. Single file change + update `get_conn()` to pull from the pool.

### MEDIUM

#### 3. Search opens two connections for what could be one query
- **Where:** [`backend/routes/content.py`](backend/routes/content.py) (`search_content`) calls `hybrid_candidates()` then `get_max_pagerank()` separately
- **Problem:** Two round-trips where one would do. `max(pagerank)` can be computed inside the same CTE that produces candidates, or at least on the same connection.
- **Fix:** Extend the CTE in [`backend/services/repository.py:205`](backend/services/repository.py) to also return `(SELECT MAX(pagerank) FROM content_rank)` as a constant column. Or thread a connection through to avoid reopening.
- **Effort:** ~30 minutes.

#### 4. No pagination on bulk reads
- **Where:**
  - [`backend/services/repository.py:116`](backend/services/repository.py) `list_content()` — `SELECT * FROM content`
  - [`backend/services/repository.py:158`](backend/services/repository.py) `fetch_graph()` — all nodes + all edges
  - [`backend/services/repository.py:170`](backend/services/repository.py) `fetch_links_adjacency()` — same
- **Problem:** Fine at 100 items, 1MB+ JSON payload at 10K, multi-second load at 100K.
- **Fix:** Add `limit` / `offset` or cursor-based pagination. Library UI in particular should lazy-load more as the user scrolls.
- **Effort:** ~1 hour for query changes; more if the UI adds infinite-scroll.

#### 5. PageRank uses pure-Python dicts
- **Where:** [`backend/services/pagerank.py`](backend/services/pagerank.py)
- **Problem:** `O(iterations × nodes²)` worst case (dangling_mass + per-node distribution). Each iteration allocates a fresh `new_pr` dict. Acceptable at 11 nodes; painful at 10K.
- **Fix:** Switch to numpy sparse matrix: build adjacency once, then 30 iterations of `pr = (1-d)/N + d * M.T @ pr` — vectorized, cache-friendly. Easily 10–100× faster past ~1K nodes.
- **Effort:** ~2 hours. Small, self-contained service.

### LOW

#### 6. Thumbnail generation in the ingest critical path
- **Where:** [`backend/routes/content.py:125`](backend/routes/content.py) calls `make_thumbnail()` synchronously before responding
- **Problem:** Large image batches block on PIL resize + JPEG encode. Minor in practice (a 256px thumbnail is fast) but compounds with (1).
- **Fix:** After (1) lands, wrap `make_thumbnail` in `asyncio.to_thread`. Alternative: fire-and-forget with a background task and add `thumbnail_status` to the response.
- **Effort:** Trivial after (1).

#### 7. Search returns full `body` for every candidate
- **Where:** [`backend/services/repository.py:245`](backend/services/repository.py) `hybrid_candidates` selects `c.body` without truncation
- **Problem:** 50 candidates × ~100KB body each = up to 5MB over IPC per search. Most of it gets sliced to 200 chars by the UI anyway.
- **Fix:** Project `LEFT(c.body, 512) AS body_preview` at the SQL layer. Keep full body for the detail drawer (`GET /content/:id`).
- **Effort:** 15 minutes.

### INFO

#### 8. CLIP CPU embed is ~100ms per call
- **Where:** [`backend/services/embeddings.py`](backend/services/embeddings.py)
- **Observation:** Dominated by the model forward pass. Hard to shave without a GPU. Minor speed-up from wrapping encode in `torch.inference_mode()` (disables autograd tracking).
- **Not worth it today.**

---

## Frontend (Electron renderer + React)

### HIGH

#### 9. @fontsource bundles ~30 font files
- **Where:** [`src/renderer/src/globals.css`](src/renderer/src/globals.css) imports `@fontsource/inter/{400,500,600}.css` and `@fontsource/jetbrains-mono/{400,500}.css`
- **Problem:** Each of those pulls **all subsets** (latin, latin-ext, cyrillic, cyrillic-ext, greek) in both `.woff` and `.woff2`. Build output has ~30 font files totaling ~700KB. The app never uses cyrillic or greek.
- **Fix:** Either:
  - Switch to `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono` (one variable font file each, all weights). Net ~150KB instead of ~600KB.
  - Or replace the CSS imports with `@fontsource/inter/latin-400.css` etc. to drop the non-latin subsets.
- **Effort:** 15 minutes (variable-font swap is a drop-in).

#### 10. Library grid has no virtualization
- **Where:** [`src/renderer/src/components/LibraryGrid.tsx`](src/renderer/src/components/LibraryGrid.tsx) — `items.map(...)` renders every item
- **Problem:** At 1000 items that's 1000 DOM nodes + 1000 `<img>` loads. Paint cost + memory pressure + slow first render.
- **Fix:** `react-window` (FixedSizeGrid) or `@tanstack/react-virtual` (more flexible). Keep the current layout for ≤100 items (fast enough), fall through to virtualized mode past that threshold.
- **Effort:** ~1 hour.

### MEDIUM

#### 11. No `loading="lazy"` on thumbnails
- **Where:** [`src/renderer/src/components/LibraryGrid.tsx:61`](src/renderer/src/components/LibraryGrid.tsx), [`src/renderer/src/components/ResultCard.tsx`](src/renderer/src/components/ResultCard.tsx), [`src/renderer/src/components/DetailDrawer.tsx`](src/renderer/src/components/DetailDrawer.tsx)
- **Problem:** Every thumbnail in the grid loads eagerly, including ones below the fold. Decodes + memory happen even for unseen items.
- **Fix:** Add `loading="lazy"` and optionally `decoding="async"` to the `<img>` tags. Browsers skip off-viewport images automatically.
- **Effort:** 5 minutes. Unblocks (10) partially even without virtualization.

#### 12. No `React.memo` on leaf components
- **Where:** [`TypeBadge.tsx`](src/renderer/src/components/TypeBadge.tsx), [`ResultCard.tsx`](src/renderer/src/components/ResultCard.tsx), library cards (inline in [`LibraryGrid.tsx`](src/renderer/src/components/LibraryGrid.tsx))
- **Problem:** Any state change in `App.tsx` (ingest progress, selected item, refresh key) causes every visible card + badge to re-render even though their props haven't changed.
- **Fix:** `export const ResultCard = memo(function ResultCard(...) {...})`. Ensure the `onClick` callback passed down is stable (wrap with `useCallback` in parents).
- **Effort:** ~30 minutes.

#### 13. Renderer bundle is 891 KB — ReactFlow is ~300 KB of that
- **Where:** Build output; [`src/renderer/src/components/GraphView.tsx`](src/renderer/src/components/GraphView.tsx) imports `reactflow` synchronously
- **Problem:** Every user pays for the Graph tab's code on initial load, even if they never open it.
- **Fix:** Code-split with `React.lazy`:
  ```tsx
  const GraphPage = lazy(() => import('./pages/GraphPage'))
  // wrap in <Suspense fallback={<PageSpinner />}>
  ```
  Defer `reactflow` CSS similarly by importing it inside `GraphView.tsx` instead of at the root.
- **Effort:** ~30 minutes.

### LOW

#### 14. Every tab switch refetches
- **Where:** [`LibraryPage.tsx`](src/renderer/src/pages/LibraryPage.tsx), [`GraphPage.tsx`](src/renderer/src/pages/GraphPage.tsx) each `useEffect(() => { fetch... }, [refreshKey])`
- **Problem:** Switching away and back hits the backend again. No in-memory cache. Feels sluggish over a slow Neon connection.
- **Fix:** Small hook like `useCachedFetch` keyed on `[endpoint, refreshKey]`, or pull in `@tanstack/react-query` (heavier but standard).
- **Effort:** ~45 minutes for the small hook; ~15 min to adopt react-query if we're OK with the dep.

#### 15. Inline style objects everywhere
- **Where:** Most components in `src/renderer/src/components/`
- **Problem:** New `{...}` object per render → extra GC churn + React can't optimize (reference-compare fails). Measurable on a high-frequency update UI; not here.
- **Fix:** Migrate to CSS classes (Tailwind arbitrary values or a small CSS-modules layer). Big refactor, skip until there's a real reason.
- **Effort:** Days. Don't do this speculatively.

### INFO

#### 16. Drop zone registers global listeners; DetailDrawer listens for Escape
- **Observation:** Both clean up on unmount. No leaks, no debouncing needed. Just noting that adding more global listeners should go through a shared hook.

---

## Quick wins (if the budget is one afternoon)

1. `@fontsource-variable/inter` + `jetbrains-mono` swap (saves ~500 KB bundle)
2. Add `loading="lazy"` + `decoding="async"` to all thumbnails (free)
3. `React.lazy` the Graph page (defers ~300 KB)
4. `psycopg_pool.ConnectionPool` in `db/client.py` (shaves ~200ms off every search)
5. `LEFT(body, 512) AS body_preview` in `hybrid_candidates` (drops search payload by ~90%)

Total: roughly one focused afternoon, noticeable UX improvement for both cold-start and per-action latency.

## Deeper work (next iteration)

1. Make all routes `async def` + `asyncio.to_thread` the CPU work (items 1, 6)
2. Library virtualization + cache layer (items 10, 14)
3. Numpy sparse PageRank (item 5) — only matters if the corpus grows past ~1K nodes
4. `React.memo` pass across leaf components (item 12) — only matters once we have hundreds of visible cards
