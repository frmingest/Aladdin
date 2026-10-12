# Sprint 25: game mode rituals (G17–G20) — 2026-10-04

Status: **written and tested, PR open, not merged, not deployed.** Branch `feature/game-mode-sprint-25-rituals`, built on `main` `25d51ec` (Sprint 24 merged as #48). F33 in `PROGRESS.md`.

## Rules kept
Read-only except the user's own competence marks. Deterministic, versioned (`app/domain/game_mapping/rituals_v1.py`). No points, streaks or reward for attending the Council or writing a review. Unknown stays unknown. No text says buy, sell, add, trim or invest (tests enforce it). Demo mode shows invented data and blocks marks.

## What was built

| ID | What | Endpoint | Notes |
|---|---|---|---|
| **G17** | **Council Chamber** `/fortress/council` | `GET /game/council` | Agenda in fixed order: fired tripwire, thesis review, written reviews owed, weak walls (large towers), no moat (large towers), old or missing analysis (stocks only), outside your circle, cash figure. Max 4 holdings named per item, the rest counted. The advisors' lines follow. *What the council cannot see* lists unknown weather, temperament and an empty circle. An empty agenda says it is not proof that all is well. An empty portfolio gets no cash item. |
| **G18** | **Hall of Records** `/fortress/records` | `GET /game/records` | The journal as a library: what you wrote, what would prove it wrong, verdict then and now, price then and now (stored prices only), 6- and 12-month review state. Caption: a decision is not its outcome. **No hit rate, no ranking, no good/bad label.** |
| **G19** | **Circle of Competence** `/fortress/circle` | `GET /game/competence`, `PUT/DELETE /game/competence/{sector}` | New additive table `competence_marks` (migration `r1d9e0f1a2b3`, one head). Levels: know, partly, outside. Marks are never inferred: no mark is *unmarked* (not inside), no sector is *no sector set*; funds and gold are *not judged*. A bar shows inside / edge / outside / unmarked weight. |
| **G20** | **Per-holding advisor lines** | `GET /game/holdings/{id}/advisors` | Every matching line about one holding (the Fortress cuts to 6), shown on the holding page in game mode. Fortress-wide lines are not included. |

Navigation: Council, Records and Circle in the game-mode nav and as buttons on the Fortress.

## Not built (on purpose)
- **Fog of war** on holdings outside the circle in the Fortress scene, and a Ledger column.
- **An advisor rule** for outside-circle holdings: shown advisor templates are not edited, so it needs `advisor_lines_v2`. The Council covers it with its own agenda item.
- Writing a review from the Records page: reviews are still written in the Journal.

## Verified
Backend 1,521 tests pass (25 new: rule boundaries, API, read-only, demo, validation), Ruff clean, one Alembic head (up/down/up runs in CI on Postgres 16, not run here). Frontend 258 tests (9 new), tsc clean, ESLint 0 errors (2 existing warnings), build. Council, Records and Circle rendered in Chromium against the real backend in demo mode. The demo data uses a non-standard "Technology" sector, so demo tech holdings show as unmarked. **Not run with Faiz's real data.**

## After deploy
Migration `r1d9e0f1a2b3` runs on deploy. Then walk through the three pages and the holding page with game mode on (see §2 C, item 10).
