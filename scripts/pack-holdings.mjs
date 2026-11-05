// Packs the ten holding-land dressings (S26-S29) into one small plain .glb per theme: holding-<theme>.glb, and the
// extra goods for the Market Quarter (S30) into market-quarter.glb.
// Usage (from a folder with @gltf-transform/{core,extensions,functions} installed, like pack-market.mjs; the
// scripts/node_modules link used on 2026-11-02 points at one):
//   node pack-holdings.mjs <Hexagon gltf root> <Dungeon gltf dir> <RPG Tools Bits gltf dir> <Resource Bits gltf dir> <out dir> [theme ...]
// Each piece becomes a top-level node named after its id. Pieces come from four CC0 KayKit packs, each with its own
// 1024 gradient atlas (so a file has at most three images: Hexagon/Dungeon/Tools/Resource, never all four).
// Blue and neutral buildings only; the red, green and yellow variants are never packed. Resource Bits: gold, silver and iron
// only (copper reads red-orange, the coloured textile stack is dropped). Check every output with glb-colour-audit.mjs.
// Plain float vertices: no quantize, no meshopt, no animation.
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [hexRoot, dungeonDir, rpgDir, resDir, outDir, ...only] = process.argv.slice(2);
if (!hexRoot || !dungeonDir || !rpgDir || !resDir || !outDir) throw new Error("usage: node pack-holdings.mjs <hex root> <dungeon dir> <rpg dir> <resource dir> <out dir> [theme ...]");
mkdirSync(outDir, { recursive: true });
// A7 (2026-11-05) adds two optional packs for the armoury and the apothecary: FW_DIR (Fantasy Weapons Bits gltf dir) and
// REST_DIR (Restaurant Bits gltf dir), passed as environment variables so the old four-argument call still works.
const ROOT = { hex: hexRoot, dun: dungeonDir, rpg: rpgDir, res: resDir, fw: process.env.FW_DIR, rest: process.env.REST_DIR };

