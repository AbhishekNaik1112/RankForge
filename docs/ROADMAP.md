# RankForge — Improvement Roadmap

Audit + research synthesis for the next phase of work. Produced after a deep review of the entire repo at commit `5588b08` (multimodal ingestion, FTS, hybrid ranking, UI redesign).

This is a **planning document, not implementation**. Every item below has a file reference, a "why now / why later" rationale, and an effort estimate. Pick from it; don't try to do everything.

---

## State of the union

The app works end-to-end. You can drop a PDF, embed it, search it, see it in the graph. The architecture is fundamentally sound — the Electron + FastAPI-sidecar split is appropriate, the IPC contract is clean, the schema is reasonable.

But three things are wrong in ways that aren't visible from a happy-path demo:

1. **CLIP truncates input at 77 tokens.** Every doc you've embedded is silently truncated to ~50 words of body text. Every "semantic" search result you've seen has been ranking on the first paragraph only. This is the single highest-ROI fix in the entire roadmap.
2. **`init_db.py` does `DROP TABLE … CASCADE`.** First time anyone with real data needs a schema change, they lose everything. Acceptable while it's just you; not acceptable for v1.0.
3. **The app is unshippable in its current form.** It requires Python 3.9+ on `PATH` and a populated `.venv`. Nothing about a `.dmg`/`.exe`/`AppImage` from `npm run package` will work for a normal user.

Everything else is polish. Those three are the agenda.

---

## Critical findings discovered in this audit

These weren't in `PERFORMANCE.md` or the previous code-quality audit. They are the new things this round surfaced.

### 🔴 1. CLIP-ViT-B/32 has a 77-token text input limit

> *Source: `transformers/CLIPTextModel.config.max_position_embeddings == 77`. Confirmed in 2026 ablation studies — Vecta, NAACL.*

**Symptom:** A 10-page PDF gets the same embedding it would have if you only kept the first paragraph. Mid- and late-document content is invisible to semantic search.

**Where it bites:** `backend/services/embeddings.py:embed_text()` is called with the **entire** extracted body in `backend/routes/content.py:134`. CLIP's tokenizer truncates without warning.

**Fix path:** chunking. See Tier 2 below.

**Why it wasn't caught earlier:** CLIP doesn't error or warn. It silently drops tokens past position 77. The `seed_demo` corpus is short enough (most docs <300 chars) that the issue never appeared in the smoke test.

### 🔴 2. `/health` lies about readiness

CLIP is lazy-loaded via `@lru_cache(maxsize=1)` (`backend/services/embeddings.py:13`). The first request that calls `embed_text()` blocks for 30 s while the model loads. `GET /health` returns `{"ok": true}` long before that.

**Where it bites:** Electron main waits for `/health` to return OK before opening the window (`src/main/python.ts:waitForReady`). User sees a window, drops a file, sees a spinner for 30 seconds with no feedback.

**Fix:** eager-load CLIP at FastAPI startup (`backend/main.py` lifespan event) and add a `model_ready` field to `/health`. Renderer already has a status dot — wire it to the new field.

### 🔴 3. `kill_python` race condition on Windows

`src/main/python.ts:140-160`. The `'exit'` event handler that clears `forceKillTimer` and nulls `pythonProcess` is registered **after** `taskkill` is spawned. If the process exits in the small window before the listener is wired up, the cleanup never fires and the next `spawnPython` thinks a process is already running.

**Fix:** swap the order — register the listener first, then send the kill signal.

### 🔴 4. App is unshippable

`electron-builder.yml` includes `backend/` via `extraResources`, but the spawned `python -m uvicorn …` command in `src/main/python.ts:findPythonExecutable` requires Python on the user's PATH. No installer in the world will produce an end-user runnable app today.

**Fix:** PyInstaller `--onedir` build of the backend. ~2-3 days. Bundle ships at ~700 MB without CLIP weights, ~1.8 GB with. Sign the sidecar exe to dodge Windows AV false positives.

### 🟡 5. Hub dominance is structural, not a corpus-size issue

You already noted "hub dominance" in CLAUDE.md as a "lower WEIGHT_PAGERANK to fix" knob. **It's actually the linear-blend formula's fault.** With `final = w_sem*S + w_pr*PR_norm + ...`, a node with `PR_norm=1.0` gets a flat +0.2 boost on every query, regardless of relevance. Lowering weights helps but doesn't solve it.

