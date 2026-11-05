/**
 * The armoury yard dressing (A7, theme `armoury`: defence and aerospace). Pure data and maths, no three.js and no React.
 *
 * A teal-roofed barracks stands at the back of a fenced yard, with a weapon rack (swords, a spear and a halberd), a shield
 * leaning on the ground and a straw archery target on a tripod in front, inside a ring of six rail-fence sections (the first
 * is the gate). The ring wears the condition ladder exactly as the other dressings do (it reuses `fountainPlan`): the numbers
 * come from the LandCondition, which comes from the wall tier alone. It matches the Map picture "Armoury yard".
 *
 * THE ARMOURY NEVER GROWS. The lists below are fixed. No count or size of weapon, shield or target depends on the wall tier,
 * the weight, the size class, a gain, a margin of safety or a verdict. Condition is shape, lean and rubble, never colour.
 */
import { COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import type { FountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";

export const FENCE_SLOTS = COLUMN_SLOTS;
/** The fence ring (world units from the centre), inside the stream band. */
export const YARD_RING = 2.0;

export type ArmouryPlan = FountainPlan;
export const armouryPlan = (c: LandCondition): ArmouryPlan => fountainPlan(c);

/** Slot 0 is the gate; the rest are plain rail fence. The long side of a fence piece (z) runs along the ring. */
export const fenceNode = (slot: number): { node: "fence_wood" | "fence_wood_gate"; scale: number } => ({
  node: slot === 0 ? "fence_wood_gate" : "fence_wood",
  scale: 1.7,
});

/** The barracks (Builder pack, borrowed from town-buildings.glb): about 1.99 by 1.61 and 1.3 high at scale 1. */
export const HUT = { scale: 0.95, halfX: 0.95, halfZ: 0.77, angle: -Math.PI / 2, r: 0.7 } as const;

/** The rack, in its own frame (x along the rack): two A-frame ends, a crossbar, and the weapons standing in it. */
export const RACK = { halfLength: 0.42, height: 0.55, angle: 2.6, r: 1.25, reach: 0.45 } as const;
export const RACK_WEAPONS: readonly { node: "sword_A" | "sword_B" | "spear_A" | "halberd"; scale: number; x: number; lean: number }[] = [
  { node: "sword_A", scale: 0.3, x: -0.3, lean: 0.12 },
  { node: "sword_B", scale: 0.3, x: -0.1, lean: -0.1 },
  { node: "spear_A", scale: 0.3, x: 0.1, lean: 0.08 },
  { node: "halberd", scale: 0.26, x: 0.3, lean: -0.1 },
];

/** The archery target: straw disc with a cream and a teal ring on a three-legged stand. Code-built. */
export const TARGET = { angle: 0.6, r: 1.2, reach: 0.4, radius: 0.34, centreY: 0.62 } as const;

/** Ground pieces that are plain model clones. Fixed, the same for every holding, every rung and the neutral. */
export interface YardPiece {
  node: string;
  scale: number;
  angle: number;
  r: number;
  reach: number;
  lift?: number;
  rotX?: number;
  rotY?: number;
}
export const PIECES: readonly YardPiece[] = [
  { node: "shield_A", scale: 0.4, angle: 1.75, r: 1.1, reach: 0.3, rotX: -0.55 },
];

/**
 * The fence piece sits on the edge of its hex tile: its rail line is 1.05 to the -x side of its own origin (the gate: 1.07), so
 * the dressing puts a group on the ring point with `rotY = PI - angle` (local -x then points out of the yard) and the piece
 * 1.05 times its scale inward of that point. The rail line then runs along the ring.
 */
export const FENCE_EDGE = 1.05;
export const fenceAt = (angle: number): { x: number; z: number; rotY: number } => ({
  x: Math.cos(angle) * YARD_RING,
  z: Math.sin(angle) * YARD_RING,
  rotY: Math.PI - angle,
});

/** How far a model's origin sits above its lowest point, per unit of scale (the weapons are centred, not footed). */
export const BASE: Readonly<Record<string, number>> = { sword_A: 0.36, sword_B: 0.37, spear_A: 1.03, halberd: 0.93, shield_A: 0.55 };

/** The rack and the target both face the middle with their long side along the ring (the same turn as the old stock rings). */
export const faceCentre = (angle: number): number => -angle - Math.PI / 2;

/** Where the hut, the rack and the target stand (x, z). */
export const spotOf = (angle: number, r: number): { x: number; z: number } => ({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
