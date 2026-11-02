/**
 * What each holding-land dressing (S26-S29), the Market Quarter (S30) and the Siege Field (S27) may use, by node name.
 * Pure data, no three.js, nothing placed yet: the packs were prepared on 2026-11-02 (see docs/game/game3d-new-packs-2026-11-02.md)
 * and the tests keep this list and the files in step.
 *
 * Rules for whoever places these: a dressing carries no fact (gate stone, survey lanterns, wall and moat tiers, price post are
 * code-built); no pile, stack or crowd may grow with a gain; no piece is red or green (the colour audit is
 * scripts/glb-colour-audit.mjs). A theme never picks its own light.
 */
export const HOLDING_THEMES = ["mine","quarry","ingots","farm","stall","bank","factory","windmill","watermill","fountain"] as const;
export type HoldingTheme = (typeof HOLDING_THEMES)[number];

/** Node names inside holding-<theme>.glb (each piece is a top-level node). */
export const HOLDING_OWN: Record<HoldingTheme, readonly string[]> = {
  mine: ["mine_building","scaffold_wall","scaffold_open","scaffold_doorway","floor_rocky","rock_A","rock_B","rock_D","wheelbarrow","pickaxe","shovel","lantern","hammer","ore_gold_nuggets","ore_gold_large","stone_chunks_large","planks_small"],
  quarry: ["rock_A","rock_B","rock_D","wheelbarrow","floor_rocks","stone_chunks_large","stone_chunks_small","bricks_stack_large","bricks_stack_medium","bricks_stack_small","brick","planks_medium","pickaxe","chisel","mallet","grindstone"],
  ingots: ["gold_bars_stack_large","gold_bars_stack_medium","gold_bars_stack_small","gold_bar","silver_bars_stack_small","silver_bar","pallet","pallet_tarp","chest_gold","coin_stack_medium","coin_stack_small","coin","gate_wall","gate_wall_window","barrier_column","shelf_large","candle_triple"],
  farm: ["grain_field","dirt_field","fence_wood","fence_wood_gate","wheelbarrow","sack","barrel","bucket_water","crate_open","lumber","pond_tile","dock_bridge","rock_B","pallet","planks_small","shovel","trowel","rope"],
  stall: ["textiles_A","textiles_B","textiles_C","textiles_stack_large","textiles_stack_small","gold_bars_stack_small","silver_bars_stack_small","pallet","crate_A_small","crate_B_big","sack","barrel","flag_blue","flag_yellow","box_small_decorated","coin_stack_small","keyring_hanging","candle_lit","scales_lantern"],
  bank: ["chest_gold","coin_stack_large","coin_stack_medium","coin_stack_small","key","keyring_hanging","gate_wall","gate_wall_window","column","barrier_half","shelf_large","candle_triple","gold_bars_stack_small","silver_bars","journal_open","pencil"],
  factory: ["blacksmith","cog","parts_pile_small","iron_bars_stack_small","pallet_tarp","anvil","hammer","tongs","wrench_A","wrench_B","saw","handdrill","barrel_large"],
  windmill: ["windmill","grain_field","dirt_field","fence_wood","fence_wood_gate","sack","wheelbarrow","crate_A_big","barrel","rock_B","pallet","planks_small","cog","lantern"],
  watermill: ["watermill","water_tile","bridge_A","bridge_B","rock_A","rock_D","sack","barrel","bucket_water","fence_wood","planks_small","cog"],
  fountain: ["well","water_tile","rock_A","rock_E","bucket_water","flag_blue","flag_yellow","barrel","crate_A_small","barrier_corner","column","candle_lit","torch_lit","coin","gold_bars_stack_small"],
};

