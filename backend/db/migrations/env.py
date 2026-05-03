"""Alembic env — online migrations against DATABASE_URL from settings.py."""
from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make 'backend' importable so we can pull DATABASE_URL from settings.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from settings import require_database_url  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _sqlalchemy_url() -> str:
    """Force SQLAlchemy to use psycopg v3 (psycopg2 isn't installed)."""
    url = require_database_url()
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


# Inject DATABASE_URL at runtime — alembic.ini intentionally leaves it blank.
config.set_main_option("sqlalchemy.url", _sqlalchemy_url())

# Migrations are pure SQL via op.execute(); no ORM models to autogenerate from.
target_metadata = None


def run_migrations_offline() -> None:
    """Generate SQL without connecting (alembic upgrade --sql)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
