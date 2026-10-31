"""Step 2: make a 3D model from each prepped picture with Modly, on your own GPU.

Modly (https://github.com/lightningpixel/modly) is a desktop app. Start it, install a model
extension on its Models page (for example Hunyuan3D 2 Mini/Turbo), and leave it running. This
script drives Modly's own command-line tool (tools/modly-cli/agent.py) and writes
art-masters/3d/models/<slot>.glb (gitignored). It never touches the app's files.

  python scripts/3d/modly_generate.py --modly-dir "C:/path/to/modly" --ids hero,oracle
  python scripts/3d/modly_generate.py --modly-dir ... --dry-run     # show the commands only

The CLI call follows Modly's documented `generate --image ... --output ...`. If your Modly
version words it differently, run `python <modly>/tools/modly-cli/agent.py --help` and pass any
extra flags with --extra, for example --extra "--model hunyuan3d-2-mini".
Environment: MODLY_DIR can replace --modly-dir.
"""
from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREP = ROOT / "art-masters" / "3d" / "prep"
MODELS = ROOT / "art-masters" / "3d" / "models"
SLOTS = ["hero", "oracle", "partner", "fountain", "lamp", "board", "perch"]


def cli(modly_dir: Path) -> list[str]:
    agent = modly_dir / "tools" / "modly-cli" / "agent.py"
    if not agent.exists():
        raise SystemExit(f"Modly CLI not found: {agent}\nPass --modly-dir (the folder of the Modly repo) or set MODLY_DIR.")
    return [sys.executable, str(agent)]


def run(cmd: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--modly-dir", type=Path, default=os.environ.get("MODLY_DIR"))
    ap.add_argument("--ids", help="comma separated slots (default: every prepped picture)")
    ap.add_argument("--extra", default="", help="extra flags for the generate command, as one string")
    ap.add_argument("--force", action="store_true", help="redo models that already exist")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timeout", type=int, default=1800, help="seconds per model")
    args = ap.parse_args()
    if not args.modly_dir:
        raise SystemExit("Give --modly-dir or set MODLY_DIR.")
    base = cli(Path(args.modly_dir))
    wanted = args.ids.split(",") if args.ids else SLOTS
    MODELS.mkdir(parents=True, exist_ok=True)

    if not args.dry_run:
        health = run(base + ["health"], 60)
        print(health.stdout.strip() or health.stderr.strip())
        if health.returncode != 0:
            print("Modly is not answering. Start the Modly app, wait for it to load, and try again.", file=sys.stderr)
            return 2

    failed = 0
    for slot in wanted:
        image, out = PREP / f"{slot}.png", MODELS / f"{slot}.glb"
        if not image.exists():
            print(f"{slot}: no prepped picture ({image}); run prep_images.py first")
            failed += 1
            continue
        if out.exists() and not args.force:
            print(f"{slot}: already made, skipping (--force to redo)")
            continue
        cmd = base + ["generate", "--image", str(image), "--output", str(out), *shlex.split(args.extra)]
        print(f"{slot}: " + " ".join(shlex.quote(c) for c in cmd))
        if args.dry_run:
            continue
        try:
            done = run(cmd, args.timeout)
        except subprocess.TimeoutExpired:
            print(f"{slot}: timed out after {args.timeout}s")
            failed += 1
            continue
        if done.returncode != 0 or not out.exists():
            print(f"{slot}: FAILED\n{done.stdout[-600:]}\n{done.stderr[-600:]}")
            failed += 1
        else:
            print(f"{slot}: ok, {out.stat().st_size / 1024:.0f} KB")
    print(f"done, {failed} problem(s). Next: python scripts/3d/optimize_glb.py")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
