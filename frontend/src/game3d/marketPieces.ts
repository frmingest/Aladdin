/**
 * The marketplace corner of the 3D courtyard (south-east, near the gate road): a blue-awning stall, a well,
 * a canopy, tables with food and bottles, stacked crates, kegs and barrels, all from the KayKit packs
 * (CC0, see public/models/CREDITS.md). Pure data, no three.js.
 *
 * It is decoration only. Nothing here depends on a holding, shows a price or says whether a price is in range:
 * that belongs to the flat Market Street page and, if it ever comes to 3D, to code-drawn pennants and words.
 * If market.glb fails to load, the corner is simply open ground again.
 */
export const MARKET_URL = "/models/market.glb";

/** Node names inside market.glb. */
export type MarketModel =
  | "market_stalls"
  | "well"
  | "tent_market"
  | "crate_long_A"
  | "stall_table_long"
  | "stall_table_medium"
  | "stall_table_plain"
  | "crates_stacked"
  | "keg_decorated"
  | "barrel_stack"
  | "stool";

/** What you walk round: a round base, or a box (half sizes in the piece's own frame, turned with it). */
export type MarketSolid = { kind: "circle"; r: number } | { kind: "box"; hx: number; hz: number };

export interface MarketPiece {
  id: string;
  model: MarketModel;
  x: number;
  z: number;
  /** Turn about the vertical axis, radians. 0 faces south (towards the gate road). */
  yaw: number;
  scale: number;
  solid: MarketSolid;
}

/** The ground the corner may use: round the middle of the old reserved zone (20, 14), moved out with the rest of the spread courtyard. */
export const MARKET_CENTER = { x: 30, z: 21 } as const;
export const MARKET_REACH = 10;

export const MARKET: readonly MarketPiece[] = [
  // The big stall: awnings, crates of produce. Its back is to the wall side, its front to the square.
  { id: "market-stall", model: "market_stalls", x: 34.8, z: 15.6, yaw: -1.45, scale: 5.4, solid: { kind: "box", hx: 4.6, hz: 3.3 } },
  // The well at the north end of the square.
  { id: "market-well", model: "well", x: 26.4, z: 14.8, yaw: 0.3, scale: 4.5, solid: { kind: "circle", r: 1.45 } },
  // A canopy at the south end, open to the square.
  { id: "market-canopy", model: "tent_market", x: 31, z: 25, yaw: -2.4, scale: 5, solid: { kind: "circle", r: 1.6 } },
  // Two laid tables on the west side of the square.
  { id: "market-table-a", model: "stall_table_long", x: 26.9, z: 24.6, yaw: 1.5, scale: 1.1, solid: { kind: "box", hx: 1.15, hz: 2.3 } },
  { id: "market-table-b", model: "stall_table_medium", x: 28.6, z: 29.6, yaw: 0.35, scale: 1.15, solid: { kind: "box", hx: 1.15, hz: 1.15 } },
  { id: "market-stool", model: "stool", x: 30.4, z: 28.4, yaw: 0.9, scale: 1.2, solid: { kind: "circle", r: 0.45 } },
  // Goods: stacked crates and a keg by the stall, barrels by the canopy.
  { id: "market-crates", model: "crates_stacked", x: 27.6, z: 18, yaw: -0.4, scale: 1.1, solid: { kind: "circle", r: 1.2 } },
  { id: "market-keg", model: "keg_decorated", x: 36.2, z: 21.9, yaw: -0.2, scale: 0.9, solid: { kind: "box", hx: 1.5, hz: 0.9 } },
  { id: "market-barrels", model: "barrel_stack", x: 34.6, z: 24.2, yaw: 0.5, scale: 1.1, solid: { kind: "box", hx: 1.0, hz: 0.6 } },
];
