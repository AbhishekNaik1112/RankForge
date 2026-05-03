"""Diagnostic script: verify pgvector + FTS + hybrid ranking + all endpoints.

Read-only against the DB. Hits the running backend via HTTP for endpoint checks,
and opens its own psycopg connection for DB introspection.

Usage:
    cd z:/Rankforge-AI-Search
    .venv/Scripts/python.exe -m backend.scripts.diag
"""
from __future__ import annotations

import os
import sys
import urllib.parse
from pathlib import Path

# Make backend package imports work when run as -m backend.scripts.diag
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db.client import get_conn  # noqa: E402
from backend.scripts import _http  # noqa: E402

PORT = int(os.environ.get("DIAG_PORT", "8765"))
BASE = f"http://127.0.0.1:{PORT}"


def section(title: str) -> None:
    print(f"\n{'=' * 72}\n  {title}\n{'=' * 72}")


def subsection(title: str) -> None:
    print(f"\n--- {title} ---")


# ---------------------------------------------------------------------------
# DB introspection


def check_extensions_and_indexes() -> None:
    section("1. DB: extensions & indexes")
    with get_conn() as conn:
        # Extensions
        exts = conn.execute(
            "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector')"
        ).fetchall()
        print(f"  extensions: {exts}")
        assert any(e[0] == "vector" for e in exts), "pgvector is not installed"

        # Indexes
        idx = conn.execute(
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname='public' AND tablename='content'
            ORDER BY indexname
            """
        ).fetchall()
        print("  indexes on content:")
        for name, defn in idx:
            print(f"    {name:30s}  {defn}")

        hnsw_present = any("hnsw" in d.lower() and "vector_cosine_ops" in d for _, d in idx)
        gin_present = any("gin" in d.lower() and "tsv" in d for _, d in idx)
        print(f"  HNSW vector index present: {hnsw_present}")
        print(f"  GIN FTS index present:     {gin_present}")
        assert hnsw_present, "HNSW vector index missing"
        assert gin_present, "GIN FTS index missing"


def check_row_counts_and_tsv() -> None:
    section("2. DB: row counts & tsvector population")
    with get_conn() as conn:
        counts = conn.execute(
            """
            SELECT
              (SELECT COUNT(*) FROM content) AS content,
              (SELECT COUNT(*) FROM content_links) AS links,
              (SELECT COUNT(*) FROM content_rank) AS rank,
              (SELECT COUNT(*) FROM content WHERE embedding IS NOT NULL) AS with_embedding,
              (SELECT COUNT(*) FROM content WHERE tsv IS NOT NULL) AS with_tsv,
              (SELECT COUNT(DISTINCT content_type) FROM content) AS distinct_types
            """
        ).fetchone()
        print(f"  content rows:         {counts[0]}")
        print(f"  content_links rows:   {counts[1]}")
        print(f"  content_rank rows:    {counts[2]}")
        print(f"  rows with embedding:  {counts[3]}")
        print(f"  rows with tsv:        {counts[4]}")
        print(f"  distinct content_types: {counts[5]}")

        # Show breakdown by type
        breakdown = conn.execute(
            "SELECT content_type, COUNT(*) FROM content GROUP BY content_type ORDER BY 1"
        ).fetchall()
        print("  by type:")
        for ct, n in breakdown:
            print(f"    {ct:12s} {n}")

        # Sample a tsvector
        sample = conn.execute(
            """
            SELECT title, substring(tsv::text, 1, 150)
            FROM content
            WHERE content_type != 'image'
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
        if sample:
            print(f"\n  sample tsv for '{sample[0]}':")
            print(f"    {sample[1]}...")


def check_pagerank_distribution() -> None:
    section("3. DB: PageRank distribution")
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.title, c.content_type, COALESCE(r.pagerank, 0) AS pr
            FROM content c
            LEFT JOIN content_rank r ON r.content_id = c.id
            ORDER BY pr DESC
            """
        ).fetchall()
        print(f"  {'title':40s} {'type':10s} pagerank")
        for title, ct, pr in rows:
            title_s = (title or "")[:38]
            print(f"  {title_s:40s} {ct:10s} {pr:.4f}")


# ---------------------------------------------------------------------------
# HTTP endpoint shape checks


def check_endpoint_shapes() -> None:
    section("4. HTTP endpoints: response shapes")

    subsection("GET /health")
    r = _http.get(BASE,"/health")
    print(f"  {r}")
    assert r.get("ok") is True
    assert "model_ready" in r
    # Cross-encoder reranker (F1) — health surfaces it as a separate flag.
    if "reranker_ready" in r:
        print(f"  reranker_ready: {r['reranker_ready']}")
        assert r["reranker_ready"] is True, "reranker model failed to load"

    subsection("GET /content (list, first 2)")
    items = _http.get(BASE,"/content")
    print(f"  total: {len(items)}")
    for item in items[:2]:
        print(f"  - keys: {sorted(item.keys())}")
        print(f"    {item['title']} / {item['content_type']} / thumbnail={bool(item['thumbnail_path'])}")

    subsection("GET /content/:id (first item)")
    one = _http.get(BASE,f"/content/{items[0]['id']}")
    print(f"  keys: {sorted(one.keys())}")
    assert one["id"] == items[0]["id"]

    subsection("GET /graph")
    g = _http.get(BASE,"/graph")
    print(f"  nodes: {len(g['nodes'])}, edges: {len(g['edges'])}")
    if g["nodes"]:
        print(f"  sample node keys: {sorted(g['nodes'][0].keys())}")
    if g["edges"]:
        print(f"  sample edge keys: {sorted(g['edges'][0].keys())}")


# ---------------------------------------------------------------------------
# Signal isolation


SIGNAL_QUERIES = [
    # (label, query, expected_signal_dominance, why)
    ("semantic",
     "deep learning",
     "sem",
     "'deep learning' doesn't appear verbatim in any doc but should semantically match ML cluster"),

    ("FTS-exact",
     "Maillard",
     "kw",
     "'Maillard' is a proper noun appearing in exactly one doc — FTS must dominate"),

    ("FTS + semantic both",
     "embedding",
     "both",
     "'embedding' appears in multiple docs AND is semantically central — both signals fire"),

    ("PageRank hub",
     "vector",
     "pr",
     "'vector' matches multiple ML docs; the hub (embeddings.md) should still win via pr=1.00"),

    ("freshness (recent only)",
     "recipe",
     "sem+kw",
     "freshness is ~1.0 for everything right now (all ingested today), so freshness is near-uniform"),

    ("zero match",
     "zzzxyz nonexistent query",
     "none",
     "FTS returns nothing; semantic returns weak matches — low final scores"),
]


def check_signal_isolation() -> None:
    section("5. Signal isolation: which signal is doing the work?")
    for label, q, expected, note in SIGNAL_QUERIES:
        subsection(f"[{label}] q={q!r}  (expect: {expected})")
        print(f"  why: {note}")
        results = _http.get(BASE,f"/content/search?q={urllib.parse.quote(q)}&limit=5")
        if not results:
            print("  (no results)")
            continue
        for i, r in enumerate(results, 1):
            sem = r["semantic_similarity"]
            kw = r["keyword_match"]
            pr = r["pagerank_norm"]
            fr = r["freshness_boost"]
            final = r["final_score"]
            # Mark which signal contributed most of the final score
            # The "top signal" annotation is a heuristic for diag readability
            # only — actual ranking is RRF, where contribution is w/(k+rank)
            # and we don't know each row's rank from the response. Use the
            # underlying signal scores weighted by env weights as a proxy.
            contribs = {
                "sem": 0.5 * sem,
                "kw": 0.2 * kw,
                "pr": 0.2 * pr,
                "fr": 0.1 * fr,
            }
            top_signal = max(contribs.items(), key=lambda x: x[1])[0]
            print(
                f"  #{i}  rrf={final:.4f} "
                f"[top:{top_signal:3s}] "
                f"sem={sem:.2f} kw={kw:.2f} pr={pr:.2f} fr={fr:.2f}  "
                f"{r['title']} ({r['content_type']})"
            )


# ---------------------------------------------------------------------------
# Direct SQL signal sanity


def check_chunk_distribution() -> None:
    section("8. content_chunks: per-doc chunk counts")
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.title, c.content_type, COUNT(cc.id) AS chunks
            FROM content c
            LEFT JOIN content_chunks cc ON cc.content_id = c.id
            GROUP BY c.id, c.title, c.content_type
            ORDER BY chunks DESC, c.title
            """
        ).fetchall()
        total_chunks = sum(r[2] for r in rows)
        with_chunks = sum(1 for r in rows if r[2] > 0)
        print(f"  total chunks: {total_chunks}")
        print(f"  docs with chunks: {with_chunks} / {len(rows)}")
        print(f"  {'title':40s} {'type':10s} chunks")
        for title, ct, n in rows:
            title_s = (title or "")[:38]
            print(f"  {title_s:40s} {ct:10s} {n}")


