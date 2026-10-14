import type { Calibration, CalibrationBand } from "./types";

/** Wording for the C2 calibration ledger (hit rate). The server decides when a ratio may be shown
 * (`is_open`); this only words it. Every ratio carries its count ("5 of 8"), nothing is a bare
 * percentage, and there is no grade, streak or "improving" language. */

export function callsLine(c: Calibration["calls"], minN: number): string {
  if (!c.is_open) {
    return `Too few so far: ${c.n} ${c.n === 1 ? "decision has" : "decisions have"} a 6- or 12-month outcome. This opens at ${minN}.`;
  }
  return `${c.as_expected} of ${c.n} went the way you expected. ${c.against} went against, ${c.flat} stayed flat.`;
}

export function oracleLine(o: Calibration["oracle"], minN: number): string {
  if (!o.is_open) {
    return `Too few so far: ${o.n} analyst ${o.n === 1 ? "range has" : "ranges have"} a later price. This opens at ${minN}.`;
  }
  return `${o.inside} of ${o.n} later prices landed inside the analyst's range. ${o.below} below it, ${o.above} above it.`;
}

/** One confidence row; a band with too few decisions says so instead of showing a ratio. */
export function bandLine(b: CalibrationBand): string {
  if (!b.shown) return `Confidence ${b.confidence}: too few so far (${b.n})`;
  return `Confidence ${b.confidence}: ${b.as_expected} of ${b.n} as expected`;
}

/** Seal shapes for a band's decisions: filled = as expected, hollow ring = against, dashed ring = flat. */
export function bandSeals(b: CalibrationBand): ("filled" | "ring" | "dashed")[] {
  if (!b.shown) return [];
  return [
    ...Array<"filled">(b.as_expected ?? 0).fill("filled"),
    ...Array<"ring">(b.against ?? 0).fill("ring"),
    ...Array<"dashed">(b.flat ?? 0).fill("dashed"),
  ];
}
