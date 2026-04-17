# RankForge

A local-first desktop app for **multimodal semantic + keyword search over a personal knowledge graph**. Drop in text, Markdown, PDFs, Word/PowerPoint, or images — the app extracts, embeds, and indexes everything, then ranks search results with a hybrid formula (semantic meaning + keyword match + graph authority + recency).

Runs entirely on free-tier infrastructure: local CPU embeddings via CLIP, Neon Postgres free tier (+ pgvector) for storage.

## Architecture

Electron desktop shell + a Python (FastAPI) backend running as a managed sidecar process.

- **Renderer** — React 19 SPA with Tailwind v4, Lucide icons, ReactFlow for graphs
- **Main process** — window lifecycle, IPC, Python sidecar supervision, disk-backed file storage in `userData/files/`
- **Backend** — FastAPI, CLIP `clip-ViT-B-32` embeddings (text + image, 512-dim), pypdf / python-docx / python-pptx for extraction, Pillow for thumbnails
- **Database** — Neon Postgres + pgvector (HNSW index for ANN), generated tsvector column + GIN index for FTS
- **Ranking** — `0.5 · semantic + 0.2 · keyword + 0.2 · pagerank + 0.1 · freshness` (tunable via env)

## Supported file types

| Extension | Handling |
|---|---|
| `.txt`, `.md`, `.markdown` | Read as UTF-8, embed text, FTS on content |
| `.pdf` | Text extracted with `pypdf` (scanned PDFs without OCR return empty → 422) |
| `.docx` | Text extracted with `python-docx` (paragraphs) |
| `.pptx` | Text extracted with `python-pptx` (slide text frames) |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp` | CLIP image embedding + 256 px JPEG thumbnail |

Max single file size: **50 MB** (enforced at the IPC boundary).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.9+ on `PATH`
- A [Neon](https://neon.tech/) Postgres database with the `vector` extension enabled

## Setup

1. Install Node dependencies:
   ```bash
   npm install
   ```

2. Create the Python virtual environment and install backend deps:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   pip install -r requirements.txt
   cd ..
   ```

3. Enable pgvector on your Neon database (once, via Neon SQL editor):
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. Configure the database URL:
   ```bash
   cp .env.example backend/.env
   # Edit backend/.env — paste your Neon pooled connection string into DATABASE_URL
   ```

5. Initialize the schema (⚠️ this is destructive; drops existing tables):
   ```bash
   cd backend
   python -m db.init_db
   cd ..
   ```

6. (Optional) Pre-download the ~600 MB CLIP model so the first ingest isn't slow:
   ```bash
   .venv/Scripts/python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('clip-ViT-B-32')"
   ```

## Development

```bash
npm run dev
```

Launches the Electron app, which automatically spawns the Python backend on a dynamic localhost port.

> **Troubleshooting — `TypeError: Cannot read properties of undefined (reading 'isPackaged')`**
> That means `ELECTRON_RUN_AS_NODE=1` is set in your shell (usually from an IDE Node-debug session). Unset it:
>
> ```bash
> # bash:
> unset ELECTRON_RUN_AS_NODE ELECTRON_NO_ATTACH_CONSOLE
> # PowerShell:
> Remove-Item Env:ELECTRON_RUN_AS_NODE
> Remove-Item Env:ELECTRON_NO_ATTACH_CONSOLE
> ```

## Scripts

Both scripts hit a running backend on port **8765** by default (override with `SEED_PORT`/`DIAG_PORT`).

```bash
# Seed demo corpus (8 docs + 1 image + 6 links) and run test queries.
# NOT idempotent — each run creates duplicates.
python -m backend.scripts.seed_demo

# Read-only diagnostic: verifies pgvector + FTS indexes, dumps row counts,
# PageRank distribution, endpoint response shapes, and runs 6 signal-isolation
# queries to show which signal is carrying each result.
python -m backend.scripts.diag
```

## Build

```bash
npm run build      # Build main / preload / renderer bundles into out/
npm run package    # Produce platform installers in dist/ (NSIS/DMG/AppImage)
```

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 + electron-vite 3 + electron-builder 25 |
| Renderer | React 19, TypeScript 5, Tailwind CSS v4, Lucide icons, ReactFlow |
| Backend | FastAPI + uvicorn (Python 3.9+) |
| Embeddings | CLIP `clip-ViT-B-32` via sentence-transformers (CPU, 512-dim, text + image) |
| Extractors | pypdf, python-docx, python-pptx, Pillow |
| Database | Neon Postgres 17 + pgvector 0.8 (HNSW ANN + GIN FTS) |
| Ranking | 0.5 semantic · 0.2 keyword · 0.2 PageRank · 0.1 freshness |

## Known limitations

- No OCR for scanned PDFs (returns 422 on zero-text extraction)
- No authentication / rate limiting on backend endpoints (desktop-only, single-user context)
- Python sidecar has no hot-reload — backend edits require restarting `npm run dev`
- CLIP first-run download (~600 MB) produces no visible loading state in the UI
- `init_db.py` is destructive; no migration tool (alembic, etc.) yet
- `/graph` fetches all content without pagination
