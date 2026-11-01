/**
 * Stepping into a stall (3D sprint S14, step M3). Pure data and maths, no three.js and no React.
 * Press E at a stall and that company's store opens in the world panel. It is the flat store page itself
 * (`/fortress/marketplace/:holdingId`, framed with `?embed=world`), so the Name your price box and every
 * number come from the same code as the flat route. Nothing is copied here.
 */
import { REGISTER } from "./parity3d";
import type { Door } from "./parity3d";
import type { Stall } from "./streetPlan";

export const STALL_RANGE = 3.4;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const STALL_LEAVE_RANGE = 4.6;

const STORE_ROUTE = "/fortress/marketplace/:holdingId";

/** The stall you can reach: the nearest one inside `range`, or null. Ties go to the earlier stall (street order). */
export function nearestStall(
  pos: { x: number; z: number },
  stalls: readonly Pick<Stall, "holdingId" | "x" | "z">[],
  range: number = STALL_RANGE,
): string | null {
  let best: string | null = null;
  let bestD = range;
  for (const s of stalls) {
    const d = Math.hypot(s.x - pos.x, s.z - pos.z);
    if (d <= bestD) {
      best = s.holdingId;
      bestD = d;
    }
  }
  return best;
}

/** The door for one company's store: the register row for the store page, opened at this company. Null if the row is gone. */
export function storeDoor(holdingId: string, register: readonly Door[] = REGISTER): Door | null {
  const row = register.find((d) => d.route === STORE_ROUTE);
  if (!row) return null;
  return { ...row, title: "The store", open: `/fortress/marketplace/${encodeURIComponent(holdingId)}` };
}

export const stallPrompt = (name: string): string => `Press E to step into ${name}'s store`;
