# 3D S26 PR 5: the gold mine and the quarry (2026-11-03)

**Status: written and tested (tsc, lint, tests, build; see PR). Rendered once in headless Chrome with software graphics in a throw-away page (picture below); the real land in `/game3d` was NOT opened in a browser, draw calls and fps not measured; not merged, not deployed.** Plan: [S26 sprint plan](game3d-s26-dressings-sprint-plan-2026-11-03.md), PR 5. Builds on the ladder and stream from [PR 1](game3d-s26-ladder-stream-2026-11-03.md).

## What you will see

Walk into a tower door whose holding is a **materials / metals** one that the Map shows as a gold mine or a quarry: the middle of the land is now a **mine mouth in a rock hill** (gold nuggets, a wheelbarrow, a lantern, a pickaxe, a shovel) or a **stone yard** (brick stacks, a grindstone, a wheelbarrow, mallet and chisel, a stepped cut face). The gate stone, lanterns, records house and price post are unchanged.

**Condition (wall tier only), same five rungs as every dressing:** Sound has stone-framed scaffold panels, a stone footing step and nothing loose. Each step down adds lean, panels with planks missing, timber props (some broken), loose planks, fallen rocks, repair patches, and at Failing a crack across the front. In the quarry the brick stacks lean and shrink (large to medium to small) as bricks go missing. Ghost (not surveyed) and Neutral (no walls) are drawn by the slot for every theme, not here. The stream round it is the shared moat band.

**Picture:** [game3d-s26-mine-quarry-ladder-2026-11-03.png](game3d-s26-mine-quarry-ladder-2026-11-03.png), top row the mine and bottom row the quarry at Sound, Solid, Worn, Patched, Failing (software render, flat light, perspective makes the quarry row look bigger).

**Visual verb + scene:** *visit the holding's workplace*, standing in a mine yard or a stone yard.

## Truth rules kept

- Theme from the sector only; condition from `landCondition(wall)` only; the plan is a pure function of the condition (tested). No weight, size, margin of safety or verdict reaches it.
- Gold nuggets, stone piles, tools are a **fixed set**; no pile grows with a gain (tested: the fixed set is identical at every rung).
- Each damage field never falls as the wall gets worse (tested). Condition is shape, lean and rubble, never colour; no red or green node or tint.
- Everything is still (no moving piece), so reduced motion changes nothing. Models load only when the land opens; if a file fails to load the plain block stands in with the same condition.
- Budget: at most 45 parts per dressing by the plan's count (tested); not measured in a browser (press P in a land).

## The worker (G2): not done here

The plan wanted a short spike: play the packed `2H_Melee_Attack_Chop` clip on the Barbarian with a pickaxe and decide whether it reads as mining. That needs a person to look at moving animation, so it was **not run**. This PR has no worker; the land stays still. G2's outcome is pending.

## Code

- `game3d/mineDressing.ts` (pure plan: fixed set, ladder-driven pieces) with `mineDressing.test.ts`.
- `game3d/MineDressing.tsx` (loads `holding-mine.glb` / `holding-quarry.glb` and the Builder `mine`).
- `LandCentre.tsx` (one `dressingFor` branch for mine and quarry), `landCentre.ts` (`DRESSING_BUILT.mine` and `.quarry` on), `landCentre.test.ts` (no longer assumes nothing is built).

## Not done / for Faiz

- Open `/game3d` in a demo or real session and walk into a mine/quarry holding at different wall tiers; the Builder `mine` face and the code-built crack bars were placed from a headless picture only.
- Which of your holdings are mine or quarry themed depends on their live sector (the demo set has none).
- Words: no new player-facing text.