**Fix:** Reciprocal Rank Fusion. RRF combines ranked lists by `score = Σ w_i / (k + rank_i)` with `k=60` (industry standard — Elastic, OpenSearch, Azure, ParadeDB all use this). Authority can only contribute `w_pr / (k+1)` per doc. The hub stays helpful but stops winning queries it has no business winning.

---

## Doc reorganization (this commit)

`README.md` and `CLAUDE.md` stay at repo root (GitHub + Claude Code conventions). Everything else moves under `docs/`:

| Old path | New path |
|---|---|
| `Project Details.md` | `docs/Project Details.md` |
| `STEP_BY_STEP_GUIDE.md` | `docs/STEP_BY_STEP_GUIDE.md` |
| `PERFORMANCE.md` | `docs/PERFORMANCE.md` |
| — (new) | `docs/ROADMAP.md` (this file) |

Done via `git mv` so history is preserved. README link updates included in this commit.

---

## Tier 1 — Must-do before any release

These block 1.0 in different ways. Do them in roughly this order.

### T1.1 — Eager-load CLIP + truthful `/health` (M3 in agent review)
- Add a FastAPI lifespan handler in `backend/main.py` that calls `services.embeddings._get_model()` on startup
- Change `/health` to return `{"ok": True, "model_ready": True}` only when the model is loaded
- In `src/main/python.ts`, switch `waitForReady` to poll for `model_ready`, not just `ok`
- Show a "Loading AI model…" toast in `src/renderer/src/App.tsx` if `pythonReady` is true but `getHealth().model_ready` is false (rare — only on first launch)
- **Effort:** 1 hour. **Files:** 3.

### T1.2 — Fix `kill_python` race
- `src/main/python.ts:killPython` — register the `exit` listener **before** issuing `taskkill`/`SIGTERM`
- **Effort:** 5 minutes. **Files:** 1.

### T1.3 — Real migration tool (Alembic) + non-destructive `init_db`
- Drop in `alembic` (free, standard), one migration capturing the current `schema.sql`
- `init_db.py` becomes idempotent: applies pending migrations, refuses to drop existing tables without `--reset`
- Schema changes from this point on are migrations, not schema.sql rewrites
- **Effort:** 3 hours. **Files:** ~5 new in `backend/db/migrations/`, 1 modified.
- **Why now:** every Tier 2 item that touches schema (chunks, tags, version) needs this first.

### T1.4 — Connection pool + `async def` routes
- See `docs/PERFORMANCE.md` HIGH #1 + #2 — promoted from "perf nice-to-have" to Tier 1 because every Tier 2 ingestion improvement amplifies the latency cost
- `psycopg_pool.AsyncConnectionPool`, min 2, max 10
- All routes become `async def`, CPU work wrapped in `asyncio.to_thread(...)`
- **Effort:** 3 hours. **Files:** `db/client.py`, every route file, every repository function.

### T1.5 — Structured logging
- `structlog` to `userData/logs/rankforge.jsonl`, plus a `GET /diagnostics` endpoint
- Renderer gets a hidden Settings panel showing recent log lines (Ctrl+Shift+D shortcut)
- Single-user defers auth and rate limiting; logging is needed to debug user reports
- **Effort:** 2 hours. **Files:** new `backend/services/logging.py`, all routes, Settings page.

### T1.6 — Bundling: PyInstaller `--onedir` for the backend
- New `backend/build_pyinstaller.spec` with explicit `hiddenimports` for `torch`, `sentence_transformers`, `pypdf`, `python_docx`, `python_pptx`, `Pillow`
- `electron-builder.yml` switches `extraResources` from raw `backend/` to the PyInstaller dist folder
- `src/main/python.ts:findPythonExecutable` adds packaged-app path discovery (the bundled `rankforge_backend.exe`)
- **Note:** ship without CLIP weights; downloaded on first run. Saves ~600 MB on the installer.
- **Effort:** 2-3 days. Most of it is fighting Windows AV / macOS notarization signatures.

---

## Tier 2 — Quality leap (highest ROI after Tier 1)

