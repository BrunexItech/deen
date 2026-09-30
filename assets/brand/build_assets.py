"""Builds every brand asset from the official DEEN logo (deen-logo-original.png, 1024×1024,
transparent). Run after replacing the logo:  python assets/brand/build_assets.py

Outputs (all in assets/brand/):
  deen-logo.png            full lockup (emblem + DEEN + tagline), trimmed, transparent
  deen-emblem.png          emblem only, square, transparent (UI, favicon, spinner)
  icon.png                 1024 store/launcher icon: emblem on white, full bleed (no alpha)
  adaptive-foreground.png  1024 Android adaptive foreground, emblem inside the 66% safe zone
  adaptive-background.png  1024 white
  monochrome.png           1024 Android 13+ themed icon (white silhouette)
  notification.png         96 white silhouette for the status bar
  splash.png               lockup for the splash screen (shown on white)
  favicon.png              512 emblem, transparent
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = Image.open(HERE / "deen-logo-original.png").convert("RGBA")
ALPHA_MIN = 8  # ignore near-invisible halo pixels when trimming

# The emblem sits above the wordmark; the gap between them is fully transparent.
EMBLEM_BOX = (320, 140, 704, 540)
LOCKUP_BOX = (230, 140, 790, 750)


def trim(im: Image.Image) -> Image.Image:
    a = im.getchannel("A").point(lambda v: 255 if v > ALPHA_MIN else 0)
    return im.crop(a.getbbox())


def square(im: Image.Image, size: int, fill: float, bg=(0, 0, 0, 0)) -> Image.Image:
    """Centre `im` on a square canvas, scaled so its longest side is `fill` of the canvas."""
    canvas = Image.new("RGBA", (size, size), bg)
    scale = fill * size / max(im.size)
    art = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def silhouette(im: Image.Image) -> Image.Image:
    white = Image.new("RGBA", im.size, (255, 255, 255, 255))
    white.putalpha(im.getchannel("A"))
    return white


emblem = trim(SRC.crop(EMBLEM_BOX))
lockup = trim(SRC.crop(LOCKUP_BOX))

outputs = {
    "deen-logo.png": lockup,
    "deen-emblem.png": square(emblem, 1024, 0.98),
    "icon.png": square(emblem, 1024, 0.74, (255, 255, 255, 255)).convert("RGB"),
    "adaptive-foreground.png": square(emblem, 1024, 0.56),
    "adaptive-background.png": Image.new("RGB", (1024, 1024), (255, 255, 255)),
    "monochrome.png": square(silhouette(emblem), 1024, 0.56),
    "notification.png": square(silhouette(emblem), 96, 0.9),
    "splash.png": square(lockup, 1024, 0.9),
    "favicon.png": square(emblem, 512, 0.96),
}
for name, img in outputs.items():
    img.save(HERE / name, optimize=True)
    print("✓", name, img.size)
