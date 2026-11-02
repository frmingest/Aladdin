# New art packs for the 3D sprints S26 to S31 (2026-11-02)

**Status:** files written on branch `feature/game3d-packs`, committed locally, not pushed, not wired into the scene. First load of `/game3d` is unchanged: nothing here is preloaded, and each pack is fetched only when its place opens.

All pieces are CC0 and credited in `frontend/public/models/CREDITS.md` (audio and sprites have their own `CREDITS.md`). Every node name per file is in `frontend/src/game3d/holdingPieces.ts`; a test checks each listed name exists in its file.

## Rules every pack follows
- Plain float vertices, no quantize, no meshopt; skinned files only had clips cut and (for the skeletons) a picture recolour.
- No red or green. `scripts/glb-colour-audit.mjs` samples the picture under every triangle and flags any piece over 8 percent red or green. All new files pass. Pieces that failed (lily pads, water plants, two bottles, a long crate) were dropped, not recoloured.
- Blue and neutral buildings only. Copper bars (orange-red) and the coloured textile stack were left out.
- A piece never carries a fact. Gold piles do not grow with gains; sizes in a dressing are scenery.

## Holding lands (one file each, at most 600 KB, 4 pictures at most)

| File | KB | Triangles | Holds |
|---|---|---|---|
| `holding-mine.glb` | 545 | 8.5k | Hexagon mine, timber scaffold walls and doorway, rocky floor, rocks, wheelbarrow, pickaxe, shovel, lantern, hammer, gold nuggets, stone chunks, planks |
| `holding-quarry.glb` | 543 | 8.5k | rocks, stone chunks and brick stacks, chisel, mallet, pickaxe, grindstone, rocky floor, planks, wheelbarrow |
| `holding-ingots.glb` | 591 | 13.1k | gold bar stacks (large, medium, small, single), silver bars, gold chest, coin stacks, barred walls, pallets, shelf, candles |
| `holding-farm.glb` | 321 | 5.2k | grain and dirt fields, wooden fences and gate, sacks, barrel, crates, pond tile, bridge as a dock, rocks, shovel, trowel, rope |
| `holding-stall.glb` | 526 | 10.6k | cloth bolts and stacks, gold and silver bar stacks, crates, sacks, flags (blue, yellow), decorated box, keyring, candle, lantern |
| `holding-bank.glb` | 531 | 9.3k | gold chest, coin stacks, key, keyring, barred walls (three kinds), column, barrier, shelves, candles, bars, open journal, pencil |
| `holding-factory.glb` | 465 | 8.4k | blacksmith, cog, parts piles, iron bars, tarp pallet, anvil, hammer, tongs, wrenches, saw, hand drill, large barrel |
| `holding-windmill.glb` | 390 | 5.9k | Hexagon windmill (blue), fields, fences, sacks, crate, barrel, cog, lantern |
| `holding-watermill.glb` | 272 | 4.3k | Hexagon watermill (blue), water tile, two bridges, rocks, bucket, barrel, fence, planks, cog |
| `holding-fountain.glb` | 206 | 2.7k | well, water tile, rocks, flags, barrels, columns, candle, torch, coin, small gold stack |

Borrowed instead of duplicated (listed in `HOLDING_REUSE`): the Builder `house`, `mine`, `mill`, `watermill`, `castle`, `barracks` (town-buildings.glb), the Kenney `fountain_round` and hedges (town-nature.glb), the market stall and cart (market.glb, town-market.glb), horizon rocks.

**What was dropped and why:** the large wood-log stack (187 KB) and the large silver and iron bar stacks (180 KB each); the Hexagon scaffolding and lumber mill (162 KB each) from factory and quarry; the blueprint stack (adds a fifth picture, 39 KB); all lily pads and water plants (green); the tavern (167 KB) from the market quarter. Only the factory and ingots dressings lost their showiest piece to the size budget. **Gaps:** there is no mine cart, no fish tank and no oil rig in the free packs. Code-build them as planned (D13), the wheelbarrow stands in for the cart. The Hexagon windmill sail is not a separate node, so it cannot spin; if S29 wants a turning sail it needs a code-built one.

