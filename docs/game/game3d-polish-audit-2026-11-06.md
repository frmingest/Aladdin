# 3D polish pass: what exists, what is built (2026-11-06)

Source: the "Making today's 3D look and run better" list and S31 in [the discovery plan](game3d-discovery-sprint-plan-2026-11-02.md). Checked by grep on `main` at `a345e9b` (#301), not in a browser.

**Visual verb + scene:** the courtyard and town get a painter's finishing coat. Every building gets the same ink line the people have; chimneys breathe, forges spit, doors swing. None of it carries a fact.

| Item | On `main` before | PR |
|---|---|---|
| Ink outline on town buildings | Characters, the Siege Field and code-built `Part` shapes have it; the town GLB buildings (`Town.tsx`) did not | **PR 1 (this one)**: `addOutlines` on each building, line `TOWN_OUTLINE_WORLD` = 0.07 |
| Soft shadows (round blobs under people and stalls) | Sun and a wide shadow map only (`Scene.tsx`) | **PR 4**: round blob under every person and the holding stall (`BlobShadow.tsx`) |
| Sky gradient | Flat sky colour tinted by siege level (`weatherPlan.ts`) | **PR 4**: gradient dome (`SkyDome.tsx`), horizon = fog colour, deeper overhead |
| Doors that swing | Nothing swings; S22 fade and name plate exist | Not built |
| Chimney smoke, forge sparks, dust | Six Kenney sprites in `public/fx` (CC0), no code used them | **PR 2**: smoke on the Archive and Workshop chimneys, sparks over the workshop forge. Dust not built |
| Sound, opt-in only | Kenney `.ogg` files in `public/audio`, no player, no switch | Not built |

## PR 1 notes

- Outline is a back-face copy per mesh, so each town building draws about twice as many meshes. The 300 draw-call target was **not measured** here (headless software graphics runs at about 2 fps). Faiz: press P at the town and compare with before; if it is over budget, drop the line on small pieces first.
- Checks: `tsc`, `eslint` (3 warnings, none new), `vitest` 1807 passing, `vite build`. New test: one shell per mesh at the town thickness, all removed on cleanup.

## PR 2 notes (smoke and sparks)

- `fxPlan.ts` (pure maths, tested) and `Embers.tsx`: one instanced draw call per column, sprites loaded when first shown, nothing mounted under reduced motion. Smoke on the house and lumber mill models (Archive, Workshop), seven puffs each; sparks (ten) above the forge in the workshop land.
- **Chimney spots are estimates.** The building file has no chimney node, so `CHIMNEYS` in `fxPlan.ts` is a guess from the roof geometry. Faiz: look at the Archive and Workshop; if smoke does not leave a chimney, nudge those two lines. Same for `FORGE_FIRE_HEIGHT`.
- Not seen on screen. Checks: `tsc`, `eslint`, `vitest` (src/game3d, 932 passing).

## PR 4 notes (sky and soft shadows)

- `SkyDome.tsx`: one sphere with vertex colours, follows the camera, outdoors only. Horizon colour is the weather's own `sky` (calm is still `#cfe3f1` there), so fog melts into it; `skyTop` is deeper overhead. **Mist stays a flat fog** (`skyTop` = `sky`), unknown never gets a pretty sky. `skyBlend` is pure and tested.
- `BlobShadow.tsx`: one shared soft texture, a flat plane at ground level. Under NPCs, townsfolk, workers (the seated scribe a bit wider) and the holding stall. Same size for every one of a kind; carries no fact. The sun's shadow map is untouched.
- **Not seen on screen.** Faiz: look at calm, gathering and besieged skies, and that the blobs sit under feet on sloped or raised ground (they are flat at y 0.03; if one floats or sinks in a land, tell me which).
- Checks: `tsc`, `eslint` (3 warnings, none new), `vitest` 1814 passing, `vite build`.

## Next PRs (order)

1. Sound, off by default, never on a trade.
