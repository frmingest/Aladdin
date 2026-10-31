# 3D courtyard: Standing 3, T3, the fourth torch (2026-10-31)

Status: **T3 of 4 written and tested, not merged, not deployed, not seen in a browser.** Plan: [game3d-standing-3-sprint-plan-2026-10-31.md](game3d-standing-3-sprint-plan-2026-10-31.md). T1 (the rule) #223 and T2 (face the wire) #227 are merged. **This step flips the live Standing from three levels to four.**

## What this step is for (plain words)
There is now a fourth torch by the road ahead of the spawn. It burns when the night watch has reported in recently **and** you have looked at every wire that fired. If the watch goes quiet, or a new wire fires, it goes out again until you have looked. The Quest log says why in one short line ("The watch has not reported. Nothing is known." / "1 wire fired, not yet looked at"). It never says what to do about a holding.

## What changed
- `backend/app/config/settings.py`: `active_standing_version` default `v1` becomes **`v2`**. This is the switch. Rolling back is `ACTIVE_STANDING_VERSION=v1` in Railway, no code change; v1 still works and tops out at 3.
- `frontend/src/game3d/standingTorches.ts`: a fourth post (`standing-torch-4`, same row, two steps further along). `litTorches` now caps at 4. The layout tests (clear of pads, keep, people, spawn, gate road; in view ahead of the spawn; no overlap) cover it and pass.
- `frontend/src/game3d/standingWordsV2.ts` (new; `standingWordsV1.ts` is not edited): "Level N of 4: <title>", the next step, and a `watch` line that shows the backend's own level 4 fact once levels 1 to 3 hold. `wordsFor` picks v1 or v2 words by the version the backend served, so a rollback keeps its old words.
- `QuestLog.tsx` shows the `watch` line in the Standing card; `Game3DPage.tsx` uses `wordsFor`.
- Same warm gold flame for all four (no status colour), still flat cone with no light source, flame holds still with reduced motion.

## Checks run (clean Linux clone of `main` + this change)
`ruff check .` clean; backend `pytest -q` 2010 passed, 2 skipped. Frontend `tsc --noEmit` clean, `npm run lint` 0 errors (2 old warnings), `npm test` 1032 passed, `npm run build` ok. Tests changed: the empty-fortress check now expects `max_level` 4; a new fixture pins the old v1 tests to v1; new tests say v2 is the live default and cover the v2 words (four torches, watch line, nothing before level 3, short, no buy/sell/score wording).

## Cut, as the plan allowed
The **Oracle's one-line dispatch** is not built (plan section 4 names it as the first cut). The torch has no 3D text label; the Quest log headline carries the title.

## Not done / not seen
T4, look and judge: empty, sample and real fortress in a real browser, one real wire acknowledged, tap counts, screenshots. The fourth torch has not been seen in any browser. **Not deployed:** after Faiz merges, the backend and frontend redeploy; the live Standing then reads four levels. A real fortress with a worker that has not run will sit at level 3 and say the watch has not reported, by design.

## Git commit description
`3D courtyard Standing 3 T3: fourth torch and v2 words; live Standing now standing_v2 (four levels)`
