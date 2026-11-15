/**
 * The Hourglass (#414): turn time back in the courtyard and watch the stored nights replay. Pure data and maths, no
 * three.js and no React.
 *
 * Rules:
 *  - The backend stores one picture of the fortress per night (`GET /game/history`). Only stored days are real. A day
 *    between two stored ones with no picture is a gap: it is shown as a gap, never filled in from its neighbours.
 *  - Today is never in the past: the live fortress is "today", and the timeline ends the day before.
 *  - A past day is drawn by the same `stateToWorld` as today (unknown stays fog). Nothing here decides a fact.
 *  - While you look back nothing can be written: only places that read are open (`OPEN_IN_THE_PAST`).
 */
import { yawToward } from "./npcs";
import { SPAWN } from "./layout";

/** Inside the gate, in the open ground in the west of the yard, clear of the camp and the siege gate; a placement test keeps it clear of everything else. */
export const HOURGLASS = { x: -29, z: 34 } as const;
export const HOURGLASS_FACING = yawToward(HOURGLASS, SPAWN);
export const HOURGLASS_RANGE = 3.4;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const HOURGLASS_LEAVE_RANGE = 4.8;
/** Half the footprint of the stand you walk round. */
export const HOURGLASS_SOLID = 0.7;

/** How long the replay rests on each day. */
export const PLAY_STEP_MS = 1400;

export interface TimelineDay {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  /** True when a frame was stored for it. False is a gap. */
  stored: boolean;
}

/** Today as a UTC day (the backend's own day). */
export function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Every calendar day from the first stored day up to the day before `today`, oldest first, each marked stored or a gap.
 * Days from today on are left out (today is the live fortress). Empty when nothing before today was stored.
 */
export function buildTimeline(stored: readonly string[], today: string): TimelineDay[] {
  const have = new Set(stored.filter((d) => d < today));
  if (have.size === 0) return [];
  const first = [...have].sort()[0];
  const out: TimelineDay[] = [];
  for (let d = first; d < today; d = addDays(d, 1)) out.push({ day: d, stored: have.has(d) });
  return out;
}

/**
 * One step along the timeline. `from` null is today (the live fortress). Earlier from today lands on the newest day;
 * later from the newest day returns to today (null). Stepping past the oldest day stays on it.
 */
export function stepDay(timeline: readonly TimelineDay[], from: string | null, dir: -1 | 1): string | null {
  if (timeline.length === 0) return null;
  if (from === null) return dir < 0 ? timeline[timeline.length - 1].day : null;
  const i = timeline.findIndex((t) => t.day === from);
  if (i < 0) return null;
  const next = i + dir;
  if (next < 0) return from;
  if (next >= timeline.length) return null;
  return timeline[next].day;
}

/** The replay: from the day you are on to the next one; at the newest day it stops (never loops, never leaves the past by itself). */
export function playNext(timeline: readonly TimelineDay[], from: string | null): string | null {
  if (from === null) return timeline.length > 0 ? timeline[0].day : null;
  const i = timeline.findIndex((t) => t.day === from);
  if (i < 0 || i >= timeline.length - 1) return null;
  return timeline[i + 1].day;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Tue 3 Nov 2026": the date that is always on screen while you look back. */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The places that still work while you look back: they only read, and they read the day you are looking at. */
export const OPEN_IN_THE_PAST = ["hourglass", "realm"] as const;

export function openInThePast(kind: string): boolean {
  return (OPEN_IN_THE_PAST as readonly string[]).includes(kind);
}
