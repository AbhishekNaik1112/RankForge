"""structlog setup for the RankForge backend.

Two outputs:
- stdout (ConsoleRenderer, no ANSI colors) — Electron's main process pipes these
  into its own `[backend] ...` log lines.
- {LOG_DIR}/rankforge.jsonl (JSONRenderer) — machine-readable, persisted across
  restarts. Only enabled if LOG_DIR is set (passed in by Electron main).

Call setup_logging() once at FastAPI startup. Subsequent calls are a no-op.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import structlog

_configured = False


def setup_logging(log_dir: str | Path | None = None, level: int = logging.INFO) -> None:
    global _configured
    if _configured:
        return

    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    structlog.configure(
        processors=shared_processors
        + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter_console = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(colors=False),
        ],
    )
    formatter_json = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )

    handlers: list[logging.Handler] = []

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter_console)
    handlers.append(console)

    if log_dir:
        path = Path(log_dir)
        path.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(path / "rankforge.jsonl", encoding="utf-8")
        file_handler.setFormatter(formatter_json)
        handlers.append(file_handler)

    root = logging.getLogger()
    root.handlers.clear()
    for h in handlers:
        root.addHandler(h)
    root.setLevel(level)

    _configured = True
