# 3D S31: the holdings step out into the landscape (sprint plan, 2026-11-04)

**Status: plan only, approved. Faiz, 2026-11-04: the building stands outside and its door still leads into the holding's land; buildings sit on fixed spots chosen by theme; H1 to H3 settled (below). No app code changed, nothing run, nothing seen in a browser.** Written against `origin/main` `8bc6c85` (#287, S26 farm merged). Part of the approved [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) and the follow-up to the [S26 dressings plan](game3d-s26-dressings-sprint-plan-2026-11-03.md).

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge. This one is Faiz's idea of 2026-11-04: **the fortress stays where it is, and the eight holdings leave it.** Out on the meadow beyond the wall, each holding stands as what it is: Vår Energi a windmill or watermill by a river, a farm in a field, a mine at the foot of the hills. Walking up to one and pressing E still takes you into that holding's own land, exactly as S25 built it.

## What is already true (checked on `origin/main`)

- **The dressed buildings already exist.** Windmill, watermill, farmhouse with fish tanks, fountain square, mine and quarry are built and merged (#281 to #287) as `LandCentre` + `MillDressing`, `FarmDressing`, `FountainDressing`, `MineDressing`. `LandCentre` takes one `slot` `{ theme, condition, stream, tower }` and draws the right building, its wear (wall tier) and its stream band (moat tier). **That is the piece we put outdoors**, so no art is remade. Bank, bank vault, market stall and factory (S27) are not built; sectors with no Map picture (defence, tech, health) fall back to S25's plain tower.
- **Today the eight towers stand in a horseshoe inside the wall** (`layout.ts`, `towerSpots()`, eight fixed spots times `WORLD_SCALE` 1.5). The door, the name plate, the exit spot and about 25 files and tests key off those spots (`towerDoor.ts`, `stateToWorld.ts`, `Courtyard.tsx`, and tests for layout, desk, vault, watch, NPCs, props, booths, street, scenery, signpost, standing, workers).
- **The meadow outside the wall is free ground:** wall radius 54; the walkable meadow ends at 104 (`HORIZON_LIMIT`); the grove and boulders sit between 66 and 96 (`horizonPieces.ts`); the gate road runs from the south gate to z 94. Hills and mountains beyond 104 are scenery you cannot reach. That leaves about 50 units of walkable ring.
- **Not yet checked:** each dressing's footprint on the ground, the walk from the gate to the far side, and how many of the eight holdings fall into each theme. PR 1 prints all three before anything is placed.

## What you will see when S31 is done

Walk out of the south gate and the road forks into short dirt tracks. A **river** comes down from the northern hills, bends past the east and south-east of the wall and runs off. On it stand the **watermill** and the **fish farm**; a **windmill** stands on a low rise beside it. West of the road are **fields with the farm**. At the foot of the northern hills are the **mine** and the **quarry**. Along the gate road stand the **fountain square** (funds) and **a plain tower for any holding with no building yet** (decision H1). Every building keeps its wear, its stream band, its name plate and a **door post** with the E prompt. The inside of the fortress is left open where the towers stood (H2).

**Visual verb + scene:** *ride out and see the holdings working in the land.* The visual win: a holding's business is readable from across the meadow, before you step inside.

## The rule that matters: the landscape may not carry a fact

- **Where a building stands depends on its theme and its weight only**, the same rule the horseshoe uses today (biggest takes the best spot). Never on the verdict, margin of safety or thesis state.
- **The river and the fields are scenery.** Fixed, identical for every portfolio. The only moat fact is the stream band around each building (moat tier). The watermill's real water tile stays scenery too (same rule as S26).
- **Wear, stream, ghost and neutral are unchanged.** `landCondition` and `landStream` already decide them; outdoors just calls them.
- No pile, crowd or herd grows with a value. Same colour rules (no red or green).

## How the placing works (plain)

Each theme has a **home zone** with more spots than it can ever need, and a fixed fallback order if a zone is full (more than three river holdings spill to the nearest field spot). Holdings of one theme fill their zone from the best spot outward, heaviest first. A test tries **every combination** of up to eight holdings and themes and checks every spot is distinct, reachable, outside the wall, off the gate road, clear of the market corner, drill post and siege-yard ground, and at least a building-width from its neighbour.

| Zone | Themes | Where |
|---|---|---|
| River bend | watermill, fish farm | east and south-east of the wall |
| Rise by the river | windmill | on the bank, next to the watermill |
| Fields | farm | west and north-west meadow |
| Hill foot | mine, quarry | north, below the foothills |
| Road edge | fountain, bank, stall, factory (later), plain tower, and the three new looks below | along the gate road, a short walk from the gate |

## Buildings for the sectors with no picture yet (H1)

Three sectors have no Map picture and no 3D building yet: **defence, tech, health**. They stand outside as the plain tower first (PR 3) and get their own building in PR 5. What can be used, found on 2026-11-04:

| Sector | Free source, no download | Free source, would need a download | My pick |
|---|---|---|---|
| Defence (Kongsberg) | `barracks`, `watchtower` and `castle` in `town-buildings.glb`, `weaponrack`, `tent`, `target` and `building_tower_catapult` from Hexagon, Castle Kit walls and towers in `siege.glb` | none needed | **A small guard post: watchtower, weapon rack, tent, target.** Everything is already in `public/models`. Note `barracks` is booked by the factory look. |
| Tech (Bouvet) | Hexagon `building_tower_A/B`, `cog`, `lantern`, Dungeon `candle` | Wizard-tower and alchemist packs exist but none showed a clear free licence (the alchemist pack is paid; the others are itch.io pages with no licence line read) | **An observatory tower from shipped pieces** (tower with a lantern and a cog). Not a modern office: Kenney City Kit Commercial and KayKit City Builder Bits are CC0 but belong to a modern town and would clash. |
| Health | `house`, `church`, `well`, herb fields (`grain_field`, `dirt_field`), `bucket_water`, `sack`, white banner | Quaternius Medieval Village MegaKit: CC0 on its page, glTF, 300+ modular pieces, free tier is about 60 to 70 % of the pack. Real build work, and its zip licence must be opened first (an earlier note found a conflict) | **A healer's house with a herb garden from shipped pieces.** The MegaKit is the upgrade if it looks too plain. The hospital packs found are modern or paid and are not used. |

**What I could and could not check today.** Pages read: KayKit City Builder Bits (CC0, free tier 32+ models, glTF), Kenney Retro Medieval Kit (CC0, 100 assets, formats not stated), Kenney City Kit Commercial (CC0, 50 files), Quaternius Medieval Village MegaKit (CC0 per page). Not checked: any zip licence file, and the sandbox cannot reach these hosts to download (found on 2026-10-31), so any download is Faiz's. **None of the three buildings needs a download to start.**

**One thing the Map does not have.** These three sectors have no flat Map picture, so the S24 test "land theme equals the Map picture" must allow a 3D-only look for them. If you later want the flat Map to match, that is a new picture to generate and I will describe it to you first.

## The PRs

Each leaves the game working. You can stop after any one.

### PR 1: plots and tracks (data only, size M)
1. `outdoorPlan.ts` (pure data, like `townPlan.ts`): the zones, the spots, `assignPlots(holdings)`. No three.js.
2. A readout: each live holding's theme, each dressing's footprint, the walk from the gate to every zone, printed in the PR text.
3. Tests: all the placement rules above, plus "same inputs give the same plots", "two holdings that differ only in verdict get the same spot".
4. Nothing drawn yet. The horseshoe is untouched.

### PR 2: the countryside (scenery, size M)
1. The river (one flat code-built band, same material language as `StreamBand` but wider and clearly not a moat), tracks from the gate road to each zone, and field patches. Fixed shape, no data in it.
2. Thin the grove and boulders where plots and the river need room (`horizonPieces.ts` keeps its seed; pieces inside a plot are dropped, not moved).
3. Budget check: draw calls and triangles for the outside, posted in the PR.

### PR 3: the holdings step out (the big one, size L)
1. `Courtyard` draws a `LandCentre` per plot at its outdoor spot, lit and fogged like the rest of the meadow. Holdings with no building yet stand there as S25's plain tower. The eight inner towers stop being drawn.
2. `towerDoor.ts` learns outdoor plots: a door post beside each building facing the track, the same reach rule (from the footprint, not the middle), the same name plate, the exit spot in front of the door. The E prompt is unchanged.
3. Everything keyed to the old spots moves with it: Standing torches over towers, nameplates, Storm Drill results, per-holding figures. A test lists every consumer of `towerSpots()` so none is left behind.
4. Models: only the themes your holdings use are loaded, with a quiet preload as you leave the gate. First load of `/game3d` must not grow noticeably; the PR posts the number.
5. Before and after pictures of the courtyard and of one strong and one weak holding outside, side by side.

### PR 4: the freed yard (size S)
Tidies the horseshoe ground inside the wall after PR 3 (paths; the desk and shelf stay put). **Nothing new is built there** (H2). What goes there, if anything, is decided after you have seen it empty.

### PR 5: guard post, observatory, healer's house (size M, after PR 3)
Three dressings built from shipped pieces, using the same `{ theme, condition, stream }` slot and the same wear ladder as every other building. `lib/sectors.ts` gets the three new look names; a theme with no building keeps the plain tower. Pictures at Sound, Failing and Ghost for each.

## Tests (pure, run on every PR)

- **Placement:** all rules above; every combination of up to eight holdings and themes; deterministic.
- **Truth:** theme and weight only decide the spot; wear and stream depend on tier only; river and fields are identical for every portfolio.
- **Doors:** you never arrive standing on a building; exit returns you to that holding's door post; an unknown holding goes to the gate.
- **Consumers:** no code path still reads the old horseshoe spots.
- **Words:** any new text (door post prompt, name plates) is in a words file with a word-budget test, game voice, short.
- **Browser check** (once `?at=` exists): open the meadow in demo mode, check every plot loads, no console error, draw calls under budget. FPS is your check with P.

## Taps (measured in a real browser before it is called done)

| Task | Now | After |
|---|---|---|
| Spawn to a tower's shelf | 2 E (door, shelf) after a short walk | 2 E, plus a longer walk |
| Read a holding's survey lantern | door, then E at the lantern | unchanged |

## Game sprint checklist, section A

1. **Pages touched:** `/game3d` meadow and fortress yard; nothing in flat Game mode.
2. **Identity score:** courtyard 3 to 3 (needs the before/after picture); meadow, new, targets 3.
3. **Visual win:** a holding's business readable from afar.
4. **Words:** door post and name plate only; no panel gets more text.
5. **Cut line:** PR 4, then the field patches. Never the wear, the stream or the name plate.
6. **Rules:** truth over flattery, fog for unknown, no red or green, reduced motion unchanged, colour-blind safe, desktop only, draw calls and triangles budgeted in each PR.

## Risks

- **A long walk.** Quick travel was **deferred by Faiz (H3)**. Measure the walk in PR 1; if it is long, raise it again then.
- **Draw calls.** Up to eight buildings now sit in the open scene at once, not one at a time inside a land. This is the main performance risk; S23's batching helps, but it must be measured in PR 3.
- **Wide change.** About 25 files and tests mention `towerSpots()`. PR 3 is the one to split further if review feels big.
- **Pretty outside flatters.** A weak holding must look as easy to read as a strong one: same wear ladder, same stream, same footprint rule.
- **Unmerged work.** PR 3 starts after the dressings it shows are merged (#281 to #287).

## Decisions (settled by Faiz, 2026-11-04)

| # | Question | Answer |
|---|---|---|
| H1 | Holdings with no building yet (defence, tech, health) | **Stay outside as a plain tower on the road edge**, and get their own building later (PR 5); free art source above |
| H2 | What goes in the empty yard | **Nothing yet**, look at it first |
| H3 | Quick travel to a holding's door | **Deferred** |
