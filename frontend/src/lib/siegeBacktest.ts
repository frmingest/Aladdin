import type { SiegeBacktest, SiegeBacktestBook, SiegeBacktestEpisode, SiegeBacktestHolding, SiegeBacktestVerdict } from "./types";

/**
 * Siege back-test wording and helpers (C1). Pure. Every number is computed by
 * the backend (backend/app/services/game/backtest.py); this file only words it.
 * It checks the Siege page against one past fall. It is not a forecast, a
 * score or a recommendation, and it never says what to do with money.
 */

export const BACKTEST_RULES = "backtest-v1";

export const VERDICT_LABEL: Record<SiegeBacktestVerdict, string> = {
  close: "Close",
  fell_more: "Fell more than the page said",
  fell_less: "Fell less than the page said",
  not_tested: "Not tested",
};

export const BACKTEST_LIMITS =
  "This checks the page's own method on one past fall. One fall is a small sample: it shows where the method was close and where it was not, and says nothing about the next fall.";

export function pct(fraction: string | number | null, digits = 1): string {
  if (fraction === null) return "—";
  const n = Number(fraction);
  if (!Number.isFinite(n)) return "—";
  const v = (n * 100).toFixed(digits);
  // A value that rounds to zero is shown as plain 0.0%, never "-0.0%" or "+0.0%".
  if (Number(v) === 0) return `${(0).toFixed(digits)}%`;
  return `${n > 0 ? "+" : ""}${v}%`;
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function episodeLine(ep: SiegeBacktestEpisode, benchmark: string): string {
  const fall = (Math.abs(Number(ep.fall)) * 100).toFixed(1);
  return `${benchmark || "The benchmark"} fell ${fall}% from its high on ${shortDate(ep.peak_date)} to its low on ${shortDate(ep.trough_date)} (${ep.trading_days} trading days).`;
}

/** Percentage points between what happened and what the page would have said, as words. */
export function gapWords(error: string | null): string {
  if (error === null) return "";
  const pts = Number(error) * 100;
  if (!Number.isFinite(pts)) return "";
  const size = Math.abs(pts).toFixed(1);
  if (Math.abs(pts) < 0.05) return "No gap";
  return pts < 0 ? `${size} points worse than the page said` : `${size} points better than the page said`;
}

export function holdingBacktestLine(h: SiegeBacktestHolding): string {
  if (!h.tested) return h.reason ?? "Not tested.";
  // The gap itself sits on the verdict line above this one, so it is not repeated here.
  return `The page would have said ${pct(h.predicted)}; it did ${pct(h.actual)}.`;
}

export function summaryLine(bt: SiegeBacktest): string {
  const share = bt.tested_value_share === null ? "" : `, ${(Number(bt.tested_value_share) * 100).toFixed(0)}% of the portfolio value`;
  const gap = bt.mean_abs_error === null ? "" : ` The average gap was ${(Number(bt.mean_abs_error) * 100).toFixed(1)} points.`;
  return `${bt.tested_count} of ${bt.total_count} holdings could be tested${share}: ${bt.close_count} close, ${bt.fell_more_count} fell more than the page said, ${bt.fell_less_count} fell less.${gap}`;
}

export function bookLines(book: SiegeBacktestBook): string[] {
  const out: string[] = [];
  if (book.actual_fall !== null) {
    out.push(`Over that fall the replayed book would have gone ${pct(book.actual_fall)}; the page's method said ${pct(book.predicted_fall)}.`);
  } else {
    out.push(`The page's method says ${pct(book.predicted_fall)} for the replayed book; the stored prices do not cover the whole fall.`);
  }
  out.push(
    `The replayed book's own worst fall was ${pct(book.max_drawdown)} (${shortDate(book.max_drawdown_peak)} to ${shortDate(book.max_drawdown_trough)}).`,
  );
  const now = book.under_water_now_days > 0 ? ` It ends the window ${book.under_water_now_days} trading days below its last high.` : " It ends the window at a high.";
  out.push(`Its longest stretch below an earlier high was ${book.longest_under_water_days} trading days.${now}`);
  return out;
}

/** Scale (a fraction) for the bars so the longest bar fills the track; never below 5%, never above 100%. */
export function barScale(rows: SiegeBacktestHolding[]): number {
  let max = 0.05;
  for (const r of rows) {
    for (const v of [r.predicted, r.actual]) {
      const n = v === null ? 0 : Math.abs(Math.min(0, Number(v)));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return Math.min(1, max);
}

/** Width (0-100) of a bar for a fractional shock on the given scale. Gains draw no bar. */
export function barWidth(shock: string | null, scale: number): number {
  if (shock === null) return 0;
  const n = Number(shock);
  if (!Number.isFinite(n) || n >= 0) return 0;
  return Math.min(100, Math.round((-n / scale) * 100));
}

/** Every fixed sentence in this file, so a test can check the wording rules. */
export function allBacktestLines(): string[] {
  return [...Object.values(VERDICT_LABEL), BACKTEST_LIMITS];
}