## Siege Field
- `siege.glb`, 867 KB (limit 1 MB), 13.8k triangles, one retinted picture. 31 pieces: five engines (catapult, trebuchet, ballista, ram, siege tower), each with a `_wrecked` twin; ten wall, gate and stair pieces; square and hexagon tower pieces; four flags (slate blue and white); two rock heaps. Kenney's red cells became slate blue and the green cells teal, as in the town kit. The orange sand of walls and the one orange hexagon roof (`tower_hexagon_roof`) are Kenney's stone and timber, not a status colour, but judge it by eye.
- `Skeleton_Minion/Warrior/Rogue/Mage.glb`: 480, 533, 546 and 581 KB (from 4.8 MB each). Kept clips: `Idle`, `Walking_A`, `Running_A`, `Cheer`, `Hit_A`, `Death_A`, `1H_Melee_Attack_Slice_Horizontal` (about 28 KB each; 95 clips existed). Joint names are the same 41 as `Knight.glb` (a test compares them; rest poses match too). The Mage robe and Rogue cape were red, so the picture is recoloured (slate blue). No weapons are inside these files; the pack ships them as separate files and we did not pack them.
- **Skeletons are a yes-or-no for Faiz (D14).** The files exist but nothing uses them.

## Work clips: the Character Animations pack does not retarget
`KayKit_AnimatedCharacter_v1.2.glb` in the free download holds **one** old character with a **six-bone** rig (`Body`, `Head`, `armLeft`, `handSlotLeft`, `armRight`, `handSlotRight`) and 30 clips. Our people have 41 bones named `hips`, `spine`, `upperarm.l` and so on, so no track would find a bone. The 133 clips and 28 tool clips the shop page mentions are not in the free zip. Not used, no credit row beyond this note.

What we did instead: the Skeletons use our exact rig, so `clips-work.glb` (211 KB) holds six of their clips with the bone nodes only: `2H_Melee_Attack_Chop` (swing a pick), `1H_Melee_Attack_Chop` (hammer blow), `2H_Melee_Attack_Slice` (scythe or saw sweep), `PickUp`, `Throw`, `Sit_Floor_Idle`. A test checks every track names a Knight.glb joint. **Not yet seen on a character:** the names say what they are, but whether a chop reads as mining needs a look in S26 (play it on Barbarian with the pickaxe in the hand slot). Carrying has no clip.

## Market Quarter
`market-quarter.glb`, 732 KB (limit 800 KB), 29 pieces, 14.3k triangles: blue house front, cloth bolts and a large stack, gold and silver bar stack (small), crates, sacks, wheelbarrow, small tables, food plates, brown bottles, large decorated barrel, keg, boxes, trunk, shelves, wooden floor tile, blue, yellow and white banners, candle, coin stack, pallet, planks. The stalls, awnings, carts and banners already in `market.glb` and `town-market.glb` were enough, so no stall was packed twice.

## Sounds and sprites (opt-in, S31)
- `frontend/public/audio/`: 11 OGG files, 137 KB in all: footsteps (stone, wood, grass), door open and close, coins, lock, page, thud, hammer, mining. **No wind or ambient loop** exists in the Kenney packs; the packs that have one are not redistributable. Faiz can search freesound.org for CC0 wind if he wants one.
- `frontend/public/fx/`: 6 white sprites, 86 KB in all, shrunk to 128 pixels: `smoke_soft`, `smoke_puff`, `spark`, `dust`, `flare`, `dot`. Tint in code; off under reduced motion.

## Performance note (before and after)
Before: courtyard first load unchanged. After: unchanged. The new files are not imported by any component, not preloaded and not in the JS bundle, so the first load, draw calls and frame time are identical (build output checked; no GPU measurement was possible here). Each pack's own cost is in the tables above; the lineup render below was software-rendered, so it shows content, not speed. Per-place budgets (120 calls, 80k triangles) are checked when each place is wired in; the biggest single new file is 14.3k triangles.

## How it was checked
- `npm test`: node lists per theme and borrowed pieces, skeleton joints against Knight, work-clip tracks, byte, mesh, triangle and picture budgets per file (`modelFiles.test.ts`), audio and sprite counts and sizes.
- Lineup renders (headless Chrome, three.js, software GL) of `siege.glb`, `holding-ingots.glb`, `holding-mine.glb` and `Skeleton_Mage.glb`: shapes read well, siege flags and roofs blue, gold bars gold and silver bars blue-grey, the mage skeleton blue. The other packs were checked by the colour audit and header tests only. The render page is not in the repo.
- To rebuild: `scripts/pack-holdings.mjs`, `scripts/pack-siege.mjs`, `scripts/optimize-models.mjs --keep=...`, `scripts/retint-skeletons.mjs`, `scripts/export-work-clips.mjs`, `scripts/pack-fx.mjs` (they need `@gltf-transform/*` and `pngjs`, like the older pack scripts).
