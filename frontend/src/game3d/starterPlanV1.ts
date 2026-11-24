/**
 * The starter level's rules (version 1, 2026-11-22; #477, build step 1 is #493). Pure: no three.js, no React, no network.
 * Spec: `docs/game/game3d-starter-level-spec-2026-11-22.md` sections 3, 4 and 7.
 *
 * What it holds: the beats in order, what each pick does, and the one thing the starter keeps, in this browser only, under
 * `aladdin.game3d.starter.v1`: the run (which beat, what was picked), the Book's pages, and the finished and skipped
 * flags. Nothing about the practice ever goes to the server, and no other key is touched. A damaged or missing value reads
 * as a fresh start; blocked storage just means nothing is remembered. A change to a rule here is a new version file.
 *
 * Build step 1 plays beats 1 and 2 (arrive, pick); the later beats are named so the saved shape does not change when they
 * are built.
 */

export const STARTER_KEY = "aladdin.game3d.starter.v1";

/** The beats, in order. `walls` is where build step 1 stops: the tower stands in fog and the goal strip points on. */
export const BEATS = ["arrive", "pick", "walls", "moat", "price", "storm", "why", "end"] as const;
export type Beat = (typeof BEATS)[number];

/** The Book of Wisdom's pages, one per idea checked in practice (section 4). None unlocks in build step 1. */
export const PAGES = ["walls", "moat", "room", "storms", "why"] as const;
export type PageId = (typeof PAGES)[number];

export interface StarterRun {
  beat: Beat;
  /** What the player picked. Beat 2 has one company. */
  picks: { company?: "pip" };
}

export interface StarterSaved {
  /** Set by the newcomer gate (build step 5); absent until then. */
  status?: "new" | "veteran";
  pages: PageId[];
  finished: boolean;
  skipped: boolean;
  run: StarterRun;
}

export const FRESH_RUN: StarterRun = { beat: "arrive", picks: {} };

export function emptyStarter(): StarterSaved {
  return { pages: [], finished: false, skipped: false, run: { ...FRESH_RUN, picks: {} } };
}

const isBeat = (v: unknown): v is Beat => typeof v === "string" && (BEATS as readonly string[]).includes(v);
const isPage = (v: unknown): v is PageId => typeof v === "string" && (PAGES as readonly string[]).includes(v);

/** Reads a stored value; anything damaged is dropped, so a broken save is a fresh start, never an error. */
export function parseStarter(raw: string | null): StarterSaved {
  if (!raw) return emptyStarter();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyStarter();
  }
  if (!v || typeof v !== "object") return emptyStarter();
  const o = v as Record<string, unknown>;
  const run = (o.run && typeof o.run === "object" ? o.run : {}) as Record<string, unknown>;
  const picks = (run.picks && typeof run.picks === "object" ? run.picks : {}) as Record<string, unknown>;
  const pages = Array.isArray(o.pages) ? [...new Set(o.pages.filter(isPage))] : [];
  const out: StarterSaved = {
    pages,
    finished: o.finished === true,
    skipped: o.skipped === true,
    run: { beat: isBeat(run.beat) ? run.beat : "arrive", picks: picks.company === "pip" ? { company: "pip" } : {} },
  };
  // A run past the pick with nothing picked cannot be drawn honestly: start it again.
  if (out.run.beat !== "arrive" && out.run.beat !== "pick" && out.run.picks.company !== "pip") out.run = { ...FRESH_RUN, picks: {} };
  if (o.status === "new" || o.status === "veteran") out.status = o.status;
  return out;
}

export function loadStarter(storage: Pick<Storage, "getItem"> | null): StarterSaved {
  try {
    return parseStarter(storage?.getItem(STARTER_KEY) ?? null);
  } catch {
    return emptyStarter();
  }
}

/** Writes the one key. Blocked storage is not an error: the starter still plays, it just is not remembered. */
export function saveStarter(storage: Pick<Storage, "setItem"> | null, saved: StarterSaved): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STARTER_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

/** Beat 1 is over: the arrival plate goes and Sal's card opens. Nothing changes once the player is past it. */
export function arrived(s: StarterSaved): StarterSaved {
  return s.run.beat === "arrive" ? { ...s, run: { ...s.run, beat: "pick" } } : s;
}

/** Beat 2: picking Pip's Lemonade raises the tower. Picking again does nothing (no second tower, no farming). */
export function pickCompany(s: StarterSaved): StarterSaved {
  if (s.run.beat !== "arrive" && s.run.beat !== "pick") return s;
  return { ...s, run: { beat: "walls", picks: { ...s.run.picks, company: "pip" } } };
}

/** The tower stands once a company is picked. */
export function towerStands(run: StarterRun): boolean {
  return run.picks.company === "pip";
}

/** Sal's card is the open station while beat 2 waits for the pick. */
export function counterWaiting(run: StarterRun): boolean {
  return run.beat === "arrive" || run.beat === "pick";
}

/** The goal strip's line: build the first tower until it stands, then the next station. */
export function goalOf(run: StarterRun): "build" | "walls" {
  return towerStands(run) ? "walls" : "build";
}

/** The Plain view's rows that have been looked at: the company and its pieces once the pick is made. */
export function plainSeen(run: StarterRun): { company: boolean; pieces: boolean } {
  const picked = towerStands(run);
  return { company: picked, pieces: picked };
}

/** How long the arrival plate stays before Sal's card opens by itself (no tap: a button that only moves on teaches nothing). */
export const ARRIVAL_MS = 8000;
/** How long each of beat 2's two result lines stays (they show one after the other). */
export const PICKED_LINE_MS = 5500;