These transform search quality. Do at least T2.1 (chunking) — without it, T2.2 and T2.3 are polishing a fundamentally broken signal.

### T2.1 — Chunking 🔥
**This is the biggest improvement available.** Fixes the CLIP 77-token bug.

- New `backend/services/chunker.py` with a recursive character splitter: 256-token chunks, 32-token overlap (Vecta Feb 2026 benchmark recommends 256-512; smaller is better for CLIP because of the 77-token limit per chunk)
- New table `content_chunks (id UUID, content_id UUID FK, ord INT, body TEXT, embedding VECTOR(512), tsv TSVECTOR, created_at)` — separate HNSW + GIN indexes
- `hybrid_candidates` now searches **chunks**, deduplicates by `content_id`, returns the chunk with the best score per parent
- Detail drawer in `src/renderer/src/components/DetailDrawer.tsx` highlights the matching chunk
- For PDFs: chunk per-page first, then split long pages
- **Effort:** 1.5 days. **Files:** new `chunker.py`, schema migration (T1.3), `repository.py`, `routes/content.py`, `DetailDrawer.tsx`.
- **Risk:** the `content` table's `embedding`/`tsv` columns become legacy. Either drop them or switch them to "best-of-chunks" projections. Decide during impl.

### T2.2 — Reciprocal Rank Fusion (RRF)
Replaces the linear blend with industry-standard rank fusion. Kills hub dominance structurally (see Critical Finding #5).

- Modify `backend/services/ranking.py:final_score`: take **rank lists** for semantic / FTS / pagerank / freshness, return RRF-combined score
- `k=60` constant (industry default)
- PageRank becomes `rank-by-PR-among-candidates`, not raw `pr_norm`
- Freshness similarly ranked, not raw decay
- Weights tunable via env (`WEIGHT_*` already exist)
- **Effort:** 4 hours. **Files:** `ranking.py`, `routes/content.py`. **Confined.**

### T2.3 — Cross-encoder reranking (top-K only)
After hybrid retrieval pulls top-50 candidates, rerank top-30 with a cross-encoder. Big precision lift.

- `BAAI/bge-reranker-v2-m3` (278M, MIT license, Apache-2.0). ~130 ms for 16-pair batches on CPU.
- Lazy-loaded like CLIP, similar `@lru_cache(maxsize=1)` pattern
- Wrap `predict()` in `asyncio.to_thread`
- New `WEIGHT_RERANK` env (default 0.0 = disabled until T1.4 lands; flip to 1.0 once async is in)
- **Effort:** 4 hours. **Files:** new `services/reranker.py`, `routes/content.py`.
- **Why later than T2.1/T2.2:** reranking gibberish from a truncated embedding is wasted compute. Get good candidates first.

### T2.4 — RapidOCR fallback for scanned PDFs
- `rapidocr-onnxruntime` (~10 MB, Apache-2.0) is the 2026 winner for cross-platform free OCR. ONNX-based, no Paddle runtime, identical results on Win/Mac/Linux.
- `backend/services/extractors.py:extract_text_from_pdf` becomes: text-layer-first, then PyMuPDF rasterize → RapidOCR if the text layer is empty
- New requirement: add `pymupdf` (already installed via pypdf? — verify) and `rapidocr-onnxruntime` to `requirements.txt`
- **Effort:** 1 day. **Files:** 1 service file, 1 requirements line.

---

## Tier 3 — Architecture polish

After Tier 2, the search quality and reliability are real. Tier 3 makes the app feel mature.

### T3.1 — One migration: tags + versioning + telemetry
Bundle these into a single Alembic revision so we don't pay schema cost three times:

- `tags(id, name)` + `content_tags(content_id, tag_id)` — for the user to organize by topic
- `content.version INT, content.superseded_by UUID` — when re-ingesting an updated PDF, link old → new
- `search_log(id, query, ts, top_id, top_score)` — telemetry for tuning weights and a future learned reranker
- **Effort:** 1 day. **Files:** Alembic migration, `repository.py`, new tag UI on detail drawer.

### T3.2 — Pluggable extractors via `Protocol`
Surgical refactor. Don't build a "plugin discovery system" (YAGNI).

- Define `class Extractor(Protocol)` with `supports(path) -> bool` and `extract(path) -> ExtractedDoc`
- Existing extractors implement it
- Adding `.epub` becomes a 20-line PR
- **Effort:** 2 hours. **Files:** `services/extractors.py`.

### T3.3 — Background job queue (in-process, asyncio)
- `apscheduler` or just an `asyncio.Queue` worker. **Not Celery** — overkill for desktop.
- New `jobs(id, kind, payload, status, created_at, completed_at)` table
- PageRank becomes one job kind; add re-embed (after model upgrade), re-chunk (after chunker change), OCR-pending
- Settings page shows "Last PageRank: 5 min ago"
- **Effort:** 6 hours. **Files:** new `services/job_queue.py`, settings page additions.

### T3.4 — Graph subgraph endpoint
Replace `GET /graph` (returns *everything*) with `GET /graph?center=&depth=2&limit=200`. BFS from a node out N hops, capped at limit. UI defaults to centering on the most recent document.

- Adds `weight FLOAT` to `content_links` (so the graph can show signal strength, e.g. cosine sim between linked docs)
- Adds `UNIQUE(from_id, to_id)` constraint — finally fixes the duplicate-edge bug
- **Effort:** 4 hours. **Files:** `routes/graph.py`, `repository.py`, `GraphView.tsx`.

### T3.5 — SSE for ingest progress (only)
- Search is fast enough that SSE for search is YAGNI
- Ingest of a 50-page PDF with chunking + reranking can take 5+ seconds — that's where streaming helps
- New endpoint `POST /content/ingest/stream` emits `{stage: "extract"|"chunk"|"embed"|"insert", percent: 0-100}` events
- IPC method `ingestFileStreaming` with a callback
- **Effort:** 1 day. **Files:** new `routes/streaming.py`, IPC + preload, ingest UI.

### T3.6 — Performance items from PERFORMANCE.md not promoted to Tier 1
Pull from `docs/PERFORMANCE.md` directly:

- Numpy sparse PageRank (item 5) — only matters past 1K nodes
- Bulk-read pagination (item 4) — same
- LEFT(body, 512) preview projection (item 7) — quick win, ~15 min
- Variable-font swap (item 9) — quick win, saves ~500 KB bundle
- `loading="lazy"` on thumbnails (item 11) — quick win, 5 min
- `React.lazy` the GraphPage (item 13) — defers ~300 KB of ReactFlow, ~30 min
- `React.memo` on leaf components (item 12) — only matters once we have hundreds of cards

**Estimated combined effort:** half-day for the quick wins, rest deferred.

### T3.7 — Code-quality fixes from previous audit
The 35-item list lives in conversation history. Highlights worth doing as part of routine cleanup:

- `backend/services/repository.py` — repeated `_row_to_content_row` pattern (DRY)
- `backend/routes/content.py:_guess_mime` ↔ `services/extractors.py:EXTENSION_MAP` — single source of truth for MIME table (DRY)
- Magic numbers in `src/main/python.ts` (timeout values) — extract to named constants
- `useIngest` toast auto-dismiss races on rapid drops — per-entry timers
- DropZone listener cleanup gate — always register/unregister consistently
- `confirm(...)` in DetailDrawer — replace with custom modal

**Estimated effort:** 2-3 hours total for the meaningful subset; skip the nits.

---

## Tier 4 — Future / explicitly skipped

Things I considered and consciously chose not to do (yet).

- **Multi-workspace support.** YAGNI for single-user desktop. If demanded, add `workspace_id UUID` everywhere.
- **Cloud-optional sync.** Idea: rename files to `userData/files/{sha256}-{name}` so the directory becomes iCloud/Dropbox/git-friendly. Don't try to sync DB metadata. Half a day's work, only useful when there are multiple users on multiple machines.
- **Switching to SigLIP-2 / Jina-CLIP-v2.** Real quality lift but requires schema change (`VECTOR(512)` → `VECTOR(768)`), full re-embed, and Tier 1.3 (migrations) first. Worth it eventually; not the urgent move.
- **Offline-first via sqlite-vec.** `sqlite-vec` + FTS5 is the right path for offline mode (single-file, Apache-2.0, native FTS5 BM25). Real but only matters if the user reports Neon outages biting them. ~2-3 days.
- **GraphQL, Celery/Redis, Tauri rewrite, switching off CLIP.** No.
- **Tests as a 1.0 blocker.** Just `pytest` the pure functions in `ranking.py` and `pagerank.py` (small, no infra). E2E + Playwright is post-1.0.
- **Manual light/dark toggle.** Tracks OS pref via `prefers-color-scheme`. Override is one more setting; do it only if multiple users ask.
- **`uvicorn --reload` in dev.** One-line fix in `src/main/python.ts`. Nice-to-have. Skip until backend edits actually start to feel slow.
- **Tunable weights UI.** Useful for *you* during tuning. Not user-facing. Add as a hidden Ctrl+Shift+W panel if you want.

---

## Suggested execution order (4 weeks)

| Week | Focus | Deliverables |
|---|---|---|
| 1 | Tier 1 foundation | T1.1 (eager-load), T1.2 (race), T1.3 (alembic), T1.4 (async + pool), T1.5 (logging) |
| 2 | Search-quality leap | T2.1 (chunking) — biggest single improvement; T2.2 (RRF) |
| 3 | Precision + scanned PDFs | T2.3 (reranker), T2.4 (OCR), T3.6 (perf quick wins) |
| 4 | Shippability | T1.6 (PyInstaller), T3.4 (graph pagination), T3.7 (code-quality polish) |

Tier 3.1, 3.2, 3.3, 3.5 fold in as opportunistic alongside the above.

---

## Implementation workflow

For every commit produced from this roadmap:

1. **Implement the change.** Follow the file references and effort estimates in this doc.
2. **Verify locally.** Run `npm run build`, run `python -m backend.scripts.diag` against a populated DB, drop a test file, run a search.
3. **Stage all changes.** `git add` the relevant files.
4. **Stop.** Do not run `git commit` or `git push`.
5. **Output a draft commit message** for the user to review.
6. The user reviews the diff + message, edits if needed, commits, and pushes.

This is a hard rule. Each Tier item should produce one focused commit, not a mega-PR. If a Tier item can be subdivided (e.g. T1.6 = PyInstaller is really 3 commits: spec file, electron-builder wiring, sidecar resolution), output the work and message for *each*.

---

## Skills worth installing

The audit was bottlenecked in places that an installed skill would have closed faster. From [skills.sh](https://skills.sh) consider adding:

- **`rag-architect`** — directly applicable; a real RAG specialist would have flagged the CLIP 77-token issue without web research, and would call out chunking + reranker patterns as defaults rather than discoveries
- **`database-optimizer`** — for executing `EXPLAIN ANALYZE` on the hybrid CTE during T1.4 / T2.1 work, and right-sizing the HNSW `ef_search` parameter at scale
- **`alembic-migrations`** (if it exists in their catalog) — would shortcut T1.3

Less critical but useful eventually:
- **`playwright-expert`** — for the post-1.0 E2E test suite
- **`monitoring-expert`** — only if T1.5 grows beyond simple structlog into Prometheus territory

Skip: `chaos-engineer`, `legacy-modernizer`, `microservices-architect`, `kubernetes-specialist` — all overkill for a single-user desktop app.

---

## Cross-references

- `docs/PERFORMANCE.md` — 16 perf findings, 5 promoted to T1.4 / T3.6 here
- `CLAUDE.md` (root, gitignored) — current state + non-obvious gotchas, will need a status update once Tier 1 lands
- `docs/Project Details.md` — original spec, durable constraints (free-tier, modular ranking, batch PageRank)
- `docs/STEP_BY_STEP_GUIDE.md` — original implementation guide; partially stale post-multimodal migration. Worth marking superseded or rewriting after Tier 1.

---

## What's intentionally **not** in this plan

This is the "you didn't ship a dashboard, why?" section.

- A test plan beyond unit tests for pure functions. Karpathy: *don't add tests to scenarios that can't happen.* The renderer + IPC paths are exercised every time you run the app.
- Detailed UI mockups. The current minimal-modern direction is fine. Wait for real complaints before redesigning.
- A "phase 2 visual polish" with animations and microinteractions. Inline-style React + Tailwind v4 is functionally complete; CSS-in-JS / Emotion / styled-components is a multi-day refactor that produces no user-visible improvement.
- Custom LLM integration ("ask questions about your docs"). That's a different product. Build the search foundation first.
