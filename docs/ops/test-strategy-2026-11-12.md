# Test strategy and the Playwright framework (2026-11-12)

Status: **written, not merged, not deployed.** The new CI job has run only on a local copy of the same stack (Postgres 16, backend, Vite), not on GitHub yet; its first run is on the PR that adds it.

Owner: Faiz (ISTQB test manager). Written to be edited by him: the tables are the contract, change them first and the tests after.

## 1. Purpose and scope

Aladdin handles real holdings and real filings, and a merge to `main` is a production deploy (CLAUDE.md, "Pull requests"). Quality here means three things, in this order:

1. **Trust in the numbers and the claims.** Deterministic arithmetic, evidence-first output, no instruction from a document reaching the model (the five architecture rules).
2. **Nothing writes or spends what it must not.** Destructive calls need `confirm=true`; the post-deploy check never writes; demo mode never reads real data.
3. **The app works for the person using it.** Pages load, the 3D world opens, errors are explained in words.

In scope: backend (FastAPI, pipeline), frontend (React, 2D game mode, 3D `/game3d`), CI and the post-deploy check. Out of scope for automation: look and feel, frame rate, sound, "does it read as a game" (section 6).

## 2. Test levels and where each lives

| Level | Tool | Where | Runs | Data | Gate |
|---|---|---|---|---|---|
| Unit (backend) | pytest (about 2,100 tests) | `backend/tests/unit` | every push and PR (`ci.yml`, Backend) | in-memory SQLite, fakes for every provider | blocks merge when red |
| Integration (API) | pytest + FastAPI test client | `backend/tests/integration` | same job | same | same |
| Migration | Alembic up / down / up on Postgres 16 | `ci.yml`, Migrations | every push and PR | empty database | same |
| Unit and component (frontend) | vitest (about 2,000 tests) | `frontend/src/**/*.test.ts(x)` | every push and PR (Frontend) | none | same |
| Static | tsc, ESLint, ruff, gitleaks, pip-audit, npm audit, mypy | `ci.yml` | every push and PR | n/a | tsc, lint, ruff, gitleaks block; audits and mypy are report-only |
| **E2E regression (new)** | **Playwright, project `regression`** | `frontend/e2e/regression/` | **every PR (`ci.yml`, E2E)** | **demo stack: fabricated data, writes refused** | **blocks merge when red** (see section 8: only once branch protection requires it) |
| E2E smoke | Playwright, project `smoke` | `frontend/e2e/*.spec.ts` | daily 05:30 UTC and after each deploy (`smoke.yml`) | live Railway site, Faiz's real data | alerts, does not block |

The two Playwright projects differ on purpose. `smoke` asks "is production up and showing the pages?" and may only read. `regression` asks "did this change break something?" on a stack nobody cares about, so it can click, walk and press keys freely.

## 3. The regression stack (how the E2E job is isolated)

- Postgres 16 service, `alembic upgrade head`, the real backend on `:8000`, the Vite dev server on `:5173` (it proxies `/api` to the backend).
- `stack.setup.ts` runs first. It waits for `/health`, checks the migration head matches the code, switches **demo mode on** (`PUT /settings/demo-mode`) and confirms it. Demo mode serves the same fabricated portfolio on every run (`backend/app/services/settings/synthetic_data.py`), so tests are deterministic and need no seed script, and **every other write is refused with 403** (`demo_guard.py`), so a test cannot change data by accident.
- No API key, no real document, no network beyond the runner. `LLM_PROVIDER` is set but has no key, so nothing can spend quota.
- Never point `E2E_API_URL` at Railway. The setup file writes the demo flag.

Run it locally (Linux, macOS or WSL):

```
# terminal 1: Postgres on :5432 with a database "aladdin", then
cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aladdin alembic upgrade head
DATABASE_URL=... OBJECT_STORAGE_PROVIDER=local MACRO_DATA_PROVIDER=none TICKER_CATALOGUE_ENABLED=false uvicorn app.main:app --port 8000
# terminal 2
cd frontend && npx vite --port 5173
# terminal 3
cd frontend && npx playwright install chromium && npm run e2e
```

`npm run e2e` runs the `regression` project; `npm run smoke` still runs the live check and needs `SMOKE_FRONTEND_URL` and `SMOKE_API_URL`. Open the report with `npx playwright show-report`.

## 4. Risk-based priorities

Likelihood and impact are Faiz's call; the first column is what the suite protects today.

| Risk | Impact | Held by | Gap |
|---|---|---|---|
| A write or LLM spend from the daily smoke run | High: real data, real quota | `rules.spec.ts` reads each smoke file and fails if it stops aborting non-GET requests or starts sending writes | none known |
| A delete without `confirm=true` | High | backend integration tests (`test_deletion_api.py`); `rules.spec.ts` proves the stack refuses writes in demo mode | the browser path to a delete is not clicked end to end |
| Real data shown or changed in demo mode | High | `rules.spec.ts` (403 on six write endpoints, `/game/state` says `demo: true`, banner on ten pages) | other write endpoints are not sampled |
| LLM computes a number, widened citations, in-place prompt edits, blind pass sees notes (rules 1 to 4) | High | pytest only (backend) | no semantic check in CI; an independent reviewer agent exists in `.claude/` but is not wired to CI |
| Evidence IDs (EV-001) printed to the reader | Medium | `rules.spec.ts` on one holding page | other pages not scanned |
| A page crashes or logs errors | Medium | `rules.spec.ts` (ten pages), `game3d.spec.ts` (courtyard and five places), watched by `support/guard.ts` | holding sub-tabs, Fortress rooms, Marketplace store pages |
| 3D place links, panels and Back/B | Medium | `regression/game3d.spec.ts` | the talk (E) dialogue and quest flow, walking, holding lands |
| 3D looks wrong, runs slowly, sounds wrong | Medium | nothing automatic | section 6 |

