"""Pre-commit guard: no image over 150 KB outside the packed-art folder.

Stitch masters are 1 MB+ PNGs. If one lands in frontend/public/ Vite ships it to
Railway; this keeps them in art-masters/ (gitignored). Packed art in
frontend/src/assets/art is checked per file by a vitest test instead.
Usage (pre-commit passes the staged files): python scripts/art/check_image_sizes.py FILE...
"""
import sys
from pathlib import Path

LIMIT_KB = 150

bad = [(f, Path(f).stat().st_size // 1024) for f in sys.argv[1:] if Path(f).exists() and Path(f).stat().st_size > LIMIT_KB * 1024]
for f, kb in bad:
    print(f"{f}: {kb} KB (limit {LIMIT_KB} KB). Keep masters in art-masters/; pack art with scripts/art/pack.py.")
raise SystemExit(1 if bad else 0)
