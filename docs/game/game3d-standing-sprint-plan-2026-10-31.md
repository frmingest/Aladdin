# 3D courtyard: next sprint, "Standing" (levels 1 to 3), plan, 2026-10-31

**Status: S1 written and tested on `feature/game3d-standing-s1` (2026-10-31); S2 to S4 not started; nothing seen in a browser.** Files: `standing.ts`, `standingGapsV1.ts`, `LevelChip.tsx`, `GateTorches.tsx`, `gateTorchData.ts`. Built here: unknown fortress state shows "Standing unknown", never level 0 by guess; the gate frame (two posts, beam, hanging lantern) is new, no new lights. Built from the [level brainstorm](game3d-progression-brainstorm-2026-10-31.md), the [KayKit doc](game3d-kaykit-models-2026-10-31.md), the 3D code on `feature/game3d-kaykit-models` and the [game sprint checklist](game-sprint-checklist.md) (section A answered below). Deploy not checked.

## 1. What this sprint is for (plain words)

A sprint is one small piece of the game that is finished and that you can try yourself.

This one answers a simple problem: **today the courtyard never tells a new player what to do first, and it never shows how far you have got.** The two quests only read your journal, and they run out.

So the sprint adds **Standing**: a level from 1 to 3, worked out fresh from your real facts every time you open the courtyard. No points to earn and no save file. If a fact stops being true (say, a holding loses its written reason), the level drops and a torch at the gate goes out. Progress here means *knowing more*, never *doing more*.

## 2. Where we start

