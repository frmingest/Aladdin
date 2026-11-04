# 3D asset sprint plan: put the art we already own on the map (2026-11-04)

**Status: plan, decisions made, A1 merged (#292), A2 merged (#293), A3 merged (#294), A4 written (PR open, see PROGRESS). Not seen in a browser, not deployed.** Written against `main` `2ad6fb6` (#291). Faiz's ask: assess what 3D assets the game still lacks, check the nine packs in `frontend/src/assets/art/3D`, and start implementing on priority. "You decide": the decisions below are Claude's, recommended and applied; say so if one is wrong.

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge. This plan is the order in which the art we already own reaches the screen. The surprise of the assessment: **most of the art is already packed, but not wired.** `holding-ingots/bank/factory/stall.glb`, `siege.glb`, the four Skeletons and `market-quarter.glb` sit in `public/models` and nothing draws them (`DRESSING_BUILT` was `false` for ingots, stall, bank, factory). Outdoors, each of those holdings stands as a plain tower. Wiring beats importing.

## The nine packs in `art/3D` (all CC0, each has a `License.txt`)

| Pack | State on `main` | Verdict |
|---|---|---|
| Adventurers 2.0 | 5 of 6 bodies in use (Ranger is not) | Ranger later, one townsperson |
| Dungeon 1.1, Hexagon 1.0 | In use (banners, market, camp, buildings, horizon) | Nothing new needed |
| Resource Bits 1.0 | Imported and packed into `holding-*` and `market-quarter` | **Wire it** (A1 to A3, A5) |
| Skeletons 1.1 | Imported, four files packed, unused | **Wire it** (A5, D14 already approved) |
| Forest Nature 1.0 | **Not imported** | **Import**, meadow plants (A4) |
| Restaurant Bits 1.0 | Not imported | Mostly kitchen. Borrow at most a few crates and jars, only if a dressing needs them |
| Furniture Bits 1.0 | Not imported | Library and interiors, later, no priority |
| Fantasy Weapons Bits 1.0 | Not imported | With the defence dressing (A7), later |

Correction to the first assessment of today: it said bank, factory and market stall needed new composition from these packs. They are already composed and packed; only the dressing code is missing.

## The order, and why

Priority is **how many of Faiz's holdings stand as a plain tower outdoors today**, then the biggest visible gain.

| Sprint | What you will see | Size | Needs |
|---|---|---|---|
| **A1 gold bullion vault** (this PR) | A bullion holding's land and outdoor building: a gold chest, fixed bar and coin piles inside a ring of six low barred barriers that wear the wall ladder | S | none |
| **A2 bank vault** (merged #293) | Alfred Berg and any bank: six barred walls, gold chest, coins, a writing desk with open journal, pencil, key and candle | M | A1 pattern |
| **A3 factory and market stall** (merged #294, [doc](game3d-a3-factory-stall-2026-11-04.md)) | Industrials as a workshop (blacksmith, cogs, anvil); retail as a stall (cloth, crates, flags) | M | A1 pattern |
| **A4 meadow plants** (PR open, [doc](game3d-a4-meadow-plants-2026-11-04.md)) | Forest Nature trees, bushes, grass tufts and rocks on the meadow, instanced, off every plot, lane, river and field | M | import Forest Nature (`scripts/import-pack.mjs`), new `forest.glb` at most 600 KB |
| **A5 Siege Field** | `siege.glb` engines and Skeleton attackers, wall line breach from the Dungeon pieces | L | S28 plan, D14 approved |
| **A6 Market Quarter** | `market-quarter.glb` lane | M | S30 plan |
| **A7 defence and health** | Armoury yard (barracks, archery target, rack, Fantasy Weapons) and apothecary | M | Map pictures first (below) |

Cut first if time is short: A7, then A6, then the grass tufts in A4. Never the ladder, the ghost and neutral states, or the truth tests.

## Decisions made

| # | Question | Decision |
|---|---|---|
| P1 | Wire or import first? | **Wire.** The art exists; four holdings are plain towers |
| P2 | Does bullion draw its neutral? Physical gold has no balance sheet, so its usual tier is "not applicable". | **Yes**, like the fountain. Otherwise the vault would hide behind the plain block |
| P3 | May gold, silver or coins vary with anything? | **No.** A fixed pile list, pinned by a test. Nothing grows with a gain |
| P4 | Defence and health: Map pictures? | **Yes, both.** The sector rows already exist in `lib/sectors.ts` with no Map art. Faiz makes two Stitch pictures (armoury yard, apothecary); the 3D dressing follows so the Map and 3D agree (D2). Until then: plain tower |
| P5 | Tech? | **Stays a plain tower.** No pack has modern art; a medieval inventor's workshop is possible later if Faiz wants it |
| P6 | Defence classed as Industrials? | **Left as is** (the defence row sits after Industrials). Each sprint's theme readout prints every real holding's theme, so Faiz can see where Kongsberg lands before any art is drawn |
| P7 | Forest Nature scope | Trees, bushes, rocks and grass tufts only. No new look for hills or mountains. Pieces used many times go through the S23 batch drawing |
| P8 | The other three packs | Not imported until a sprint needs a piece |

## Rules every sprint keeps

- **The art never carries a fact.** Theme from the sector only; condition from the wall tier only; stream from the moat tier only; piles fixed.
- No red or green (`scripts/glb-colour-audit.mjs` for any new file). Colour-blind safe: condition is shape, lean and rubble.
- Models load only when the land opens. First load of `/game3d` must not grow; each PR posts the number.
- Budgets: land at most 120 draw calls, 80k triangles, 600 KB per dressing; countryside inside the courtyard limits.

## Game sprint checklist, section A (for A1 to A3)

1. **Pages touched:** `/game3d` meadow and the holding land behind the door. No flat page.
2. **Identity score:** holding land 3 to 3, meadow 3 to 3 (the theme now reads on four more holdings).
3. **Visual win:** the business readable from across the meadow (gold chest and bars say "bullion").
4. **Visual verb + scene:** *guard the vault.* Standing in a barred yard of gold.
5. **Words:** no new text.
6. **Kit:** reuses `StaticBatch`, `LandBlock`, `StreamBand`, `WithFallback`, the ladder and the code-built props.
7. **Cut line:** as above.
8. **Rules:** above.
9. **Taps:** unchanged (door, shelf = 2 E).

## Not seen

No browser run, no fps. The A1 vault was checked in a headless lineup render only (intact, worn, failing). Faiz's look: walk out of the gate, find the bullion holding, step in.
