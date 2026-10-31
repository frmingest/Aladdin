/**
 * Standing (game3d, sprint "Standing", S1): a level from 0 to 3 worked out fresh from
 * real facts every time the courtyard opens. Pure maths, no React, no three.js.
 *
 * Rules that never bend (docs/game/game3d-standing-sprint-plan-2026-10-31.md):
 *  - Nothing is stored. No XP, no streaks, no points. The level can go DOWN when a fact
 *    stops being true.
 *  - Sample data never lifts a real level. Unknown (not loaded, unreadable) never counts.
 *  - Level N needs levels 1 to N-1 to hold.
 *  - No buy or sell words.
 *
 *  1 Bare Ground  at least one real holding stands
 *  2 The Survey   every tower is surveyed, or carries a named gap (standingGapsV1)
 *  3 Reasons      every holding has a written thesis and an invalidation line
 *
 * Honest limit: the game cannot tell whether a journal entry was backdated.
 */
import type { JournalEntry } from "../lib/types";
import { nameList } from "./quest";
import type { TowerView, WorldModel } from "./stateToWorld";
import { STANDING_GAPS_V1 } from "./standingGapsV1";

export type Level = 0 | 1 | 2 | 3;

export const LEVEL_NAMES: Record<Level, string> = {
  0: "Nothing stands",
  1: "Bare Ground",
  2: "The Survey",
  3: "Reasons",
};

export interface Standing {
  level: Level;
  name: string;
  /** The data is sample: the level is pinned at 0 and the chip says so. */
  sample: boolean;
  /** Which fact could not be read, so the next rung cannot be checked (never guessed). */
  unknown: "state" | "journal" | null;
  /** Holdings that hold the next level back, biggest first. Empty at level 3 or when unknown. */
  blockers: string[];
}

export function isNamedGap(t: Pick<TowerView, "ticker">): boolean {
  const ticker = t.ticker.trim().toUpperCase();
  return STANDING_GAPS_V1.some((g) => g.ticker.toUpperCase() === ticker);
}

/** Surveyed means not fog (wall and size both known), or a named gap. */
function unsurveyed(world: WorldModel): TowerView[] {
  return world.plain.filter((t) => t.fog && !isNamedGap(t));
}

/** Holdings with no single journal entry that has both a thesis and an invalidation line. */
function withoutReasons(world: WorldModel, entries: readonly JournalEntry[]): TowerView[] {
  const complete = new Set<string>();
  for (const e of entries) {
    if (e.holding_id && e.thesis.trim().length > 0 && (e.invalidation ?? "").trim().length > 0) {
      complete.add(e.holding_id);
    }
  }
  return world.plain.filter((t) => !complete.has(t.holdingId));
}

function at(level: Level, rest: Partial<Omit<Standing, "level" | "name">> = {}): Standing {
  return { level, name: LEVEL_NAMES[level], sample: false, unknown: null, blockers: [], ...rest };
}

/**
 * @param world   the courtyard model; null while the fortress state is loading or failed
 * @param entries journal entries; null while loading
 * @param journalFailed the journal could not be read
 */
export function standing(
  world: WorldModel | null,
  entries: readonly JournalEntry[] | null,
  journalFailed: boolean,
): Standing {
  if (world === null) return at(0, { unknown: "state" });
  if (world.demo) return at(0, { sample: true });
  if (world.plain.length === 0) return at(0);

  // Level 1 holds: a real holding stands. Level 2 needs every tower surveyed or named.
  const fog = unsurveyed(world);
  if (fog.length > 0) return at(1, { blockers: fog.map((t) => t.name) });

  // Level 2 holds. Level 3 needs the journal, and an unread journal is unknown, never "fine".
  if (journalFailed || entries === null) return at(2, { unknown: "journal" });
  const bare = withoutReasons(world, entries);
  if (bare.length > 0) return at(2, { blockers: bare.map((t) => t.name) });

  return at(3);
}

/** The chip, in words: five words or fewer. */
export function chipWords(s: Standing): string {
  if (s.unknown === "state") return "Standing unknown";
  if (s.sample) return "Sample data, no standing";
  return `Standing ${s.level} · ${s.name}`;
}

/** One short line saying what lifts the next level. Plain words, no buy or sell. */
export function hintWords(s: Standing): string {
  if (s.unknown === "state") return "The fortress is not read yet, so nothing is guessed.";
  if (s.sample) return "Sample towers never count. Your own holdings do.";
  if (s.level === 0) return "Import a holding to raise your first tower.";
  if (s.level === 1) return `Next: survey ${nameList(s.blockers)}.`;
  if (s.level === 2) {
    if (s.unknown === "journal") return "Your journal is not read yet, so level 3 can't be checked.";
    return `Next: write why, and what proves you wrong, for ${nameList(s.blockers)}.`;
  }
  return "All three torches lit. One missing reason puts one out.";
}
