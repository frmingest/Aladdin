import { COUNCIL_LABEL } from "./rituals";
import type { Council, CouncilKind } from "./types";

/** The Council chamber (game mode, page-scene kit): one chair per agenda kind, in the fixed order the
 * backend uses. Pure mapping, unit-tested. An empty chair means "nothing found by this rule", never
 * "all is well": it is drawn neutral, with no candle, no tick and no count, and an empty agenda earns
 * no celebration (no rewards, no "x of 8"). */

export const COUNCIL_KINDS: CouncilKind[] = [
  "tripwire",
  "thesis_review",
  "review_due",
  "weak_walls",
  "no_moat",
  "stale_analysis",
  "outside_circle",
  "cash",
];

/** At most this many papers are drawn in a stack; the real number is printed beside it. */
export const MAX_PAPERS = 5;

export interface Seat {
  kind: CouncilKind;
  label: string;
  occupied: boolean;
  tone: "warning" | "note" | null;
  /** Real number of holdings the item names plus those it did not name; null when the item names none. */
  count: number | null;
  /** Papers drawn in the stack (0 when empty). */
  papers: number;
  /** Where the seat sits, percent of the chamber box. */
  leftPct: number;
  topPct: number;
}

/** Eight (or n) positions around an ellipse, starting just left of the top and going clockwise. */
export function seatPositions(n: number): { leftPct: number; topPct: number }[] {
  const out: { leftPct: number; topPct: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((-90 + (360 / n) * (i - 0.5)) * Math.PI) / 180;
    out.push({
      leftPct: Math.round((50 + 40 * Math.cos(a)) * 10) / 10,
      topPct: Math.round((54 + 34 * Math.sin(a)) * 10) / 10,
    });
  }
  return out;
}

export function councilSeats(council: Pick<Council, "items">): Seat[] {
  const pos = seatPositions(COUNCIL_KINDS.length);
  return COUNCIL_KINDS.map((kind, i) => {
    const item = council.items.find((it) => it.kind === kind);
    const named = item ? item.holdings.length + item.more : 0;
    return {
      kind,
      label: COUNCIL_LABEL[kind],
      occupied: item !== undefined,
      tone: item ? item.tone : null,
      count: item && named > 0 ? named : null,
      papers: item ? Math.min(MAX_PAPERS, Math.max(1, named)) : 0,
      ...pos[i],
    };
  });
}

/** Accessible name of a seat. */
export function seatLabel(s: Seat): string {
  if (!s.occupied) return `${s.label}: nothing found`;
  const what = s.count === null ? "on the agenda" : `${s.count} ${s.count === 1 ? "holding" : "holdings"}`;
  return `${s.label}: ${what}. Press to jump to the item`;
}
