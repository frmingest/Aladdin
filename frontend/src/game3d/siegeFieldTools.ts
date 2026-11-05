/**
 * The Siege Field tools (asset plan A8, 2026-11-05). Pure data and maths, no three.js and no React.
 *
 * The fall winch, the Storm-line and Siege-line marker stones and the two yardstick banners (the S28 parts the
 * first Siege Field left out). They only STEER the same what-if the flat Siege Simulator runs: the fall and the
 * yardstick. Every number still comes from the backend through the siege yard; nothing here computes a result.
 *
 * Rules kept: the tools are a fixed set (they never multiply or grow with a holding or a verdict); a line the fall
 * range never reaches stays "out of reach" and E does nothing (unknown stays unknown); the active choice reads from
 * shape (a raised weight, a standing banner, a pennant), never from colour.
 */
import { BENCHMARK_SHORT } from "../lib/siege";
import type { SiegeBenchmarkKey } from "../lib/types";
import { FALL_DEFAULT, FALL_MAX, FALL_MIN, FALL_STEP, fallPercent } from "./stormDrill";
import { FIELD_BANNERS, FIELD_WALL_Z } from "./siegeField";
import { FIELD_TOOLS_WORDS as W } from "./siegeFieldToolsWordsV1";

export type FieldSpotId = "winch" | "storm" | "siege" | "local" | "global";

export interface FieldSpot {
  id: FieldSpotId;
  /** Where you stand to use it. */
  x: number;
  z: number;
  range: number;
  leaveRange: number;
}

/** In front of the skeleton ranks and behind the road back: a winch in the middle and a stone on each side. */
export const WINCH = { x: 0, z: 17 } as const;
export const STORM_STONE = { x: -6.5, z: 22 } as const;
export const SIEGE_STONE = { x: 6.5, z: 22 } as const;
/** You use a banner from the grass in front of it. */
const BANNER_STAND_OFF = 3.4;

const bannerX = (key: "west" | "east"): number => FIELD_BANNERS.find((b) => b.id === `field-banner-${key}`)?.x ?? 0;

export const FIELD_SPOTS: readonly FieldSpot[] = [
  { id: "winch", ...WINCH, range: 2.8, leaveRange: 3.8 },
  { id: "storm", ...STORM_STONE, range: 2.6, leaveRange: 3.6 },
  { id: "siege", ...SIEGE_STONE, range: 2.6, leaveRange: 3.6 },
  // West banner is the home yardstick (Oslo Børs), east the world one.
  { id: "local", x: bannerX("west"), z: FIELD_WALL_Z + BANNER_STAND_OFF, range: 2.8, leaveRange: 3.8 },
  { id: "global", x: bannerX("east"), z: FIELD_WALL_Z + BANNER_STAND_OFF, range: 2.8, leaveRange: 3.8 },
];

/** The banner each yardstick is flown on. */
export const BANNER_FOR: Readonly<Record<SiegeBenchmarkKey, "field-banner-west" | "field-banner-east">> = {
  local: "field-banner-west",
  global: "field-banner-east",
};

/**
 * Which tool you stand at, nearest first. Once at one, stay at it until you walk past its leave range, so the prompt
 * does not flicker at the edge (same rule as every other post in the game).
 */
export function fieldSpotAt(pos: { x: number; z: number }, current: FieldSpotId | null): FieldSpotId | null {
  let best: { id: FieldSpotId; d: number } | null = null;
  for (const s of FIELD_SPOTS) {
    const d = Math.hypot(s.x - pos.x, s.z - pos.z);
    const range = s.id === current ? s.leaveRange : s.range;
    if (d <= range && (best === null || d < best.d)) best = { id: s.id, d };
  }
  return best ? best.id : null;
}

/** What the tools know: the fall being drawn, the yardstick, and the two preset falls the backend answered with. */
export interface FieldTools {
  fall: number;
  benchmark: SiegeBenchmarkKey;
  /** The whole-percent fall that reaches each line, or null when never reached in range (or not read yet). */
  toStorm: number | null;
  toSiege: number | null;
  min: number;
  max: number;
}

export const DEFAULT_TOOLS = (benchmark: SiegeBenchmarkKey): FieldTools => ({
  fall: FALL_DEFAULT,
  benchmark,
  toStorm: null,
  toSiege: null,
  min: FALL_MIN,
  max: FALL_MAX,
});

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** One turn of the winch: up a step, and round to the bottom after the top. */
export function winchTurn(fall: number, min: number, max: number): number {
  const next = round2(fall + FALL_STEP);
  return next > max + 1e-9 ? round2(min) : next;
}

/** The weight on the winch rope: 0 at the lowest fall, 1 at the highest. Mirrors the fall; never the other way. */
export function winchPosition(fall: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.min(1, Math.max(0, (fall - min) / (max - min)));
}

/** The tools after E at a spot, or null when E does nothing there (a line never reached, or already chosen). */
export function applySpot(id: FieldSpotId, t: FieldTools): FieldTools | null {
  switch (id) {
    case "winch":
      return { ...t, fall: winchTurn(t.fall, t.min, t.max) };
    case "storm":
      return t.toStorm === null || t.toStorm === t.fall ? null : { ...t, fall: t.toStorm };
    case "siege":
      return t.toSiege === null || t.toSiege === t.fall ? null : { ...t, fall: t.toSiege };
    case "local":
    case "global":
      return t.benchmark === id ? null : { ...t, benchmark: id };
  }
}

/** The flat page's own short name for a yardstick ("Oslo" / "World"). */
export function yardstickName(key: SiegeBenchmarkKey): string {
  return BENCHMARK_SHORT[key];
}

/** The plate over a marker stone. */
export function stonePlate(id: "storm" | "siege", t: FieldTools): string {
  const name = id === "storm" ? W.stormName : W.siegeName;
  const fall = id === "storm" ? t.toStorm : t.toSiege;
  return fall === null ? W.stoneNever(name) : W.stonePlate(name, fallPercent(fall));
}

/** E's answer at a spot, or null when E does nothing there (so the prompt never promises what E will not do). */
export function spotPrompt(id: FieldSpotId, t: FieldTools): string | null {
  if (applySpot(id, t) === null) return null;
  switch (id) {
    case "winch":
      return W.winchPrompt(fallPercent(t.fall));
    case "storm":
      return W.stonePrompt(W.stormName, fallPercent(t.toStorm ?? t.fall));
    case "siege":
      return W.stonePrompt(W.siegeName, fallPercent(t.toSiege ?? t.fall));
    case "local":
    case "global":
      return W.bannerPrompt(yardstickName(id));
  }
}
