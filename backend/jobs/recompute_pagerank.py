from __future__ import annotations

from services.pagerank import compute_pagerank
from services.repository import fetch_links_adjacency, upsert_pageranks


def main() -> None:
    graph = fetch_links_adjacency()
    ranks = compute_pagerank(graph)
    updated = upsert_pageranks(ranks)
    print({"ok": True, "updated": updated, "nodes": len(ranks)})


if __name__ == "__main__":
    main()
