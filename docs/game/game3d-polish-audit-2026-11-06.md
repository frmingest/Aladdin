# 3D polish pass: what exists, what is built (2026-11-06)

Source: the "Making today's 3D look and run better" list and S31 in [the discovery plan](game3d-discovery-sprint-plan-2026-11-02.md). Checked by grep on `main` at `a345e9b` (#301), not in a browser.

**Visual verb + scene:** the courtyard and town get a painter's finishing coat. Every building gets the same ink line the people have; chimneys breathe, forges spit, doors swing. None of it carries a fact.

| Item | On `main` before | PR |
|---|---|---|
| Ink outline on town buildings | Characters, the Siege Field and code-built `Part` shapes have it; the town GLB buildings (`Town.tsx`) did not | **PR 1 (this one)**: `addOutlines` on each building, line `TOWN_OUTLINE_WORLD` = 0.07 |
| Soft shadows (round blobs under people and stalls) | Sun and a wide shadow map only (`Scene.tsx`) | Not built |
| Sky gradient | Flat sky colour tinted by siege level (`weatherPlan.ts`) | Not built |
| Doors that swing | Nothing swung; S22 fade and name plate exist | **PR 3**: the tower door leaf and a new two-leaf gate on each outdoor building's door post open while the hero stands at that holding's door (`doorSwing.ts`, `DoorLeaf.tsx`) |
| Chimney smoke, forge sparks, dust | Six Kenney sprites in `public/fx` (CC0), no code used them | **PR 2**: smoke on the Archive and Workshop chimneys, sparks over the workshop forge. Dust not built |
| Sound, opt-in only | Kenney `.ogg` files in `public/audio`, no player, no switch | Not built |

## PR 1 notes

- Outline is a back-face copy per mesh, so each town building draws about twice as many meshes. The 300 draw-call target was **not measured** here (headless software graphics runs at about 2 fps). Faiz: press P at the town and compare with before; if it is over budget, drop the line on small pieces first.
- Checks: `tsc`, `eslint` (3 warnings, none new), `vitest` 1807 passing, `vite build`. New test: one shell per mesh at the town thickness, all removed on cleanup.

## PR 2 notes (smoke and sparks)

- `fxPlan.ts` (pure maths, tested) and `Embers.tsx`: one instanced draw call per column, sprites loaded when first shown, nothing mounted under reduced motion. Smoke on the house and lumber mill models (Archive, Workshop), seven puffs each; sparks (ten) above the forge in the workshop land.
- **Chimney spots are estimates.** The building file has no chimney node, so `CHIMNEYS` in `fxPlan.ts` is a guess from the roof geometry. Faiz: look at the Archive and Workshop; if smoke does not leave a chimney, nudge those two lines. Same for `FORGE_FIRE_HEIGHT`.
- Not seen on screen. Checks: `tsc`, `eslint`, `vitest` (src/game3d, 932 passing).

## PR 3 notes (door swings)

- The leaf opens about 83 degrees in 0.4 s, shuts when the hero leaves; a cut under reduced motion. Tower door swings out, the gate swings in. Opens on the same "near" signal as the E prompt, so it never promises anything E does not do.
- Town buildings (GLB models) and the Town Hall / Records Hall doors are not touched: they have no door leaf in the art.
- Tests: swing maths, direction signs, shared open-door value. Not seen in a browser.

## Next PRs (order)

1. Sky gradient and soft blob shadows.
2. Sound, off by default, never on a trade.
