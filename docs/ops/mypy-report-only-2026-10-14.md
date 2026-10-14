# Backend type check in CI: mypy, report only (2026-10-14)

**Status:** written and tested locally, not merged; the first CI run happens on its PR. Branch `chore/mypy-report-only-ci`, off `main` `5135a8f`.
Decision (Faiz, 2026-10-14): add a report-only mypy job, with stubs for the untyped libraries.

## What it does

A new CI job, **Type check (mypy, report only)**, runs `mypy` over `backend/app` and writes the last line (the count) into the run
summary. It has `continue-on-error: true`, so it can never block a change and never turns the PR red. The existing jobs
(ruff + pytest, migrations, frontend, gitleaks, dependency audit) are untouched.

- `backend/pyproject.toml` has the `[tool.mypy]` config (`python_version = "3.12"`, `files = ["app"]`).
- `backend/requirements-dev.txt` pins `mypy==2.4.0` and the stubs: `pandas-stubs`, `types-openpyxl`, `lxml-stubs`,
  `boto3-stubs`, `botocore-stubs`.
- `yfinance` has no stubs and no `py.typed`, so it is the one module ignored for missing imports (`pyproject.toml`).
  The earlier plan also named `fitz` and `apscheduler`: neither produced a missing-stub error (`app` imports `pymupdf`, which is typed, and
  the scheduler needs no stub), so no stub was added for them. `lxml-stubs` was added instead because `lxml` did.

## The baseline

Run locally (Python 3.13, the same pins): **166 findings in 50 files** (the 2026-10-14 note said 169; the stubs type a few calls). The most are in `ixbrl.py` (30), `system_status.py` (22), `game/state.py` (16) and `game/ravens.py` (11). By kind: argument types 71, union attribute access 32 (mostly "value may be None"), assignment 14, attribute 13,
operator 11, the rest few. None is a known runtime bug; they are what a type checker finds in code written without one.
CI runs Python 3.12, so its count may differ by a handful.

## What was not changed

No application code. No `# type: ignore` added. The ruff, pytest and pre-commit setups are unchanged.

## Next

Fix the findings in batches by file, watching the count in the run summary fall. Make the job blocking (remove `continue-on-error`)
only when it reaches zero. Until then it is information, not a gate.
