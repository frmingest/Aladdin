# Model credits

All models here are **CC0 1.0 Universal** (public domain). Attribution is not required; it is given anyway.

| File | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `Rogue_Hooded.glb` | KayKit Character Pack: Adventurers 1.0, Rogue_Hooded | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 | 2026-10-31 |
| `Mage.glb` | KayKit Character Pack: Adventurers 1.0, Mage | Kay Lousberg (KayKit) | same | CC0 1.0 | 2026-10-31 |
| `Barbarian.glb`, `Rogue.glb` (S8) | KayKit Character Pack: Adventurers 1.0, Barbarian and Rogue (same compression as above) | Kay Lousberg (KayKit) | same | CC0 1.0 | 2026-10-31 |
| `Knight.glb` | KayKit Character Pack: Adventurers 1.0, Knight | Kay Lousberg (KayKit) | same | CC0 1.0 | 2026-10-31 |

The pack's own licence text is in `LICENSE-KayKit-Adventurers.txt`. **Modified (2026-10-31, S4/S5):** the three `.glb` files are the original models with the unused animation clips removed (kept: `Idle`, `Walking_A`, `Running_A`, `Cheer`, `Interact`, `Spellcasting`), resampled and pruned, to cut each file from about 3.6 MB to about 0.5 MB. Geometry, texture and look are unchanged (float vertices, no quantization or mesh compression: see the S5 note in `docs/game/game3d-kaykit-models-2026-10-31.md`). Done with `scripts/optimize-models.mjs`; the original downloads are in the source repo above.

## Scenery (S6, 2026-10-31)

`scenery.glb` is one file holding 16 small pieces, each a top-level node named after the piece. All CC0 1.0.

| Pieces | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `torch_mounted`, `banner_blue`, `banner_white`, `banner_yellow`, `banner_patternA_blue`, `banner_shield_white` | KayKit Dungeon Remastered | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered | CC0 1.0 | 2026-10-31 |
| `barrel`, `crate_A_big`, `crate_B_small`, `sack`, `tent`, `weaponrack`, `wheelbarrow`, `bucket_water`, `flag_blue`, `flag_yellow` | KayKit Medieval Hexagon Pack | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack | CC0 1.0 | 2026-10-31 |

Licence texts: `LICENSE-KayKit-Dungeon-Remastered.txt`, `LICENSE-KayKit-Medieval-Hexagon.txt`. **Modified:** the pieces were merged into one file with `scripts/pack-props.mjs` (plain float vertices, no compression, no animation); geometry and texture are unchanged. Banners and flags use blue, white or yellow only, never red or green, so no flag can read as a status colour.

## Horizon (S7, 2026-10-31)

`horizon.glb` is one file holding 17 nature pieces (trees, tree clumps, boulders, hills, mountains), each a top-level node named after the piece. All CC0 1.0.

| Pieces | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `tree_single_A`, `tree_single_B`, `trees_A_small`, `trees_A_medium`, `trees_B_large`, `rock_single_C`, `rock_single_E`, `hills_A`, `hills_B`, `hills_C`, `hills_A_trees`, `hills_C_trees`, `mountain_A`, `mountain_B`, `mountain_C`, `mountain_A_grass_trees`, `mountain_B_grass` | KayKit Medieval Hexagon Pack | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack | CC0 1.0 | 2026-10-31 |

Licence text: `LICENSE-KayKit-Medieval-Hexagon.txt`. **Modified:** merged into one file with `scripts/pack-horizon.mjs` (plain float vertices, no compression, no animation); geometry and texture unchanged.

## Keep and corner towers (2026-11-01)

`keep.glb` holds two top-level nodes: `keep` (the castle) and `corner_tower`. Blue set only, so no piece can read as a status colour. CC0 1.0.

| Pieces | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `keep` (`building_castle_blue`), `corner_tower` (`building_tower_B_blue`) | KayKit Medieval Hexagon Pack | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack | CC0 1.0 | 2026-11-01 |

Licence text: `LICENSE-KayKit-Medieval-Hexagon.txt`. **Modified:** the two pieces were merged into one file with `scripts/pack-keep.mjs` (plain float vertices, no compression, no animation); geometry and texture unchanged.


