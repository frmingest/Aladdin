# 3D courtyard, next sprint: "Standing 1" (levels 1 to 3), plan 2026-10-31

Status: **built as planned in PR `feature/game3d-standing`; see [the write-up](game3d-standing-2026-10-31.md) (merged as #217, merge checked on `main`; deploy not checked). Jæren decision: yes (Faiz, "you decide", 2026-10-31). The torches ended up on the road ahead of the spawn, not at the gate, so they are in view.** Decisions it rests on are Faiz's, 2026-10-31, in [the progression brainstorm](game3d-progression-brainstorm-2026-10-31.md) section 9. Models and scenery (KayKit S0 to S8) are done and merged, so this sprint is about *what there is to do* in the courtyard, not how it looks. Not seen in a browser by me; deploy not checked.

## What this sprint is for (plain words)
Today the courtyard is pretty but has no sense of progress. A new person walks in, the Oracle says the pads are bare, and that is it. This sprint gives the courtyard a **Standing**: a level from 1 to 3 that says how far you have really got with your own fortress, shown as **torches at the gate** (one lit per level) and one line in the Quest log.

It is not XP. Nothing is saved, nothing is earned by clicking, and the level can go **down** again if the facts go stale. You only go up by doing real work: having real holdings, lifting fog, writing why you own each one.

## The three levels in this sprint
| Level | Name | You are here when (all real, worked out fresh) | The next thing to do |
|---|---|---|---|
| 1 | Bare Ground | At least one real holding stands (the sample fortress does not count) | Bring in your holdings |
| 2 | The Survey | Every tower is surveyed, or carries a named gap ("no tagged filing") | Lift the fog: fetch reports, queue the analysis |
| 3 | Reasons | Every real holding has a written reason **and** an invalidation line, and at least one tripwire is armed | Write why, and what would prove you wrong |

Levels 4 (The Watch) and 5 (The Ledger) stay as in the brainstorm and come in a later sprint. Until then the top is Level 3 and the Quest log says "more to build".

## What gets built (one PR, one commit per step)
1. **Rules file and endpoint (backend).** `standing_v1` (a versioned rules file) and `GET /game/standing`: level, the facts behind each gate (for example "5 of 8 towers surveyed"), and the next step in plain words. Read-only. Level N is the highest N whose gates 1..N all hold. Unknown never counts; a weaker data set never raises a level; the sample journal reports "sample". Tests for every rule. A change to what a level means is a new version file.
2. **Standing in the world (frontend).** The 3D page asks `/game/standing` and draws it only. A "Standing" line on top of the Quest log. **Torches at the gate light one per level**, reusing the S6 torches (same warm flame for every level, never red or green; only the count differs). Reduced motion: no flicker.
3. **Level 1 start (frontend).** With no real holdings, the Oracle says what is missing and where to start, with a link to the existing import page. New wording goes in `dialogueV2` (new version file; `dialogueV1` stays).
4. **Level 2 named gaps.** A small versioned list of towers that honestly cannot be surveyed. It starts empty; Jæren Sparebank (no tagged filing) is the first candidate, **Faiz decides** whether it goes on.
5. **Checks and write-up.** Backend: pytest, ruff, mypy report. Frontend: `tsc`, lint, test, build. Headless screenshots at the gate with 0, 1, 2 and 3 torches, plus the empty-fortress Oracle. Doc, README line and PROGRESS in the same PR.

Not in this sprint: writing desk (it comes with the Level 3 work after this), Night Watch and tripwire quests (Level 4), quests as data, Storm Drill, per-tower pennants (cut by Faiz).

## Game sprint checklist, section A
1. **Pages touched:** `/game3d` only (Quest log panel, the gate in the courtyard, the Oracle's talk). The flat Fortress is not touched. One new backend endpoint.
2. **Identity score (0 to 3):** `/game3d` | before 2 to 3 (horizon doc) | target 3 | torches at the gate show the Standing without a number. Faiz confirms. Identity debt, not touched: Printer pages with no art wired.
3. **Visual win:** *Light the torches*: a gate that shows how far you have got. Verb and scene: lighting the torches at the gate. Real fact encoded: the Standing level. Words deleted: the Oracle's "pads are bare" dead end becomes one clear first step.
4. **Visual verb + scene per item:** item 1 none (rules); item 2 torches at the gate; item 3 the Oracle pointing to the bare pads; item 4 a named gap shown as a small mist tag on that tower, not as a failure.
5. **Words:** Quest log Standing line at most 12 words; Oracle bare-pads text at most 40 words. Voice: short and playful, like a game ("Bare Ground", "The Survey", "Reasons"); numbers stay exact. The final labels are written in the PR for Faiz to read aloud.
6. **Kit:** reuses the S6 gate torches and the Quest log panel; adds a lit/unlit state for the torch (owner: game-feel-engineer). No new art, no new Stitch picture needed.
7. **Cut line:** if the sprint runs long, cut the tripwire half of Level 3 first (Level 3 then means thesis plus invalidation; tripwires move to the Level 4 sprint). Never cut the sample label, the unknown state or the screenshots.
8. **Rules:** progress = understanding; no XP, streaks, timers or rewards for acting; no buy or sell wording; unknown stays fog; sample journal wins and is labelled; level can go back down; read-only (only existing writes stay). Colour-blind: torches differ by count, not colour. Reduced motion: still flames. Performance: lit torches add no draw calls beyond the S6 ones; Faiz checks 60 fps with P.
9. **Taps from a cold load:** Standing line: 1 (press Q). Torches: 0 (visible at the gate). Empty fortress: walk to the Oracle, E, one link out = 2. No control appears twice; no confirm step.

## Questions for Faiz
- Is Jæren Sparebank allowed as the first named gap at Level 2? **Answered: yes.**
- Playtest (after deploy), Level 1: with an empty or sample fortress, can someone tell in two minutes what to do first?

## Checks before the PR is called done
Never say merged or deployed unless checked. Journal `invalidation` exists on entries (`lib/types.ts`); the tripwire and Night Watch services exist in the backend (`services/thesis/tripwires.py`, `services/game/night_watch.py`). The exact "active tripwire" query is checked in step 1 before the rule is written.

## After this sprint (from the brainstorm, one PR each)
Quests as data and quest 1 v2 · Level 4 (tripwire and Night Watch quests) · writing desk from Level 3 · Storm Drill · Level 5 (the Ledger) · world growth.
