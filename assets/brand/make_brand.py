"""Generates the DEEN brand mark in every size the apps need.

    python3 assets/brand/make_brand.py      (needs inkscape on PATH)

The mark: an 8-point star (khatam, two overlapping squares) framing an arched
doorway — the door of opportunity — with a single point of light above it."""
import math
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent
EMERALD_TOP, EMERALD_BOTTOM = "#11775F", "#04291F"
GOLD_LIGHT, GOLD_DARK = "#F1D78A", "#B7862C"
CREAM = "#FBF3DC"


def star_points(cx, cy, a):
    """Union outline of two squares (half-side a), one rotated 45 degrees."""
    outer, inner = a * math.sqrt(2), a / math.cos(math.radians(22.5))
    pts = []
    for k in range(16):
        ang = math.radians(k * 22.5 - 90)
        r = outer if k % 2 == 0 else inner
        pts.append(f"{cx + r * math.cos(ang):.1f},{cy + r * math.sin(ang):.1f}")
    return " ".join(pts)


def mark(cx=512, cy=512, scale=1.0, mono=None):
    a = 232 * scale
    stroke = 24 * scale
    door_w, door_h = 158 * scale, 214 * scale
    base = cy + 112 * scale
    left, right = cx - door_w / 2, cx + door_w / 2
    top = base - door_h
    r = door_w / 2
    arch = f"M{left:.1f},{base:.1f} V{top + r:.1f} A{r:.1f},{r:.1f} 0 0 1 {right:.1f},{top + r:.1f} V{base:.1f} Z"
    # Light spilling out of the open door onto a path that widens towards the viewer.
    spread, depth = 46 * scale, 92 * scale
    path = (f"M{left:.1f},{base:.1f} L{right:.1f},{base:.1f} L{right + spread:.1f},{base + depth:.1f} "
            f"L{left - spread:.1f},{base + depth:.1f} Z")
    light_y = top - 46 * scale
    gold = mono or "url(#gold)"
    frame = mono or "url(#cream)"
    inner_fill = "none" if mono else "url(#glow)"
    door_light = mono or "url(#doorlight)"
    spill = mono or "url(#spill)"
    return f"""
  <polygon points="{star_points(cx, cy, a)}" fill="{inner_fill}" stroke="{gold}" stroke-width="{stroke:.1f}" stroke-linejoin="round"/>
  <path d="{path}" fill="{spill}" opacity="{1 if mono else 0.9}"/>
  <path d="{arch}" fill="{door_light}" stroke="{frame}" stroke-width="{18 * scale:.1f}" stroke-linejoin="round"/>
  <circle cx="{cx}" cy="{light_y:.1f}" r="{16 * scale:.1f}" fill="{gold}"/>"""


DEFS = f"""<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="{EMERALD_TOP}"/><stop offset="1" stop-color="{EMERALD_BOTTOM}"/>
  </linearGradient>
  <radialGradient id="halo" cx="0.5" cy="0.42" r="0.55">
    <stop offset="0" stop-color="#2FBF93" stop-opacity="0.38"/><stop offset="1" stop-color="#2FBF93" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{GOLD_LIGHT}"/><stop offset="0.55" stop-color="#D9B25A"/><stop offset="1" stop-color="{GOLD_DARK}"/>
  </linearGradient>
  <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFBEF"/><stop offset="1" stop-color="{CREAM}"/>
  </linearGradient>
  <linearGradient id="doorlight" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF6D6"/><stop offset="0.6" stop-color="#F3D27E"/><stop offset="1" stop-color="#E2B654"/>
  </linearGradient>
  <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F6DC92" stop-opacity="0.95"/><stop offset="1" stop-color="#F6DC92" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
    <stop offset="0" stop-color="#1A8C6F" stop-opacity="0.55"/><stop offset="1" stop-color="#0B5D4B" stop-opacity="0.15"/>
  </radialGradient>
</defs>"""


def svg(body, size=1024, background=True):
    bg = f'<rect width="{size}" height="{size}" fill="url(#bg)"/><rect width="{size}" height="{size}" fill="url(#halo)"/>' if background else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{DEFS}{bg}{body}</svg>'


FILES = {
    "icon.svg": svg(mark()),                                   # store icon / iOS (full bleed, OS masks it)
    "adaptive-foreground.svg": svg(mark(scale=0.78), background=False),  # inside the 66% safe zone
    "adaptive-background.svg": svg(""),
    "splash.svg": svg(mark(scale=0.9), background=False),
    "notification.svg": svg(mark(scale=0.95, mono="#FFFFFF"), background=False),
    "monochrome.svg": svg(mark(scale=0.78, mono="#FFFFFF"), background=False),
    "favicon.svg": svg(mark(scale=1.18)),
}
SIZES = {"icon.svg": 1024, "adaptive-foreground.svg": 1024, "adaptive-background.svg": 1024, "splash.svg": 1024,
         "notification.svg": 96, "monochrome.svg": 1024, "favicon.svg": 512}

for name, content in FILES.items():
    (OUT / name).write_text(content)
    png = OUT / name.replace(".svg", ".png")
    subprocess.run(["inkscape", str(OUT / name), "--export-type=png", f"--export-filename={png}",
                    f"--export-width={SIZES[name]}"], check=True, capture_output=True)
    print("✓", png.name)
