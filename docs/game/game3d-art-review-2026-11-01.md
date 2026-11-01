# 3D art review: the three downloaded packs (2026-11-01)

Status: **review only. Nothing imported, nothing built, nothing committed, nothing rendered in the game.** Source folder: `E:\Aladdin\frontend\3D art review` (untracked in git, 175 MB). Plan that uses this review: [KayKit and free-pack sprint plan](game3d-kaykit-sprint-plan-2026-10-31.md) (S9 rewritten, S13 to S20 new). **Update (S9, same day):** the Kenney kit and the KayKit Builder Pack were then imported; see [the S9 write-up](game3d-town-kit-import-2026-11-01.md). The review below is kept as it was written.

## What was checked, and what was not

- **Checked from the files:** every file listed; all three licence texts read; piece names, sizes, triangle counts, materials and bounding boxes read from the GLB and glTF headers; three preview pictures (Kenney overview, Kenney "Variation A", Quaternius preview) looked at.
- **Not done:** no piece was loaded into the courtyard, so how a piece looks next to the KayKit models under our flat light and ink outline is **judged from pictures, not seen**. The 168 per-piece thumbnails are 1 to 2 KB icons and were not opened one by one.

## Pack 1: KayKit Medieval Builder Pack 1.0 (re-checked 11:40, files now present)

The first look found an empty folder; the files arrived afterwards and this section replaces that note.

- **Licence:** `License.txt`, Kay Lousberg, created 2021-07-30, **CC0 1.0**, personal, educational and commercial use, credit optional. Licence text in hand.
- **Contents:** 226 pieces, in glTF (binary `.gltf.glb`), FBX, OBJ and DAE; GLB total 4.0 MB. No textures: every piece uses plain named colours (`Brown`, `BrownDark`, `Stone`, `StoneDark`, `Beige`, `White`, `Metal`, `Water`, `Yellow`), so recolouring means changing material colours in the packer, no texture work.
- **Whole small buildings, ready to place:** `house`, `market`, `barracks`, `mill`, `watermill`, `lumbermill`, `mine`, `archeryrange`, `watchtower`, `castle`, `well`, `farm_plot`, two `bridge` types. Walls: `wall_straight`, `wall_corner`, `wall_gate`, `wall_gate_closed`, hex corners. Nature: `detail_tree*`, `forest*`, `detail_rocks*`, `detail_hill`, `mountain`.
- **Terrain tiles (about 190):** hex and square tiles in forest, rock, sand and water variants with road pieces (`*_roadA` to `M`), water edges and transitions. Meant for a tile-map builder; not useful for our walkable courtyard, so ignored.
- **Weight:** buildings are 1,250 to 2,270 triangles each (`house` 1,666, `market` 1,924, `watchtower` 1,871, `castle` 2,231), 60 to 140 KB each. Heavier than Kenney's pieces, still small. Eight buildings is about 15,000 triangles.
- **Scale:** a tile is 2 units; a house is 1.7 wide, 0.9 high. Needs about 5 to 6 times scale (the Hexagon castle already uses 5.6).
- **Style (from the overview picture):** the older sibling of the Hexagon pack: flat colours, chunky, terracotta roofs, grey stone. Same author and family as what is already in the courtyard, so it should sit well; the orange roofs differ from the blue Hexagon set, so a roof recolour to blue or teal is advisable.
- **Colour rule:** the `archeryrange` has a `Red` material (the target) and grass tiles are green; ground and a target are not status colours, but the rule "no red or green piece" is applied by recolouring or skipping that piece.
- **Overlap:** partly overlaps Hexagon (castle, market, tower, well, mill, walls exist there too in the blue set). **New here:** `house`, `barracks`, `lumbermill`, `mine`, `farm_plot`, `archeryrange`, `bridge`, `watermill`.

**Verdict: adopt, and it changes the plan for the Town.** Instead of assembling buildings from Kenney wall and roof pieces, the Town can use these finished buildings (house, market, barracks, mill, watchtower, lumbermill, mine) for the districts, which is faster and looks more finished. Kenney stays for stalls, the cart, street and fences.

## Pack 2: "Kenney Fantasy tower kit" is really the Fantasy Town Kit 2.0

- **Licence:** `License.txt` says "Fantasy Town Kit (2.0)", Kenney, created 2025-08-03, **CC0 1.0**, personal, educational and commercial use, credit optional. Licence file is in hand, so the rule "CC0 with the licence text in hand" is met.
- **The folder name is wrong:** there is no tower kit. No file has "tower" in its name. Towers would be assembled from wall and roof pieces.
- **Contents:** 167 pieces in GLB, FBX and OBJ (GLB total only 2.8 MB), one shared palette texture (`colormap.png`), no animation, no skeleton. 4 to 1,628 triangles per piece, median 96, 155 of 167 under 400, 26,186 triangles for the whole kit.
- **Style:** flat palette colours, rounded low-poly, no outline. Closest match to KayKit of anything reviewed. Roofs in teal-green and red, orange timber, lavender stone.
- **Scale:** one unit is one tile. A stall is 1 by 1.24 by 1, a tree 2.4 tall, a fountain 2 wide. Our people are 2.0 tall, so pieces need roughly 2.5 to 3 times scale.

