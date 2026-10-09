# Game mode integrity fixes (PR 1 of the team-review follow-ups) — 2026-10-09

Status: **written and tested, not merged, not deployed.** Source: [game-mode-team-review-2026-10-09.md](game-mode-team-review-2026-10-09.md), section 1, items 1, 2 and 5.

## What was wrong and what changed

| Item | Problem | Fix |
|---|---|---|
| 1 | The Fortress weather could read **calm** from a stored stress scenario that covered only part of the book (equity and fund types; gold, bonds and unmodelled holdings sat outside it). | New **game mapping v2** (`domain/game_mapping/v2.py`): `min_stress_coverage = 50%`. Below it (or when coverage is unknown) the sky cannot read calm, it reads *unsurveyed* (mist) with a reason. Gathering and besieged still stand, because a loss on the covered part is a loss. v1 is untouched (Rule 3) and ignores coverage, so old frames read the same. `Settings.active_game_mapping_version` default is now `v2`. Coverage = weight of towers with a stored scenario shock / weight of all towers (`state._stress_coverage`). |
| 2 | In `risk/stress.py`, a DCF bear case **above** the price gave a *positive* shock, which offset real losses in the portfolio total and could keep the sky calm. | The DCF-bear shock is clamped at 0: a stress scenario is never a gain. |
| 5 | A back-dated journal entry took **today's** analysis verdict as `verdict_at_decision`, leaking hindsight into the temperament rules `bought_against_verdict` and `sold_intact_thesis`. | `analysis/latest.run_in_force(db, holding_id, as_of)` picks the newest usable run finished by the end of `decided_on`; none = no verdict. Changing `decided_on` on an entry recomputes it. |

## Behaviour changes Faiz will see

- The sky may now read **mist** where it read calm before (the book has 5 of 8 holdings covered by the stored stress, so the real book is likely to show it until the stress covers more).
- Journal entries dated before the first analysis of a holding show no verdict at the time. Existing stored entries are not rewritten.

## Not in this PR (still open from the review)

Item 3 (simulator headline at 50% coverage, needs `siege_scenarios_v3`), items 6–7 (blind vs reconciled verdict, temperament rewards, needs `temperament v2`), 8–16.

## After deploy

Check Railway has no `ACTIVE_GAME_MAPPING_VERSION=v1` env var overriding the new default. No migration.

## Verification

`ruff check .` clean; `pytest -q` in `backend/` with `MACRO_DATA_PROVIDER=none`: 1776 passed, 2 skipped. New tests: coverage boundary (49.9% / 50% / unknown), storm not hidden by low coverage, v1 unchanged, bear-above-price clamp, API-level mist case, journal back-dating and recompute.
