"""Standalone PageRank recompute. Same job as POST /jobs/pagerank but runnable
without the FastAPI app — useful from cron or one-off shell."""
from __future__ import annotations

import asyncio
import sys

# psycopg async requires the Selector loop on Windows.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from db.client import close_pool, open_pool  # noqa: E402
from services.pagerank import compute_pagerank  # noqa: E402
from services.repository import fetch_links_adjacency, upsert_pageranks  # noqa: E402


async def main_async() -> None:
    await open_pool()
    try:
        graph = await fetch_links_adjacency()
        ranks = await asyncio.to_thread(compute_pagerank, graph)
        updated = await upsert_pageranks(ranks)
        print({"ok": True, "updated": updated, "nodes": len(ranks)})
    finally:
        await close_pool()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
