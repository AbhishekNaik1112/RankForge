"""Text chunker for the multimodal ingest pipeline.

Why chunking matters here: CLIP-ViT-B/32's text encoder has a hard 77-token
context window. Long bodies are silently truncated to ~50-60 words. We split
into ~64-token chunks (256 chars, conservative for English BPE) with 32-char
overlap so every chunk fits comfortably under CLIP's window with margin.

Strategy: sliding-window split with bias toward natural breakpoints
(sentence/newline/space). Prefer to break at the rightmost sentence boundary
within the lookback window; fall back to newline, then space, then hard char.
"""
from __future__ import annotations

DEFAULT_CHUNK_SIZE = 256
DEFAULT_OVERLAP = 32

# When deciding where to break a chunk, look back at most these many chars
# from the target end for a natural boundary. Tuned to match the chunk size.
_BOUNDARY_LOOKBACKS: list[tuple[str, int]] = [
    (". ", 100),
    ("\n", 80),
    (" ", 50),
]


def split(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> list[str]:
    """Split `text` into chunks of approximately `chunk_size` chars with
    `overlap` chars of context shared between consecutive chunks.

    Empty / whitespace-only input → empty list.
    Short input (≤chunk_size) → single chunk (the whole thing).
    Long input → sliding window with sentence-aware breakpoints.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]
    if overlap >= chunk_size:
        raise ValueError(f"overlap ({overlap}) must be < chunk_size ({chunk_size})")

    chunks: list[str] = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)

        # Try to break at a natural boundary near the chunk end.
        if end < n:
            for sep, lookback in _BOUNDARY_LOOKBACKS:
                idx = text.rfind(sep, start, end)
                if idx > start + (chunk_size - lookback):
                    end = idx + len(sep)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break
        start = end - overlap

    return chunks
