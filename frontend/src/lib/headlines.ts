import { formatNok, formatPct100 } from "./format";
import type { MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance } from "./types";

/**
 * Headline numbers that more than one place shows (the flat main-app pages and the 3D Town Hall boards).
 * One function per number, so the two can never drift apart: a page and a board that print the same fact call
 * the same code. Nothing is recomputed from raw rows beyond what the flat page already did; unknown stays
 * unknown ("—"), never a made-up number.
 */

/** The big number on the Dashboard: the whole portfolio, in NOK. */
export function portfolioValueText(overview: Pick<PortfolioOverview, "total_value_nok">): string {
  return formatNok(overview.total_value_nok);
}

/** Total return on the Performance page, two decimals; "—" while there is no usable history. */
export function totalReturnText(perf: Pick<PortfolioPerformance, "total_return_pct">): string {
  return perf.total_return_pct !== null ? formatPct100(perf.total_return_pct, 2) : "—";
}

/** How many owned companies the Margin of safety board could rank, and how many it could not. */
export function rankedCounts(board: Pick<MarginOfSafetyBoard, "rows"> | undefined): { ranked: number; unavailable: number } {
  const rows = board?.rows ?? [];
  const unavailable = rows.filter((r) => r.zone === "unavailable").length;
  return { ranked: rows.length - unavailable, unavailable };
}