## Marketplace corner (2026-11-01)

`market.glb` holds 11 top-level nodes, each named after its piece. Blue and neutral pieces only (the red and green market variants are not used). CC0 1.0.

| Pieces | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `market_stalls` (`building_market_blue`), `well` (`building_well_blue`), `tent_market` (`tent`), `crate_long_A` | KayKit Medieval Hexagon Pack | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack | CC0 1.0 | 2026-11-01 |
| `stall_table_long` (`table_long_tablecloth_decorated_A`), `stall_table_medium` (`table_medium_tablecloth_decorated_B`), `stall_table_plain` (`table_long_tablecloth`), `crates_stacked`, `keg_decorated`, `barrel_stack` (`barrel_small_stack`), `stool` | KayKit Dungeon Remastered | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered | CC0 1.0 | 2026-11-01 |

Licence texts: `LICENSE-KayKit-Medieval-Hexagon.txt`, `LICENSE-KayKit-Dungeon-Remastered.txt`. **Modified:** merged into one file with `scripts/pack-market.mjs` (plain float vertices, no compression, no animation); geometry and textures unchanged. `stall_table_plain` and `crate_long_A` are packed but not placed yet.

## Drill camp (S10, 2026-11-01)

`camp.glb` is one file holding 9 pieces for the Storm Drill camp, each a top-level node named after the piece. It is only fetched when a drill is opened. All CC0 1.0.

| Pieces | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `catapult`, `catapult_yellow`, `catapult_ball`, `ladder`, `target`, `tent`, `weaponrack`, `flag_blue`, `flag_yellow` | KayKit Medieval Hexagon Pack | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack | CC0 1.0 | 2026-11-01 |

Licence text: `LICENSE-KayKit-Medieval-Hexagon.txt`. **Modified:** merged into one file with `scripts/pack-camp.mjs` (plain float vertices, no compression, no animation). Blue, yellow and neutral pieces only, never red or green.

## Town kit (S9, 2026-11-01)

Four files, each with every piece as a top-level node named after the piece. All CC0 1.0. Not placed in the world yet (S14 Market Street and S15 the Town use them); list and sizes in `frontend/src/game3d/townPieces.ts`.

| Files | Asset | Author | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `town-market.glb` (13), `town-street.glb` (16), `town-nature.glb` (16) | Fantasy Town Kit 2.0 | Kenney (kenney.nl) | https://kenney.nl/ (Fantasy Town Kit 2.0) | CC0 1.0 | 2026-11-01 (kit dated 2025-08-03) |
| `town-buildings.glb` (13: `house`, `market`, `barracks`, `mill`, `watermill`, `lumbermill`, `mine`, `watchtower`, `castle`, `well`, `wall_straight`, `wall_corner`, `wall_gate`) | KayKit Medieval Builder Pack 1.0 | Kay Lousberg (KayKit) | https://kaylousberg.com/game-assets (Medieval Builder Pack) | CC0 1.0 | 2026-11-01 (pack dated 2021-07-30) |

Licence texts: `LICENSE-Kenney-Fantasy-Town-Kit.txt`, `LICENSE-KayKit-Medieval-Builder.txt` (copied by `scripts/import-pack.mjs`, which stops if a pack has no licence text or it is not CC0). `town-palette.png` is our retinted copy of Kenney's palette.

**Modified:** merged and renamed with `scripts/pack-town.mjs` (plain float vertices, no compression, no animation). Kenney's one 512 by 512 palette image is **retinted**: the red cells became slate blue and the teal-green cells a clearer teal, so no piece reads as a status colour (leaf greens and timber are unchanged). Kenney's colour-named pieces were renamed (`stall-red` is `stall_awning_blue`, `stall-green` is `stall_awning_teal`, `banner-red` and `banner-green` are `banner_blue` and `banner_teal`). The Builder buildings' orange roof material was recoloured to teal; `archeryrange` (the only piece with a pure red material) and the terrain tiles are not packed. Geometry is unchanged.
