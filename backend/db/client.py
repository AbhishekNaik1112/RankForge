"""Database connection management.

Two paths are exposed:
- `aget_conn()` (preferred): pulls a connection from a global AsyncConnectionPool.
  Used by all FastAPI routes and the async repository layer. Pool is opened
  via `open_pool()` from the app lifespan and closed via `close_pool()`.
- `get_conn()` (escape hatch): a one-off sync connection. Used by Alembic and
  any standalone script that doesn't want to bother with asyncio. Not pooled.

Both paths register the pgvector extension types on the connection so we can
pass numpy arrays directly as bind parameters.
"""
from __future__ import annotations

import asyncio
import sys

# psycopg's async mode requires the Selector event loop on Windows. Set the
# policy here, at first import of any DB module, so nothing downstream creates
# a Proactor loop. Safe to set repeatedly.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager, contextmanager  # noqa: E402
from typing import AsyncIterator, Iterator  # noqa: E402

import psycopg  # noqa: E402
from pgvector.psycopg import register_vector, register_vector_async  # noqa: E402
from psycopg import AsyncConnection, Connection  # noqa: E402
from psycopg_pool import AsyncConnectionPool  # noqa: E402

from settings import require_database_url  # noqa: E402

_pool: AsyncConnectionPool | None = None


async def _on_pool_connect(conn: AsyncConnection) -> None:
    """Run once per pooled connection: register pgvector types."""
    await register_vector_async(conn)


async def open_pool(min_size: int = 2, max_size: int = 10) -> None:
    """Open the global async connection pool. Idempotent."""
    global _pool
    if _pool is not None:
        return
    _pool = AsyncConnectionPool(
        require_database_url(),
        min_size=min_size,
        max_size=max_size,
        configure=_on_pool_connect,
        open=False,
    )
    await _pool.open()


async def close_pool() -> None:
    """Close the global async pool. Idempotent."""
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None


@asynccontextmanager
async def aget_conn() -> AsyncIterator[AsyncConnection]:
    """Async context manager yielding a pooled connection.

    Commits on clean exit, rolls back on exception. Caller must have ensured
    the pool is open via `open_pool()` first (the FastAPI lifespan handles this).
    """
    if _pool is None:
        raise RuntimeError(
            "DB pool not open. open_pool() must run during app startup."
        )
    async with _pool.connection() as conn:
        try:
            yield conn
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise


@contextmanager
def get_conn() -> Iterator[Connection]:
    """Sync escape hatch — opens a one-off connection (no pool).

    Use only from sync entry points (Alembic, standalone scripts). Routes
    and the repository layer should use `aget_conn()` instead.
    """
    conn = psycopg.connect(require_database_url())
    try:
        register_vector(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
