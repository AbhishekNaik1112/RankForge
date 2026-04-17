from __future__ import annotations

from pathlib import Path

from PIL import Image

THUMBNAIL_MAX_PX = 256
THUMBNAIL_FORMAT = "JPEG"
THUMBNAIL_QUALITY = 85


def make_thumbnail(image_path: str | Path, output_dir: str | Path) -> Path:
    """Generate a max-256px JPEG thumbnail alongside the original file.

    Returns the absolute path to the thumbnail.
    """
    src = Path(image_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    dest = out_dir / f"{src.stem}.thumb.jpg"

    with Image.open(src) as img:
        img = img.convert("RGB")
        img.thumbnail((THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX))
        img.save(dest, format=THUMBNAIL_FORMAT, quality=THUMBNAIL_QUALITY, optimize=True)

    return dest.resolve()
