import type { PeriodMultiples } from "./types";

/** Why a multiple has no chart: the reason from the NEWEST period that has one,
 * with the period named. The first period is the wrong one to quote: an early
 * year that only holds opening balances (Kongsberg FY2019) says "missing:
 * shares_outstanding" for every metric, which hid the real, current reason
 * ("missing: ebitda"). Periods are in chronological order. */
export function latestSkipReason(series: PeriodMultiples[], metricKey: string): string | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const reason = series[i].skipped[metricKey];
    if (reason) return `${series[i].period}: ${reason}`;
  }
  return null;
}
