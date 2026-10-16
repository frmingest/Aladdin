import type { WinterPoint, WinterRehearsal } from "./types";

/** Pure helpers for Winter Rehearsal (E2): the winter order kept in this browser, and the mapping from a
 * point in the replay to what the war-table scene draws. The server computes every figure (kroner, fall,
 * days under water); nothing here does financial arithmetic beyond picking a point and a share of the
 * way down. Your order is never sent anywhere: it lives in this browser and reaches no analysis. */

export const WINTER_STORAGE_KEY = "aladdin.winter.order.v1";
export const ORDER_MAX_LENGTH = 200;
export const CANDLES = 5;
/** Icicle copies hung in the scene: none at the peak, one, two or three as the frost deepens. */
export const MAX_FROST_COPIES = 3;

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The order as saved, or "" when there is none. Storage can be missing or throw (private window). */
export function loadOrder(store: ReadStore | null): string {
  try {
    const raw = store?.getItem(WINTER_STORAGE_KEY);
    return typeof raw === "string" ? cleanOrder(raw) : "";
  } catch {
    return "";
  }
}

/** One line, trimmed, at most ORDER_MAX_LENGTH characters. */
export function cleanOrder(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, ORDER_MAX_LENGTH);
}

/** Saves the order and returns what is now kept; a failed write keeps it in memory for this visit only. */
export function saveOrder(store: WriteStore | null, text: string): string {
  const clean = cleanOrder(text);
  try {
    if (clean) store?.setItem(WINTER_STORAGE_KEY, clean);
    else store?.removeItem(WINTER_STORAGE_KEY);
  } catch {
    /* kept in memory for this visit */
  }
  return clean;
}

export interface WinterSceneState {
  /** Share of the way from the peak (0) to the bottom (1), by position in the replay. */
  progress: number;
  /** Candles still alight: all five at the peak, none at the bottom, going out one by one. */
  candlesLit: number;
  /** How deep this day is compared with the worst day of the window, 0 at the peak and 1 at the bottom. */
  frost: number;
  /** How many icicle copies hang from the ledge. */
  icicles: number;
  atBottom: boolean;
}

/** What the scene shows for point `index` of `points` (clamped). Null when there is no replay. */
export function sceneState(points: WinterPoint[], index: number): WinterSceneState | null {
  if (points.length === 0) return null;
  const last = points.length - 1;
  const i = Math.min(Math.max(Math.round(index), 0), last);
  const progress = last === 0 ? 1 : i / last;
  const worst = Math.abs(Number(points[last].change));
  const here = Math.abs(Number(points[i].change));
  const frost = worst > 0 && Number.isFinite(here) ? Math.min(here / worst, 1) : 0;
  const candlesLit = i === last ? 0 : Math.max(CANDLES - Math.floor(progress * CANDLES), 1);
  const icicles = frost <= 0 ? 0 : Math.min(Math.ceil(frost * MAX_FROST_COPIES), MAX_FROST_COPIES);
  return { progress, candlesLit, frost, icicles, atBottom: i === last };
}

const minus = (n: number) => (n < 0 ? "−" : "");

/** "−12.3%" for a fraction such as -0.123 (a loss keeps its sign; a zero prints "0.0%"). */
export function signedPercent(fraction: string): string {
  const n = Number(fraction);
  if (!Number.isFinite(n)) return fraction;
  const abs = Math.abs(n * 100);
  const text = abs.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${text === "0.0" ? "" : minus(n)}${text}%`;
}

/** "−85 000 kr" for a NOK change, whole kroner, Norwegian grouping. */
export function signedNok(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const abs = Math.round(Math.abs(n));
  return `${abs === 0 ? "" : minus(n)}${abs.toLocaleString("nb-NO")} kr`;
}

export const daysWord = (n: number): string => `${n} ${n === 1 ? "day" : "days"}`;

/** The coverage line, always printed with its "of": "5 of 8 holdings had stored prices". */
export function coverageLine(data: Pick<WinterRehearsal, "coverage">): string {
  const { covered_count: c, total_count: t } = data.coverage;
  return `${c} of ${t} holdings had stored prices`;
}
