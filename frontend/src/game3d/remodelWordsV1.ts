/**
 * Game voice for the Temperament card's "what changed between the last two looks" counts line (text pass 4h). The flat
 * card says "2 added, 1 removed, 3 resized · about 12% of positions changed"; the 3D Vault says the same numbers in
 * tower words. Every number is copied from the counts the backend sends, nothing is computed. Version 1 (2026-11-09):
 * a change that could be shown for real is a NEW file, never an edit of this one.
 */

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export interface RemodelCounts {
  added: number;
  removed: number;
  resized: number;
  /** Share of positions that changed, as the backend's decimal string; null when the backend has none. */
  turnover_pct: string | number | null;
}

/** "2 towers added, 1 removed, 3 resized · about 12% of the fortress changed" (the share part only when the backend has one). */
export function gameRemodelCounts(o: RemodelCounts): string {
  const base = `${n(o.added, "tower", "towers")} added, ${o.removed} removed, ${o.resized} resized`;
  return o.turnover_pct === null ? base : `${base} · about ${Number(o.turnover_pct).toFixed(0)}% of the fortress changed`;
}

/** Words that must not survive on the game line. Used by the test. */
export const REMODEL_BANNED = [/\bpositions?\b/i, /\bsnapshots?\b/i];