// [node id, source pack, source file name without extension]
export const THEMES = {
  mine: [
    ["mine_building", "hex", "building_mine_blue"],
    ["scaffold_wall", "dun", "wall_scaffold"],
    ["scaffold_open", "dun", "wall_open_scaffold"],
    ["scaffold_doorway", "dun", "wall_doorway_scaffold"],
    ["floor_rocky", "dun", "floor_dirt_large_rocky"],
    ["rock_A", "hex", "rock_single_A"],
    ["rock_B", "hex", "rock_single_B"],
    ["rock_D", "hex", "rock_single_D"],
    ["wheelbarrow", "hex", "wheelbarrow"],
    ["pickaxe", "rpg", "pickaxe"],
    ["shovel", "rpg", "shovel"],
    ["lantern", "rpg", "lantern"],
    ["hammer", "rpg", "hammer"],
    ["ore_gold_nuggets", "res", "Gold_Nuggets"],
    ["ore_gold_large", "res", "Gold_Nugget_Large"],
    ["stone_chunks_large", "res", "Stone_Chunks_Large"],
    ["planks_small", "res", "Wood_Planks_Stack_Small"],
  ],
  quarry: [
    ["rock_A", "hex", "rock_single_A"],
    ["rock_B", "hex", "rock_single_B"],
    ["rock_D", "hex", "rock_single_D"],
    ["wheelbarrow", "hex", "wheelbarrow"],
    ["floor_rocks", "dun", "floor_tile_large_rocks"],
    ["stone_chunks_large", "res", "Stone_Chunks_Large"],
    ["stone_chunks_small", "res", "Stone_Chunks_Small"],
    ["bricks_stack_large", "res", "Stone_Bricks_Stack_Large"],
    ["bricks_stack_medium", "res", "Stone_Bricks_Stack_Medium"],
    ["bricks_stack_small", "res", "Stone_Bricks_Stack_Small"],
    ["brick", "res", "Stone_Brick"],
    ["planks_medium", "res", "Wood_Planks_Stack_Medium"],
    ["pickaxe", "rpg", "pickaxe"],
    ["chisel", "rpg", "chisel"],
    ["mallet", "rpg", "mallet"],
    ["grindstone", "rpg", "grindstone"],
  ],
  ingots: [
    ["gold_bars_stack_large", "res", "Gold_Bars_Stack_Large"],
    ["gold_bars_stack_medium", "res", "Gold_Bars_Stack_Medium"],
    ["gold_bars_stack_small", "res", "Gold_Bars_Stack_Small"],
    ["gold_bar", "res", "Gold_Bar"],
    ["silver_bars_stack_small", "res", "Silver_Bars_Stack_Small"],
    ["silver_bar", "res", "Silver_Bar"],
    ["pallet", "res", "Pallet_Wood"],
    ["pallet_tarp", "res", "Pallet_Wood_Covered_A"],
    ["chest_gold", "dun", "chest_gold"],
    ["coin_stack_medium", "dun", "coin_stack_medium"],
    ["coin_stack_small", "dun", "coin_stack_small"],
    ["coin", "dun", "coin"],
    ["gate_wall", "dun", "wall_gated"],
    ["gate_wall_window", "dun", "wall_archedwindow_gated"],
    ["barrier_column", "dun", "barrier_column"],
    ["shelf_large", "dun", "shelf_large"],
    ["candle_triple", "dun", "candle_triple"],
  ],
  farm: [
    ["grain_field", "hex", "building_grain"],
    ["dirt_field", "hex", "building_dirt"],
    ["fence_wood", "hex", "fence_wood_straight"],
    ["fence_wood_gate", "hex", "fence_wood_straight_gate"],
    ["wheelbarrow", "hex", "wheelbarrow"],
    ["sack", "hex", "sack"],
    ["barrel", "hex", "barrel"],
    ["bucket_water", "hex", "bucket_water"],
    ["crate_open", "hex", "crate_open"],
    ["lumber", "hex", "resource_lumber"],
    ["pond_tile", "hex", "hex_water"],
    ["dock_bridge", "hex", "building_bridge_A"],
    ["rock_B", "hex", "rock_single_B"],
    ["pallet", "res", "Pallet_Wood"],
    ["planks_small", "res", "Wood_Planks_Stack_Small"],
    ["shovel", "rpg", "shovel"],
    ["trowel", "rpg", "trowel"],
    ["rope", "rpg", "rope_bundle_B"],
  ],
  stall: [
    ["textiles_A", "res", "Textiles_A"],
    ["textiles_B", "res", "Textiles_B"],
    ["textiles_C", "res", "Textiles_C"],
    ["textiles_stack_large", "res", "Textiles_Stack_Large"],
    ["textiles_stack_small", "res", "Textiles_Stack_Small"],
    ["gold_bars_stack_small", "res", "Gold_Bars_Stack_Small"],
    ["silver_bars_stack_small", "res", "Silver_Bars_Stack_Small"],
    ["pallet", "res", "Pallet_Wood"],
    ["crate_A_small", "hex", "crate_A_small"],
    ["crate_B_big", "hex", "crate_B_big"],
    ["sack", "hex", "sack"],
    ["barrel", "hex", "barrel"],
    ["flag_blue", "hex", "flag_blue"],
    ["flag_yellow", "hex", "flag_yellow"],
    ["box_small_decorated", "dun", "box_small_decorated"],
    ["coin_stack_small", "dun", "coin_stack_small"],
    ["keyring_hanging", "dun", "keyring_hanging"],
    ["candle_lit", "dun", "candle_lit"],
    ["scales_lantern", "rpg", "lantern"],
  ],
  bank: [
    ["chest_gold", "dun", "chest_gold"],
    ["coin_stack_large", "dun", "coin_stack_large"],
    ["coin_stack_medium", "dun", "coin_stack_medium"],
    ["coin_stack_small", "dun", "coin_stack_small"],
    ["key", "dun", "key"],
    ["keyring_hanging", "dun", "keyring_hanging"],
    ["gate_wall", "dun", "wall_gated"],
    ["gate_wall_window", "dun", "wall_archedwindow_gated"],
    ["column", "dun", "column"],
    ["barrier_half", "dun", "barrier_half"],
    ["shelf_large", "dun", "shelf_large"],
    ["candle_triple", "dun", "candle_triple"],
    ["gold_bars_stack_small", "res", "Gold_Bars_Stack_Small"],
    ["silver_bars", "res", "Silver_Bars"],
    ["journal_open", "rpg", "journal_open"],
    ["pencil", "rpg", "pencil_A_long"],
  ],
  factory: [
    ["blacksmith", "hex", "building_blacksmith_blue"],
    ["cog", "res", "Parts_Cog"],
    ["parts_pile_small", "res", "Parts_Pile_Small"],
    ["iron_bars_stack_small", "res", "Iron_Bars_Stack_Small"],
    ["pallet_tarp", "res", "Pallet_Wood_Covered_B"],
    ["anvil", "rpg", "anvil"],
    ["hammer", "rpg", "hammer"],
    ["tongs", "rpg", "tongs"],
    ["wrench_A", "rpg", "wrench_A"],
    ["wrench_B", "rpg", "wrench_B"],
    ["saw", "rpg", "saw"],
    ["handdrill", "rpg", "handdrill"],
    ["barrel_large", "dun", "barrel_large"],
  ],
  windmill: [
    ["windmill", "hex", "building_windmill_blue"],
    ["grain_field", "hex", "building_grain"],
    ["dirt_field", "hex", "building_dirt"],
    ["fence_wood", "hex", "fence_wood_straight"],
    ["fence_wood_gate", "hex", "fence_wood_straight_gate"],
    ["sack", "hex", "sack"],
    ["wheelbarrow", "hex", "wheelbarrow"],
    ["crate_A_big", "hex", "crate_A_big"],
    ["barrel", "hex", "barrel"],
    ["rock_B", "hex", "rock_single_B"],
    ["pallet", "res", "Pallet_Wood"],
    ["planks_small", "res", "Wood_Planks_Stack_Small"],
    ["cog", "res", "Parts_Cog"],
    ["lantern", "rpg", "lantern"],
  ],
  watermill: [
    ["watermill", "hex", "building_watermill_blue"],
    ["water_tile", "hex", "hex_water"],
    ["bridge_A", "hex", "building_bridge_A"],
    ["bridge_B", "hex", "building_bridge_B"],
    ["rock_A", "hex", "rock_single_A"],
    ["rock_D", "hex", "rock_single_D"],
    ["sack", "hex", "sack"],
    ["barrel", "hex", "barrel"],
    ["bucket_water", "hex", "bucket_water"],
    ["fence_wood", "hex", "fence_wood_straight"],
    ["planks_small", "res", "Wood_Planks_Stack_Small"],
    ["cog", "res", "Parts_Cog"],
  ],
  "market-quarter": [
    // Extra goods and fronts for the Market Quarter (S30). Stalls, awnings, carts and banners already exist in market.glb and town-market.glb.
    ["home_A", "hex", "building_home_A_blue"],
    ["crate_open", "hex", "crate_open"],
    ["sack", "hex", "sack"],
    ["wheelbarrow", "hex", "wheelbarrow"],
    ["bucket_empty", "hex", "bucket_empty"],
    ["textiles_A", "res", "Textiles_A"],
    ["textiles_B", "res", "Textiles_B"],
    ["textiles_C", "res", "Textiles_C"],
    ["textiles_stack_large", "res", "Textiles_Stack_Large"],
    ["gold_bars_stack_small", "res", "Gold_Bars_Stack_Small"],
    ["silver_bars_stack_small", "res", "Silver_Bars_Stack_Small"],
    ["planks_small", "res", "Wood_Planks_Stack_Small"],
    ["pallet", "res", "Pallet_Wood"],
    ["table_small", "dun", "table_small_decorated_A"],
    ["plate_food_A", "dun", "plate_food_A"],
    ["plate_food_B", "dun", "plate_food_B"],
    ["plate_stack", "dun", "plate_stack"],
    ["bottle_A", "dun", "bottle_A_brown"],
    ["barrel_large", "dun", "barrel_large_decorated"],
    ["keg", "dun", "keg"],
    ["box_small", "dun", "box_small_decorated"],
    ["trunk_small", "dun", "trunk_small_A"],
    ["shelves", "dun", "shelves"],
    ["floor_wood", "dun", "floor_wood_large"],
    ["banner_thin_blue", "dun", "banner_thin_blue"],
    ["banner_triple_yellow", "dun", "banner_triple_yellow"],
    ["banner_triple_white", "dun", "banner_triple_white"],
    ["candle_lit", "dun", "candle_lit"],
    ["coin_stack_small", "dun", "coin_stack_small"],
  ],
  fountain: [
    ["well", "hex", "building_well_blue"],
    ["water_tile", "hex", "hex_water"],
    ["rock_A", "hex", "rock_single_A"],
    ["rock_E", "hex", "rock_single_E"],
    ["bucket_water", "hex", "bucket_water"],
    ["flag_blue", "hex", "flag_blue"],
    ["flag_yellow", "hex", "flag_yellow"],
    ["barrel", "hex", "barrel"],
    ["crate_A_small", "hex", "crate_A_small"],
    ["barrier_corner", "dun", "barrier_corner"],
    ["column", "dun", "column"],
    ["candle_lit", "dun", "candle_lit"],
    ["torch_lit", "dun", "torch_lit"],
    ["coin", "dun", "coin"],
    ["gold_bars_stack_small", "res", "Gold_Bars_Stack_Small"],
  ],
  armoury: [
    ["fence_wood", "hex", "fence_wood_straight"],
    ["fence_wood_gate", "hex", "fence_wood_straight_gate"],
    ["sword_A", "fw", "sword_A"],
    ["sword_B", "fw", "sword_B"],
    ["spear_A", "fw", "spear_A"],
    ["halberd", "fw", "halberd"],
    ["shield_A", "fw", "shield_A"],
  ],
  // Brown bottles read red-orange in the colour audit (B and C over the 8 percent line, A at 6), so no bottles at all; jars carry the shelf.
  apothecary: [
    ["shelf_small_candles", "dun", "shelf_small_candles"],
    ["table_decorated", "dun", "table_medium_decorated_A"],
    ["candle_lit", "dun", "candle_lit"],
    ["barrel_small", "dun", "barrel_small"],
    ["box_small", "dun", "box_small_decorated"],
    ["jar_A", "rest", "jar_A_small"],
    ["jar_B", "rest", "jar_B_medium"],
    ["jar_C", "rest", "jar_C_large"],
    ["jar_D", "rest", "jar_D_small"],
  ],
};

