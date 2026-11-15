---
description: Run CI-equivalent checks, then open the PR per CLAUDE.md
---
Follow CLAUDE.md "Pull requests" exactly: branch off current main, run `rules-auditor` and `docs-sync-checker`, run backend ruff + pytest (MACRO_DATA_PROVIDER=none) and frontend tsc/lint/test/build for changed areas, update docs/PROGRESS.md and the Claude project progress.md in the same PR, commit, push, open the PR via the GitHub REST API, watch checks. Never merge.

Fill every row of the "Who reviewed it (agents and skills)" table in `.github/pull_request_template.md` with what actually ran and a result or link; write `skipped` and the reason for anything that did not. Never mark a role as run when it was not.
