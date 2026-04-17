"""Initialize the RankForge schema on a Neon database.

THIS IS DESTRUCTIVE: the SQL in schema.sql begins with DROP TABLE IF EXISTS ...
CASCADE, which erases all content, links, and PageRank rows. Running this
against a database that has data will lose that data.

The script refuses to run unless either:
  - stdin is a TTY and the user types "yes" at the confirmation prompt, or
  - the --force flag is passed (for scripted / CI use).
"""
from __future__ import annotations

import sys
from pathlib import Path

from db.client import get_conn


def init_db() -> None:
    schema_path = Path(__file__).with_name("schema.sql")
    sql = schema_path.read_text(encoding="utf-8")
    with get_conn() as conn:
        conn.execute(sql)


def _confirm_destructive() -> bool:
    if "--force" in sys.argv:
        return True
    if not sys.stdin.isatty():
        print(
            "init_db.py refuses to run non-interactively without --force.\n"
            "  This drops and recreates content, content_links, content_rank.",
            file=sys.stderr,
        )
        return False
    print("This will DROP and RECREATE the content, content_links, and")
    print("content_rank tables on the database referenced by DATABASE_URL.")
    print("All existing rows will be lost.")
    answer = input('Type "yes" to proceed: ').strip().lower()
    return answer == "yes"


if __name__ == "__main__":
    if not _confirm_destructive():
        print("Aborted.")
        sys.exit(1)
    init_db()
    print("DB schema applied.")
