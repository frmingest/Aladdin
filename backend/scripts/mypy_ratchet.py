"""mypy ratchet: block any NEW type finding while the old ones are worked down (issue #389).

mypy has ~170 old findings in ``backend/app``. Fixing them all first would stall the money-math features, so the
gate is a ratchet instead: ``backend/mypy-baseline.txt`` lists every finding that existed when the ratchet was
introduced, and this script fails when mypy reports a finding that is not in that list. The baseline can only
shrink: fix a finding, run ``--update``, commit the shorter file.

A finding is identified by file, error code and message, NOT by line number, so moving code around does not
trip the gate. The same finding twice in one file counts twice.

Usage (from ``backend/``):
    python scripts/mypy_ratchet.py            # CI check: exit 1 on a new finding
    python scripts/mypy_ratchet.py --update   # rewrite the baseline (refuses to grow it)

Exit codes: 0 ok, 1 new findings, 2 mypy crashed or the baseline is unreadable.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

BASELINE = Path(__file__).resolve().parent.parent / "mypy-baseline.txt"
HEADER = (
    "# mypy baseline (issue #389). One finding per line: file::code::message (no line numbers).\n"
    "# Never add a line by hand. Fix a finding and run: python scripts/mypy_ratchet.py --update\n"
)
_FINDING = re.compile(r"^(?P<file>[^:\n]+):(?P<line>\d+):(?:\d+:)? error: (?P<msg>.*?)(?:  \[(?P<code>[\w-]+)\])?$")


def parse(output: str) -> list[tuple[str, str, str, int]]:
    """Return (file, code, message, line) for every ``error`` line of mypy output. Notes are ignored."""
    found = []
    for raw in output.splitlines():
        m = _FINDING.match(raw.strip())
        if m:
            found.append((m["file"].replace("\\", "/"), m["code"] or "none", m["msg"].strip(), int(m["line"])))
    return found


def key(file: str, code: str, msg: str) -> str:
    return f"{file}::{code}::{msg}"


def read_baseline(path: Path = BASELINE) -> Counter[str]:
    lines = [ln.rstrip("\n") for ln in path.read_text(encoding="utf-8").splitlines()]
    return Counter(ln for ln in lines if ln and not ln.startswith("#"))


def compare(found: list[tuple[str, str, str, int]], baseline: Counter[str]):
    """Return (new findings with line numbers, number of baseline entries no longer reported)."""
    seen: Counter[str] = Counter()
    new = []
    for file, code, msg, line in found:
        k = key(file, code, msg)
        seen[k] += 1
        if seen[k] > baseline[k]:
            new.append((file, line, code, msg))
    fixed = sum((baseline - seen).values())
    return new, fixed


def run_mypy() -> tuple[int, str]:
    proc = subprocess.run(
        [sys.executable, "-m", "mypy", "--no-error-summary"],
        capture_output=True,
        text=True,
        check=False,
        cwd=Path(__file__).resolve().parent.parent,
    )
    return proc.returncode, proc.stdout + proc.stderr


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--update", action="store_true", help="rewrite the baseline from the current mypy output")
    args = ap.parse_args(argv)

    status, output = run_mypy()
    if status >= 2:
        print(output)
        print(f"mypy crashed (exit {status}); the ratchet cannot judge.")
        return 2
    found = parse(output)
    current = Counter(key(f, c, m) for f, c, m, _ in found)

    if args.update:
        old = read_baseline() if BASELINE.exists() else Counter()
        grown = current - old
        if old and grown:
            print("Refusing to update: the baseline would GROW. Fix these instead:")
            for k, n in sorted(grown.items()):
                print(f"  +{n}  {k}")
            return 1
        BASELINE.write_text(HEADER + "".join(f"{k}\n" for k in sorted(current.elements())), encoding="utf-8")
        print(f"Baseline written: {sum(current.values())} findings (was {sum(old.values())}).")
        return 0

    try:
        baseline = read_baseline()
    except OSError as exc:
        print(f"Cannot read {BASELINE}: {exc}")
        return 2
    new, fixed = compare(found, baseline)
    print(f"mypy ratchet: {len(found)} findings now, {sum(baseline.values())} in the baseline.")
    if new:
        print(f"\n{len(new)} NEW finding(s) not in the baseline. Fix them (do not add `# type: ignore` without a reason):")
        for file, line, code, msg in new:
            print(f"  {file}:{line}: [{code}] {msg}")
        return 1
    if fixed:
        print(f"{fixed} baseline finding(s) are fixed. Shrink the baseline: python scripts/mypy_ratchet.py --update")
    return 0


if __name__ == "__main__":
    sys.exit(main())
