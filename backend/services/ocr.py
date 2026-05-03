"""Scanned-PDF OCR fallback.

Triggered only when pypdf returns empty body for a PDF — most users will
never hit this code path (typed PDFs go through pypdf, fast). When it does
fire, we render each page to a 150-DPI image via PyMuPDF and run RapidOCR
(ONNX-runtime, CPU-only) over the result.

RapidOCR is lazy-loaded on first call (not in lifespan warmup) so users with
no scanned PDFs don't pay the ~3 s init cost.
"""
from __future__ import annotations

import io
from functools import lru_cache
from pathlib import Path

import numpy as np
import structlog
from PIL import Image

logger = structlog.get_logger(__name__)

# Cap the page count so a 500-page scanned book doesn't lock the ingest path
# for minutes. Most useful documents are < 50 pages; beyond that, the user
# should be using a search system designed for archives, not RankForge.
MAX_PAGES = 50

# 150 DPI balances OCR accuracy vs render time. 300 DPI is sharper but ~2x slower.
RENDER_DPI = 150


@lru_cache(maxsize=1)
def _get_engine():  # type: ignore[no-untyped-def]
    """Lazy-import RapidOCR — keeps the cold-import path of the backend clean
    when no scanned PDFs are ingested. ~70 MB of ONNX models load on first call."""
    from rapidocr_onnxruntime import RapidOCR  # noqa: WPS433

    logger.info("ocr_engine_loading")
    engine = RapidOCR()
    logger.info("ocr_engine_loaded")
    return engine


def ocr_pdf(path: Path) -> str:
    """Render each page of `path` and OCR. Returns concatenated text or "".
    Capped at MAX_PAGES to keep latency bounded on large scans."""
    import fitz  # noqa: WPS433  (PyMuPDF — heavy; lazy import)

    engine = _get_engine()

    page_texts: list[str] = []
    pages_processed = 0
    chars_total = 0

    with fitz.open(path) as doc:
        total_pages = len(doc)
        for idx, page in enumerate(doc):
            if idx >= MAX_PAGES:
                break
            pix = page.get_pixmap(dpi=RENDER_DPI)
            # Convert pixmap → PIL → numpy (RapidOCR accepts numpy arrays).
            # Going via PNG bytes is slightly slower but avoids stride/format
            # issues with non-RGB pixmaps (e.g. alpha-channel PDFs).
            png_bytes = pix.tobytes("png")
            with Image.open(io.BytesIO(png_bytes)) as img:
                arr = np.array(img.convert("RGB"))
            result, _elapse = engine(arr)
            if result:
                lines = [item[1] for item in result if item and len(item) >= 2]
                if lines:
                    page_texts.append("\n".join(lines))
            pages_processed += 1

    body = "\n\n".join(page_texts)
    chars_total = len(body)
    logger.info(
        "pdf_ocr_invoked",
        pages_total=total_pages,
        pages_processed=pages_processed,
        chars=chars_total,
    )
    return body
