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

One-shot DB validation:
    python run.py --validate-db
With DATABASE_URL set in env. Tries a sync psycopg connect + SELECT 1 with
a short timeout, prints VALIDATION_OK or VALIDATION_ERROR: <msg>, exits 0/1.
Used by the setup wizard's "Test connection" button. Short-circuits BEFORE
any heavy imports (torch, sentence_transformers, uvicorn) so it's snappy.
"""
from __future__ import annotations

import os
import sys


def _validate_and_exit() -> None:
    """Connect to DATABASE_URL and exit. Tiny footprint — only psycopg loaded."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("VALIDATION_ERROR: DATABASE_URL env var is empty")
        sys.exit(1)
    try:
        import psycopg  # local import; avoids loading anything else if argv check fails

        with psycopg.connect(url, connect_timeout=8) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        print("VALIDATION_OK")
        sys.exit(0)
    except Exception as e:  # noqa: BLE001  (broad — psycopg has many error subtypes)
        # Trim the error to a single line so the renderer's parser can read it.
        msg = str(e).replace("\n", " ").strip() or e.__class__.__name__
        print(f"VALIDATION_ERROR: {msg}")
        sys.exit(1)


# Argv check FIRST — before any heavy imports.
if "--validate-db" in sys.argv:
    _validate_and_exit()


import asyncio  # noqa: E402

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
