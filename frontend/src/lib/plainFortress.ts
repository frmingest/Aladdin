import type { GameTower } from "./types";
import {
  EXPOSURE_SHORT,
  FRESHNESS_LABEL,
  LAND_SHORT,
  MOAT_LABEL,
  SIZE_LABEL,
  STRUCTURE_LABEL,
  THESIS_SHORT,
  WALL_LABEL,
  formatShock,
  needsAttention,
} from "./fortress";
import type { FortressLayout, PlacedTower } from "./fortress";
import { formatNok, formatPct100 } from "./format";

/**
 * D1 Plain lens. The Fortress scene redrawn as labelled blocks: the same arrangement (the Great
 * Keep in the middle of the first row, the biggest holdings beside it, the rest on the terraces
 * below) but every fact is a word and a number, nothing is a drawing. Pure helpers over the
 * categories the backend already decided; nothing here scores anything, and every fact the
 * painted scene shows is here as text, so colour and art never carry a fact alone.
 */

export interface PlainRow {
  row: number;
  /** Towers in this row, left to right. */
  items: PlacedTower[];
  /** Row 0 only: how many of `items` stand to the left of the Great Keep. Null in other rows. */
  keepAfter: number | null;
}

/** Group the scene layout into rows, left to right, with the Great Keep slotted into row 0.
 * An empty portfolio has no rows. */
export function plainRows(layout: FortressLayout): PlainRow[] {
  if (layout.items.length === 0) return [];
  const rows: PlainRow[] = [];
  for (let r = 0; r < Math.max(1, layout.rows); r += 1) {
    const items = layout.items.filter((i) => i.row === r).sort((a, b) => a.x - b.x);
    const keepAfter = r === 0 ? items.filter((i) => i.x < layout.keep.x).length : null;
    rows.push({ row: r, items, keepAfter });
  }
  return rows;
}

export interface PlainFact {
  label: string;
  value: string;
  /** A second, quieter line (an age, a margin, a number). */
  note?: string;
}

/** The facts of one tower, in the Ledger's order and words. */
export function plainFacts(t: GameTower): PlainFact[] {
  return [
    { label: "Moat", value: MOAT_LABEL[t.moat] },
    { label: "Walls", value: WALL_LABEL[t.wall], note: t.wall_reason || undefined },
    {
      label: "Analysis",
      value: FRESHNESS_LABEL[t.freshness],
      note: t.analysis_age_days !== null ? `${t.analysis_age_days} days old` : undefined,
    },
    {
      label: "Land",
      value: LAND_SHORT[t.land],
      note: t.margin_of_safety_pct !== null ? `${formatPct100(t.margin_of_safety_pct)} margin of safety` : undefined,
    },
    {
      label: "Thesis",
      value: THESIS_SHORT[t.thesis],
      note: t.thesis === "breached" ? `${t.tripwires_fired} ${t.tripwires_fired === 1 ? "tripwire" : "tripwires"} fired` : undefined,
    },
    {
      label: "Siege",
      value: EXPOSURE_SHORT[t.siege_exposure],
      note: t.siege_shock_pct !== null ? `${formatShock(t.siege_shock_pct)} in the what-if` : undefined,
    },
  ];
}

/** Name, sub line, weight and value of a block. */
export function plainHeading(t: GameTower): { title: string; sub: string; weight: string; value: string } {
  return {
    title: t.name,
    sub: `${t.ticker} · ${STRUCTURE_LABEL[t.structure]} · ${SIZE_LABEL[t.size_class]}`,
    weight: formatPct100(t.weight_pct),
    value: formatNok(t.value_nok),
  };
}

/** Bar width (0 to 100) for the weight, so a block can be scanned without reading; null when unweighted. */
export function plainBarPct(t: GameTower): number | null {
  if (t.weight_pct === null) return null;
  const n = Number(t.weight_pct);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

/** The words that say "look here first", null when the block needs nothing. */
export function plainAttentionWord(t: GameTower): string | null {
  return needsAttention(t) ? "Needs a look" : null;
}

/** "Shares a wall with A, B" or null. */
export function plainSharedWall(t: GameTower): string | null {
  return t.shared_wall_with.length > 0 ? `Shares a wall with ${t.shared_wall_with.join(", ")}` : null;
}
