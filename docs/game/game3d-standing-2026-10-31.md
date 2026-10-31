# 3D courtyard: Standing 1, levels 1 to 3 (2026-10-31)

Status: **written and tested (backend 1988 passed, frontend 993 passed, ruff, tsc, lint, build green), rendered in a headless software browser, not merged, not deployed, not seen on a real GPU or on Railway.** Branch `feature/game3d-standing`. Plan: [game3d-standing-sprint-plan-2026-10-31.md](game3d-standing-sprint-plan-2026-10-31.md). Decisions: [brainstorm](game3d-progression-brainstorm-2026-10-31.md) section 9, and Faiz's "you decide" on Jæren (yes).

## What this sprint is for (plain words)
The courtyard now has a **Standing**: a level from 1 to 3 that says how far you have really got with your own fortress. It shows as **torches by the road ahead of where you spawn** (one burns per level) and one card at the top of the Quest log. It is not XP: nothing is saved, nothing is earned by clicking, and the level goes **down** again if the facts go stale.

| Level | Name | You are here when |
|---|---|---|
| 1 | Bare Ground | At least one real holding stands (the sample fortress does not count) |
| 2 | The Survey | Every tower is surveyed, or carries a named gap |
| 3 | Reasons | Every holding has a written reason and a "wrong if" line, and at least one wire is armed |

## What changed
- **Backend.** `app/domain/game_mapping/standing_v1.py` (versioned rules: levels, words, named gaps, `max_level` 3), `app/services/game/standing.py` (pure `build_standing`, no database, no LLM), `GET /game/standing` in `api/game.py`, `StandingOut` in `schemas/game.py`, setting `active_standing_version`. Read-only. Level N is the highest N whose gates 1..N all hold. A tower counts as surveyed when its wall and size are known (a wall that does not apply counts). Active tripwires are counted only on holdings that stand as towers. The sample fortress is level 0, labelled "Sample fortress, not yours".
- **Named gap.** `JAREN.OL`, "no tagged filing" (Faiz allowed it, 2026-10-31). It is only a label: the tower stays fog, the gap shows in the tower's name tag and the Towers panel ("Gap: no tagged filing"), and it disappears the day the tower is really surveyed. Remove the line in `standing_v1.py` once its figures are stored.
- **Frontend.** `standingTorches.ts` and `StandingTorches.tsx` (three code-built posts with the ink outline; one warm gold flame for every level, never red or green; no light source added; reduced motion holds the flames still), `standingWordsV1.ts` (game voice), `standingGaps.ts`, a Standing card in `QuestLog.tsx`, `dialogueV2.ts`: with no holdings the Oracle says "The pads are bare. Upload your broker export and your towers rise here. Then I will ask why you own each one." and the panel shows a "Bring in my holdings" link to `/portfolio`. Everything else in the dialogue is exactly v1.
- **Unknown stays unknown.** Loading, unreadable or sample Standing burns no torch and the card says so; it never guesses a level.

## Checklist, section B
1. **Pages touched (from the diff):** `/game3d` only: Quest log, the road ahead of the spawn, the Towers panel and tower name tags, the Oracle's talk. One new backend route. The flat Fortress is untouched.
2. **Identity:** `/game3d` | before 2 to 3 | after 3 by my judgement (Faiz to confirm) | torches show the Standing without a number | Plain view: the Standing card and the Towers panel carry the same facts in words.
3. **Visual win:** *Light the torches*, delivered. Real fact encoded: the Standing level. Words deleted: the Oracle's dead end.
4. **Voice check:** Standing card headline "Level 2 of 3: The Survey" (6 words), next steps 4 to 15 words in the rules file ("Bring in your holdings.", "Lift the fog: fetch reports, queue the analysis."); level 3's step is 15 words, longer than the 12-word budget for the line, and is shown under the headline, not in it. **Copy debt:** shorten the level 3 step if it reads long.
5. **Checks run:** backend `ruff check .` clean and `pytest -q` 1988 passed (26 new: 19 unit, 7 over the route and a database); frontend `tsc --noEmit` clean, `npm run lint` 0 errors (the 2 old warnings), `npm test` 993 passed (29 new), `npm run build` ok (Scene chunk unchanged at 3.0 MB). Headless render (software, mocked API, built `dist`): torches 0, 1, 2 and 3 lit as expected from the spawn view, the Standing card, the gap chip, no console errors.
6. **Not seen:** a real GPU, Railway, the 60 fps check, the Oracle's bare-pads talk and the "Bring in my holdings" link (covered by tests, not clicked through), a reduced-motion run, colour-blind pass (torches differ by count, not colour).
7. **Taps:** Standing card 1 (press Q); torches 0 (in view from the spawn); empty fortress: walk to the Oracle, E, one link = 2. Measured by the plan and the headless run, not on a real machine.
8. **Identity debt left:** Printer pages with no art wired; levels 4 and 5 not built.

## For Faiz after deploy
Open `/game3d`: three torches stand on the left of the road ahead of you. With real data and no journal yet you should see level 1 or 2; press Q for the Standing card. Check the Jæren tower says "not surveyed: no tagged filing". Playtest question: with an empty or sample fortress, can you tell in two minutes what to do first? Check 60 fps with P (the torches add no light sources).

## Not done / next
Quests as data and quest 1 v2 (reason plus wrong-if as one quest), Level 4 (The Watch), the writing desk from Level 3, Storm Drill, Level 5, world growth. Per-tower pennants stay cut.
