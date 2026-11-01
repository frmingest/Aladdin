/**
 * The town kit (S9, 2026-11-01): four small packed .glb files of CC0 pieces for Market Street (S14) and the Town
 * beyond the gate (S15). Pure data, no three.js. Nothing is placed in the world yet: this file only says what the
 * files hold and how big a piece should be drawn, and the tests keep the files and this list in step.
 *
 * Sources and licences (see public/models/CREDITS.md):
 *  - Kenney Fantasy Town Kit 2.0 (CC0): market, street and nature pieces. One shared 512x512 palette, retinted:
 *    no red, no teal-green (those became blue and teal), leaf greens and timber left alone.
 *  - KayKit Medieval Builder Pack 1.0 (CC0): finished buildings. Plain material colours; roofs recoloured to teal.
 * No piece carries a fact. Anything that shows data (a pennant, a price plate, a board) is built by code on top.
 */
export const TOWN_FILES = {
  market: "/models/town-market.glb",
  street: "/models/town-street.glb",
  buildings: "/models/town-buildings.glb",
  nature: "/models/town-nature.glb",
} as const;
export type TownGroup = keyof typeof TOWN_FILES;

/** The one palette every Kenney piece uses (it is also embedded in the .glb files; kept for the colour test). */
export const TOWN_PALETTE_URL = "/models/town-palette.png";

/**
 * How much to scale a piece so it sits beside the 2.0-tall people. Kenney pieces are about 1 unit per tile, the
 * Builder buildings about 1.7 units wide: the awning stall comes out about 3.1 high, a house about 9.3 wide and 5 high.
 */
export const TOWN_SCALE = { kenney: 2.5, builder: 5.5 } as const;
export type TownMaker = keyof typeof TOWN_SCALE;

/** Node names inside each file (each piece is a top-level node). Never says red or green. */
export const TOWN_PIECES = {
  market: [
    "stall", "stall_bench", "stall_stool", "stall_awning_blue", "stall_awning_teal", "cart", "cart_high",
    "banner_blue", "banner_teal", "lantern", "poles", "poles_horizontal", "overhang",
  ],
  street: [
    "road", "road_bend", "road_corner", "road_corner_inner", "road_curb", "road_curb_end", "road_edge", "road_edge_slope", "road_slope",
    "fence", "fence_broken", "fence_curved", "fence_gate", "pillar_stone", "pillar_wood", "stairs_stone",
  ],
  buildings: [
    "house", "market", "barracks", "mill", "watermill", "lumbermill", "mine", "watchtower", "castle", "well",
    "wall_straight", "wall_corner", "wall_gate",
  ],
  nature: [
    "tree", "tree_crooked", "tree_high", "tree_high_crooked", "tree_high_round", "rock_large", "rock_small", "rock_wide",
    "hedge", "hedge_curved", "hedge_gate", "hedge_large", "hedge_large_curved", "hedge_large_gate", "fountain_round", "fountain_round_detail",
  ],
} as const satisfies Record<TownGroup, readonly string[]>;

/** Who made a group, so the right scale is used. */
export const TOWN_MAKER: Record<TownGroup, TownMaker> = { market: "kenney", street: "kenney", buildings: "builder", nature: "kenney" };

/** Measured native size (width, height, depth) of the pieces S14 and S15 lean on most, before scaling. */
export const TOWN_SIZES = {
  stall_awning_blue: { group: "market", w: 1.0, h: 1.24, d: 1.0 },
  stall_awning_teal: { group: "market", w: 1.0, h: 1.24, d: 1.0 },
  cart: { group: "market", w: 0.89, h: 0.54, d: 1.34 },
  lantern: { group: "market", w: 0.22, h: 1.56, d: 0.22 },
  house: { group: "buildings", w: 1.69, h: 0.91, d: 1.66 },
  market: { group: "buildings", w: 1.47, h: 0.86, d: 1.67 },
  watchtower: { group: "buildings", w: 0.97, h: 1.98, d: 1.71 },
  castle: { group: "buildings", w: 1.8, h: 2.53, d: 1.85 },
} as const satisfies Record<string, { group: TownGroup; w: number; h: number; d: number }>;

/** A piece's size as drawn. */
export function townSizeOf(id: keyof typeof TOWN_SIZES): { w: number; h: number; d: number } {
  const s = TOWN_SIZES[id];
  const k = TOWN_SCALE[TOWN_MAKER[s.group]];
  return { w: s.w * k, h: s.h * k, d: s.d * k };
}
