/**
 * The apothecary dressing (A7, theme `apothecary`: health care and pharma). Pure data and maths, no three.js and no React.
 *
 * A small teal-roofed shop (the Builder pack's market house, borrowed from town-buildings.glb) stands at the back with herb
 * bundles hanging along its front, a table of potions, a shelf of candles, jars on the ground and a lantern candle by the door,
 * inside a ring of six low stock pieces (small casks and boxes, alternating). The ring wears the condition ladder exactly as
 * the other dressings do (it reuses `fountainPlan`): the numbers come from the LandCondition, which comes from the wall tier
 * alone. It matches the Map picture "Apothecary".
 *
 * THE SHOP NEVER GROWS. The lists below are fixed. No count or size of jar, herb bundle, cask or candle depends on the wall
 * tier, the weight, the size class, a gain, a margin of safety or a verdict. There are no bottles of red or green (the brown
 * bottles of the pack read red-orange in the colour audit), and no herb colour is a status colour. Condition is shape, lean and
 * rubble, never colour.
 */
import { COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import type { FountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";

export const STOCK_SLOTS = COLUMN_SLOTS;
/** The stock ring (world units from the centre), inside the stream band. */
export const STOCK_RING = 2.0;

export type ApothecaryPlan = FountainPlan;
export const apothecaryPlan = (c: LandCondition): ApothecaryPlan => fountainPlan(c);

/** Which piece stands in ring slot `slot`: small casks and boxes alternate, so the ring has gaps. */
export const stockNode = (slot: number): { node: "barrel_small" | "box_small"; scale: number } =>
  slot % 2 ? { node: "box_small", scale: 0.35 } : { node: "barrel_small", scale: 0.5 };

/** The shop (the Builder market house at scale 1: 1.47 wide, 1.67 deep, 0.86 high; its origin is about its middle). */
export const SHOP = { scale: 1, halfX: 0.74, halfZ: 0.84, angle: -Math.PI / 2, r: 0.85 } as const;

/** Herb bundles hang on a string across the shop front. Fixed: four bundles, never a value. Colours are lavender, straw, cream, dusty teal. */
export const HERBS: readonly { x: number; colour: string }[] = [
  { x: -0.5, colour: "#8e86bf" },
  { x: -0.17, colour: "#c9b27a" },
  { x: 0.17, colour: "#efe3c1" },
  { x: 0.5, colour: "#5a9a9a" },
];
/** Where the string hangs, in the shop's own frame (x across the front, z toward the yard). */
export const HERB_LINE = { y: 0.78, z: 0.9 } as const;

export interface ShopPiece {
  node: string;
  scale: number;
  angle: number;
  r: number;
  reach: number;
  /** Lift above the ground for a piece whose origin is above its lowest point (the shelf board). */
  lift?: number;
  /** A turn about y so the piece faces the middle (shelf and table face +z by default). */
  face?: boolean;
}

/** The fixed shop floor. Same for every holding, every rung and the neutral. A test pins it. */
export const PIECES: readonly ShopPiece[] = [
  { node: "table_decorated", scale: 0.4, angle: 0.55, r: 1.2, reach: 0.5, face: true },
  { node: "shelf_small_candles", scale: 0.8, angle: 2.75, r: 1.25, reach: 0.45, lift: 0.24, face: true },
  { node: "jar_A", scale: 0.8, angle: 1.2, r: 1.0, reach: 0.2 },
  { node: "jar_B", scale: 0.7, angle: 1.7, r: 1.15, reach: 0.2 },
  { node: "jar_C", scale: 0.7, angle: 2.0, r: 1.15, reach: 0.2 },
  { node: "jar_D", scale: 0.7, angle: 0.0, r: 1.5, reach: 0.2 },
  { node: "candle_lit", scale: 0.6, angle: -0.3, r: 1.0, reach: 0.12 },
];

/** Where ring slot `angle` stands and how it faces. */
export const stockAt = (angle: number): { x: number; z: number; rotY: number } => ({
  x: Math.cos(angle) * STOCK_RING,
  z: Math.sin(angle) * STOCK_RING,
  rotY: -angle - Math.PI / 2,
});

/** A piece that faces the middle from `angle`. */
export const faceCentre = (angle: number): number => -angle - Math.PI / 2;
