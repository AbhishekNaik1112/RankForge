# RankForge

AI-Powered Content Discovery Platform combining PageRank graph algorithms with semantic vector search.

## Architecture

Electron desktop application with a Python (FastAPI) backend running as a managed sidecar process.

- **Renderer** - React SPA with Tailwind CSS and ReactFlow graph visualization
- **Main Process** - Manages window lifecycle, IPC, and Python sidecar
- **Backend** - FastAPI with Sentence-Transformers embeddings and PageRank algorithm
- **Database** - Neon PostgreSQL with pgvector extension (free tier)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.9+
- A [Neon](https://neon.tech/) PostgreSQL database with pgvector enabled

## Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Set up Python backend:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Configure the database:
   ```bash
   cp .env.example backend/.env
   # Edit backend/.env with your Neon DATABASE_URL
   ```

4. Initialize the database schema:
   ```bash
   cd backend
   python -m db.init_db
   ```

## Development

```bash
npm run dev
```

This launches the Electron app, which automatically spawns the FastAPI backend on a dynamic localhost port.

## Build

```bash
npm run build      # Build for current platform
npm run package    # Package as distributable
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron + electron-vite |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| Graph Visualization | ReactFlow |
| Backend | FastAPI (Python) |
| Embeddings | Sentence-Transformers (all-MiniLM-L6-v2, CPU) |
| Database | PostgreSQL + pgvector (Neon free tier) |
| Ranking | 60% semantic + 30% PageRank + 10% freshness |
