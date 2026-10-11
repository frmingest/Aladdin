"""Pack Stitch Master object art for the app (offline dev tool, not run in CI).

Stitch gives opaque 1024x1024 PNGs on a flat white background. This script
  1. optionally fixes known flaws per image (see FIXES), then
  2. removes the white background by flood-fill from the border (so white
     INSIDE an object, e.g. a cream awning stripe, is kept),
  3. crops to the object, shrinks to <= 512 px on the long side, and
  4. writes WebP (quality 82) into frontend/public/art/objects/.

Masters stay outside the repo (frontend/public/art/stitch_master is untracked).
Needs: pip install pillow numpy scipy matplotlib opencv-python-headless

Usage:  python scripts/art/pack.py <stitch_master_dir> [--out frontend/public/art/objects]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

# output name -> (source folder prefix inside stitch_master, fix name or None)
JOBS = {
    "booth-goods": ("cartoon_fantasy_medieval_merchant_market_stall_booth", None),
    "sal-counter": ("cartoon_friendly_fantasy_merchant_representative_sal_booth", "sal_teal_blank_sign"),
}
MAX_SIDE = 512
WHITE_MIN = 232  # min(R,G,B) at or above this counts as background
ENCLOSED_WHITE_MIN = 244  # stricter test for white regions not connected to the border
ENCLOSED_MIN_AREA = 700  # px at 1024; ignores glints and small highlights


def sal_teal_blank_sign(rgb: np.ndarray) -> np.ndarray:
    """Stand-in for the S13 re-make: red awning stripes -> teal, sign lettering erased.

    Decision 3 (2026-10-11): no red awning, no baked text. Replace with a Stitch
    re-make (prompt S13) when it exists; then drop this fix.
    """
    import cv2
    import matplotlib.colors as mc

    hsv = mc.rgb_to_hsv(rgb.astype(float) / 255)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    yy, xx = np.mgrid[0 : rgb.shape[0], 0 : rgb.shape[1]]
    box = (xx > 425) & (xx < 825) & (yy > 215) & (yy < 385) & ~((xx > 765) & (yy > 335))
    red = ((h < 0.042) | (h > 0.94)) & (s > 0.38) & (v > 0.25) & box
    big = ndi.binary_closing(red, structure=np.ones((3, 3)), iterations=3)
    fill = big & box & (s > 0.25) & ((h < 0.062) | (h > 0.94))
    lab, n = ndi.label(fill)
    sizes = ndi.sum(fill, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z > 400])
    hsv[..., 0] = np.where(keep, 0.5, h)
    out = (mc.hsv_to_rgb(hsv) * 255).astype(np.uint8)

    x0, x1, y0, y1 = 568, 684, 200, 262  # the hanging sign plaque
    gray = cv2.cvtColor(out, cv2.COLOR_RGB2GRAY)
    sub = gray[y0:y1, x0:x1]
    mask = np.zeros(gray.shape, np.uint8)
    mask[y0:y1, x0:x1] = (sub < np.percentile(sub, 28)).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    return cv2.inpaint(out, mask, 5, cv2.INPAINT_TELEA)


FIXES = {"sal_teal_blank_sign": sal_teal_blank_sign}


def key_white(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(int)
    near = a.min(axis=2) >= WHITE_MIN
    lab, _ = ndi.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # Pure-white openings enclosed by the object (e.g. the open back of a stall)
    # are background too; cream and parchment stay because their min channel is lower.
    pure = a.min(axis=2) >= ENCLOSED_WHITE_MIN
    plab, pn = ndi.label(pure)
    if pn:
        sizes = ndi.sum(pure, plab, range(1, pn + 1))
        bg |= np.isin(plab, [i + 1 for i, z in enumerate(sizes) if z >= ENCLOSED_MIN_AREA])
    alpha = ndi.binary_opening(~bg, iterations=1).astype(np.uint8) * 255
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert("RGB")
    out.putalpha(alpha_img)
    return out


def pack(src: Path, fix: str | None) -> Image.Image:
    img = Image.open(src).convert("RGB")
    if fix:
        img = Image.fromarray(FIXES[fix](np.asarray(img)))
    keyed = key_white(img)
    bbox = keyed.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    keyed = keyed.crop(bbox)
    keyed.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return keyed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("master_dir", type=Path)
    ap.add_argument("--out", type=Path, default=Path("frontend/public/art/objects"))
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for name, (prefix, fix) in JOBS.items():
        matches = sorted(args.master_dir.glob(prefix + "*/screen.png"))
        if not matches:
            print(f"missing source for {name}", file=sys.stderr)
            return 1
        img = pack(matches[0], fix)
        dest = args.out / f"{name}.webp"
        img.save(dest, "WEBP", quality=82, method=6)
        print(f"{dest}  {img.size[0]}x{img.size[1]}  {dest.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
