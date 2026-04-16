from __future__ import annotations

from pathlib import Path

from db.client import get_conn


def init_db() -> None:
    schema_path = Path(__file__).with_name("schema.sql")
    sql = schema_path.read_text(encoding="utf-8")
    with get_conn() as conn:
        conn.execute(sql)


if __name__ == "__main__":
    init_db()
    print("DB schema applied")
