# 3D courtyard: next sprint, "Standing 3: The Watch" (Level 4), plan, 2026-10-31

**Status: plan only. Nothing built, nothing seen in a browser.** Follows Standing 1 (#217) and Standing 2, the writing desk (#221), both merged on `main` at `213c6b0` (deploy not checked). Built from the [Standing 1 write-up](game3d-standing-2026-10-31.md), the [level brainstorm](game3d-progression-brainstorm-2026-10-31.md) (level 4 row), `backend/app/services/game/standing.py`, `night_watch.py` and `services/thesis/tripwires.py`. Decided by Claude on Faiz's "you decide" (2026-10-31). Faiz picked the writing desk over this sprint and the drill camp earlier; this is the one that follows it.

## 1. What this sprint is for (plain words)

A sprint is one small piece of the game that is finished and that you can try yourself.

Levels 1 to 3 say how well you have **set up** your fortress: holdings in, fog lifted, reasons written, a wire armed. Nothing yet says whether you are **paying attention to it**. A wire can fire in the night and nobody looks.

This sprint adds **Level 4, The Watch**: the night watch has reported in recently **and** every wire that fired has been looked at by you. A fourth torch burns when both are true. It is held, not won: if the watch goes quiet or a new wire fires, the torch goes out again until you have looked. Looking is all it asks. It never asks you to act, and it never says what to do about a holding.

## 2. Where we start (checked in the code on `main`)

- `standing_v1.py` and `build_standing` (pure, no database, no LLM) give levels 1 to 3 over `GET /game/standing`. A change to what a level means is a **new `standing_v2.py`**, not an edit (CLAUDE.md Rule 3).
- Everything level 4 needs is already stored: a tripwire has `fired_at` and `seen_at`; the night watch knows if the worker reported in (`watch_state`: ok, old or never, from `watch_last_at` against `watch_old_hours`); `POST /thesis/tripwires/{id}/acknowledge` already sets `seen_at`, and `api.acknowledgeTripwire` exists in the frontend. **No new table and no new write endpoint.**
- A tripwire that returns to the right side clears its own `fired_at` and `seen_at`, so a wire that stopped firing never blocks the level.
- Standing 1 shows one torch per level and a Standing card in the Quest log; the writing desk and quest 1 are as Standing 2 left them.

## 3. The rung this sprint builds

| Lvl | Name | You are here when (all real, all worked out on load) | Player verb |
|---|---|---|---|
| 4 | The Watch | Levels 1 to 3 hold, the night watch reported in within its allowed hours, and no wire on a standing tower has fired without being marked seen | Look at the wire |

Rules that never bend: the sample fortress is still level 0 and cannot mark anything seen; **a watch that never ran is "unknown", never "quiet"** (it counts as not met, with its own words); level 4 needs 1 to 3; the level can go **down**; no XP, no streaks, no daily visits, no buy or sell words. "Seen" means "I looked", not "I agree" and not "I did something".

## 4. Items (each one PR on its own branch, tests included; Claude opens the PRs)

| # | Name | What it is | Size |
|---|---|---|---|
| T1 | **Standing v2, the rule** | `standing_v2.py` (levels 1 to 3 copied unchanged, level 4 added, `max_level` 4), the extra inputs (watch state, unseen firing wires on towers) and tests, including "unknown watch never counts". Setting `active_standing_version` stays `v1` until T3 | M |
| T2 | **Face the wire** | In the Quest log: each fired, unseen wire named in plain words with one button, "I have looked" (the existing acknowledge call). The Standing card refreshes. Unreadable or sample: says so and saves nothing | M |
| T3 | **The fourth torch** | A fourth post in the torch row, Standing card shows four gates, new wording in a new words file (`standingWordsV2`), the Oracle reads the night dispatch in one line. Then `active_standing_version` flips to `v2` | M |
| T4 | **Look and judge** | Click through with an empty fortress, the sample fortress and real data; one fired wire acknowledged for real; screenshots; tap counts; section B | S |

**Cut line:** if the sprint runs long, cut the Oracle's dispatch line first, then the fourth torch's own look (a plain fourth post is enough). Never cut the unknown-watch state, the sample guard or the screenshots.

## 5. Checklist section A

1. **Pages touched.** Only `/game3d` (torch row, Quest log, Oracle line). One backend rule file and one small input change to `GET /game/standing`. The flat Fortress and the Night Watch page are not changed.
2. **Identity (0 to 3).** `/game3d`: before 3, target 3. The new fact is encoded as a torch: lit or dark, plus the count.
3. **Visual win.** **The fourth torch.** Verb: *look*. Scene: the torch row on the road ahead of the spawn. Fact: the watch reported in and no fired wire is unseen. **No Stitch picture needed**: code-built like the first three. If one is needed later I will tell you first, with a short description of what it should show.
4. **Words (budgets, game voice).** Torch label 5 words or fewer ("The Watch: all wires seen"); Quest log line 12 or fewer ("A wire fired on <name>. Look at it."); button 3 ("I have looked"); the Oracle's line 15 or fewer. Unknown watch: "The watch has not reported. Nothing is known." New wording is a new file; v1 words are not edited.
5. **Kit.** Reused: `StandingTorches`, `standingTorches.ts`, the Quest log card, `api.acknowledgeTripwire`. Added: one torch post and one list in the Quest log.
6. **Rules.** Colour-blind: lit versus dark by flame shape and count, one warm gold for every level (as in Standing 1). Reduced motion: the flame stays still. Performance: no new light source; frame rate re-checked on a real GPU (165 fps on Railway earlier).
7. **Taps from a cold load.** Level: 0 (torches are in view from the spawn). Look at a wire: Q, then 1 click per fired wire. Measured in a real browser in T4.

## 6. Done means

- Backend: `ruff check .`, `pytest -q`; new tests: unknown watch never counts; old watch drops to 3; one unseen fired wire drops to 3; a seen one holds 4; a cleared wire does not block; sample stays 0; level 4 needs 1 to 3.
- Frontend: `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; the new Quest log list and button tested for success, failure (wire stays unseen, message shown) and sample.
- Seen in a real browser with three data states (empty, sample, real) and one real acknowledge. Anything not seen is named.
- Status written as three separate facts: merged, deployed, seen on real data.

## 7. Decisions for Faiz (I go with the recommendation if you do not say otherwise)

1. **"Seen" or "decided"?** The brainstorm said "write what you decided". Recommended: **seen only** for this sprint (one click). A journal entry linked to the wire is a later sprint, so level 4 never feels like a chore.
2. **Does the level drop when the worker is off?** The watch runs on your PC. Recommended: **yes**, because level 4 says the watch is walking the walls; the card says so in plain words ("The watch is not walking the walls") and the level returns as soon as it reports in.
3. **Fourth torch next to the others or somewhere new?** Recommended: **next to the others**, same row.

## 8. Later (not this sprint)

Quests as data and quest 1 v2, the drill camp with the Storm Drill (KayKit S10, a Level 4 verb in the brainstorm), a decision written against a fired wire, Level 5 The Ledger (needs 6-month-old entries), world growth.
