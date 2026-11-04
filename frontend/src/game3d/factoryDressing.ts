/**
 * The workshop dressing (A3, theme `factory`). Pure data and maths, no three.js and no React.
 *
 * A blacksmith's forge stands in the middle with an anvil, a cog, a scrap pile, iron bars, a tarped pallet, a barrel and a few
 * tools around it, inside a ring of six stockpile pieces (barrels and iron-bar stacks, alternating). The ring wears the
 * condition ladder exactly as the fountain's columns, the bullion barriers and the bank walls do (it reuses `fountainPlan`):
 * the numbers come from the LandCondition, which comes from the wall tier alone.
 *
 * THE WORKSHOP NEVER GROWS. The list below is fixed. No count, size or glow of any tool or pile depends on the wall tier,
 * the weight, the size class, a gain, a margin of safety or a verdict. Condition is shape, lean and rubble, never colour.
 */
import { COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import type { FountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";

export const STOCK_SLOTS = COLUMN_SLOTS;
/** The stockpile ring (world units from the centre), inside the stream band. */
export const STOCK_RING = 2.0;

export type FactoryPlan = FountainPlan;
export const factoryPlan = (c: LandCondition): FactoryPlan => fountainPlan(c);

/** Which piece stands in ring slot `slot`, and at what scale: barrels and iron-bar stacks alternate, so the ring has gaps. */
export const stockNode = (slot: number): { node: "barrel_large" | "iron_bars_stack_small"; scale: number } =>
  slot % 2 ? { node: "iron_bars_stack_small", scale: 0.6 } : { node: "barrel_large", scale: 0.28 };

export interface Piece {
  node: string;
  scale: number;
  /** Angle and distance from the centre; r 0 means the middle. */
  angle: number;
  r: number;
  /** Half the piece's footprint on the ground at this scale (for the "inside the ring" and "no overlap" tests). */
  reach: number;
  /** Lift above the ground, and a turn about x (a tool lying down is turned 90 degrees). */
  lift?: number;
  rotX?: number;
  rotY?: number;
}

/** Half the forge's footprint at its scale (1.3 wide in the file, so 2.6 times 0.33 at scale 1.3 reads as about 0.86 each side). */
export const FORGE_REACH = 0.86;

/** The fixed workshop. Same for every holding, every rung and the neutral. A test pins it. */
export const PIECES: readonly Piece[] = [
  { node: "blacksmith", scale: 1.3, angle: 0, r: 0, reach: FORGE_REACH },
  { node: "anvil", scale: 0.4, angle: 0.9, r: 1.25, reach: 0.36 },
  { node: "cog", scale: 1.2, angle: 2.2, r: 1.3, reach: 0.24, lift: 0.1, rotX: -Math.PI / 2 },
  { node: "parts_pile_small", scale: 0.7, angle: 3.3, r: 1.25, reach: 0.4 },
  { node: "iron_bars_stack_small", scale: 0.6, angle: 4.3, r: 1.3, reach: 0.24 },
  { node: "pallet_tarp", scale: 0.35, angle: 5.3, r: 1.25, reach: 0.31 },
  { node: "barrel_large", scale: 0.25, angle: 6.1, r: 1.3, reach: 0.23 },
  { node: "hammer", scale: 0.4, angle: 1.55, r: 1.3, reach: 0.12, lift: 0.08, rotX: Math.PI / 2, rotY: 0.6 },
];

/** Where ring slot `angle` stands and how it faces (its long side runs along the ring). */
export const stockAt = (angle: number): { x: number; z: number; rotY: number } => ({
  x: Math.cos(angle) * STOCK_RING,
  z: Math.sin(angle) * STOCK_RING,
  rotY: -angle - Math.PI / 2,
});
