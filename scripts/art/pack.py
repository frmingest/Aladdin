"""Pack Stitch Master object art for the app (offline dev tool, not run in CI).

Reads scripts/art/manifest.json and, for each object,
  1. keys the background out with the object's key mode (see KEY_MODES),
  2. optionally trims a baked ground line (crop_bottom_px, in master pixels),
  3. crops to the object, shrinks to max_side and writes WebP, then
  4. writes frontend/src/lib/artManifest.ts (the typed id -> file, size, anchors
     map the app imports) and a contact sheet for review.

Output goes to frontend/src/assets/art/<id>.webp. Vite content-hashes those
files at build time, so a changed picture never serves stale from a cache.

Masters stay OUTSIDE the shipped tree: put the Design_master folder at
art-masters/Design_master (gitignored; Vite never sees it). Never under public/.

Key modes (manifest "key"):
  white         flood-fill from the border over near-white; white INSIDE the
                object (a cream awning stripe) is kept. Default. "enclosed": false
                also keeps big pure-white regions inside (the genie's white cloud).
  sampled       like white, but the background colour is sampled from the
                border (Sal's busts sit on a pale lavender or cream tint).
  glow          soft alpha from the distance to white, for glow and smoke that
                a flood fill would leave a halo around (the fire arrow).
  erase-shadow  white key plus removal of a pale neutral cast shadow that
                touches the background (the trading port).

Needs: pip install pillow numpy scipy

Usage:
  python scripts/art/pack.py                       # all objects
  python scripts/art/pack.py --only spire-granite  # a subset (comma separated)
  python scripts/art/pack.py --masters path/to/Design_master
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("manifest.json")
DEFAULT_MASTERS = ROOT / "art-masters" / "Design_master"
OUT_DIR = ROOT / "frontend" / "src" / "assets" / "art"
TS_OUT = ROOT / "frontend" / "src" / "lib" / "artManifest.ts"
SHEET_OUT = Path(__file__).with_name("contact-sheet.png")  # gitignored

WHITE_MIN = 232  # min(R,G,B) at or above this counts as background
ENCLOSED_WHITE_MIN = 244  # stricter test for white regions not connected to the border
ENCLOSED_MIN_AREA = 700  # px at 1024; ignores glints and small highlights
SAMPLED_TOL = 22  # max channel distance from the sampled border colour
SHADOW_MIN = 170  # erase-shadow: lightest-channel floor for a "pale" pixel
SHADOW_SAT_MAX = 0.14  # erase-shadow: max saturation for a neutral grey
KEY_MODES = ("white", "sampled", "glow", "erase-shadow")


def _soft_alpha(opaque: np.ndarray) -> Image.Image:
    alpha = ndi.binary_opening(opaque, iterations=1).astype(np.uint8) * 255
    return Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))


def _border_labels(mask: np.ndarray) -> np.ndarray:
    lab, _ = ndi.label(mask)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(border))


def key_white(img: Image.Image, white_min: int = WHITE_MIN, enclosed: bool = True) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(int)
    bg = _border_labels(a.min(axis=2) >= white_min)
    # Pure-white openings enclosed by the object (e.g. the open back of a stall)
    # are background too; cream and parchment stay because their min channel is lower.
    pure = a.min(axis=2) >= ENCLOSED_WHITE_MIN
    plab, pn = ndi.label(pure) if enclosed else (None, 0)
    if pn:
        sizes = ndi.sum(pure, plab, range(1, pn + 1))
        bg |= np.isin(plab, [i + 1 for i, z in enumerate(sizes) if z >= ENCLOSED_MIN_AREA])
    out = img.convert("RGB")
    out.putalpha(_soft_alpha(~bg))
    return out


def key_sampled(img: Image.Image, tol: int = SAMPLED_TOL) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg_rgb = np.median(border, axis=0)
    near = np.abs(a - bg_rgb).max(axis=2) <= tol
    bg = _border_labels(near)
    out = img.convert("RGB")
    out.putalpha(_soft_alpha(~bg))
    return out


def key_glow(img: Image.Image) -> Image.Image:
    """Un-premultiply from white: alpha = 1 - min(R,G,B)/255, colour = c - white*(1-alpha)."""
    a = np.asarray(img.convert("RGB")).astype(float) / 255.0
    alpha = np.clip(1.0 - a.min(axis=2), 0.0, 1.0)
    # Faint haze below ~6% is background noise; stretch the rest so cores stay solid.
    alpha = np.clip((alpha - 0.06) / 0.5, 0.0, 1.0)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1.0 - safe)) / safe, 0.0, 1.0)
    out = np.dstack([rgb, alpha])
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def key_erase_shadow(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(int)
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    pale_neutral = (mn >= SHADOW_MIN) & (sat <= SHADOW_SAT_MAX)
    bg = _border_labels(pale_neutral)
    out = img.convert("RGB")
    out.putalpha(_soft_alpha(~bg))
    return out


def key_image(img: Image.Image, spec: dict) -> Image.Image:
    mode = spec.get("key", "white")
    if mode == "white":
        return key_white(img, spec.get("white_min", WHITE_MIN), spec.get("enclosed", True))
    if mode == "sampled":
        return key_sampled(img, spec.get("tol", SAMPLED_TOL))
    if mode == "glow":
        return key_glow(img)
    if mode == "erase-shadow":
        return key_erase_shadow(img)
    raise ValueError(f"unknown key mode {mode!r} for {spec['id']}")


def pack(src: Path, spec: dict, max_side: int) -> tuple[Image.Image, dict]:
    """Returns the packed picture and its anchors as fractions of that picture."""
    img = Image.open(src).convert("RGB")
    trim = int(spec.get("crop_bottom_px", 0))
    if trim:
        img = img.crop((0, 0, img.width, img.height - trim))
    keyed = key_image(img, spec)
    bbox = keyed.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    keyed = keyed.crop(bbox)
    keyed.thumbnail((spec.get("max_side", max_side),) * 2, Image.LANCZOS)
    anchors = anchors_to_fractions(spec.get("anchors_px", {}), bbox)
    anchors.update(spec.get("anchors_frac", {}))  # already fractions of the packed picture
    return keyed, anchors


def anchors_to_fractions(anchors_px: dict, bbox: tuple[int, int, int, int]) -> dict:
    """Master-pixel anchors -> fractions [x, y] of the cropped picture.

    Points ("door", "w1") are measured from the crop's top-left; names ending in
    "-size" are scaled only. Measured once per pose in master pixels, so every
    material that shares a pose can share one set even though each crops differently.
    """
    x0, y0, x1, y1 = bbox
    out = {}
    for name, (px, py) in anchors_px.items():
        if name.endswith("-size"):
            out[name] = [round(px / (x1 - x0), 4), round(py / (y1 - y0), 4)]
        else:
            out[name] = [round((px - x0) / (x1 - x0), 4), round((py - y0) / (y1 - y0), 4)]
    return out


def load_manifest() -> tuple[dict, list[dict]]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    objects = data["objects"]
    ids = [o["id"] for o in objects]
    if len(ids) != len(set(ids)):
        raise SystemExit("manifest has duplicate ids")
    for o in objects:
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", o["id"]):
            raise SystemExit(f"bad id {o['id']!r} (lower-case words joined by '-')")
        if o.get("key", "white") not in KEY_MODES:
            raise SystemExit(f"{o['id']}: unknown key mode {o.get('key')!r}")
    return data.get("defaults", {}), objects


def camel(object_id: str) -> str:
    first, *rest = object_id.split("-")
    return first + "".join(w.capitalize() for w in rest)


def write_ts(entries: list[dict]) -> None:
    lines = [
        "// GENERATED by scripts/art/pack.py from scripts/art/manifest.json. Do not edit by hand.",
        "// Pictures live in src/assets/art; Vite content-hashes them at build time.",
        "",
    ]
    for e in entries:
        lines.append(f'import {camel(e["id"])} from "../assets/art/{e["id"]}.webp";')
    lines += ["", "export interface PackedArt {", "  src: string;", "  width: number;", "  height: number;",
              "  /** Empty = decorative: the page already says it in words. */", "  alt: string;",
              "  /** Named points as fractions [x, y] of the picture (0-1), for code overlays. */",
              "  anchors?: Record<string, readonly [number, number]>;", "}", "",
              "export const ART_MANIFEST = {"]
    for e in entries:
        parts = [f'src: {camel(e["id"])}', f'width: {e["width"]}', f'height: {e["height"]}', 'alt: ""']
        if e.get("anchors"):
            anchors = ", ".join(f'"{k}": [{v[0]}, {v[1]}] as const' for k, v in e["anchors"].items())
            parts.append(f"anchors: {{ {anchors} }}")
        lines.append(f'  "{e["id"]}": {{ {", ".join(parts)} }},')
    lines += ["} as const satisfies Record<string, PackedArt>;", ""]
    TS_OUT.write_text("\n".join(lines), encoding="utf-8")


def contact_sheet(entries: list[dict]) -> None:
    cell, cols = 200, 8
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 16)), (214, 218, 226))
    draw = ImageDraw.Draw(sheet)
    for i, e in enumerate(entries):
        tile = Image.open(OUT_DIR / f'{e["id"]}.webp').convert("RGBA")
        tile.thumbnail((cell - 12, cell - 12))
        x, y = (i % cols) * cell, (i // cols) * (cell + 16)
        sheet.paste(tile, (x + (cell - tile.width) // 2, y + (cell - tile.height) // 2), tile)
        draw.text((x + 4, y + cell), e["id"], fill=(30, 30, 50))
    sheet.save(SHEET_OUT)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--masters", type=Path, default=DEFAULT_MASTERS)
    ap.add_argument("--only", help="comma-separated ids to rewrite; the generated manifest still lists every id")
    args = ap.parse_args()

    defaults, objects = load_manifest()
    max_side = int(defaults.get("max_side", 448))
    quality = int(defaults.get("quality", 80))
    only = set(args.only.split(",")) if args.only else None
    unknown = (only or set()) - {o["id"] for o in objects}
    if unknown:
        print(f"unknown ids: {sorted(unknown)}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    for spec in objects:
        dest = OUT_DIR / f'{spec["id"]}.webp'
        src = args.masters / spec["source"] / "screen.png"
        if not src.exists():
            print(f'missing master for {spec["id"]}: {src}', file=sys.stderr)
            return 1
        # Always packed (cheap) so the generated manifest keeps every anchor;
        # --only just limits which files are rewritten.
        img, anchors = pack(src, spec, max_side)
        if anchors:
            spec = {**spec, "anchors": anchors}
        if only is None or spec["id"] in only:
            img.save(dest, "WEBP", quality=int(spec.get("quality", quality)), method=6)
            print(f'{spec["id"]:20s} {img.size[0]:4d}x{img.size[1]:<4d} {dest.stat().st_size / 1024:5.1f} KB')
        with Image.open(dest) as packed:
            entries.append({**spec, "width": packed.width, "height": packed.height})

    write_ts(entries)
    contact_sheet(entries)
    total = sum((OUT_DIR / f'{e["id"]}.webp').stat().st_size for e in entries)
    print(f"{len(entries)} pictures, {total / 1024:.0f} KB total; wrote {TS_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
