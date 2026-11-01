# 3D courtyard: Storm Drill quest and drill camp (2026-11-01)

Status: **written and tested, in PR `feature/game3d-storm-drill`; not merged, not deployed (the new migration `z1b2c3d4e5f6` must run on deploy), seen only in a headless browser (software WebGL, mocked API), not on your real data or a real GPU.** Plan: [KayKit plan, S10](game3d-kaykit-sprint-plan-2026-10-31.md) and quest 3 in the [brainstorm](game3d-progression-brainstorm-2026-10-31.md).

## What this is (plain words)
In the south-west of the courtyard stands a **drill post** (timber stake, board, teal pennant). Walk up and press E: a **Storm Drill** panel opens and a small enemy camp rises on the old siege-simulator ground (two catapults, ladders, targets, a tent, a weapon rack, two flags). Pick a market fall (5% to 60%, default 30%), write what you would do, press "Write it down". Walk away or press E again and the camp goes. The third card in the Quest log (Q) turns "Done!" once one plan is written. It is a rehearsal: nothing is traded, queued or sent.

## Decisions
- **Own table, not the journal** (Faiz chose this, 2026-11-01). A drill is not a decision, so it never triggers a thesis check or a 6/12-month review. Table `storm_drills`: fall (fraction), plan text, scenarios version, time. Only new rows are written; nothing edits or deletes.
- **Camp inside the walls**, on the ground held for the siege simulator (the hero cannot leave the walls). The `siege-simulator` reserved zone is deleted in this change, as `layout.ts` says to.
- **Fixed size, no fact** (decision of 2026-10-31): the camp is identical whatever fall you pick. A calm fortress shows no camp; it only stands during a drill you started.
- **Code-built ram and siege tower skipped** (cut line): KayKit has neither. Not needed for version 1.
- Quest done = at least one drill stored. On the sample fortress the quest reads "Sample fortress, not yours" and saving is off (server also refuses with 403). Standing (levels) is **not** changed by this quest.

## What changed
| Part | Files |
|---|---|
| Backend | `models/storm_drill.py`, migration `z1b2c3d4e5f6_storm_drills.py` (additive, one table), `schemas/storm_drill.py`, `api/storm_drill.py` (`GET` and `POST /game/drills`; fall must sit inside the siege scenarios' range), tests `test_storm_drill_api.py` |
| Frontend logic | `stormDrill.ts` (post, ranges, form, quest state), `stormDrillWordsV1.ts` (words, versioned file), `campPieces.ts` |
| Frontend scene | `DrillPost.tsx`, `DrillCamp.tsx` (mounted only while a drill is open; failure leaves no camp), `DrillPanel.tsx`, `Scene.tsx`, `QuestLog.tsx`, `Game3DPage.tsx`, `lib/api.ts`, `lib/types.ts` |
| Assets | `public/models/camp.glb` (0.24 MB, 9 KayKit Hexagon pieces, CC0), `scripts/pack-camp.mjs`, `CREDITS.md` rows |

## Checks run
Backend: `ruff check` (pinned 0.16.8) clean, `pytest` 2014 passed (4 new). Frontend: `tsc`, `npm run lint` (the same 2 old warnings), `npm test` 130 files / 1096 tests, `npm run build`: green. Migration up/down/up on Postgres 16 is **not run here**; CI does it. Seen in headless Chromium with a mocked API: post, camp rising, panel, save, Quest log "Done!". **Not seen:** real GPU, your data, phone, 60 fps (press P).

## Game sprint checklist, section A
1. Pages touched: `/game3d` only. 2. Identity: stays 3 (a new destination with a scene). 3. Visual verb and scene: *besiege*, at the south-west wall: you see what a drill means. 4. Words: short, in `stormDrillWordsV1.ts`; no new paragraph. 5. Kit: `Scenery`/`Market` loader pattern, `Part`/`PAL`, packer. 6. Rules: unknown stays unknown (no number is shown for a holding); no red or green piece (tested); nothing moves (reduced motion needs nothing); colour never carries meaning. 7. Performance: lazy 0.24 MB file, 13 pieces, only while open. 15 MB and 300 draw-call budgets **not re-measured** here. 8. Taps: walk up, E, write, one button = 2 after arriving (measured only by script).

## For Faiz after deploy
Check the `storm_drills` migration ran. Open `/game3d`, walk to the south-west post, press E, write a plan, save; press Q: the Storm Drill card says Done. Press P and check 60 fps with the camp up. If the pill in the Quest log wraps on a phone that is the old "Done!" pill issue.

## Not done
- Camp does not follow the siege level (needs its own guarded exception).
- No Oracle line points to the post yet (new words would be a new version file).
- Siege tower and ram.
