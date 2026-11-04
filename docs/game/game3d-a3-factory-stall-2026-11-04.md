# 3D asset plan A3: the workshop and the market stall (2026-11-04)

**Status: written and tested on `feature/game3d-a3-factory-stall`, off `main` at `2907d25` (A2 merged as #293). `tsc`, lint (0 errors), the full test run (1671) and the build pass. Seen in a headless lineup only, not in the app, no fps, not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md).

## What you will see

Two more holdings stop standing as plain towers, on the meadow and in their own land.

- **Industrials (theme `factory`) are a workshop.** A blacksmith's forge in the middle with an anvil, a cog lying flat, a scrap pile, an iron-bar stack, a tarped pallet, a barrel and a hammer on the ground, inside a ring of six stockpile pieces (barrels and iron-bar stacks alternate).
- **Retail (theme `stall`) is a market stall.** A timber counter under a cloth awning with a blue and a yellow pennant on the poles. On the counter: two cloth bolts, a scale lantern and a small coin stack. Around it: cloth, a sack, a barrel, a pallet with a small crate, and a big crate. A ring of six stock pieces (cloth stacks and crates alternate) stands outside.

Both rings wear the wall ladder exactly like the fountain, the bullion barriers and the bank walls: upright and footed on Sound, leaning and gapped on Worn, props and boards on Patched, fallen pieces and a crack on Failing. Unsurveyed shows the pale ghost.

## Decision to check (Claude's call)

Neither theme draws its own neutral. Industrials and retail have a balance sheet, so "not applicable" is rare and keeps the plain block, like the mills and the mine. Say so if you want it drawn like the bank.

## What changed

- `factoryDressing.ts`, `stallDressing.ts` (new, pure): ring, `*Plan` (= `fountainPlan` read as stock pieces), fixed piece lists, counter and awning sizes.
- `FactoryDressing.tsx`, `StallDressing.tsx` (new): draw them from `holding-factory.glb` and `holding-stall.glb`, static batch, plain block as the fallback.
- `RingWear.tsx` (new): the footing, bracing posts, loose boards, patches and cracks, shared by both new dressings (the older dressings keep their own copy; no behaviour change there).
- `LandCentre.tsx` two lines; `landCentre.ts`: `DRESSING_BUILT.factory` and `.stall` true.
- `factoryDressing.test.ts`, `stallDressing.test.ts` (new, 9 each): ladder order, sound versus failing, neutral and ghost are not Sound, wall tier alone decides, fixed lists, everything inside the ring and clear of the forge or counter and of each other, slot behaviour, every node exists, file under 600 KB.
- No new asset, no backend, no migration. Not changed: `holding-factory.glb`, `holding-stall.glb`.

## The goods never grow

Fixed lists, pinned by a test. No count or size of tool, pile, cloth, crate or coin depends on the wall, the weight, the size class, a gain, a margin of safety or a verdict. The stall has no gold or silver (those say "bullion" and "bank"; a test pins it).

## Seen

A headless lineup (three.js, software GL) of the real files at Sound, Patched and Failing. The first pass had the forge too small beside oversized ring pieces and the crates reading as grey stone blocks; the scales were cut and the awning made shallower. The awning's teal stripe sits inside the cream cloth and does not show; harmless, left for a look in the app.

## Not checked

The buildings in the real scene (facing, size next to the door post, shadows), draw calls and fps (press P), the colour audit on the two files (packed and audited when the packs were prepared), and which of your holdings land as factory or stall (the theme readout lists them; defence stays a plain tower, P6).
