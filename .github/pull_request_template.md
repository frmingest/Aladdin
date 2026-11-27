## In plain words

<!-- Two or three short sentences, at most 60 words: what changes for Faiz and what he has to do. No code, file paths or issue numbers here. Write it the way you would say it to a friend. -->

## What changed and why

## How it was verified

Checks run (tick what ran; for anything unticked say why):
- [ ] Backend: ruff, pytest (`MACRO_DATA_PROVIDER=none`)
- [ ] Frontend: tsc, lint, test, build
- [ ] Not run: <!-- which checks, and why (draft PR if any are red or skipped) -->

Seen in a browser? <!-- Real browser / headless only (software WebGL, mocked API) / not seen -->

## Who reviewed it (agents and skills)

One row per role. Result = pass / findings fixed / findings open, with a link to the report or session. If a role did not run, write `skipped` and the reason; do not delete the row. Game UI PRs need all four game rows.

| Role | Ran? | Result / link | If skipped, why |
|---|---|---|---|
| `rules-auditor` (Rules 1-5, migrations, destructive endpoints) | | | |
| `docs-sync-checker` (claims vs git, docs mirror) | | | |
| `playtest-qa` (screenshots, phone profile, console) | | | |
| `game-ux-designer` (identity score, noise, a11y) | | | |
| `game-designer` (spec before build) | | | |
| `game-feel-engineer` (motion, sound, perf) | | | |
| `qa-testlead` / `code-auditor` (security and test depth, if used) | | | |
| `compliance-officer` (data flows, vendors, AI use) | | | |
| `release-manager` (CI, migrations, rollback, live check) | | | |
| `llm-quality-guard` (prompt versions, golden cases, hostile documents) | | | |
| `valuation-reviewer` (numbers recomputed independently) | | | |
| `board-steward` (issue, milestone, labels, stacked PRs) | | | |

Implemented by: <!-- e.g. frontend-engineer, backend-engineer, main session -->

## After deploy (Faiz)

Closes #
