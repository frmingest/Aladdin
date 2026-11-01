/**
 * The signpost by the gate (3D sprint S13). Pure data and maths, no three.js and no React.
 * It stands just inside the gate, off the road to the keep, and faces the spawn point. It is
 * furniture: press E at it and the "Where to?" menu opens (the same menu the G key and the
 * toolbar button open). It carries no fact.
 */
import { yawToward } from "./npcs";
import { SPAWN } from "./layout";

export const SIGN = { x: 7, z: 38 } as const;
export const SIGN_FACING = yawToward(SIGN, SPAWN);

export const SIGN_RANGE = 3.8;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const SIGN_LEAVE_RANGE = 5.2;

export function nearSign(pos: { x: number; z: number }, range: number = SIGN_RANGE): boolean {
  return Math.hypot(SIGN.x - pos.x, SIGN.z - pos.z) <= range;
}
