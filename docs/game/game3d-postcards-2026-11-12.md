# 3D game: Postcards on every PR (D1, 2026-11-12)

**Status: written, run on a local copy of the CI stack (8 of 8 tests passed, 7 pictures looked at), not yet run on GitHub.** `tsc` clean, lint 0 errors. First step of the recommended combined plan in the round 2 roadmap contest (Claude project doc `claude/game3d-roadmap-contest-round2-2026-11-11.md`). Faiz has not picked a roadmap yet; this step is small and every team ranked "see it first" at the top.

## What this is for (plain words)

Most 3D work used to be merged without anyone seeing it. Now every pull request takes seven photos of the 3D world and attaches them, so the person judging looks at pictures first.

## What you will see

A robot opens `/game3d` on the pretend (demo) portfolio, walks to seven places by their links and photographs each: the yard, the Town Hall, the Hall of Records, the Weather Tower, the Siege Field, the Market Quarter and one holding's own land. The files are `01-courtyard.png` to `07-holding-land.png`. On each PR a comment *Postcards* links to the `postcards` download (a zip of the seven), updated on every push.

## How it works

- New test `frontend/e2e/regression/postcards.spec.ts` in the existing Playwright `regression` project. It also fails if a place does not open, sets the wrong tab title or logs a console error.
- `ci.yml` (job *E2E*): uploads `frontend/postcards/` as the `postcards` artifact and posts or edits one PR comment. The job gets `pull-requests: write` for that one step. Fork PRs get the artifact but no comment.
- `frontend/postcards/` is gitignored.

## Limits

- CI has no GPU. Pictures are drawn with software WebGL: close in colour and shape, nothing about frame rate or feel.
- The demo portfolio is fabricated and the same on every run, so two postcards of one place differ only when the code changed. The Weather Tower's dials have no needles in the postcard: the test stack runs with no macro data (`MACRO_DATA_PROVIDER=none`), so that picture shows the room, not the dials.
- Not done from the plan's D1: **merges waiting for green checks** needs branch protection on `main` (finding F-3 in the [test strategy](../ops/test-strategy-2026-11-12.md), Faiz's call). The stale `?at=town` test was already fixed in the test framework PR (F-0).

## For Faiz after merge

Open the next 3D PR, scroll to the *Postcards* comment and download the pictures. Turn on branch protection and require *E2E (Playwright, demo stack)* when you want merges to wait.

## Git commit description

`CI: postcards, seven pictures of the 3D world on every PR (yard, Town Hall, Records, Weather Tower, Siege Field, Market Quarter, a holding's land) from the demo stack`
