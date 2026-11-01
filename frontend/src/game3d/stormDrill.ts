/**
 * Quest 3, Storm Drill (2026-11-01). Pure data and maths, no three.js and no React.
 * The drill post stands at the edge of the old siege-simulator ground. Press E there to start a drill:
 * pick a market fall and write what you would do before it happens. The note goes to its own table
 * (never the journal), and nothing reads it to act. Quest state is worked out fresh from the stored
 * drills every render; nothing about "I just did it" is kept in the browser.
 */
import type { StormDrillInput, StormDrills } from "../lib/types";
import { yawToward } from "./npcs";

export const DRILL_POST = { x: -24.2, z: 12.5 } as const;
/** The post faces the middle of the courtyard, like the desk. */
export const DRILL_POST_FACING = yawToward(DRILL_POST, { x: 0, z: 0 });

export const DRILL_RANGE = 4.2;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const DRILL_LEAVE_RANGE = 5.6;

export function nearDrillPost(pos: { x: number; z: number }, range: number = DRILL_RANGE): boolean {
  return Math.hypot(DRILL_POST.x - pos.x, DRILL_POST.z - pos.z) <= range;
}

/** Slider bounds as fractions. The server holds the real range (siege scenarios) and refuses anything outside it. */
export const FALL_MIN = 0.05;
export const FALL_MAX = 0.6;
export const FALL_STEP = 0.05;
export const FALL_DEFAULT = 0.3;

export function clampFall(v: number): number {
  if (!Number.isFinite(v)) return FALL_DEFAULT;
  const stepped = Math.round(v / FALL_STEP) * FALL_STEP;
  return Math.min(FALL_MAX, Math.max(FALL_MIN, Math.round(stepped * 100) / 100));
}

export function fallPercent(fall: number): string {
  return `${Math.round(fall * 100)}%`;
}

export interface DrillDraft {
  fall: number;
  plan: string;
}

export function drillReady(d: DrillDraft): boolean {
  return d.plan.trim().length > 0 && d.fall >= FALL_MIN && d.fall <= FALL_MAX;
}

export function drillInput(d: DrillDraft): StormDrillInput {
  return { market_drop: clampFall(d.fall).toFixed(2), plan: d.plan.trim() };
}

export type DrillQuestState =
  | { status: "loading" | "unreadable" | "sample" | "open"; count: 0; latestFall: null }
  | { status: "done"; count: number; latestFall: number | null };

/** loading until the first read, unreadable if it failed, sample for the demo fortress, open with none, done with one or more. */
export function stormDrillQuest(drills: StormDrills | null, failed: boolean): DrillQuestState {
  if (failed) return { status: "unreadable", count: 0, latestFall: null };
  if (drills === null) return { status: "loading", count: 0, latestFall: null };
  if (drills.demo) return { status: "sample", count: 0, latestFall: null };
  if (drills.drills.length === 0) return { status: "open", count: 0, latestFall: null };
  const newest = Number(drills.drills[0].market_drop);
  return { status: "done", count: drills.drills.length, latestFall: Number.isFinite(newest) ? newest : null };
}

export type DrillBlock = "sample" | "unreadable" | "loading";

/** Why a drill cannot be saved right now; null when it can. */
export function drillBlock(state: DrillQuestState): DrillBlock | null {
  if (state.status === "sample" || state.status === "unreadable" || state.status === "loading") return state.status;
  return null;
}
