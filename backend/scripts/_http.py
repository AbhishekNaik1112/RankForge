"""Private HTTP helpers shared by the seed_demo and diag scripts.

Intentionally stdlib-only so the scripts stay self-contained and do not pull
in requests/httpx as deps. This module is private (leading underscore); do
not import it from application code.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any


def get(base: str, path: str, timeout: float = 60.0) -> Any:
    with urllib.request.urlopen(f"{base}{path}", timeout=timeout) as resp:
        return json.loads(resp.read())


def post(base: str, path: str, body: dict | None = None, timeout: float = 60.0) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"} if data else {},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"POST {path} -> {e.code}: {detail}") from None


def require_backend(base: str) -> None:
    """Exit with a clear error if the backend isn't reachable at `base`."""
    try:
        result = get(base, "/health")
        if not isinstance(result, dict) or not result.get("ok"):
            raise RuntimeError(f"unhealthy response: {result!r}")
    except Exception as e:
        print(f"ERROR: backend not reachable at {base}")
        print(f"  {e}")
        print("  Start the backend first, or override the port env var.")
        sys.exit(1)