def check_pgvector_direct() -> None:
    section("6. pgvector: direct cosine distance (bypass ranking layer)")
    # Pick an ML-cluster title and find its 3 nearest neighbors by raw cosine distance
    with get_conn() as conn:
        target = conn.execute(
            "SELECT id, title, embedding FROM content WHERE title ILIKE 'embeddings' LIMIT 1"
        ).fetchone()
        if not target:
            print("  skipping: no 'Embeddings' row")
            return
        tid, title, emb = target
        print(f"  target: {title} ({tid})")
        nbrs = conn.execute(
            """
            SELECT title, content_type, (embedding <=> %s) AS dist
            FROM content
            WHERE id != %s AND embedding IS NOT NULL
            ORDER BY embedding <=> %s
            LIMIT 5
            """,
            (emb, tid, emb),
        ).fetchall()
        print(f"  5 nearest by raw cosine distance:")
        for t, ct, d in nbrs:
            print(f"    {d:.3f}  {t} ({ct})")


def check_fts_direct() -> None:
    section("7. Postgres FTS: direct ts_rank (bypass ranking layer)")
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT title, content_type,
                   ts_rank_cd(tsv, plainto_tsquery('english', %s)) AS rank
            FROM content
            WHERE tsv @@ plainto_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT 5
            """,
            ("Maillard reaction browning steak", "Maillard reaction browning steak"),
        ).fetchall()
        print("  FTS matches for 'Maillard reaction browning steak':")
        if not rows:
            print("    (no matches)")
        for t, ct, rank in rows:
            print(f"    rank={rank:.4f}  {t} ({ct})")


# ---------------------------------------------------------------------------
# Main


EDGE_CASE_QUERIES: list[tuple[str, str]] = [
    ("empty after strip", "   "),
    ("single char", "a"),
    ("punctuation only", "!!!"),
    ("diacritics", "café résumé"),
    ("mixed case", "DEEP LEARNING"),
    ("very long", "lorem ipsum " * 200),
    ("non-ascii smart quotes", "“hello”"),
]


def check_edge_case_queries() -> None:
    section("9. Search route: edge-case queries return well-shaped responses")
    for label, q in EDGE_CASE_QUERIES:
        subsection(f"[{label}] q={q[:40]!r}{'...' if len(q) > 40 else ''}")
        try:
            results = _http.get(BASE, f"/content/search?q={urllib.parse.quote(q)}&limit=3")
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR: {e}")
            continue
        assert isinstance(results, list), f"expected list, got {type(results).__name__}"
        print(f"  ok — {len(results)} result(s)")
        if results:
            top = results[0]
            print(f"    top: {top['title'][:50]!r} (rrf={top['final_score']:.4f})")


def check_chunk_determinism() -> None:
    section("10. Chunker: deterministic output")
    # Stand-alone import; no DB / HTTP needed.
    from services.chunker import split as split_chunks  # noqa: WPS433

    samples = [
        ("short", "Short body."),
        ("multiline", "First paragraph.\n\nSecond paragraph with more text. Third sentence here."),
        ("long", "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 15),
    ]
    for label, text in samples:
        a = split_chunks(text)
        b = split_chunks(text)
        ok = a == b
        print(f"  [{label}] chunks={len(a)}  deterministic={ok}")
        assert ok, f"chunker non-deterministic for {label}"


def check_token_threshold_smoke() -> None:
    section("11. Embeddings: chunk lengths under CLIP threshold")
    from services.chunker import split as split_chunks  # noqa: WPS433
    from services.embeddings import CLIP_CHAR_WARN_THRESHOLD  # noqa: WPS433

    # Use longest text-bearing doc body as our worst case.
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT title, body
            FROM content
            WHERE body IS NOT NULL
            ORDER BY length(body) DESC
            LIMIT 1
            """
        ).fetchall()
    if not rows:
        print("  skipping: no text content")
        return

    title, body = rows[0]
    chunks = split_chunks(body)
    over = [c for c in chunks if len(c) > CLIP_CHAR_WARN_THRESHOLD]
    print(f"  longest doc: {title!r}  ({len(body)} chars → {len(chunks)} chunks)")
    print(f"  chunks over warn threshold ({CLIP_CHAR_WARN_THRESHOLD} chars): {len(over)}/{len(chunks)}")
    if over:
        for c in over[:3]:
            print(f"    {len(c)} chars: {c[:60]!r}…")


