"""Backend launcher.

Sets the asyncio event loop policy on Windows BEFORE creating any event loop —
psycopg's async mode is incompatible with ProactorEventLoop, which is asyncio's
default on Windows in Python 3.8+. Setting the policy inside main.py is too
late because uvicorn creates the loop before importing the app.

We bypass `uvicorn.run()` (which manages its own loop creation) and instead
drive `Server.serve()` ourselves under our `asyncio.run()`, guaranteeing the
SelectorEventLoop policy is honored.

Run via:
    python run.py
or
    python -m run

The Electron main process spawns this in src/main/python.ts.
"""
from __future__ import annotations

import asyncio
import os
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn  # noqa: E402  (after policy set)

# Import the app directly (not as the "main:app" string) so PyInstaller's
# import scanner picks it up and bundles main.py + its transitive deps.
from main import app  # noqa: E402


async def _serve() -> None:
    config = uvicorn.Config(
        app,
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        loop="asyncio",
    )
    server = uvicorn.Server(config)
    await server.serve()


def main() -> None:
    asyncio.run(_serve())


if __name__ == "__main__":
    main()
