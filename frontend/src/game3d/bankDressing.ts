/**
 * The bank vault dressing (A2, theme `bank`). Pure data and maths, no three.js and no React.
 *
 * A gold chest, coin stacks, a gold and a silver stack and a writing desk (open journal, pencil, key, candle) stand inside a
 * ring of six barred walls. The walls wear the condition ladder exactly as the fountain's columns and the bullion barriers do
 * (same slots lost first, same props, boards, patches, crack and footing), so this file reuses `fountainPlan`: the numbers
 * come from the LandCondition, which comes from the wall tier alone.
 *
 * THE TREASURE NEVER MOVES. The piles and the desk are fixed lists below. No count, height or size of coin, gold or paper
 * depends on the wall tier, the weight, the size class, a gain, a margin of safety or a verdict, and the open journal shows no
 * writing that means anything. Condition is shape, lean and rubble, never colour.
 */
import { COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import type { FountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";

export const WALL_SLOTS = COLUMN_SLOTS;
/** The barred walls stand on this ring (world units from the centre), inside the stream band. */
export const WALL_RING = 2.0;
/** gate_wall is 4 wide, 4 high, 1 deep in the file; at this scale a slot is 1.28 wide, 1.28 high, 0.32 deep, so the ring has open gaps and the treasure shows from outside. */
export const WALL_SCALE = 0.32;

/** The same plan as the fountain, read as barred walls: `columns` are the six wall slots. */
export type BankPlan = FountainPlan;
export const bankPlan = (c: LandCondition): BankPlan => fountainPlan(c);

/** Which barred piece stands in a slot: windowed and plain alternate, so the ring reads as bars and not as one long wall. */
export const wallNode = (slot: number): "gate_wall" | "gate_wall_window" => (slot % 2 ? "gate_wall" : "gate_wall_window");

export interface Pile {
  node: string;
  scale: number;
  /** Angle and distance from the centre; r 0 means the middle. */
  angle: number;
  r: number;
  /** Largest half-extent of the piece on the ground at this scale (for the "inside the ring" test). */
  reach: number;
}

/** The fixed treasure. Same for every holding, every rung and the neutral. A test pins it. */
export const PILES: readonly Pile[] = [
  { node: "chest_gold", scale: 0.7, angle: 0, r: 0, reach: 0.56 },
  { node: "coin_stack_large", scale: 0.5, angle: 4.1, r: 1.2, reach: 0.42 },
  { node: "coin_stack_medium", scale: 0.55, angle: 5.0, r: 1.25, reach: 0.3 },
  { node: "coin_stack_small", scale: 0.55, angle: 5.6, r: 1.2, reach: 0.28 },
  { node: "gold_bars_stack_small", scale: 0.6, angle: 0.9, r: 1.2, reach: 0.24 },
  { node: "silver_bars", scale: 0.55, angle: 1.45, r: 1.25, reach: 0.35 },
];

/** The writing desk: two short columns under a shelf, with the things on top. Built in the desk's own frame (x along it). */
export const DESK_ANGLE = 2.75;
export const DESK_R = 1.2;
export const DESK_SHELF_SCALE = 0.8;
export const DESK_LEG_SCALE = 0.4;
export const DESK_LEG_X = 0.6;
/** Legs are 1.4 * 0.4 = 0.56 high; the shelf plank runs -0.35 to 0.1 about its origin (0.8 scale), so its origin sits 0.28 above the legs and its top at 0.92. */
export const DESK_SHELF_Y = 0.84;
export const DESK_TOP = 0.92;
/** The shelf's depth runs 0 to 0.5 from its origin; this centres it on the legs. */
export const DESK_SHELF_Z = -0.2;
export const DESK_HALF_WIDTH = 0.8;
export const DESK_HALF_DEPTH = 0.4;
/** Pieces on the desk, desk frame: x along the desk, z across it. Fixed. */
export const DESK_THINGS: readonly { node: string; scale: number; x: number; z: number; lift: number; rotY?: number; rotX?: number }[] = [
  { node: "journal_open", scale: 0.6, x: -0.1, z: 0, lift: 0.07 * 0.6, rotX: -Math.PI / 2 },
  { node: "pencil", scale: 0.6, x: 0.3, z: 0.1, lift: 0.03, rotX: Math.PI / 2, rotY: 0.5 },
  { node: "key", scale: 0.5, x: -0.6, z: 0.15, lift: 0.04, rotX: Math.PI / 2 },
  { node: "candle_triple", scale: 0.5, x: 0.62, z: -0.1, lift: 0 },
];

/** Where wall `slot` stands and how it faces (its long side runs along the ring). */
export const wallAt = (angle: number): { x: number; z: number; rotY: number } => ({
  x: Math.cos(angle) * WALL_RING,
  z: Math.sin(angle) * WALL_RING,
  rotY: -angle - Math.PI / 2,
});

/** The desk's centre and facing, same convention as `wallAt`. */
export const deskAt = (): { x: number; z: number; rotY: number } => ({
  x: Math.cos(DESK_ANGLE) * DESK_R,
  z: Math.sin(DESK_ANGLE) * DESK_R,
  rotY: -DESK_ANGLE - Math.PI / 2,
});
