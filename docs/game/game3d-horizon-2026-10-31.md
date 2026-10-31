# 3D courtyard S7: the horizon (2026-10-31)

Status: **written and tested, seen in a headless (software-rendered) browser, not merged, not deployed, not seen on a real GPU.** Plan: [game3d-kaykit-sprint-plan-2026-10-31.md](game3d-kaykit-sprint-plan-2026-10-31.md) (S7). Branch `feature/game3d-horizon`.

## What this sprint is for (plain words)
Until now the courtyard stood on a flat green plate with a painted picture of mountains far behind it. S7 puts real, low-poly trees, boulders, foothills and mountains round the meadow, so that when you look over the wall (or out of the gate) you see a landscape, not a painting. It is scenery only: nothing in it shows or depends on any of your data.

## What changed
- `frontend/public/models/horizon.glb` (347 KB): 17 CC0 nature pieces from KayKit Medieval Hexagon, packed by `scripts/pack-horizon.mjs` (plain float vertices, no compression, no animation). Credits row added in `public/models/CREDITS.md`; the Hexagon licence text was already there.
- `frontend/src/game3d/horizonPieces.ts`: the placement, pure data from a fixed seed, so it is identical on every load. **78 pieces:** 35 trees and tree clumps and 13 boulders in a grove outside the wall (radius 46 to 68), 16 foothills (radius 90 to 98), 14 mountains at the rim (radius 101 to 108). The gate road and its sides are kept clear.
- `frontend/src/game3d/Horizon.tsx`: loads the file and draws each model **once for all its places** (instancing: 17 draw calls for 78 pieces). No shadows (they are far away). Trunks and boulders get box colliders (48), and there is an **invisible wall at radius 74** so the hero stays on the meadow and cannot walk into a hill. If the file fails to load, nothing is drawn and none of those colliders exist: the courtyard looks like before, with the painted backdrop behind it.
- `Scene.tsx`: mounts `<Horizon />` next to the painted backdrop. **The painted backdrop stays** (fallback, and it still fills the gaps between mountains).
- **Pre-existing bug fixed on the way (`Courtyard.tsx`):** the ground collider was a 1-unit slab. In a slow, software-rendered browser, about 2 runs in 5 on plain `main` let the hero fall through it at spawn (one long first frame, then the courtyard is out of sight and you see only sky). The ground is now 20 units deep, 6 of 6 runs fine afterwards. On a fast machine this is unlikely to show, but a long frame while a model loads could cause it.

## Verified
- `horizonPieces.test.ts` (8 tests): every piece names a node in the file; file under 1 MB, no quantize or meshopt; at most 120 pieces and 17 models; same output on every build; grove stays outside the wall and cobbles and inside the invisible edge; gate road clear; no two solid pieces overlap; hills and mountains have no collider and sit beyond the edge; only nature names.
- `tsc --noEmit`, `npm run lint` (0 errors, the 2 warnings are old), `npm test` (960 passed), `npm run build`: green, in a clean clone.
- Headless screenshots from the spawn looking north, east, west and out of the gate: grove and mountains show over the wall, haze softens the far ring.

## Numbers (headless, software rendering, so only counts, not speed)
| | before (S6) | with horizon |
|---|---|---|
| Draw calls, peak of the views I looked at | 148 | **215** (budget 300) |
| Triangles | about 32k | about 62k |
| Model files in `/models` | 1.7 MB | 2.1 MB |
| Scene chunk (production build) | | 3.0 MB |

First load of `/game3d` is the 3.0 MB scene chunk, 2.1 MB of models and the painted backdrop: well under the 15 MB budget. **Frame rate is not measured** (software rendering says nothing); please check 60 fps on your machine with the P stats.

## What I found about the view (useful for deciding S7 part 2)
- The wall is 6 high and the camera sits only a little above the hero, so **from inside the courtyard trees mostly hide behind the wall.** What you really see over it are the foothills and mountains; the grove shows through the gate and when the camera is raised. That is why the grove stands close (46 to 68) and the mountains are big.
- The foothills read as flat-topped grassy blocks up close. They are scaled down and pushed far out so the haze hides that. If you dislike them, the fix is deleting one line (the `hill` band) in `horizonPieces.ts`.
- Trees are dark green conifers. Green here is landscape, not a status; the rule "no red or green flags" is about banners and towers.

## Not done (decision for Faiz)
**Corner towers and keep as Hexagon models: not done.** The plan said only after Faiz sees a test shot and agrees. The colliders are plain boxes and cylinders today, and a model needs matching colliders, which is real work for a mostly cosmetic gain. Say if you want a test render of `building_tower_A` and `building_castle` beside the current ones first. The eight holding towers stay code-built (they show real data).

## Game checklist
Visual verb and scene: "look beyond the wall: a world, not a plate". Identity score before: 2; after: 2 to 3 by my judgement (a real horizon, no fact encoded; Faiz to confirm). Tap count unchanged (no new control). Plain view: n/a (decoration). Reduced motion: nothing animates.

## After deploy (Faiz)
Open `/game3d`, stand at spawn and turn slowly: do the mountains and grove feel right, are the foothills ugly, and does it still run at 60 fps with the P stats on? Walk out of the gate: you should be able to go down the road and across the meadow but stop at an invisible edge before the hills.
