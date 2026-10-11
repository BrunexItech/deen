"""Builds every brand asset from the official D.E.E.N logo and installs them in the app
and the website. Run after replacing the logo:  python assets/brand/build_assets.py

Source: deen-logo-original.jpeg (the logo on white; anything outside the white area is
ignored). The white background is removed, so the artwork works on any colour.

Outputs in assets/brand/, then copied to mobile/assets and web:
  deen-logo.png            lockup: emblem + D.E.E.N + full name, transparent
  deen-emblem.png          emblem only, square, transparent (UI, favicon, spinner)
  icon.png                 1024 store/launcher icon: emblem on white (no alpha)
  adaptive-foreground.png  1024 Android adaptive foreground, emblem inside the safe zone
  adaptive-background.png  1024 white
  monochrome.png           1024 Android 13+ themed icon (white silhouette)
  notification.png         96 white silhouette for the status bar
  splash.png               lockup for the splash screen (shown on white)
  favicon.png              512 emblem, transparent
"""
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SCALE = 3  # the source is small: upscale once, before cutting, for smooth edges

# Rows of the source image (measured on the 720px-wide original).
EMBLEM_ROWS = (470, 873)   # the tree-and-people emblem
LOCKUP_ROWS = (470, 1029)  # emblem + D.E.E.N + "Development & Education Empowerment Network"


def load() -> Image.Image:
    """The logo as RGBA with the white background keyed out."""
    rgb = Image.open(HERE / "deen-logo-original.jpeg").convert("RGB")
    rgb = rgb.resize((rgb.width * SCALE, rgb.height * SCALE), Image.LANCZOS)
    a = np.asarray(rgb).astype(np.float32)
    # Opacity from how far a pixel is from white; then undo the blend with white so
    # edges keep the true ink colour instead of a pale halo.
    alpha = np.clip((250 - a.min(axis=2)) / 110, 0, 1)
    safe = np.maximum(alpha, 1e-3)[..., None]
    ink = np.clip((a - 255 * (1 - safe)) / safe, 0, 255)
    return Image.fromarray(np.dstack([ink, alpha * 255]).astype(np.uint8), "RGBA")


def rows(im: Image.Image, top: int, bottom: int) -> Image.Image:
    part = im.crop((0, top * SCALE, im.width, bottom * SCALE))
    return part.crop(part.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox())


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


src = load()
emblem, lockup = rows(src, *EMBLEM_ROWS), rows(src, *LOCKUP_ROWS)

outputs = {
    "deen-logo.png": lockup,
    "deen-emblem.png": square(emblem, 1024, 0.98),
    "icon.png": square(emblem, 1024, 0.78, (255, 255, 255, 255)).convert("RGB"),
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

# Install: one source of truth, copied to where each app expects it.
INSTALL = {
    "deen-logo.png": ["mobile/assets/deen-logo.png", "web/public/deen-logo.png"],
    "deen-emblem.png": ["mobile/assets/deen-emblem.png", "web/public/deen-icon.png"],
    "icon.png": ["mobile/assets/icon.png", "web/src/app/apple-icon.png"],
    "adaptive-foreground.png": ["mobile/assets/android-icon-foreground.png"],
    "adaptive-background.png": ["mobile/assets/android-icon-background.png"],
    "monochrome.png": ["mobile/assets/android-icon-monochrome.png"],
    "notification.png": ["mobile/assets/notification-icon.png"],
    "splash.png": ["mobile/assets/splash-icon.png"],
    "favicon.png": ["mobile/assets/favicon.png", "web/src/app/icon.png"],
}
for name, targets in INSTALL.items():
    for target in targets:
        shutil.copyfile(HERE / name, ROOT / target)
print("✓ installed in mobile/assets and web")
