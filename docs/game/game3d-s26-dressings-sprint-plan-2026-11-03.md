# 3D S26: the first four dressings for the holding lands (sprint plan, 2026-11-03)

**Status: plan only, approved. Faiz, 2026-11-03 06:41: "Decisions all are ok"; G1 to G4 are settled as recommended. No app code changed.** Written against `main` `5c2bd93` (#267). Part of the approved [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) (D1 to D16 approved by Faiz on 2026-11-02). It follows the [S25 plan](game3d-s25-holding-land-sprint-plan-2026-11-03.md) (the land itself, plain version) and the [S22 and S23 plan](game3d-s22-s23-sprint-plan-2026-11-02.md). Nothing was run for this plan and nothing was looked at in a browser.

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge: one to five PRs, a clear "what you will see", and a test so it cannot quietly break later. S25 gives every holding its own land, with a plain centre (the holding's own tower). **S26 is where the land starts to look like the holding's picture on the flat Map**: a mill by a stream, a farm, a fountain square, a mine. It is the first time the 3D game shows *what kind of business* it is, not only how strong it is.

## Where things stand (checked in the repo today)

- **Merged:** the discovery plan (#263), the one sector table (#264, `lib/sectors.ts` already answers "which theme for this holding"), the packed art (#265), the S22/S23 plan (#266), the S25 plan (#267).
- **Not built yet:** S21 (the list of places, written on `feature/game3d-s21-areas`, not merged), S22 (fade and name plate), S23 (lighter courtyard), S25 (the land). **S26 cannot start until S25 PR 3 is merged**, because it fills the land's centre slot.
- **The art is already in `public/models`** and listed in `game3d/holdingPieces.ts`, each file under the 600 KB budget: `holding-windmill.glb` 390 KB, `holding-watermill.glb` 272 KB, `holding-farm.glb` 321 KB, `holding-fountain.glb` 206 KB, `holding-mine.glb` 545 KB, `holding-quarry.glb` 543 KB. A test already keeps that list and the files in step. Some pieces are borrowed from files we already ship (Builder `mill`, `watermill`, `mine`, `house`; Kenney `fountain_round`; the market `well`), so nothing is packed twice.
- **The tiers a dressing must show** (`lib/fortress.ts`): walls are basalt, granite, brick, timber, rotted, unsurveyed, or not applicable. Moats are wide, narrow, none, unsurveyed, or not applicable. These two are what the centre may show as *condition*. Nothing else about a holding may change how the centre looks.
- **Windmill sails cannot turn.** The pack note says the Hexagon windmill's sail is not a separate piece. So in S26 the windmill stands still (decision G1).
- **The work clips are unreviewed.** `clips-work.glb` holds six clips cut from the Skeleton files (chop, hammer, saw, pick up, throw, sit). Nobody has seen one play on a character yet.

## What you will see when S26 is done

Walk into a tower door whose holding is **energy or utilities** and you arrive in a land with a **mill by a stream**; **food** gives a **farm**; **funds** a **fountain square**; **materials and metals** a **gold mine or quarry**. The land is laid out exactly as S25 made it (gate stone, four survey lanterns, records house, price post); only the centre changes.

**Which of your holdings will change is smaller than it sounds.** S26 covers four of the ten looks. Sectors that the flat Map shows as a bank, a factory or a market stall (S27), and sectors the Map has no picture for (defence, tech, health), stay on S25's plain tower until later. My notes list Vår Energi (energy), Salmon Evolution (food), Jæren Sparebank (bank), Kongsberg (defence), Bouvet (tech) and Vend; I have **not** checked the live sector of each. PR 1 prints the real theme of every holding, so you know up front which lands change.

**Visual verb + scene:** *visit the holding's workplace.* The visual win is that the land's centre now says what the business is, and its *condition* says how sound the walls are. Both replace reading words.

## The one rule that matters: the picture may never flatter

A pretty mill must not make a weak holding feel safe. So:

- **The theme comes from the sector only** (the flat Map picture; the same code as the Map).
- **The condition comes from the wall tier only**, by one fixed ladder that every dressing uses, so a weak holding is as easy to read as a strong one.
- **The stream comes from the moat tier only.**
- Weight, sector, size class, margin of safety and the verdict change nothing about condition, light or sky.

### The condition ladder (the same five rungs in every dressing)

| Wall tier | Rung | What it looks like (any dressing) |
|---|---|---|
| Basalt | Sound | Everything upright and tight; no props, no rubble |
| Granite | Solid | Upright, one small plain patch |
| Brick | Worn | A little lean in the pieces, a few gaps, a prop or two |
| Timber | Patched | Clear lean, gaps, several props, a loose plank or two |
| Rotted | Failing | Strong lean, a crack across the front, fallen pieces on the ground, broken props |
| Walls not surveyed | **Ghost** | The whole centre drawn pale, in mist, no detail. The gate stone says "Not surveyed yet" |
| No walls (no balance sheet to judge) | **Neutral** | Plain, undamaged and not proud: it never reads as "Sound" |

How each theme wears the ladder (the piece choice is settled in that theme's PR picture):

| Dressing | Centre | Condition shown with |
|---|---|---|
| Windmill / watermill | Hexagon `windmill` or `watermill` (borrowed Builder `mill` / `watermill` as the check) | lean and gaps of fence and planks, loose sacks, props; the crack is code-built |
| Farmhouse (and fish farm) | Builder `house` | lean, gaps in `fence_wood`, fallen `lumber`, empty field patches |
| Fountain square | Kenney `fountain_round` and the `well` | missing and fallen `column`s, a cracked rim, dry stones |
| Gold mine / quarry | Hexagon `mine_building` with `scaffold_*` pieces | stone-lined timbers (sound) down to propped timbers, rubble in the doorway and a crack (failing) |

**One function, no guessing:** a pure `landCondition(wall)` returns the numbers (lean, gaps, rubble, props, crack) and `landStream(moat)` returns the stream. Every dressing only chooses *which pieces* wear them. The tests are on those two functions, not on pictures.

### The stream (moat tier)

| Moat tier | Stream |
|---|---|
| Wide | Broad water band around the centre |
| Narrow | Thin water band |
| None | Dry stony bed, no water |
| Not surveyed | Mist band with a "?" |
| No moat (not a business) | No band |

The band is built in code from one shared flat material, so every dressing has the same moat language. The watermill and fountain keep their real water tile *inside* the scene; it is scenery and never carries the moat fact.

## The five PRs

Each PR leaves the game working: a theme that is not built yet keeps S25's plain tower. You can stop after any PR.

### PR 1: the ladder, the stream and the theme readout (M)
1. `landCondition.ts` and `landStream.ts`, pure data and maths, no three.js, with tests.
2. The centre slot in the land takes `{ theme, condition, stream }`. Theme `plain` keeps the S25 tower. The ghost and neutral states are drawn here, once, for every theme.
3. A small readout (a test that prints, and a line in the PR text) of the **theme of each live holding**, from the same `holdingTheme3d` call the page uses. This is how you learn which lands will change.
4. A picture of the ladder: one plain placeholder block drawn at all five rungs plus ghost plus neutral, side by side.

### PR 2: windmill and watermill (S to M)
Placed from `holding-windmill.glb` and `holding-watermill.glb`. The windmill stands still (G1). One picture: the same dressing at Sound, Failing and Ghost, side by side.

### PR 3: the farmhouse, with the fish farm (M)
`holding-farm.glb` plus the Builder `house` and hedges. **The salmon tanks are code-built** (decision D13 is already yes): round open tanks with simple silver-blue fish shapes, in the same flat style as the other code-built pieces. They are scenery only: the number of tanks and fish never changes with any value. Fish are silver-blue, never red or orange. Sector "food" without fish keeps the plain farmhouse; the tanks show only where the holding is a fish or aquaculture name (the exact test is written in the PR, against the sector text).

### PR 4: the fountain square (S)
`holding-fountain.glb`, Kenney `fountain_round` and the `well`. For funds, "no walls" is the usual tier, so this dressing is mostly **Neutral**. It is also the smallest file, so it is a safe place to prove the ladder if PR 2 runs long.

### PR 5: the gold mine and the quarry (M to L)
`holding-mine.glb` and `holding-quarry.glb` plus the Builder `mine`. Gold nuggets and stone piles have a **fixed count**: they never grow with a gain. **A short spike first:** play the packed `2H_Melee_Attack_Chop` clip on the Barbarian with the pickaxe in his hand and look. If it reads as mining, one worker swings a pick near the mine mouth; if it does not, there is no worker and the land stays still (decision G2).

## Order

By default the dressings go **in the order of how many of your holdings wear them**, read from PR 1's readout. If it does not settle things, the order above (mill, farm, fountain, mine) is the fallback.

| Step | Needs | Size |
|---|---|---|
| S25 PR 3 merged (Faiz) | S21, S22 PR 1, S25 PR 1 and 2 | — |
| S26 PR 1 (ladder, stream, readout) | S25 PR 3 | M |
| S26 PR 2 to PR 5 (one dressing each) | S26 PR 1 | S to L |

Then S28 (the Siege Field) and S30 (the Market Quarter) follow as in the discovery plan; S27 adds the bank, gold bars, market stall and factory dressings.

## Budgets (checked in each PR, posted in its text)

| Measure | Limit |
|---|---|
| Draw calls in a land | 120 |
| Triangles in a land | 80k |
| Model download per dressing | 600 KB (all six files already fit) |

Pieces used many times (sacks, rocks, fence posts) use S23's batch drawing once it is merged; until then they are placed as single clones within the same limits. Models load only when the land opens (a quiet preload starts when you are near the door, S22 PR 1), so the first load of `/game3d` does not grow.

## Tests (pure, run on every PR)

- **Ladder:** a worse wall never has less damage than a better one; ghost equals no rung; neutral equals no rung and is not the same as Sound; the numbers depend on the wall tier alone.
- **Stream:** each moat tier has its own look; "none" has no water; unsurveyed is mist, not clear water.
- **Truth rules:** two holdings that differ only in sector look the same in every fact piece (gate stone, lanterns, price post, stream, condition numbers); two that differ only in wall tier look different; theme and light never read the verdict; no pile or crowd grows with a value.
- **Same theme as the Map:** each holding's land theme equals its flat Map picture (S24's tests, reused).
- **Pieces exist:** every node a dressing places exists in its file, and each file has a credits row (the packs' tests already do this).
- **Colour:** code-built pieces (stream, cracks, tanks, fish) pass the red-and-green check; the pack files already pass `scripts/glb-colour-audit.mjs`.
- **Browser check (once S22 PR 2 gives `?at=`):** open `?at=holding:<id>` for each themed holding in demo mode; it loads, the gate stone shows, no console error, draw calls under 120. Not fps (headless graphics are about 2 fps); fps stays your check with P.

## Taps

A dressing adds no presses. Courtyard to a shelf stays **2 E** (door, shelf); reading a survey check stays **1 E at the lantern** after the door. Counted in a real browser before each PR is called done.

## Game sprint checklist, section A

1. **Pages touched:** `/game3d`, the land behind each tower door (the centre only). No flat page changes.
2. **Identity score (before → after):** holding land 3 → 3 (the discovery plan scores the land at 3; S26 raises how well it reads, not the score). Courtyard 3 → 3. No page drops.
3. **Visual win:** the themed centre with its condition: it shows the business kind and the wall tier at a glance and deletes a text line. **Fact encoded:** wall tier (condition) and moat tier (stream); the theme itself encodes the sector.
4. **Visual verb + scene:** "visit the holding's workplace", standing in a mill yard, farm, square or mine.
5. **Words:** no panel gets more text. New short lines in the existing land words file: the "Not surveyed yet" gate-stone line already planned in S25, and one plate per dressing in game voice (for example *"A mill by the stream"*, *"The old timbers are holding. Just."*). Numbers stay exact.
6. **Kit:** reused: the nameplate, fog patch, seal, banner, S25's gate stone and lantern. New: the condition ladder and the stream band (owner: game-feel engineer).
7. **Cut line:** the worker (G2), then the salmon tanks, then the quarry's own look (it shares the mine's pieces). **Never** the ladder, the ghost and neutral states, or the before-and-after pictures.
8. **Rules:** truth over flattery; fog for unknown (the ghost); no red or green; reduced motion keeps everything still (no moving piece depends on it); colour-blind safe (condition is shape, lean and rubble, never colour); phone not in scope (3D is desktop only); budget above.
9. **Taps:** unchanged, see above.

## Google Stitch pictures

**None needed.** Everything is a packed 3D model or built in code.

## Risks

- **A pretty land flatters a weak holding.** This is the main one. Guards: the condition ladder, the shared stream, the tests above, and a side-by-side picture in every PR (Sound, Failing and Ghost of the same dressing) so you can judge that the weak one is not nicer.
- **Stacking on unmerged work.** S26 needs S25, which needs S21 and S22 PR 1. If those change in review, S26 changes with them. Cheapest fix: merge S21 first, then S22 PR 1.
- **Fewer lands change than you may expect** (see "What you will see"). PR 1's readout settles this before any art is placed.
- **Art fit.** One dressing per PR, each with a picture, so a bad fit is caught one at a time.
- **The code-built crack, tanks and fish may look off** next to the KayKit pieces. They are the first things cut.
- **Work clips are unseen.** The PR 5 spike decides; no promise before it.

## Decisions (settled 2026-11-03: all as recommended)

Everything big was decided earlier (D1 to D16). These four small ones are now settled too; the choice is in bold.

| # | Question | Recommendation |
|---|---|---|
| G1 | The windmill's sails stay still in S26. A turning sail would be code-built (S31 polish). OK? | **Yes, still for now** |
| G2 | One worker swinging a pick at the mine, only if the short spike shows the clip reads right. Otherwise no worker. | **Yes, decided by the spike** |
| G3 | Order of the dressings | **By how many of your holdings wear each one (read from PR 1's readout)** |
| G4 | "No walls" (funds) shows neutral, not sound. | **Yes: a fund must not look as if it passed a wall check** |
