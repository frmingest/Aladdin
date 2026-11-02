/**
 * The Great Keep banner (3D sprint S16, PR 3). Pure data and maths, no three.js and no React.
 *
 * The flat Fortress ends in one verdict on the whole fortress (`summarizeRealm`, rules `realm-v1`). In 3D it becomes a
 * banner pole on the cobbles in front of the keep door. Press E and the flat RealmVerdict card opens in a world panel.
 * The banner shows only the level the flat rules already decided (never recomputed here): a printed word, a mark and a
 * pennant colour, so colour is never the only signal. Nothing here says buy or sell.
 */
import { REALM_LEVEL_LABEL } from "../lib/realmVerdict";
import type { RealmLevel } from "../lib/realmVerdict";
import { yawToward } from "./npcs";
import { REALM_UNREAD } from "./realmWordsV1";

/** In front of the keep door, between the writing desk (x = -5.5) and the Vault chest (x = 6); a test keeps it clear of every reach. */
export const REALM_BANNER = { x: 0, z: -24 } as const;
export const REALM_FACING = yawToward(REALM_BANNER, { x: 0, z: 0 });
export const REALM_RANGE = 3.6;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const REALM_LEAVE_RANGE = 5;
/** Half the footprint of the pole you walk round. */
export const REALM_SOLID = 0.35;

export interface RealmBannerLook {
  /** The printed word on the plate. */
  word: string;
  /** Printed with the word, the same marks the flat card uses: ● no flag, ▲ watch, ■ needs a look, ? unknown. */
  mark: "●" | "▲" | "■" | "?";
  /** Pennant colour: never red or green. */
  cloth: string;
}

const LOOKS: Record<RealmLevel, RealmBannerLook> = {
  sound: { word: REALM_LEVEL_LABEL.sound, mark: "●", cloth: "#0ca5b0" },
  mixed: { word: REALM_LEVEL_LABEL.mixed, mark: "▲", cloth: "#eee4d3" },
  attention: { word: REALM_LEVEL_LABEL.attention, mark: "■", cloth: "#26253B" },
  unknown: { word: REALM_LEVEL_LABEL.unknown, mark: "?", cloth: "#6b6e8a" },
};

/** What the banner says. A verdict that could not be read is "Not read yet" with a "?", never a good-looking flag. */
export function realmLook(level: RealmLevel | null | undefined): RealmBannerLook {
  if (level === null || level === undefined) return { word: REALM_UNREAD, mark: "?", cloth: LOOKS.unknown.cloth };
  return LOOKS[level] ?? LOOKS.unknown;
}

export function nearRealm(pos: { x: number; z: number }, range: number = REALM_RANGE): boolean {
  return Math.hypot(REALM_BANNER.x - pos.x, REALM_BANNER.z - pos.z) <= range;
}