function findFile(root, names) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && names.includes(e.name)) return join(root, e.name);
    if (e.isDirectory()) {
      const hit = findFile(join(root, e.name), names);
      if (hit) return hit;
    }
  }
  return null;
}

const fileFor = (theme) => (theme === "market-quarter" ? "market-quarter.glb" : `holding-${theme}.glb`);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const [theme, pieces] of Object.entries(THEMES)) {
  if (only.length && !only.includes(theme)) continue;
  const target = new Document();
  target.createBuffer();
  const scene = target.createScene(theme);
  const seen = new Set();
  for (const [id, pack, base] of pieces) {
    if (seen.has(id)) throw new Error(`duplicate id ${id} in ${theme}`);
    seen.add(id);
    const path = findFile(ROOT[pack], [`${base}.gltf`, `${base}.gltf.glb`, `${base}.glb`]);
    if (!path) throw new Error(`missing ${pack}/${base}`);
    const src = await io.read(path);
    const kids = src.getRoot().listScenes()[0].listChildren();
    const map = mergeDocuments(target, src);
    const holder = target.createNode(id);
    for (const child of kids) holder.addChild(map.get(child));
    scene.addChild(holder);
    for (const s of src.getRoot().listScenes()) map.get(s)?.dispose();
  }
  await target.transform(prune(), dedup(), unpartition());
  let tris = 0;
  for (const m of target.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  console.log(`\n${fileFor(theme)}: ${pieces.length} pieces, ${Math.round(tris)} triangles, ${target.getRoot().listTextures().length} texture(s)`);
  for (const node of scene.listChildren()) {
    const b = getBounds(node);
    console.log(" ", node.getName().padEnd(26), "size", b.max.map((m, i) => (m - b.min[i]).toFixed(2)).join(","));
  }
  await io.write(join(outDir, fileFor(theme)), target);
}
console.log("\ndone");
