import type { Chronicle, ChronicleChange, ChronicleFrame, ChronicleSource, ChronicleTower, FortressWall } from "./types";

/**
 * Pure helpers for the Chronicle (game mode G14, Sprint 24). No React, so it is unit-tested.
 * Nothing here decides how strong anything was: every frame arrives from the backend, either a
 * stored nightly frame (real walls, moats, weather) or a positions-only frame rebuilt from an older
 * import (real towers and sizes, walls NOT rebuilt). This file only picks what to show and says it
 * in plain words.
 */

export const SOURCE_LABEL: Record<ChronicleSource, string> = {
  stored: "Stored frame",
  positions_only: "Positions only",
};

export const SOURCE_NOTE: Record<ChronicleSource, string> = {
  stored: "Saved by the nightly worker: the walls, moats and weather are what the Fortress showed that day.",
  positions_only:
    "Rebuilt from a portfolio import. The towers and their sizes are real; the walls, moats and weather of that day were never stored and cannot be rebuilt, so they are drawn as unsurveyed.",
};

/** Fill colours for the miniature towers (same palette family as the Fortress scene). */
export const WALL_FILL: Record<FortressWall, string> = {
  basalt: "#4b4f57",
  granite: "#9097a1",
  brick: "#a9553a",
  timber: "#8d6436",
  rotted: "#4f3e29",
  unsurveyed: "#3a4352",
  not_applicable: "#7b828d",
};

export function frameTitle(frame: ChronicleFrame): string {
  const d = new Date(`${frame.day}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? frame.day
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** The changes that arrived with this frame (the diff from the frame before it). */
export function changesOn(chronicle: Chronicle, day: string): ChronicleChange[] {
  return chronicle.changes.filter((c) => c.day === day);
}

/** Index to open on: the newest frame. -1 when there are none. */
export function newestIndex(chronicle: Chronicle): number {
  return chronicle.frames.length - 1;
}

export function clampIndex(i: number, length: number): number {
  if (length <= 0) return -1;
  if (!Number.isFinite(i)) return length - 1;
  return Math.max(0, Math.min(length - 1, Math.round(i)));
}

/** Next frame while playing: stops at the newest instead of wrapping, so a replay has an end. */
export function nextPlayIndex(i: number, length: number): { index: number; done: boolean } {
  if (length <= 0) return { index: -1, done: true };
  const next = Math.min(i + 1, length - 1);
  return { index: next, done: next >= length - 1 };
}

export interface MiniTower {
  tower: ChronicleTower;
  x: number;
  w: number;
  h: number;
  ghost: boolean;
}

const MIN_W = 22;
const MAX_W = 84;
const GAP = 8;

/** Towers in one row, biggest first, width following the weight (a stand-in of 36 for an unknown
 * weight). Ghosts are the towers of a positions-only frame: the wall is not known. */
export function miniLayout(frame: ChronicleFrame, width = 760): MiniTower[] {
  const sorted = [...frame.towers].sort((a, b) => Number(b.weight_pct ?? -1) - Number(a.weight_pct ?? -1));
  const ghost = frame.source === "positions_only";
  const sized = sorted.map((tower) => {
    const weight = tower.weight_pct === null ? null : Number(tower.weight_pct);
    const w = weight === null || !Number.isFinite(weight) ? 36 : Math.max(MIN_W, Math.min(MAX_W, MIN_W + weight * 1.4));
    return { tower, w, h: Math.round(w * 1.35) };
  });
  const total = sized.reduce((sum, t) => sum + t.w + GAP, 0);
  const scale = total > width ? width / total : 1;
  let x = 0;
  return sized.map((t) => {
    const w = Math.max(10, Math.floor(t.w * scale));
    const placed = { tower: t.tower, x, w, h: Math.round(t.h * scale), ghost };
    x += w + Math.floor(GAP * scale);
    return placed;
  });
}

export function describeFrame(frame: ChronicleFrame): string {
  const n = frame.towers.length;
  const weather = frame.source === "stored" ? `Weather ${frame.weather}.` : "Weather not recorded.";
  return `${frameTitle(frame)}: ${n} ${n === 1 ? "tower" : "towers"}. ${weather}`;
}

export function headline(chronicle: Chronicle): string {
  if (chronicle.frames.length === 0) return "Nothing to replay yet.";
  const first = chronicle.frames[0];
  const last = chronicle.frames[chronicle.frames.length - 1];
  return `${chronicle.frames.length} frames from ${frameTitle(first)} to ${frameTitle(last)}: ${chronicle.stored_frames} stored, ${chronicle.positions_only_frames} rebuilt from imports.`;
}

/** Everything the record cannot show, in reading order: days the worker stored nothing (never read
 * as calm), then the standing notes. Older payloads have no gaps. */
export function recordLimits(chronicle: Chronicle): string[] {
  return [...(chronicle.gaps ?? []).map((g) => g.text), ...chronicle.notes];
}