/** Pieces a theme borrows from files that already exist, instead of packing them twice. */
export const HOLDING_REUSE: Record<HoldingTheme, readonly { file: string; nodes: readonly string[] }[]> = {
  mine: [{ file: "town-buildings.glb", nodes: ["mine"] }, { file: "horizon.glb", nodes: ["rock_single_C", "rock_single_E"] }],
  quarry: [{ file: "horizon.glb", nodes: ["rock_single_C", "rock_single_E"] }, { file: "town-nature.glb", nodes: ["rock_large", "rock_small", "rock_wide"] }],
  ingots: [{ file: "scenery.glb", nodes: ["torch_mounted", "banner_blue"] }],
  farm: [{ file: "town-buildings.glb", nodes: ["house"] }, { file: "town-nature.glb", nodes: ["hedge", "hedge_gate", "hedge_large"] }],
  stall: [{ file: "market.glb", nodes: ["market_stalls", "stall_table_long", "stall_table_medium", "crates_stacked", "keg_decorated"] }, { file: "town-market.glb", nodes: ["stall", "cart", "banner_blue"] }],
  bank: [{ file: "town-buildings.glb", nodes: ["castle"] }, { file: "scenery.glb", nodes: ["banner_shield_white"] }],
  factory: [{ file: "town-buildings.glb", nodes: ["barracks"] }],
  windmill: [{ file: "town-buildings.glb", nodes: ["mill"] }],
  watermill: [{ file: "town-buildings.glb", nodes: ["watermill"] }],
  fountain: [{ file: "town-nature.glb", nodes: ["fountain_round", "fountain_round_detail"] }, { file: "market.glb", nodes: ["well"] }],
};

export const HOLDING_URL = (theme: HoldingTheme): string => `/models/holding-${theme}.glb`;

/** Siege Field: siege.glb holds Kenney Castle Kit pieces on one retinted palette; the skeletons attack. */
export const SIEGE_URL = "/models/siege.glb";
export const SIEGE_ENGINES = ["siege_catapult", "siege_trebuchet", "siege_ballista", "siege_ram", "siege_tower"] as const;
export const SIEGE_WRECKS = SIEGE_ENGINES.map((e) => `${e}_wrecked`);
export const SIEGE_WALLS = ["wall","wall_half","wall_corner","wall_doorway","wall_pillar","wall_narrow","wall_narrow_stairs","gate","metal_gate","stairs_stone","tower_square","tower_hexagon_base","tower_hexagon_mid","tower_hexagon_top","tower_hexagon_roof"] as const;
export const SIEGE_FLAGS = ["flag","flag_pennant","flag_banner_long","flag_wide"] as const;
export const SIEGE_ROCKS = ["rocks_small", "rocks_large"] as const;

export const SKELETON_FILES = ["Skeleton_Minion", "Skeleton_Warrior", "Skeleton_Rogue", "Skeleton_Mage"] as const;
export const SKELETON_URL = (name: (typeof SKELETON_FILES)[number]): string => `/models/${name}.glb`;
/** Clips kept in each Skeleton file. Same bone names as the Adventurers, so any clip below also plays on Knight and friends. */
export const SKELETON_CLIPS = ["Idle", "Walking_A", "Running_A", "Cheer", "Hit_A", "Death_A", "1H_Melee_Attack_Slice_Horizontal"] as const;

/** clips-work.glb: animation-only, binds by bone name to the Adventurers (and Skeletons). Not visually reviewed yet. */
export const WORK_CLIPS_URL = "/models/clips-work.glb";
export const WORK_CLIPS = ["2H_Melee_Attack_Chop", "1H_Melee_Attack_Chop", "2H_Melee_Attack_Slice", "PickUp", "Throw", "Sit_Floor_Idle"] as const;

/** Market Quarter extras (S30). Stalls, awnings, carts and banners already live in market.glb and town-market.glb. */
export const MARKET_QUARTER_URL = "/models/market-quarter.glb";
export const MARKET_QUARTER_NODES: readonly string[] = ["home_A","crate_open","sack","wheelbarrow","bucket_empty","textiles_A","textiles_B","textiles_C","textiles_stack_large","gold_bars_stack_small","silver_bars_stack_small","planks_small","pallet","table_small","plate_food_A","plate_food_B","plate_stack","bottle_A","barrel_large","keg","box_small","trunk_small","shelves","floor_wood","banner_thin_blue","banner_triple_yellow","banner_triple_white","candle_lit","coin_stack_small"];

/** Opt-in sounds (S31). Nothing preloads; muted until the player turns sound on. See public/audio/CREDITS.md. */
export const AUDIO_FILES = ["footstep-stone", "footstep-wood", "footstep-grass", "door-open", "door-close", "coins", "lock", "page", "thud", "hammer", "mining"] as const;
export const audioUrl = (name: (typeof AUDIO_FILES)[number]): string => `/audio/${name}.ogg`;

/** Soft white sprites for tinting in code. Off under reduced motion. */
export const FX_SPRITES = ["smoke_soft", "smoke_puff", "spark", "dust", "flare", "dot"] as const;
export const fxUrl = (name: (typeof FX_SPRITES)[number]): string => `/fx/${name}.png`;
