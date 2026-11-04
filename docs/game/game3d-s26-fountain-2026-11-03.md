# 3D S26 PR 4: the fountain square (2026-11-03)

**Status: written and tested (tsc, lint, vitest, build). The picture below is a headless-Chrome software render of the dressing at every rung, not the game. The land was NOT opened in the game in a browser; draw calls, triangles and fps not measured; not merged, not deployed.** Plan: [S26 sprint plan](game3d-s26-dressings-sprint-plan-2026-11-03.md), PR 4. Builds on S26 PR 1 (the ladder, the stream and the centre slot).

## What you will see

A holding whose sector the flat Map draws as a fountain (funds) now has a **fountain square** in the middle of its land instead of S25's tower: Kenney's round fountain, a well, and a ring of six stone columns, with the moat stream round it as before. The gate stone, lanterns and price post are untouched.

The square wears the same ladder as every dressing, from the wall tier alone:

| Rung | The square |
|---|---|
| Sound | Six upright columns, a stone footing under the fountain |
| Solid | Six upright columns, a smaller footing, one plain patch on the rim |
| Worn | Two columns gone, a slight lean, a prop, a patch |
| Patched | Four columns gone (one lying down), clear lean, three props, loose planks on the rim, two patches |
| Failing | All columns gone or fallen on the ground (five lie there), a crack across the rim, two broken props |
| Neutral (no walls: the usual state of a fund) | Six upright columns, undamaged, **no footing**, so it never reads as Sound |
| Ghost (walls not surveyed) | The slot's pale block in mist, as for every theme |

Picture: [game3d-s26-fountain-ladder-2026-11-03.png](img/game3d-s26-fountain-ladder-2026-11-03.png). It shows Sound, Solid, Worn, Patched and Failing left to right, with different stream looks round them only to show the band (the stream follows the moat tier, not the rung). The camera crops the neutral and ghost off the right edge; the harness was a throwaway page and is not in the repo.

**Visual verb + scene:** *stand in the fountain square.* Fact encoded: wall tier as columns standing, lean, fallen stones, props and the rim crack (shape, never colour).

## Rules kept

- Condition from the wall tier only (`fountainPlan(condition)` takes the LandCondition and nothing else); stream from the moat tier only, drawn by the slot's shared band. The fountain's own water is scenery.
- No count grows with a value: six column slots, at most three props, a fixed rubble count per rung.
- Unknown stays fog: the ghost is the slot's pale block.
- Stone, timber and ink only; a test rejects red and green tints in the code-built bits. Nothing moves, so reduced motion changes nothing.
- Pieces are borrowed from files that already ship (`town-nature.glb` fountain, `market.glb` well, `holding-fountain.glb` column), so nothing new is downloaded beyond the 206 KB holding file, loaded when the land opens. While loading, or if a file fails, the plain block stands in.

## One change to the shared slot

The slot normally draws the plain block for the neutral of every theme. For funds the neutral is the usual state, so a block would hide the dressing. `DRESSING_DRAWS_NEUTRAL` (in `landCentre.ts`, fountain only) lets the dressing draw the neutral itself with the NEUTRAL condition (undamaged, no footing). Other themes are unchanged. The old test "builds no dressing yet" now says which themes are built.

## Code

`game3d/fountainDressing.ts` (pure plan, tested), `FountainDressing.tsx` (draws it), `landCentre.ts` and `LandCentre.tsx` (switch and one case per theme), `fountainDressing.test.ts`.

## Not done / for Faiz

- Look at a fund's land in `/game3d` (demo mode has no fund; the readout shows only Exxon and Coca-Cola would change from S26's other PRs). Press P for draw calls and fps.
- The well's awning is bright blue and orange; if it is loud next to the KayKit pieces it is the first thing to cut.
- Columns are scaled by eye against the fountain; adjust `COLUMN_SCALE` if they look chunky in the real light.
