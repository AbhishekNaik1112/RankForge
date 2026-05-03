"""Idempotent DB initializer for RankForge.

Behavior:
- Fresh DB (no tables)            → run all Alembic migrations to HEAD.
- Legacy DB (has `content` but    → stamp HEAD without re-running. The
  no `alembic_version` table)        existing schema is assumed to match 0001.
- Migrated DB (has both)          → upgrade to HEAD (no-op if up-to-date).

`init_db()` is safe to call repeatedly and is invoked from the FastAPI
lifespan in main.py — users do not need to run it manually.

For the destructive "wipe and rebuild" workflow (e.g. after editing a
migration in development), pass `--reset` on the command line. This
prompts for confirmation unless stdin is non-interactive AND `--force`
is also given.
"""
from __future__ import annotations

import sys
from pathlib import Path

import structlog
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from settings import require_database_url

logger = structlog.get_logger(__name__)

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def _sqlalchemy_url() -> str:
    """Force SQLAlchemy to use psycopg v3 (we don't ship psycopg2)."""
    url = require_database_url()
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


def _config() -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", _sqlalchemy_url())
    # The script_location in alembic.ini is relative to backend/; resolve.
    cfg.set_main_option(
        "script_location", str(Path(__file__).parent / "migrations")
    )
    return cfg


def _existing_tables() -> set[str]:
    engine = create_engine(_sqlalchemy_url())
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def init_db() -> None:
    cfg = _config()
    tables = _existing_tables()
    has_alembic = "alembic_version" in tables
    has_legacy = "content" in tables

    if has_legacy and not has_alembic:
        logger.info("alembic_stamp_legacy", revision="head")
        command.stamp(cfg, "head")
    else:
        logger.info("alembic_upgrade", target="head", fresh=not has_legacy)
        command.upgrade(cfg, "head")


def reset_db() -> None:
    """DESTRUCTIVE: drop everything Alembic-managed, then re-apply all migrations."""
    cfg = _config()
    tables = _existing_tables()
    if "content" in tables:
        # Downgrade to base if alembic tracks it; otherwise drop manually.
        if "alembic_version" in tables:
            command.downgrade(cfg, "base")
        else:
            engine = create_engine(_sqlalchemy_url())
            try:
                with engine.begin() as conn:
                    conn.exec_driver_sql("DROP TABLE IF EXISTS content_rank CASCADE")
                    conn.exec_driver_sql("DROP TABLE IF EXISTS content_links CASCADE")
                    conn.exec_driver_sql("DROP TABLE IF EXISTS content CASCADE")
            finally:
                engine.dispose()
    command.upgrade(cfg, "head")


def _confirm_destructive() -> bool:
    if "--force" in sys.argv:
        return True
    if not sys.stdin.isatty():
        print(
            "init_db.py --reset refuses to run non-interactively without --force.\n"
            "  This drops content, content_links, content_rank.",
            file=sys.stderr,
        )
        return False
    print("This will DROP all content tables on the database referenced by")
    print("DATABASE_URL and re-apply migrations. All existing rows will be lost.")
    return input('Type "yes" to proceed: ').strip().lower() == "yes"


if __name__ == "__main__":
    if "--reset" in sys.argv:
        if not _confirm_destructive():
            print("Aborted.")
            sys.exit(1)
        reset_db()
        print("DB reset and migrated to HEAD.")
    else:
        init_db()
        print("DB at HEAD.")
