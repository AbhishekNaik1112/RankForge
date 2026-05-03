"""Generate resources/icon.png — the source PNG that electron-builder
turns into platform icons (.ico / .icns) for the installer and window.

Concept: three descending ranked rows on an indigo→violet gradient.
Each row = a leading dot + a horizontal bar that gets shorter and
slightly more transparent toward the bottom. Reads as "ranked search
results" at a glance, distinctive even at 16×16.

Run from repo root:
    .venv/Scripts/python resources/build_icon.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "icon.png"
SIZE = 512  # source size; electron-builder downsamples for .ico/.icns

# Brand colors (match design tokens — indigo-500 → violet-500)
COLOR_TOP = (99, 102, 241)
COLOR_BOTTOM = (139, 92, 246)


def _draw_gradient(draw: ImageDraw.ImageDraw, size: int) -> None:
    """Linear top-left → bottom-right gradient via per-row blending."""
    for y in range(size):
        for x_step in (0, size):  # we'll fill with horizontal lines for speed
            pass
    # Faster: paint per scanline using diagonal interpolation t = (x+y)/(2*size)
    # Use a single horizontal-line approach with t = y/size as approximation.
    for y in range(size):
        t = y / (size - 1)
        r = round(COLOR_TOP[0] + t * (COLOR_BOTTOM[0] - COLOR_TOP[0]))
        g = round(COLOR_TOP[1] + t * (COLOR_BOTTOM[1] - COLOR_TOP[1]))
        b = round(COLOR_TOP[2] + t * (COLOR_BOTTOM[2] - COLOR_TOP[2]))
        draw.line([(0, y), (size, y)], fill=(r, g, b))


def _round_corners(img: Image.Image, radius: int) -> Image.Image:
    """Apply rounded-rectangle alpha mask to img."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.size[0], img.size[1]), radius=radius, fill=255
    )
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main() -> None:
    img = Image.new("RGB", (SIZE, SIZE))
    draw = ImageDraw.Draw(img)
    _draw_gradient(draw, SIZE)

    # Three ranked rows. Each row = leading dot + bar.
    # Coordinates as fractions of SIZE so the layout scales.
    pad_left_dot = SIZE * 0.27
    bar_left = SIZE * 0.39
    dot_radius = SIZE * 0.040
    bar_height = SIZE * 0.062
    y_centers = [SIZE * 0.31, SIZE * 0.50, SIZE * 0.69]
    bar_widths = [SIZE * 0.36, SIZE * 0.27, SIZE * 0.20]
    opacities = [255, 217, 178]  # 1.0, 0.85, 0.70

    # Switch to RGBA for alpha-on-white compositing
    img = img.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    for y, w, alpha in zip(y_centers, bar_widths, opacities):
        white = (255, 255, 255, alpha)
        # Dot
        od.ellipse(
            (
                pad_left_dot - dot_radius,
                y - dot_radius,
                pad_left_dot + dot_radius,
                y + dot_radius,
            ),
            fill=white,
        )
        # Bar
        od.rounded_rectangle(
            (
                bar_left,
                y - bar_height / 2,
                bar_left + w,
                y + bar_height / 2,
            ),
            radius=bar_height / 2,
            fill=white,
        )

    img = Image.alpha_composite(img, overlay)
    img = _round_corners(img, radius=int(SIZE * 0.235))

    img.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
