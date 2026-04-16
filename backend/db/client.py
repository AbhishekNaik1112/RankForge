from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg import Connection
from pgvector.psycopg import register_vector

from settings import require_database_url


@contextmanager
def get_conn() -> Iterator[Connection]:
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
