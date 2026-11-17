# Backend type check: mypy ratchet (2026-11-17, issue #389, step 1)

**Status:** PR adds it (written, not merged, not yet run in CI). Replaces the report-only job described in
[mypy-report-only-2026-10-14.md](mypy-report-only-2026-10-14.md).

## What it is for

mypy finds 173 old problems in `backend/app` (measured in this session, Python 3.12, the pins in `requirements-dev.txt`;
the 2026-10-14 note said 166). Fixing all of them first would stall the next money-math features (#384, #385), and a
report nobody has to read lets new ones in. The ratchet does the middle thing: **old findings are tolerated, a new one fails the build.**

## How it works

- `backend/mypy-baseline.txt` lists every old finding as `file::code::message`. No line numbers, so moving code does not trip it.
  The same finding twice in one file counts twice.
- `backend/scripts/mypy_ratchet.py` runs mypy and compares. A finding not in the baseline fails with its file and line (exit 1).
  A mypy crash fails with exit 2. A fixed finding does not fail; the script says how to shrink the baseline.
- `python scripts/mypy_ratchet.py --update` rewrites the baseline and **refuses to grow it**.
- CI job **Type check (mypy ratchet)** is no longer `continue-on-error`. It prints the result in the run summary.
- 5 unit tests in `backend/tests/unit/test_mypy_ratchet.py`.

## Checked in this session

Baseline written (173 lines); check passes (exit 0); a probe file with one new type error fails (exit 1, names the line); `--update`
with that probe refuses to grow the baseline (exit 1); ruff clean; full backend suite 2,159 passed, 2 skipped.
Not yet seen: the job on GitHub's runner. Its count may differ by a few findings if CI resolves a different package version;
if the first CI run is red on findings nobody touched, regenerate the baseline on that run's versions: empty the file below its two `#` header lines, run `python scripts/mypy_ratchet.py --update` with CI's Python 3.12 and pins, commit it. (`--update` only refuses to grow a baseline that already has lines.)

## Branch protection

Nothing stops a merge while `main` has no branch protection (#377, Faiz sets it). Until then "blocking" means the PR shows red. When #377 is done, add the check name `Type check (mypy ratchet)` to the required list; the old name `Type check (mypy, report only)` no longer exists.

## Still open on #389 (not in this PR)

- Step 2: add the missing stubs. Step 3: clear findings package by package, money code first (`ixbrl.py` 30, `system_status.py` 22, `game/state.py` 16, `game/ravens.py` 11 were the biggest in the October count).
- Review the 50 `# type: ignore` lines in money and backtest code.
- Zero findings is the stretch goal; the ratchet is the must-have, and it also satisfies the gate Faiz set for starting #384 and #385 ("item 6, step 1").

## Cleanup of the baseline (#455)

**Status:** the PR for #455 empties the baseline (173 findings to 0 on Python 3.12 with the pins in `requirements-dev.txt`) and
turns on `warn_unused_ignores`. Written, not merged, not yet run in CI.

- **Stubs (step 2 of #389):** nothing to add. The only import mypy cannot type is `yfinance`, which has no stubs package; its
  override in `pyproject.toml` stays.
- **How the findings went:** most were Optional values mypy could not see were set (`Decimal | None` sums, `UUID | None`
  lookups, `datetime | None` helpers), `str` where the schema has a `Literal`, and reused variable names. Fixes are narrowing,
  overloads (`_aware`, `_utc`, `_q`, `_r`, `_day_out`), Literal return types on the game rules, and a typed schema registry
  (`BlindPassOutput`). No arithmetic was moved or reworded.
- **`# type: ignore`:** 50 before, 20 after. All 20 now carry a reason on the same line. `warn_unused_ignores` makes an
  ignore that stops being needed a finding, so they cannot pile up silently.
- **Behaviour that is not type-only (each was an AttributeError, TypeError or response-validation error before):**
  - the equity note in `ixbrl.py` skips a year with no total-equity fact;
  - `GET` precious-metals history in demo mode returns 404 for a metal with no demo series (was a 500);
  - the watchlist row returns 404 if its holding is gone;
  - `imported_at` on the ESEF and Newsweb responses is parsed from the stored ISO string, and an empty or unreadable one becomes null;
  - the multiples helper in `metrics.py` skips a ratio whose denominator fact is stored as None, with the "missing" reason.
- **Ratchet:** `mypy-baseline.txt` holds only its two header lines. The job still compares against it, so a new finding fails
  the build. `test_committed_baseline_is_well_formed` no longer requires a non-empty baseline.
- Checked in this session: `mypy` clean (327 files), ruff clean, full backend suite 2,159 passed, 2 skipped. Not seen: the job on
  GitHub's runner.
