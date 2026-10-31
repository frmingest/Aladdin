# 3D courtyard: Standing 3, T1 the Level 4 rule and T2 look at the wire (2026-10-31)

Status: **T1 of 4 written and tested (backend only), not merged, not deployed, nothing in the courtyard changes yet.** Plan: [game3d-standing-3-sprint-plan-2026-10-31.md](game3d-standing-3-sprint-plan-2026-10-31.md) (merged #222).

## What this step is for (plain words)
The rule for a fourth level, **The Watch**, now exists in the backend. It says: the night watch reported in within its allowed hours, and every wire that fired on a tower has been marked seen. Nothing shows it yet: the live setting stays on version 1 (three levels) until the fourth torch exists (T3), so today's game looks exactly the same.

## What changed
- `app/domain/game_mapping/standing_v2.py`: `STANDING_V2`, `max_level` 4. Levels 1 to 3 are the v1 levels unchanged (a test compares them); the named gap list is copied, not shared. `standing_v1.py` keeps its rules; only its version lookup now also knows `v2` (lazy import, the pattern `siege_scenarios_v1.py` uses).
- `services/game/standing.py`: two new inputs with safe defaults (`watch_state`, `unseen_wires`) and gate 4. Level 4 needs 1 to 3. **A watch that never ran is "never", not quiet, and does not count.** The sample fortress is still level 0. v1 ignores both inputs.
- `services/game/night_watch.py`: `watch_state()` pulled out so the Night Watch and the Standing read the watch the same way (ok, old or never, against `watch_old_hours`). Night Watch behaviour is unchanged.
- `api/game.py` `GET /game/standing`: reads the last nightly check and counts active wires on standing towers that fired and have no `seen_at`. Read-only, no new table, no new write route: marking a wire seen is the existing `POST /thesis/tripwires/{id}/acknowledge`.
- Words (game voice, in `build_standing`): "The watch has not reported. Nothing is known." / "The watch is not walking the walls" / "1 wire fired, not yet looked at" / "The watch reports in. Every wire looked at" / "Nothing to watch yet". Goal for level 4: "Keep the watch walking, and look at every wire that fires."

## Checks run
`ruff check .` clean; `pytest -q` 2006 passed, 2 skipped (18 new: 11 unit, 7 over the route and a database; the v1 tests still pass). Covered: level 4 held, never-ran watch is unknown, old watch drops to 3, an unseen fired wire drops to 3 and acknowledging it restores 4, an inactive fired wire does not block, level 4 needs levels 1 to 3, sample stays 0, v1 stays the default and tops out at 3.

## Not done / not seen
T2 (look at a wire in the Quest log), T3 (fourth torch, words v2, flip the setting to `v2`), T4 (browser check). Not run against a real database with a real worker; not deployed. Copy debt: the words live in `build_standing` for gate 4 facts, as for levels 1 to 3.

## Git commit description
`3D courtyard Standing 3 T1: standing_v2 with Level 4, The Watch (watch reported in, no fired wire unseen); GET /game/standing reads it when active_standing_version is v2`


---

# T2: look at the wire (Quest log)

Status: **T2 of 4 written and tested, not merged, not deployed, not seen in a browser.** Stacked on T1 (branch `feature/game3d-standing-3-face-the-wire`).

## What this step is for (plain words)
When a wire fires in the night, the Quest log now says so by name and gives you one button, **I have looked**. Pressing it marks that wire seen, the same way the Thesis page already does. It never says what to do about the holding. Level 4 is still switched off (the setting stays on version 1 until T3), so today the list is the only change you can see, and only when a wire has really fired and nobody has looked.

## What changed
- Backend: `GET /game/standing` also returns `wires`: each active wire on a standing tower that fired and has no `seen_at` (id, ticker, label; the label is the wire's own words, or its metric if it has none). Read-only, no new table, no new write route. Empty on the sample fortress. Listed under either version: it is a fact, not a level.
- Frontend: a "Wires that fired" card in the Quest log (only drawn when there is at least one), a line per wire ("A wire fired on AKRBP.OL. Look at it."), one button "I have looked" that calls the existing `api.acknowledgeTripwire` and then reads the Standing again. The level and the card come from the facts, never from "I just clicked".
- `wireWords.ts` holds the words and `lookAtWire`, the one action: the sample fortress marks nothing and says so; a failed call leaves the wire unseen and says "Could not mark it seen. It stays unseen."; if only the re-read fails the mark still counts.
- Words are hand-written in game voice (line 12 words or fewer, button 3, title 5), no advice, no buy or sell words.

## Checks run
Backend: `pytest` on the standing files 47 passed (3 new over the route and a database: a fired wire is named and disappears once acknowledged, a wire with no words is named by its metric, inactive, seen, unfired and sample wires are not listed). Frontend: `tsc --noEmit`, `eslint src/game3d`, `vitest run` 1026 passed (new: `wireWords.test.ts`, `questLogWires.test.tsx`), `vite build`. Not run: the full backend suite (the dependency install here skipped `psycopg2-binary`, which these tests do not use); ruff 0.17.3 here is newer than the pinned 0.16.8, so its `datetime.UTC` hints (same style as existing code) were not treated as findings.

## Not done / not seen
Not seen in a browser; not tried with a real fired wire (T4). The Oracle does not mention wires yet (T3). Level 4 and the fourth torch are T3.

## Git commit description
`3D courtyard Standing 3 T2: Quest log lists fired, unseen wires with an "I have looked" button; GET /game/standing returns wires`