def check_orphan_files() -> None:
    section("12. Files on disk: orphan scan vs content.source_path")
    # Tries the userData/files dir if it exists locally; otherwise skips.
    candidate_dirs: list[Path] = []
    if os.environ.get("APPDATA"):
        candidate_dirs.append(Path(os.environ["APPDATA"]) / "rankforge" / "files")
    candidate_dirs.append(Path.home() / ".config" / "rankforge" / "files")
    files_dir = next((d for d in candidate_dirs if d.is_dir()), None)
    if files_dir is None:
        print("  skipping: userData/files dir not found locally")
        return

    on_disk = {p.name for p in files_dir.iterdir() if p.is_file()}
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT source_path FROM content WHERE source_path IS NOT NULL"
        ).fetchall()
    referenced = {Path(r[0]).name for r in rows if r[0]}
    orphans = on_disk - referenced
    missing = referenced - on_disk
    print(f"  files dir:  {files_dir}")
    print(f"  on disk:    {len(on_disk)}")
    print(f"  referenced: {len(referenced)}")
    print(f"  orphans:    {len(orphans)}")
    print(f"  missing:    {len(missing)}")
    if orphans:
        for name in list(orphans)[:5]:
            print(f"    orphan: {name}")
    if missing:
        for name in list(missing)[:5]:
            print(f"    missing: {name}")


def main() -> None:
    _http.require_backend(BASE)

    check_extensions_and_indexes()
    check_row_counts_and_tsv()
    check_pagerank_distribution()
    check_endpoint_shapes()
    check_signal_isolation()
    check_pgvector_direct()
    check_fts_direct()
    check_chunk_distribution()
    check_edge_case_queries()
    check_chunk_determinism()
    check_token_threshold_smoke()
    check_orphan_files()

    print("\n" + "=" * 72)
    print("  ALL CHECKS COMPLETE")
    print("=" * 72)


if __name__ == "__main__":
    main()
