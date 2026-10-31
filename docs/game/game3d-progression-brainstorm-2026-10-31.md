# 3D courtyard: review against the app, and a level 1 to 5 brainstorm (2026-10-31)

Status: **brainstorm only. Nothing built.** Decisions by Faiz are in section 9. The first sprint that follows from it is [Standing 1](game3d-standing-sprint-plan-2026-10-31.md). Written from the repo (as of `feature/game3d-kaykit-models`), `docs/PROGRESS.md`, the 3D docs and the Claude project docs. Deploy not checked. Not seen in a browser by me. Since writing, KayKit S4 to S8 and the HUD toolbar have merged.

## 1. Review: what the 3D mode is today

| Piece | State |
|---|---|
| Courtyard, walking, camera | Built (weeks 1 to 2), seen by Faiz on Railway at 165 fps |
| 8 holdings as towers | Built. Shows wall, size, moat, ivy (freshness) and thesis flag from `GET /game/state` |
| Oracle (Barren Wuffet) and Partner (Marlie Chunger) | Built, KayKit Mage and Knight |
| Quest 1 Unwritten Thesis, quest 2 Six-Month Reckoning | Built. Both read **only** `GET /journal`, derived, nothing stored |
| Quest 3 Storm Drill | Planned, not built |

## 2. Gaps against the app (checked in the code)

1. **3D reads two sources and writes nothing.** `stateToWorld.ts`, `Courtyard.tsx` and `Game3DPage.tsx` never mention vault, siege, temperament, advisors, ravens or night watch, and nothing in `game3d/` calls a write endpoint. The flat Fortress and the backend have all of those (`/game/siege`, `/ravens`, `/night-watch`, `/records`, `/calibration`, `/holdings/{id}/advisors`, thesis tripwires, readiness, newsweb).
2. **A brand-new user has nothing to do in 3D.** With no holdings the Oracle says "The pads are bare" and stops. Both quests need a journal, which needs holdings. The first-run path (import CSV, fetch reports, run analysis) only exists in the flat app. This is the biggest "startup" gap.
3. **The quests can run out.** Each is a yes/no predicate on the journal. Once every holding has a reason and no review is due, there is nothing left, and the only recurring reason to return is a review months away.
4. **Every quest ends with "go to the Journal page."** That leaves the world and breaks the 2-tap interaction-cost gate in `CLAUDE.md`.
5. **Dialogue is one quest deep.** Only the first open quest speaks; no per-holding talk; towers cannot be inspected in the world.
6. **The 3D plan is partly stale.** `3d-game-feasibility-2026-10-30` says "skill tree = circle of competence" (Circle page removed 2026-10-19), "Council/Chronicle" are gone (2026-10-18), and it says **drop XP/levels**, which this request reopens (see decision 1 in section 9).
7. **Demo journal never marks a review due**, so level 5 cannot be playtested on sample data.

## 3. Rules every level must keep (CLAUDE.md, skill `game-design-reward-knowing`)

Progress = understanding. Allowed: fog that lifts when real work is done, reviews written. It **can go backwards** when data goes stale. Banned: XP for trades, streaks, dailies, timers, leaderboards, anything that makes acting feel better than waiting. Read-only except writes that already exist (journal, watchlist, queue, cash, buy-below). Unknown stays fog. Demo wins. No buy/sell wording. New wording is a new version file.

**Proposal for "levels" under those rules: a derived *Standing*.** No XP counter, no save file. Level N = the highest N for which gates 1..N all hold, recomputed on every load from real facts, like the two quests today. Lose a gate (an analysis goes stale, a tripwire fires unseen) and the level drops, the torches go out.

## 4. Level 1 to 5 (a fresh start: empty app, bare courtyard)