- 3D weeks 1 to 4 are merged (#198 to #203). KayKit characters S0 to S3 are on `feature/game3d-kaykit-models` (PR open, not merged).
- In the working folder, not committed: the three character files are already small (about 0.33 MB each, was 3.6 MB: that is S4) and the HUD panels (press Q for quests, T for towers; they start shut). **S5, looking at the Mage and Knight rendered, is still not done.**
- **Before this sprint starts:** land that branch (commit S4 and the HUD work, do the S5 look) so the Standing work does not mix with it.
- Checked in the code: the journal already has an `invalidation` field ("what would prove me wrong"), `GET /game/night-watch` exists, and the 3D page already knows when data is sample (`demo`). So levels 1 to 3 need **no new backend**.

## 3. The three rungs this sprint builds

Levels 4 (The Watch) and 5 (The Ledger) from the brainstorm are **not in this sprint**. The keep shows three torches; Standing stops at 3 for now. Quest 2 (Six-Month Reckoning) keeps working as it does today and does not count toward the level yet.

| Lvl | Name | You are here when (all real, all worked out on load) | Player verb |
|---|---|---|---|
| 1 | Bare Ground | At least one real holding stands (sample does not count) | Raise your first tower |
| 2 | The Survey | Every tower is surveyed, or carries a named gap | Lift the fog |
| 3 | Reasons | Every holding has a written thesis and an invalidation line | Write why. Write what proves you wrong |

Rules that never bend: sample data is labelled "Sample" and never lifts a real level; unknown stays fog and never counts; the level can go **down**; level N needs 1 to N-1 to hold; no XP, no streaks, no daily visits, no buy or sell words. Honest limit to say in the Oracle's words: the game cannot tell if a journal entry was backdated.

## 4. Items (each one PR on its own branch, tests included; Claude opens the PRs)

| # | Name | What it is | Size |
|---|---|---|---|
| S1 | **Where you stand** | One pure `standing()` function with tests, a Level chip that is always visible, and **torches at the gate** that light up with the level (the visual win) | M |
| S2 | **First steps** | Empty or sample-only app: the Oracle says the one thing to do first, and the quest log shows "Raise the first towers" with one link to the import page | S |
| S3 | **Quests are data** | Quests move into a versioned file (`standing_v1`: id, level, what it needs, the test, the words). Quest 1 gets a v2 that asks for thesis **and** invalidation (a new version file, the old one is not edited) | M |
| S4 | **Look and judge** | Click through with an empty account, the sample journal and your real data; screenshots; tap counts; review answers checklist section B | S |

**Cut line:** if the sprint runs long, cut S2's second quest ("Name what stands") first, then the level-2 named-gap list. Never cut the Plain view (the chip in words), the unknown state or the screenshots.

## 5. Checklist section A

1. **Pages touched.** Only `/game3d`: the Level chip, the gate torches, the quest log panel, and the Oracle and Partner dialogue. No flat Game mode page changes. The import page is only linked to.
2. **Identity score before to after (0 to 3).**

| Page | Before | After | Why |
|---|---|---|---|
| `/game3d` | not scored (never run through `game-ux-designer`) | target 2 | scene (the courtyard), shared kit, one real fact shown visually (torches = Standing), Plain view (the chip in words) |

   Identity debt on untouched pages: not re-scored here; it comes from the next `/game-ideas`.
3. **Visual win.** **Torches at the gate.** Verb: *light*. Scene: the keep gate in the courtyard. Fact: your real Standing, 0 to 3 torches lit. Deletes the "Level 2 of 5, The Survey, here is why" paragraph. **No Stitch picture is needed this sprint**: the torches are code-built from the lamp model that already exists. If a later item needs a picture, I will tell you first with a short description of what it should show.
4. **Visual verb + scene per item.** S1: light, at the gate. S2: *point*, the Oracle faces you and names one step (deletes the "pads are bare" paragraph). S3: no look change, data and words only (said plainly, not dressed up). S4: no look change.
5. **Words.** Budgets: Level chip 5 words or fewer; quest title 4 or fewer; quest line 12 or fewer; the Oracle's first-step line 15 or fewer. Before-counts are taken from the files as the first job of S1 (not counted yet). Voice, as the player would hear it: chip "Standing 2 · The Survey"; Oracle on an empty app "Nothing stands yet. Raise your first tower."; button "Raise a tower"; level-3 quest "Write why. Write what proves you wrong." Numbers stay exact; only the wording is playful. New wording ships as new version files.
6. **Kit.** Reused: Avatar and NpcMesh, the lamp prop, the ink outline, QuestLog, the Q and T panels and Toolbar. Added: a torch prop (code-built, owner `game-feel-engineer`) and a Level chip.
7. **Cut line.** See section 4.
8. **Rules.** Truth: the level comes only from real facts; sample never counts. Colour-blind: lit versus dark is brightness and shape plus the number, never colour alone. Reduced motion: the flame is static. Performance: glowing meshes only, no new lights; frame rate re-checked on a real GPU (it was 165 fps on Railway).
9. **Taps from a cold load.** Level: 0 taps (always visible). What is next: 1 key press (Q). First step on an empty app: walk up, E, then 1 click on "Raise a tower" (2). Known cost: writing a reason still leaves the world for the Journal page until the in-world writing desk (later item, P4). Measured in a real browser in S4, not from the diff.

## 6. Done means

- Tests: `standing()` never raises a level on weaker data; unknown never counts; sample never counts; level 3 needs 1 and 2. Then `tsc`, `eslint src/game3d`, `vitest run src/game3d`, `vite build`.
- Seen in a real browser with three data states (empty, sample, real). Anything not seen is named.
- Status written as three separate facts: merged, deployed, seen on real data.

## 7. Decisions for Faiz (I will go with the recommendation if you do not say otherwise)

1. **Levels at all?** The old 3D plan said "drop XP and levels". Standing is not XP (nothing to earn, can go down), but it does reopen that line. Recommended: yes.
2. **Named gaps count for level 2?** A holding with no tagged filing (Jæren Sparebank today) cannot be surveyed. Recommended: yes, a named gap counts, kept in a small versioned list. Otherwise you sit at level 1 until it is fixed.
3. **Names:** Bare Ground, The Survey, Reasons. Change any you do not like.

## 8. Later (not this sprint)

P3 tripwire and Night Watch quests (level 4), P4 in-world writing desk, P5 Storm Drill, P6 KayKit props and townsfolk, level 5 The Ledger (needs 6-month-old entries, so it cannot be rushed).
