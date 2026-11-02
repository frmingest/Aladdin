import { formatIndicatorValue, formatNok, formatPct100 } from "./format";
import type {
  MacroIndicator,
  MacroIndicators,
  MarginOfSafetyBoard,
  MonitorRow,
  PortfolioOverview,
  PortfolioPerformance,
  PreciousMetalsOverview,
  ThesisStatus,
} from "./types";

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

/** The handful of macro numbers worth a glance every day: the Dashboard strip shows all of them, the Town Hall board shows the first. */
export const MACRO_HEADLINE_KEYS = ["no_policy_rate", "no_cpi_yoy", "no_10y", "usd_nok", "us_fed_funds_upper", "us_10y"];

/** The headline indicators that have a value, in the strip's order (the Dashboard strip and the Macro board both start from this). */
export function macroHeadlineIndicators(data: Pick<MacroIndicators, "indicators">): MacroIndicator[] {
  const byKey = new Map(data.indicators.map((i) => [i.key, i]));
  return MACRO_HEADLINE_KEYS.map((k) => byKey.get(k)).filter((i): i is MacroIndicator => Boolean(i?.value));
}

/** Norway's policy rate as the Macro page prints it, "stale" kept when the series is old; null when it has no value. */
export function policyRateText(data: Pick<MacroIndicators, "indicators">): string | null {
  const ind = data.indicators.find((i) => i.key === "no_policy_rate");
  if (!ind?.value) return null;
  return `${formatIndicatorValue(ind)}${ind.stale ? " (stale)" : ""}`;
}

/** Most urgent first, the same order as the Thesis page. */
export const THESIS_STATUS_ORDER: ThesisStatus[] = ["tripwire_fired", "review", "not_analyzed", "intact"];

/** How many holdings sit in each thesis status, most urgent first, empty statuses left out (the Thesis page's status bar). */
export function thesisStatusCounts(rows: Pick<MonitorRow, "status" | "status_label">[]): { status: ThesisStatus; label: string; count: number }[] {
  return THESIS_STATUS_ORDER.map((status) => {
    const match = rows.filter((r) => r.status === status);
    return { status, label: match[0]?.status_label ?? status, count: match.length };
  }).filter((g) => g.count > 0);
}

/** Plain words for the 3D board. The backend's own labels start with a red or green dot, which the 3D rules keep out, so the board says it in words (the counts still come from `thesisStatusCounts`). */
export const THESIS_STATUS_WORDS: Record<ThesisStatus, string> = {
  tripwire_fired: "tripwire fired",
  review: "to review",
  not_analyzed: "not analyzed",
  intact: "intact",
};

/** "1 tripwire fired, 4 intact": the page's counts in plain words; "Nothing watched yet" with no rows. */
export function thesisSummaryText(rows: Pick<MonitorRow, "status" | "status_label">[]): string {
  const parts = thesisStatusCounts(rows);
  return parts.length === 0 ? "Nothing watched yet" : parts.map((p) => `${p.count} ${THESIS_STATUS_WORDS[p.status]}`).join(", ");
}

/** The precious-metals total, in NOK, as the Precious metals page prints it. */
export function metalsValueText(overview: Pick<PreciousMetalsOverview, "total_value_nok">): string {
  return formatNok(overview.total_value_nok);
}