| Lvl | Title | Gate (all real, derived) | Quests (player verb) | NPC | World |
|---|---|---|---|---|---|
| 1 | **Bare Ground** | At least 1 real holding stands (not demo) | *Raise the first towers* (import holdings CSV). *Name what stands* (tag-review queue and currency check clean) | Oracle only says what is missing and where to start | Mist, a campfire and a tent. Pads empty |
| 2 | **The Survey** | Every tower is non-fog (wall and size surveyed) or carries a **named gap** ("no tagged filing") | *Lift the fog*: fetch Newsweb/SEC/ESEF reports or upload statements, then queue the analysis. Reading, fetching | Partner asks "what does this wall rest on?" | Fog patches lift one tower at a time. Torches at the gate |
| 3 | **Reasons** | Every holding has a written thesis **and** an invalidation line, and at least 1 active tripwire | *Write why, and what proves you wrong* (quest 1, tightened). *Arm the wire* (tripwire suggestions already exist) | Partner: "invert it" | Banners on the keep wall (teal and neutral only) |
| 4 | **The Watch** | Night Watch check is current, no fired tripwire left unseen | *Face the wire*: open a fired tripwire, write what you decided (holding counts as much as selling). *Storm Drill*: set the siege slider, write what you would do before it happens. Ravens perch on towers for new reports; reading is optional, unread ravens never lower the level | Oracle reads the night dispatch | Lanterns, ravens, weather |
| 5 | **The Ledger** | No 6- or 12-month review due and unwritten, with enough old entries to have been reviewed | *Reckoning* (quest 2): write what happened next to what you expected. Calibration record shown with its sample size ("too few so far") | Both talk about your own track record | The fullest courtyard. Townsfolk appear (decoration only) |

Level 5 is **held, not won**: it drops the day a review falls due. It cannot be reached in a weekend, because the 6-month rule needs 182-day-old entries. That is the point of the game, not a flaw.

## 5. Cross-cutting ideas

- **Pennants per tower (cut by Faiz):** each tower would fly 0 to 5 pennants for work done on that holding. Risk was diligence read as quality.
- **Quests as data:** `{id, level, source endpoint, predicate, words}` in a versioned file (`standing_v1`), so adding a quest is a data change, deterministic and testable, not new React.
- **One endpoint:** `GET /game/standing` computing the level from stored data, so the browser does not fetch six sources and the rules live in the backend's versioned mapping.
- **In-world writing desk (from level 3):** a desk at the keep door using the existing `POST /journal`. Levels 1 and 2 keep linking out.
- **Seasons instead of an end:** report season (new periods captured) and a yearly 12-month day give level 5 a rhythm.
- **Not allowed:** XP for logging, streaks, daily visits, countdowns, rewards for trading, anything calling an untouched holding "failed".

## 6. Cheapest prototype and one cut

- **1-day prototype behind a flag:** one pure `standing(...)` function with tests (weaker data never raises a level, unknown never counts, demo is labelled "sample") and a Level line at the top of the existing quest log. No new art.
- **Playtest questions:** L1: someone who never saw the app, after two minutes: do they know the first thing to do? L2: does the fog lifting make you want to read the report? L3: did you write an invalidation you would honestly admit to? L4: when a wire fires, does it feel like a decision or like an alarm? L5: do you believe the number after reading the sample size?

## 7. Open points to check before building

- Journal `Action` values: whether a Storm Drill pre-commitment fits an existing action or needs a new one (not checked).
- Does `decided_on` backdating let a user fake an old entry? The game cannot tell; say so in the Oracle's words.
- Level-2 exemption list ("named gaps", e.g. Jæren has no tagged filing) needs its own versioned source.

## 8. Suggested order (each one PR, tests, new version files for any wording)

P0 standing prototype · P1 level 1 onboarding guidance for an empty app · P2 quests as data, quest 1 v2 (thesis plus invalidation) · P3 tripwire and Night Watch quests (level 4) · P4 writing desk · P5 Storm Drill · P6 world growth with the KayKit props already planned (S6 to S8).

## 9. Decisions (Faiz, 2026-10-31)

1. **Levels as a derived Standing: ok.** No XP, nothing stored, level can drop.
2. **Per-tower pennants: cut** (Faiz did not need them; keep-level Standing only). Can come back later if wanted.
3. **Rules live in the backend** (Claude's call): `GET /game/standing` over a versioned rules file `standing_v1`, deterministic, with tests. The frontend only draws it. A change to what a level means is a new version file.
4. **Writing desk: yes, from level 3** (Claude's call), using the existing `POST /journal`. Levels 1 and 2 link out to the existing pages. No new write endpoints.
