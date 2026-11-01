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

