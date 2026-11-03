/**
 * The stream round the centre (S26 PR 1). Pure data, no three.js and no React. It follows the MOAT TIER ALONE, and every
 * dressing draws it the same way, so the moat has one language across all lands.
 *
 *   wide -> broad water band     narrow -> thin water band     none -> dry stony bed, no water
 *   unsurveyed (or none read) -> mist band with a "?"          not_applicable -> no band
 *
 * Tiers differ by width AND by kind (water, stone, mist), never by colour alone, and no tint is red or green.
 */
import type { FortressMoat } from "../lib/types";
import { LAND_TOWER } from "./holdingLand";

export type StreamLook = "wide" | "narrow" | "none" | "mist" | "absent";

export interface LandStream {
  look: StreamLook;
  /** Band width in world units; 0 for no band. */
  width: number;
  /** Real water. Only wide and narrow. */
  water: boolean;
  /** A dry stony bed (the "none" tier). */
  bed: boolean;
  /** Mist: not surveyed. Never clear water. */
  mist: boolean;
  /** The mark drawn on the band: "?" for mist, otherwise none. */
  mark: string | null;
  /** The flat tint (no red or green). */
  tint: string;
}

/** The band starts this far from the centre, like the tower's moat gap; its widest reach is `LAND_TOWER_REACH`. */
export const STREAM_INNER = LAND_TOWER.radius + LAND_TOWER.moatGap;

export const STREAM_TINT = { water: "#4f7a95", bed: "#9a9488", mist: "#dfe5ea" } as const;

const STREAMS: Record<StreamLook, LandStream> = {
  wide: { look: "wide", width: LAND_TOWER.moatWide, water: true, bed: false, mist: false, mark: null, tint: STREAM_TINT.water },
  narrow: { look: "narrow", width: LAND_TOWER.moatNarrow, water: true, bed: false, mist: false, mark: null, tint: STREAM_TINT.water },
  none: { look: "none", width: LAND_TOWER.moatNarrow, water: false, bed: true, mist: false, mark: null, tint: STREAM_TINT.bed },
  mist: { look: "mist", width: LAND_TOWER.moatNarrow, water: false, bed: false, mist: true, mark: "?", tint: STREAM_TINT.mist },
  absent: { look: "absent", width: 0, water: false, bed: false, mist: false, mark: null, tint: STREAM_TINT.mist },
};

/** The stream for a moat tier, and nothing else. A moat that has not been read is mist, never clear water. */
export function landStream(moat: FortressMoat | null | undefined): LandStream {
  if (moat === "wide" || moat === "narrow" || moat === "none") return STREAMS[moat];
  if (moat === "not_applicable") return STREAMS.absent;
  return STREAMS.mist;
}

export const ALL_STREAMS: readonly LandStream[] = Object.values(STREAMS);
