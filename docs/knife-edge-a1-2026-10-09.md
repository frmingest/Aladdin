# A1 Knife-edge — 2026-10-09

Branch `feature/knife-edge-a1` (off `main` `33fc93f`). Written and tested, **not merged, not deployed, never seen in a browser.** Second slice of the [team review](game-mode-team-review-2026-10-09.md) order (B1 Long Memory was the first).

## Review of #85 and #86 first (merged, CI green on `33fc93f`)

Read: the whole #86 diff, the #85 logic changes in `lib/fortress.ts`, and both write-ups. Not read line by line: the SVG drawing in `sceneWorld.tsx`. Not seen: either PR on the live app.

- **#86 retention is sound.** `frames_to_keep` is pure and idempotent; the newest frame and future-dated frames survive; thinning cannot remove the only frame of a week or month. Nothing is thinned until January 2027 (first frame 2026-10-07), so it cannot hurt today.
- **Small things, not fixed here:** the setting `GAME_STATE_HISTORY_KEEP_DAYS` is now dead code; the gap text says "the worker was off" but the code only knows no frame was stored (a failed write looks the same); a thinned frame dates a change at the later frame (the Chronicle says so).
- **#85:** `weightScale` saturates at a 20% weight (0.9 + 0.0125 × weight, bounded 0.9–1.15), so towers above 20% look alike in height; size class already encodes weight, so height double-counts it. Cosmetic; the constants are the lever if it reads wrong.

## Why

A wall tier is a verdict drawn from a few stored numbers, but the picture showed a tier as if it had no edges. Net debt of 2.4x EBITDA (brick) and 0.4x (granite) looked different only by material, and 2.4x gave no hint that one more weak report makes it timber. The review called this out as the cheapest honest depth: no new data, only the distance to the line.

## What changed

- **`margins_v1.py`** (`backend/app/domain/game_mapping/`, versioned file, Rule 3): `wall_margins()` measures, for the same numbers `wall_for_stock` already used, the distance to the next tier on each side. Net debt / EBITDA (granite ≤1x, brick ≤2.5x, timber ≤4x), equity / assets for banks and insurers (10 / 7 / 5%), and the interest-cover rule (cover under the weak line pulls a wall one tier down). `near_band` = 10% of the boundary, **weaker side only**; the distance to a stronger tier is text, never flagged. No ratio (net cash, no positive EBITDA, unsurveyed) means no margins.
- **`TowerOut.wall_margins`** (`MarginOut`: metric, value, boundary, direction, tier, distance, near, plain-words text). Additive with a default of `[]`, so stored Chronicle frames still load. **The wall decision itself is untouched**; mapping v2 and all existing tests unchanged. No migration.
- **Survey card** (Fortress and holding page): "Distance to the next tier" under Walls, e.g. "Net debt / EBITDA is 2.4x; timber begins above 2.5x (0.1x of room)", with "Close to the line:" where near and the note "from the last stored statements; a new report can move it either way. A distance, not a goal."
- **Scene:** a static hairline crack on a tower whose weaker side is near (a shape, not a colour; no motion, no new filter). The hover card adds "On a knife-edge: …", and the screen-reader label says "close to the line of a weaker wall".

## Rules respected

Read-only; deterministic arithmetic in application code (Rule 1); unknown stays unknown (no ratio, no margin); no buy/sell/should wording (tested); no progress or reward framing for moving up a tier (the stronger side is never flagged or highlighted); versioned file for the band.

## Verified

Backend: `ruff check .` clean; `pytest -q` 1,797 passed, 2 skipped (10 new in `tests/unit/test_game_margins.py`: each tier both sides, exactly on a boundary, cover penalty, rotted, banks, no-ratio, wording). Frontend: `tsc --noEmit`, `npm run lint` (0 errors, 2 existing warnings), `npm test` 408 passed (3 new in `lib/knifeEdge.test.ts`), `npm run build`. **Not seen in a browser; the crack's size and placement are unjudged.**

## For Faiz after deploy

Open Fortress, click a tower with a non-bank balance sheet: the Walls block should list the distance to the next tier. Any tower within 10% of a weaker line shows a thin crack and "Close to the line". If the crack is too faint or the 10% band too wide or narrow, the band is `near_band` in `margins_v1.py` (a change is a new `margins_v2.py`) and the drawing is `KnifeEdgeCrack` in `FortressScene.tsx`.

## Not built

The Council agenda item for a knife-edge tower (the review's "agenda kind"): it needs a decision on whether an agenda line may appear for a number that has not moved. Next in order: C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now.
