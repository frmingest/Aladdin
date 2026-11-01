import { scrollDate } from "../lib/scrolls";
import type { DocumentSummary } from "../lib/types";

const FINANCIAL = new Set(["annual_report", "quarterly_report"]);

/**
 * The newest financial report on file for a holding: annual or quarterly/half-year, by the report's own
 * date (Newsweb's when known, else the upload). On a tie the annual report wins. Null when none is stored.
 * View-only: nothing is read from the filing here and nothing is stored.
 */
export function latestReport(documents: DocumentSummary[]): DocumentSummary | null {
  let best: DocumentSummary | null = null;
  let bestTime = -Infinity;
  for (const d of documents) {
    if (!FINANCIAL.has(d.type)) continue;
    const t = Date.parse(scrollDate(d));
    const time = Number.isNaN(t) ? -Infinity : t;
    if (best === null || time > bestTime || (time === bestTime && d.type === "annual_report" && best.type !== "annual_report")) {
      best = d;
      bestTime = time;
    }
  }
  return best;
}
