"""Step 1: turn Stitch pictures into clean inputs for an image-to-3D tool (Modly).

Reads Stitch export folders (each holds a screen.png), keys the white background out with
the same key as scripts/art/pack.py, crops to the object, and writes a square transparent PNG
with a margin to art-masters/3d/prep/<slot>.png (gitignored, never shipped).

Slots: hero (front view), oracle, partner, fountain, lamp, board, perch. The hero back and side
pictures are prepped too (hero_back, hero_side) for multi-view models.

Usage:
  python scripts/3d/prep_images.py --src "E:/Aladdin/frontend/public/art/New folder"
  python scripts/3d/prep_images.py --src "<folder>" --size 1024 --only hero,oracle
Needs: pip install pillow numpy scipy
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "art"))
from pack import key_white  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-masters" / "3d" / "prep"

# slot -> words that must all appear in the Stitch folder name (lower case). First match wins.
RULES: list[tuple[str, tuple[str, ...]]] = [
    ("hero_back", ("hero", "back")),
    ("hero_side", ("hero", "side")),
    ("hero", ("hero", "front")),
    ("oracle", ("oracle",)),
    ("partner", ("partner",)),
    ("fountain", ("fountain",)),
    ("lamp", ("lamp",)),
    ("board", ("notice",)),
    ("perch", ("perch",)),
]


def slot_for(folder: str) -> str | None:
    name = folder.lower()
    for slot, words in RULES:
        if all(w in name for w in words):
            return slot
    return None


def prep(src: Path, size: int, margin: float) -> Image.Image:
    img = key_white(Image.open(src).convert("RGB"))
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    inner = int(size * (1 - 2 * margin))
    img.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, required=True, help="folder with Stitch export folders (searched recursively)")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--margin", type=float, default=0.08)
    ap.add_argument("--only", help="comma separated slots")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None
    args.out.mkdir(parents=True, exist_ok=True)
    seen: dict[str, Path] = {}
    for png in sorted(args.src.rglob("screen.png")):
        slot = slot_for(png.parent.name)
        if slot is None:
            print(f"skip (no slot): {png.parent.name[:70]}")
            continue
        # a later (re-done) picture in a sub-folder like "das" wins over an older one
        if slot in seen and png.stat().st_mtime < seen[slot].stat().st_mtime:
            continue
        seen[slot] = png
    if not seen:
        print("no screen.png files found", file=sys.stderr)
        return 1
    for slot, png in seen.items():
        if only and slot not in only:
            continue
        prep(png, args.size, args.margin).save(args.out / f"{slot}.png")
        print(f"{slot:10s} <- {png.parent.name[:60]}")
    print(f"wrote {len(seen)} pictures to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
