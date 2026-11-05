/**
 * The Market Quarter (asset plan A6, 2026-11-04). Pure data and maths, no three.js and no React.
 *
 * A place of its own, reached through a timber arch in the east of the courtyard: one lane of stalls, one stall per watchlist
 * company, in the same street order as the flat Marketplace (in range first, then nearest to the price you named, then by
 * name). The lane starts at the arch, so the stalls nearest you are the ones nearest your price. Stalls with no price stand
 * in a quiet stretch at the far end, behind a gap and a mist, with the words "No price" and never a "0%". It removes the
 * eight-stall limit of the courtyard street (twelve stand here). It puts art we already own on the map: `market-quarter.glb`
 * (KayKit Resource Bits and Dungeon pieces: cloth, crates, barrels, sacks, planks, banners, a house) and the stall models
 * already drawn in the courtyard.
 *
 * What carries a fact, and what never does:
 * - A stall carries the facts the flat page prints: its pennant shape (tone), its plate words and its signed gap. Those come
 *   from `toStall`, the same function the courtyard street uses.
 * - WHERE a stall stands says one thing: how near your price it is (street order), plus whether it has a price at all (the
 *   quiet stretch). Nothing else decides a place.
 * - The goods beside a stall, the boardwalk, the banners and the house are fixed. The goods set is picked from the company id
 *   alone (stable variety, no data), every set has the same number of pieces, and nothing grows with a gain, a gap or a verdict.
 * Colour never carries the meaning alone: pennant shape and printed words say it too. No red or green.
 */
import { orderStreet } from "../lib/marketplace";
import type { WatchlistRow } from "../lib/types";
import { yawToward } from "./npcs";
import { stableIndex, toStall } from "./streetPlan";
import type { Stall } from "./streetPlan";

// --- The arch in the courtyard -------------------------------------------------------------------------------
/** The arch stands in the east, between the market corner and the perch, clear of every reach (test). */
export const QUARTER_GATE = { x: 29, z: 8 } as const;
/** Faces the middle of the courtyard. */
export const QUARTER_GATE_FACING = yawToward(QUARTER_GATE, { x: 0, z: 0 });
export const QUARTER_GATE_RANGE = 4.2;
export const QUARTER_GATE_LEAVE_RANGE = 5.6;
/** Where you stand in the courtyard on coming back: out of every reach, looking away from the arch. */
export const QUARTER_GATE_RETURN = { x: QUARTER_GATE.x - 7, z: QUARTER_GATE.z } as const;
/** Camera sits behind the hero, on the arch's side (same rule as the Siege Field's gate). */
export const QUARTER_GATE_RETURN_YAW = Math.atan2(QUARTER_GATE.x - QUARTER_GATE_RETURN.x, QUARTER_GATE.z - QUARTER_GATE_RETURN.z);

// --- The quarter itself --------------------------------------------------------------------------------------
/** Local coordinates: x east, z south, y up. Camera yaw 0 looks north, up the lane. */
export const QUARTER_RADIUS = 44;
export const QUARTER_SPAWN = { x: 0, z: 30, yaw: 0 } as const;
/** The road back stands at the south end. */
export const QUARTER_EXIT = { x: 0, z: 38 } as const;
export const QUARTER_EXIT_RANGE = 4.5;
export const QUARTER_EXIT_LEAVE_RANGE = 6;
/** Half the side of the square the hero may walk in (invisible walls). */
export const QUARTER_HALF = 40;

/** Twelve stalls stand here, six rows of two. The courtyard street stops at eight. */
export const QUARTER_MAX = 12;
/** The stalls stand this far either side of the lane's middle; their fronts face it. */
export const STALL_X = 7.5;
/** The first row, nearest the arch, and the distance between rows. */
export const FIRST_ROW_Z = 18;
export const ROW_GAP = 7;
/** Extra empty lane between the last priced row and the first stall with no price. */
export const FOG_GAP = 8;

export interface Quarter {
  /** The stalls that stand, in street order (priced first, no-price last). At most `QUARTER_MAX`. */
  stalls: Stall[];
  /** Companies with no stand here: counted in the panel's line, not drawn. */
  overflow: Stall[];
  /** The z where the quiet stretch begins (the far gate stands just in front of it), or null when no stall is unpriced. */
  fogZ: number | null;
  /** Every company on the watchlist, and how many of them are in range. Drawn from the whole list, not just the stalls that stand. */
  total: number;
  inRange: number;
}

/** The rows' z for a run of `n` stalls starting at `startZ`: two to a row. */
export function rowZs(n: number, startZ: number): number[] {
  return Array.from({ length: n }, (_, i) => startZ - ROW_GAP * Math.floor(i / 2));
}

/** The stall for list position `i` of a run: west first, then east, a new row every two. */
function place(row: WatchlistRow, i: number, z: number): Stall {
  const x = i % 2 === 0 ? -STALL_X : STALL_X;
  const s = toStall(row, { x, z });
  // Fronts face the lane, not the middle of the courtyard.
  return { ...s, yaw: yawToward({ x, z }, { x: 0, z }) };
}