## 5. Traceability: rule to test

| Source | Rule | Test |
|---|---|---|
| CLAUDE.md, Guardrail tooling | Smoke is read-only | `rules.spec.ts` > "the read-only smoke suite stays read-only" |
| CLAUDE.md, Destructive operations | Writes need `confirm=true`; none against production | `rules.spec.ts` > "demo mode keeps the test stack safe"; `stack.setup.ts` |
| CLAUDE.md, Architecture rule 2 | Evidence IDs are for the code | `rules.spec.ts` > "a holding page never shows evidence IDs" |
| Noise audit 2026-10-06, 2.1 | No internal IDs in reader text | same |
| `placeLink.ts` | A broken link means the courtyard, never an error | `regression/game3d.spec.ts` > "a retired or broken link" |
| S22 (places as links) | Each place opens, sets its title, B goes back | `regression/game3d.spec.ts` > "places opened by their link"; `smoke` `game3d.spec.ts` on production |
| Game voice and identity standards | not automated | section 6 |

## 6. What automation does not cover (kept as a person's look)

CI has no GPU: Chromium draws with software WebGL. The suite therefore never asserts frame rate, colour, layout beauty, sound or "reads as a game" (identity score, tap counts, voice). The agentic-coding audit of 2026-11-01 found 20 game PRs merged without anyone seeing the page; this suite **does not close that gap**, it only makes sure what can be checked by a machine is. Whoever judges looks needs a real GPU and should write the result in the PR (screenshots and tap counts), as `docs/game/game-sprint-checklist.md` already asks.

## 7. Findings from setting this up

| ID | Finding | Status |
|---|---|---|
| F-0 | Three tests in `e2e/game3d.spec.ts` (smoke project) had been wrong since 2026-11-10 when "The Town" stopped being a place: they expected `?at=town` and a "Back to the Town" button. They would have failed the next daily smoke run. Fixed in this change (both halls lead "Back outside" to the courtyard). | fixed |
| F-1 | `GET /sources/holdings/{id}` is a read-only hint but calls `require_not_demo`, so in demo mode the Sources panel on every holding page gets a 403. | **open**; allow-listed by exact URL in `e2e/support/guard.ts`; remove the guard in `backend/app/api/sources.py` (`get_eligibility`), then delete the allow-list entry |
| F-2 | Opening `/game3d` logs two console errors in Chromium ("BufferGeometryUtils: mergeAttributes failed", "mergeGeometries failed ... uv attribute"): some model has a UV attribute of a different type. Nothing visibly missing; not seen on a real GPU. | **open**; allow-listed in `guard.ts` so the suite can still catch new errors |
| F-3 | `main` has no branch protection and no required checks (2026-11-01 audit, finding 1). Until it does, a red E2E job warns but cannot stop a merge. | open, Faiz's call |
| F-4 | The daily smoke run showed "cancelled" (13 of its last 30 runs) or red (3) from 8 Nov. Cancelled = the 15-minute job limit. Cause found 2026-11-13: in Playwright a bare file name in `testMatch` also matches the same name in a sub-folder, so the `smoke` project ran `e2e/regression/game3d.spec.ts` (14 extra 3D page loads, written for the demo stack, 90 s timeout) against the live site with the 45 s smoke timeout. Likely reason for the red runs on 10 and 11 Nov: F-0 (three wrong `game3d` expectations). The red run on 8 Nov is not explained: its report cannot be downloaded from a cloud session. | **fixed** in the PR for #407: smoke ignores `**/regression/**`; 3D check is its own project (`smoke-3d`, 90 s, no retry) and its own workflow step with a step timeout; the CI reporter now also writes `github` annotations, so a red run can be read through the REST API. Needs three green runs after merge. |

## 8. Entry and exit criteria

- **Entry to review (a PR may be opened):** ruff, pytest, tsc, lint, vitest and build green locally (CLAUDE.md, Pull requests, step 2); for UI changes, `npm run e2e` run locally or CI green.
- **Exit (a PR may be merged by Faiz):** all required jobs green and no new entry in the allow-lists of `guard.ts` without a written reason; for game pages, the look-and-judge list answered by a person.
- **Release gate for the daily smoke:** a red smoke run after a deploy is the signal to roll forward or back. It never blocks anything, so someone must read it.

## 9. Metrics (what to watch)

- E2E duration (about 2.5 minutes for the 3D tests locally with software WebGL; CI is not measured yet; plan for a few minutes more) and flaky tests: a test that needs the one CI retry twice in a month is rewritten or removed.
- Allow-list size in `guard.ts` (three entries today: F-1, F-2 and unreachable web fonts); it should shrink.
- Share of game PRs whose body says "not seen in a browser" (20 of 37 on 2026-11-01).

## 10. Next steps (not in this PR)

1. Faiz decides on branch protection and then adds the **E2E (Playwright, demo stack)** job to the required checks.
2. Fix F-1 (one line) and look into F-2.
3. Extend the regression project, in this order: the 3D quest and talk flow, holding page tabs, Fortress rooms, Marketplace store pages. Each new test says which risk row it closes.
4. Decide whether the semantic rule checks (architecture rules 1 to 4) should run as a CI step; today only pytest holds them.
