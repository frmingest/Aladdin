# 3D courtyard: Standing 3, T2, face the wire (2026-10-31)

Status: **T2 of 4 written and tested, not merged, not deployed, not seen in a browser.** Plan: [game3d-standing-3-sprint-plan-2026-10-31.md](game3d-standing-3-sprint-plan-2026-10-31.md). T1 (the rule) merged as #223.

## What this step is for (plain words)
When a wire has fired on one of your towers, the Quest log now says so by name and gives you one button, **I have looked**. Pressing it marks the wire seen (the same call the Thesis page already uses) and the Standing is read again. It never says what to do about the holding. The level does not change yet: the live setting is still `v1` until the fourth torch (T3), so today the list only shows which wires wait.

## What changed
- `GET /game/standing` now also returns `wires`: the active wires on towers that fired and have no `seen_at` (id, ticker, name, label), oldest first. Empty for the sample fortress. Read-only; no new table, no new write route (marking seen is `POST /thesis/tripwires/{id}/acknowledge`). `build_standing` stays pure; the list arrives as an input.
- `frontend/src/game3d/wires.ts` (words and the one action), `WireList.tsx` (the card), `QuestLog.tsx` (shows the card only when wire props are passed), `Game3DPage.tsx` (wires the acknowledge and re-read calls).
- Words (game voice): "Wires to look at" / "A wire fired on <name>. Look at it." / "I have looked" / "Couldn't save that. The wire is still unseen." / sample: "Sample fortress, not yours. Nothing to mark."
- Rules kept: sample fortress lists no wire and has no button; if the Standing cannot be read no list is shown; a failed save keeps the wire unseen and says so; "seen" means "I looked", nothing else.

## Checks run
Backend: `ruff check .` clean; standing tests 47 passed (3 new over the route and a database: listed by name and cleared after acknowledge; seen and inactive wires not listed; sample lists none). Frontend: `tsc --noEmit`, `npm run lint` (2 old warnings, 0 errors), `npm test` 1026 passed (new `wires.test.tsx`), `npm run build`. Run in a clean Linux clone of `main`; the full backend `pytest -q` was not re-run (only the standing files), CI will.

## Not done / not seen
T3 (fourth torch, words v2, flip the setting to `v2`) and T4 (look and judge, tap count Q + 1 click per wire). The card has not been seen in a browser, and no real wire has been acknowledged. Not deployed.

## Git commit description
`3D courtyard Standing 3 T2: list fired, unseen wires in the Quest log with "I have looked"; GET /game/standing returns them`
