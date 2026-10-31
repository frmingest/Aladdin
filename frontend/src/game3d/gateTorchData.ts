/**
 * Torches at the gate (game3d, Standing S1). Pure data and maths, no three.js.
 * Three flames on a plain gate frame: west post, hanging lantern over the road, east post.
 * They light left to right as the Standing level rises, and one goes out if the level falls.
 *
 * They show one real fact (the level) and nothing else. Lit versus dark is shape and
 * brightness (a flame stands in the bowl, or the bowl is bare and cold), never colour alone,
 * and the level is also written in the chip.
 */
import { GATE_HALF_ANGLE, WALL_RADIUS } from "./layout";

export type TorchId = "west" | "centre" | "east";

export interface GateTorch {
  id: TorchId;
  x: number;
  /** Height of the bowl rim. */
  y: number;
  z: number;
}

/** Where the curtain wall begins on each side of the gate, measured along x. */
export function gateOpeningHalfWidth(): number {
  const segment = (2 * Math.PI) / 32; // WALL_SEGMENTS
  const firstWall = Math.ceil(GATE_HALF_ANGLE / segment) * segment;
  const centreX = WALL_RADIUS * Math.sin(firstWall);
  const halfLength = (2 * WALL_RADIUS * Math.sin(Math.PI / 32) + 0.4) / 2;
  return centreX - halfLength * Math.cos(firstWall);
}

/** Posts stand a step inside the opening so they never touch the wall. */
export const POST_X = 9.4;
export const POST_Z = 34.7;
export const POST_HEIGHT = 8;
export const BEAM_Y = 8.4;

export const GATE_TORCHES: readonly GateTorch[] = [
  { id: "west", x: -POST_X, y: POST_HEIGHT + 0.2, z: POST_Z },
  { id: "centre", x: 0, y: BEAM_Y - 0.9, z: POST_Z },
  { id: "east", x: POST_X, y: POST_HEIGHT + 0.2, z: POST_Z },
];

/** Torch i is lit when the level is above i, so level 0 is all dark and level 3 is all lit. */
export function torchesLit(level: number): boolean[] {
  return GATE_TORCHES.map((_, i) => level > i);
}
