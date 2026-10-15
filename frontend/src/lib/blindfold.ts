import type { BlindfoldPosition, BlindfoldReveal, BlindfoldWidthClass } from "./types";

/** Pure helpers for Blindfold Years (E1): the answers kept in this browser, the n-gated tally, number
 * formatting and the stake geometry. The server decides every comparison (inside, below, above); this
 * only counts and words them. Nothing typed here is sent anywhere, and there is no grade, streak or
 * trend arrow: a tally is a count with its "of n", and it opens only at `minN` puzzles. */

export const BLINDFOLD_STORAGE_KEY = "aladdin.blindfold.v1";

export interface BlindfoldResult {
  puzzle_id: string;
  inside: boolean;
  position: BlindfoldPosition;
  width_class: BlindfoldWidthClass | null;
}

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isResult = (x: unknown): x is BlindfoldResult => {
  const r = x as Partial<BlindfoldResult> | null;
  return !!r && typeof r.puzzle_id === "string" && typeof r.inside === "boolean" && typeof r.position === "string";
};

/** What this browser has answered. Storage can be missing or throw (private window): then it is empty. */
export function loadResults(store: ReadStore | null): BlindfoldResult[] {
  try {
    const raw = store?.getItem(BLINDFOLD_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isResult) : [];
  } catch {
    return [];
  }
}

/** Adds one answer (a puzzle counts once) and returns the list; a failed write keeps it in memory only. */
export function addResult(store: WriteStore | null, current: BlindfoldResult[], reveal: BlindfoldReveal): BlindfoldResult[] {
  if (current.some((r) => r.puzzle_id === reveal.puzzle_id)) return current;
  const next = [
    ...current,
    { puzzle_id: reveal.puzzle_id, inside: reveal.inside, position: reveal.position, width_class: reveal.width_class },
  ];
  try {
    store?.setItem(BLINDFOLD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* kept in memory for this visit */
  }
  return next;
}

export function clearResults(store: WriteStore | null): void {
  try {
    store?.removeItem(BLINDFOLD_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export const seenIds = (results: BlindfoldResult[]): string[] => results.map((r) => r.puzzle_id);

export interface Tally {
  n: number;
  open: boolean;
  /** Ranges that held; null until the tally opens (never shown as a bare ratio). */
  inside: number | null;
}

export function tally(results: BlindfoldResult[], minN: number): Tally {
  const n = results.length;
  const open = n >= minN;
  return { n, open, inside: open ? results.filter((r) => r.inside).length : null };
}

export const WIDTH_ORDER: BlindfoldWidthClass[] = ["narrow", "medium", "wide"];

export function tallyByWidth(results: BlindfoldResult[], minN: number): Record<BlindfoldWidthClass, Tally> {
  const out = {} as Record<BlindfoldWidthClass, Tally>;
  for (const w of WIDTH_ORDER) out[w] = tally(results.filter((r) => r.width_class === w), minN);
  return out;
}

export function tallyLine(t: Tally, minN: number): string {
  if (!t.open) {
    return `Keep going: ${t.n} answered. Your tally opens at ${minN}.`;
  }
  return `Your stakes caught it ${t.inside} of ${t.n} times.`;
}

export const WIDTH_LABEL: Record<BlindfoldWidthClass, string> = {
  narrow: "Narrow stakes",
  medium: "Medium stakes",
  wide: "Wide stakes",
};

export function widthLine(w: BlindfoldWidthClass, t: Tally, minN: number): string {
  return t.open ? `${WIDTH_LABEL[w]}: caught ${t.inside} of ${t.n}` : `${WIDTH_LABEL[w]}: not enough yet (${t.n} of ${minN})`;
}

export const POSITION_WORD: Record<BlindfoldPosition, string> = {
  below: "Missed: it landed below your stakes",
  inside: "Caught it: inside your stakes",
  above: "Missed: it landed above your stakes",
};

// --- numbers --------------------------------------------------------------------

const minus = (v: number) => (v < 0 ? "\u2212" : "");

/** A figure for the table: money in plain compact units (no currency: it would give the company away),
 * ratios as a percent. null is fog and is worded by the caller. */
export function formatFigure(value: string | null, kind: "money" | "ratio"): string {
  if (value === null) return "";
  const v = Number(value);
  if (!Number.isFinite(v)) return "";
  if (kind === "ratio") return `${minus(v)}${Math.abs(v * 100).toFixed(1)}%`;
  const a = Math.abs(v);
  if (a >= 1e9) return `${minus(v)}${(a / 1e9).toFixed(2)} bn`;
  if (a >= 1e6) return `${minus(v)}${(a / 1e6).toFixed(1)} m`;
  return `${minus(v)}${Math.round(a).toLocaleString("en")}`;
}

/** What a person types into a stake field: spaces and commas as thousands marks, "." as the decimal point. */
export function parseStake(text: string): number | null {
  const cleaned = text.replace(/[\s\u00a0,]/g, "").replace("\u2212", "-");
  if (cleaned === "" || cleaned === "-") return null;
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

/** A number as the decimal string the API takes (six significant digits is far finer than a stake). */
export const stakeText = (v: number): string => String(Number(v.toPrecision(8)));

// --- stake geometry -------------------------------------------------------------

export const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

export function fractionToValue(f: number, min: number, max: number): number {
  return min + clamp01(f) * (max - min);
}

export function valueToFraction(v: number, min: number, max: number): number {
  return max === min ? 0.5 : (v - min) / (max - min);
}

/** Scene y for a value: the lowest value sits at `bottom`, the highest at `top`. Values past the range are
 * kept at the edge so a stored figure far outside the shown years still sits on the gauge. */
export function sceneY(v: number, min: number, max: number, top: number, bottom: number): number {
  return bottom - clamp01(valueToFraction(v, min, max)) * (bottom - top);
}

/** The smallest gap kept between the two stakes (a share of the gauge), so their pills never overlap. */
export const MIN_STAKE_GAP = 0.11;

/** The value at a scene y: the inverse of sceneY, kept on the gauge. */
export function valueFromSceneY(sy: number, min: number, max: number, top: number, bottom: number): number {
  return fractionToValue((bottom - sy) / (bottom - top), min, max);
}

/** Where a dragged stake ends up: on the gauge, and never closer than MIN_STAKE_GAP to the other stake. */
export function moveStake(which: "low" | "high", value: number, low: number, high: number, min: number, max: number): number {
  const gap = (max - min) * MIN_STAKE_GAP;
  const v = Math.min(max, Math.max(min, value));
  return which === "low" ? Math.min(v, high - gap) : Math.max(v, low + gap);
}

/** Round, even tick values between min and max for the gauge (about `count` of them). */
export function gaugeTicks(min: number, max: number, count = 4): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= max + step * 1e-9; t += step) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}