/** The quarter for a watchlist: ordered like the flat page, priced stalls up the lane, unpriced ones in the quiet stretch. */
export function buildQuarter(rows: readonly WatchlistRow[] | null | undefined): Quarter {
  const ordered = orderStreet([...(rows ?? [])]);
  const shown = ordered.slice(0, QUARTER_MAX);
  const rest = ordered.slice(QUARTER_MAX);
  // `orderStreet` puts stalls with no price last, so the two runs are already apart; the gap only has to be made.
  const unpricedOf = (r: WatchlistRow): boolean => toStall(r, { x: 0, z: 0 }).unpriced;
  const priced = shown.filter((r) => !unpricedOf(r));
  const unpriced = shown.filter(unpricedOf);
  const pricedZ = rowZs(priced.length, FIRST_ROW_Z);
  const lastPricedZ = priced.length > 0 ? pricedZ[priced.length - 1] : null;
  const fogStart = lastPricedZ === null ? FIRST_ROW_Z : lastPricedZ - ROW_GAP - FOG_GAP;
  const fogZs = rowZs(unpriced.length, fogStart);
  const stalls = [...priced.map((r, i) => place(r, i, pricedZ[i])), ...unpriced.map((r, i) => place(r, i, fogZs[i]))];
  const all = ordered.map((r) => toStall(r, { x: 0, z: 0 }));
  return {
    stalls,
    overflow: rest.map((r) => toStall(r, { x: 0, z: 0 })),
    fogZ: unpriced.length > 0 ? fogStart : null,
    total: all.length,
    inRange: all.filter((s) => s.tone === "gold").length,
  };
}

// --- Goods beside each stall (fixed sets, picked from the company id alone) -----------------------------------
export type GoodsNode =
  | "textiles_stack_large"
  | "textiles_C"
  | "wheelbarrow"
  | "barrel_large"
  | "sack"
  | "crate_open"
  | "box_small"
  | "pallet"
  | "keg"
  | "bucket_empty"
  | "table_small"
  | "planks_small";

export interface Goods {
  node: GoodsNode;
  /** Scale to a sensible size in the world (the pieces are packed at very different native sizes). */
  scale: number;
  /** In the stall's own frame: x along the counter, z toward the lane. Behind and beside the stall, never in its front. */
  x: number;
  z: number;
  y: number;
  yaw: number;
}

/** Four goods sets of three pieces each. The same size, so no set looks richer than another. */
export const GOODS_SETS: readonly (readonly Goods[])[] = [
  // Cloth
  [
    { node: "textiles_stack_large", scale: 0.55, x: -2.3, z: -0.5, y: 0, yaw: 0.3 },
    { node: "textiles_C", scale: 0.5, x: 2.4, z: -0.8, y: 0, yaw: 1.2 },
    { node: "wheelbarrow", scale: 2.6, x: 2.5, z: 0.6, y: 0, yaw: 0.5 },
  ],
  // Provisions
  [
    { node: "barrel_large", scale: 0.38, x: -2.3, z: -0.6, y: 0, yaw: 0 },
    { node: "sack", scale: 4, x: 2.3, z: -0.6, y: 0, yaw: 0.6 },
    { node: "crate_open", scale: 3, x: -2.4, z: 0.6, y: 0, yaw: -0.3 },
  ],
  // Crates
  [
    { node: "box_small", scale: 0.5, x: -2.3, z: -0.8, y: 0, yaw: 0.2 },
    { node: "pallet", scale: 0.8, x: 2.5, z: -0.5, y: 0, yaw: 0 },
    { node: "crate_open", scale: 3, x: 2.5, z: -0.5, y: 0.24, yaw: 0.4 },
  ],
  // Cellar
  [
    { node: "keg", scale: 0.32, x: -2.3, z: -0.7, y: 0, yaw: 0 },
    { node: "table_small", scale: 0.7, x: 2.6, z: -0.7, y: 0, yaw: -0.4 },
    { node: "bucket_empty", scale: 3, x: -2.3, z: 0.6, y: 0, yaw: 0 },
  ],
];

/** The goods set for a company: from the id alone. Stable, and the same on every visit. */
export const goodsFor = (holdingId: string): readonly Goods[] => GOODS_SETS[stableIndex(holdingId, GOODS_SETS.length)];

// --- The lane's own dressing (fixed: no input) ----------------------------------------------------------------
/** Boardwalk: 4 x 4 plank tiles, two wide, down the middle of the lane. */
export const LANE_TILE = 4;
export const LANE_TILES: readonly { id: string; x: number; z: number }[] = [-2, 2].flatMap((x) =>
  Array.from({ length: 15 }, (_, i) => ({ id: `tile-${x}-${i}`, x, z: 28 - i * LANE_TILE })),
);

/**
 * Banner poles: a pair at the entrance (facing the way you arrive) and a pair every so often beyond the stalls (facing the lane).
 * Fixed. The packed banner hangs from nothing (its foot is above the ground), so each stands on a code-built pole.
 */
export const LANE_BANNERS: readonly { id: string; x: number; z: number; yaw: number }[] = [
  { id: "banner-in-w", x: -5.5, z: 27, yaw: 0 },
  { id: "banner-in-e", x: 5.5, z: 27, yaw: 0 },
  ...[12, -6, -24].flatMap((z) => [
    { id: `banner-w-${z}`, x: -13, z, yaw: Math.PI / 2 },
    { id: `banner-e-${z}`, x: 13, z, yaw: -Math.PI / 2 },
  ]),
];

/** The house that closes the far end of the lane. */
export const LANE_HOUSE = { x: 0, z: -37, yaw: 0, scale: 4, solid: 2 } as const;
/** The lane sign where the boardwalk starts. */
export const LANE_SIGN = { x: 0, z: 24 } as const;
