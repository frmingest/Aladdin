/**
 * The two stands at the head of Market Street (3D sprint S14, step M4). Pure data and maths, no three.js and no React.
 *
 * Sal the Sales Rep (add a stock by its ticker) and the Hype Booth (test a tip against the eight gates) are two
 * dialogs on the flat Marketplace page. In 3D each gets a stand you walk up to; press E and the SAME dialog opens
 * over the world. Nothing is copied: the dialogs, their words and their one write each (add to the watchlist) are
 * the flat page's own components. A stand carries no fact, only a sign.
 */
import { yawToward } from "./npcs";

export type BoothId = "sal" | "hype";

export interface Booth {
  id: BoothId;
  x: number;
  z: number;
  /** Faces the middle of the courtyard, like the stalls. */
  yaw: number;
  /** The word on the sign over the counter (short; the dialog has the real words). */
  sign: string;
  prompt: string;
  /** Roof cloth. Never red or green. */
  cloth: string;
}

/** Reach, and a wider reach to leave, so standing on the edge does not flicker. */
export const BOOTH_RANGE = 3.0;
export const BOOTH_LEAVE_RANGE = 4.2;

/** Half the footprint of a stand you walk round. */
export const BOOTH_SOLID = { hx: 1.2, hz: 0.9 } as const;

const MIDDLE = { x: 0, z: 0 } as const;

/** Where the stands go: the near end of the street, clear of every stall plot, prop, person and tower (test). */
const AT: Record<BoothId, { x: number; z: number }> = {
  sal: { x: 14.5, z: 34.5 },
  hype: { x: 19, z: 29 },
};

export const BOOTHS: readonly Booth[] = [
  { id: "sal", ...AT.sal, yaw: yawToward(AT.sal, MIDDLE), sign: "Sal's counter", prompt: "Press E to talk to Sal: open a new stall", cloth: "#0ca5b0" },
  { id: "hype", ...AT.hype, yaw: yawToward(AT.hype, MIDDLE), sign: "Hype Booth", prompt: "Press E to test a tip at the Hype Booth", cloth: "#e6b93a" },
];

/** The stand you can reach: the nearest one inside `range`, or null. Ties go to the earlier stand. */
export function nearestBooth(
  pos: { x: number; z: number },
  booths: readonly Pick<Booth, "id" | "x" | "z">[] = BOOTHS,
  range: number = BOOTH_RANGE,
): BoothId | null {
  let best: BoothId | null = null;
  let bestD = range;
  for (const b of booths) {
    const d = Math.hypot(b.x - pos.x, b.z - pos.z);
    if (d <= bestD) {
      best = b.id;
      bestD = d;
    }
  }
  return best;
}

/** The prompt for one stand, or null if the id is unknown. */
export function boothPrompt(id: BoothId | null): string | null {
  return BOOTHS.find((b) => b.id === id)?.prompt ?? null;
}
