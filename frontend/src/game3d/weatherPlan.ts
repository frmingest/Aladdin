/**
 * The weather over the courtyard (3D sprint S16, PR 3). Pure data and maths, no three.js and no React.
 *
 * The flat Fortress draws the backend's siege level as a sky: calm, storm clouds gathering, under siege, or "weather not
 * surveyed" (a mist). In 3D the same level tints the sky and fog and raises a few painted clouds. It carries ONE fact,
 * the level the backend already decided, and never works one out. Rules that stay in force:
 *  - **Flat neutral lighting stays.** Only the sky and fog colour change, plus flat clouds. No light on a tower ever
 *    changes with the weather.
 *  - **Calm skies look exactly as the courtyard always did** (the same sky colour), the same as the flat page's calm.
 *  - **Unknown stays fog**: an unreadable or unsurveyed level is a pale mist, never calm.
 *  - Never red or green; the sky is grey-blue. The plate on the Realm post says the same thing in words.
 *  - Nothing moves, so reduced motion needs nothing.
 */
import { siegeSky } from "../lib/fortress";
import type { FortressSiegeLevel } from "../lib/types";

/** The sky the courtyard has always had. Calm weather keeps it. */
export const SKY_CALM = "#cfe3f1";

export interface WeatherLook {
  /** Sky and fog colour. This is the horizon colour of the gradient dome, so the fog melts into it. */
  sky: string;
  /** Colour straight overhead. Equal to `sky` for the mist: unknown stays a flat fog, never a pretty sky. */
  skyTop: string;
  fogNear: number;
  fogFar: number;
  /** How many painted clouds hang over the walls (0 to MAX_CLOUDS). */
  clouds: number;
  /** Colour of those clouds. */
  cloudColor: string;
  /** True when the level is not known: the mist is drawn instead of a sky. */
  mist: boolean;
}

export const MAX_CLOUDS = 9;

/** Clouds follow the flat sky's own cloud strength (0.75 gathering, 0.95 under siege), so the two never disagree. */
function cloudCount(level: FortressSiegeLevel | null | undefined): number {
  return Math.min(MAX_CLOUDS, Math.ceil(siegeSky(level).clouds * MAX_CLOUDS));
}

export function weatherLook(level: FortressSiegeLevel | null | undefined): WeatherLook {
  const clouds = cloudCount(level);
  switch (level) {
    case "gathering":
      return { sky: "#b7c3cf", skyTop: "#97a6b6", fogNear: 90, fogFar: 215, clouds, cloudColor: "#a9b3bd", mist: false };
    case "besieged":
      return { sky: "#8f9aa8", skyTop: "#707c8c", fogNear: 80, fogFar: 195, clouds, cloudColor: "#737d89", mist: false };
    case "calm":
      return { sky: SKY_CALM, skyTop: "#9cc2de", fogNear: 100, fogFar: 230, clouds: 0, cloudColor: "#ffffff", mist: false };
    default:
      // Not surveyed or unreadable: a pale mist that closes in, never a calm sky.
      return { sky: "#dbe3e8", skyTop: "#dbe3e8", fogNear: 60, fogFar: 150, clouds: 0, cloudColor: "#ffffff", mist: true };
  }
}

/**
 * How far up the gradient a point on the sky dome is: 0 at and below the horizon (the fog colour), 1 straight overhead.
 * `y` is the point's height on the unit sphere (-1 to 1). Eased, so the horizon band stays wide and calm.
 */
export function skyBlend(y: number): number {
  if (!Number.isFinite(y)) return 0;
  const t = Math.max(0, Math.min(1, y / 0.65));
  return t * t * (3 - 2 * t);
}

export interface CloudSlot {
  x: number;
  y: number;
  z: number;
  /** Size of the cloud, fixed by slot, never data. */
  s: number;
}

/** Fixed places, filled in the same order whatever the count, so worse weather adds clouds and never moves one. Round the walls, high up. */
const SLOTS: readonly CloudSlot[] = [
  { x: -34, y: 46, z: -30, s: 1.0 },
  { x: 30, y: 50, z: -38, s: 1.2 },
  { x: -52, y: 44, z: 8, s: 1.1 },
  { x: 48, y: 47, z: 12, s: 0.9 },
  { x: 0, y: 55, z: -52, s: 1.3 },
  { x: -26, y: 49, z: 40, s: 1.0 },
  { x: 28, y: 52, z: 44, s: 1.1 },
  { x: -10, y: 58, z: 6, s: 1.4 },
  { x: 14, y: 56, z: -14, s: 1.2 },
];

export function cloudSlots(count: number): CloudSlot[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.min(MAX_CLOUDS, Math.floor(count))) : 0;
  return SLOTS.slice(0, n);
}