| Group | Pieces | Use for us |
|---|---|---|
| Market | `stall-red`, `stall-green` (awning stalls, 270 and 322 triangles), `stall` (from its size 0.65 by 0.37 by 1 a low counter, not an awning stall), `stall-bench`, `stall-stool`, `cart`, `cart-high` (goods cart), `lantern`, `banner-red`, `banner-green` | Market Street (S13) |
| Walls | about 60 stone and timber wall pieces: plain, door, doorway, window (round, small, stone, shutters, glass), arch, corner, diagonal, curved, broken, slope | Small district buildings (S15) |
| Roofs | about 35: flat, gable, point, corner, window, high versions | Same |
| Stairs, balcony, pillars, planks, poles, chimney | about 30 | Same |
| Street | `road`, bends, corners, curbs, slopes; `fence` (4); `hedge` (8, with gate) | Market Street, Town street |
| Water | `fountain-round`, `fountain-square` (and parts; 1,002 triangles for the round one, water is a second material), `watermill`, `wheel` | Fountain option, Royal Mint |
| Nature | `tree`, `tree-high` (round and crooked), `rock-*` | Horizon top-up (cheap) |
| Big | `windmill` (732 triangles), `blade` | Royal Mint or town landmark |

**What it does not have:** people, barrels, crates, sacks, towers, siege pieces, furniture, books, shelves. (KayKit has all of those except towers, which Hexagon has.)

**Two things to handle:**
1. **Red and green.** The only awning stalls and the banners come in red and green, and the rule is "no red or green piece that could read as a status colour". Because every piece shares **one 512 by 512 palette texture (11 KB)**, the whole kit can be recoloured at once with our own palette (teal, cream, slate, timber). Kenney's own "Variation A" (blue and purple roofs) is exactly this trick, so the UVs are built for it. This is the main reason the kit is cheap to adopt.
2. **Folder naming.** Credit it as "Fantasy Town Kit", not "tower kit".

**Verdict: adopt.** Best fit for what we are missing: stalls, a goods cart, street pieces and modular small buildings. Total weight is a non-issue.

## Pack 3: Quaternius "Medieval Village MegaKit [Standard]"

- **Licence:** `License_Standard.txt` says **CC0 1.0 Universal**, models by Quaternius, and that this free version holds only a portion of the models (Pro and Source are paid). This **settles the earlier "licence conflict" for this pack only**; the other Quaternius packs are still unread.
- **Contents:** 176 modular pieces in glTF, FBX and OBJ: walls (plaster, uneven brick), doors, window frames and shutters, roofs (round tiles, many sizes), floors, stairs, balconies, overhangs, chimneys, fences, vines, a wagon, a crate. **No people, no stalls, no barrels, no furniture.**
- **Size:** geometry 6.3 MB for all pieces (118k triangles in total, single pieces up to 6,356 triangles), but **75 MB of PBR textures** (colour, normal, roughness maps at high resolution, one texture of 13 MB).
- **Style (from the preview picture):** realistic-stylised, painted and weathered, normal-mapped. Not flat.

**Why it does not fit the courtyard:**
1. Style clash: a flat-lit, ink-outlined KayKit and Kenney world next to normal-mapped, weathered houses would look like two games.
2. The courtyard's rule is flat neutral lighting and a fixed code-driven look so a weak holding never looks strong; normal and roughness maps react to light and break it.
3. Weight: textures would need to be cut from 75 MB to well under 6 MB, and the geometry is 5 to 20 times heavier per piece than Kenney's.
4. **`Prop_Vine*` pieces would collide with a real fact:** ivy on the holding towers means "analysis is stale". Vines on a decorative house would read as the same signal. Not to be used.
5. For interiors, KayKit Dungeon Remastered already has flat-style floors, walls, doorways, stairs and shelves (names checked in the repo).

**Verdict: park.** Keep the zip on disk (outside git). Only reopen if Faiz wants a realistic direction; the test would be one house and one screenshot, kill if it does not sit with the rest.

## Where this leaves the free-asset picture

| Need | Best source now | Gap |
|---|---|---|
| Market stalls, goods cart, street | Kenney (retinted) + KayKit crates, barrels, sacks, tent | none |
| Small buildings (records hall, map office, archive, gatehouse, town hall) | **KayKit Builder Pack** finished buildings (house, market, barracks, mill, watchtower, lumbermill, mine), Hexagon buildings; Kenney modular walls and roofs only for odd shapes | none |
| Interiors (floors, walls, stairs, shelves, tables, chests, coins) | KayKit Dungeon Remastered, Furniture Bits | none |
| Siege camp | KayKit Hexagon (built) | siege tower and ram (code-built or skip) |
| Fountain | Kenney `fountain-round` or keep the code-built one | decide by screenshot |
| Mill | Kenney `watermill`, `windmill` | none |
| **People** | the five KayKit Adventurers (all in use) | **no new character models in hand**; merchants, scribes and ravenkeepers would need new bodies or reuse with hat and prop swaps |

## Things to do outside the sprints

- Add `frontend/3D art review/` to `.gitignore`. It is untracked now and 175 MB; one `git add .` would put it in a commit (the same trap as the 103 MB of Stitch masters in October). **Done in S9.**
- Copy `License.txt` of the Kenney kit and of the KayKit Builder Pack next to `CREDITS.md` once S9 starts (the Builder Pack licence is the same CC0 text as the other KayKit packs; still one credits row per pack). **Done in S9.** `License_Standard.txt` (Quaternius) only if MegaKit is unparked.
