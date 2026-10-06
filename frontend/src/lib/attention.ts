import type { MonitorRow, SummaryPoint } from "./types";
import type { WarningItem } from "./warnings";

/** The Dashboard's "Needs attention" feed (UX noise audit, Wave 2).
 *
 * Replaces three overlapping lists (the rule-based summary, the thesis-check
 * card and the tripwire banner) with one ranked list. Nothing is computed
 * here that the backend or the thesis monitor has not already decided: the
 * overview's own `warn` sentences become items, fired tripwires and changed
 * theses come from the monitor rows. `good` and `info` points are not
 * warnings; the passed checks are returned so the page can offer them one
 * click away instead of printing them. */

export interface Attention {
  items: WarningItem[];
  /** Checks that passed, for a collapsed "Show N passed checks". */
  passed: string[];
  /** A tripwire is firing: the page offers "Check now" next to the feed. */
  tripwireFiring: boolean;
}

function names(rows: MonitorRow[], limit = 3): string {
  const shown = rows.slice(0, limit).map((r) => r.ticker);
  const more = rows.length - shown.length;
  return shown.join(", ") + (more > 0 ? ` and ${more} more` : "");
}

export function buildAttention(summary: SummaryPoint[], thesisRows: MonitorRow[]): Attention {
  const items: WarningItem[] = [];

  const firing = thesisRows.filter((r) => r.status === "tripwire_fired");
  if (firing.length > 0) {
    const total = firing.reduce((n, r) => n + r.firing_count, 0);
    items.push({
      id: "tripwires",
      kind: "investment",
      severity: "high",
      title: `${total} tripwire${total === 1 ? "" : "s"} fired on ${firing.length} holding${firing.length === 1 ? "" : "s"}`,
      detail: names(firing),
      to: "/thesis",
    });
  }

  const review = thesisRows.filter((r) => r.status === "review");
  if (review.length > 0) {
    items.push({
      id: "thesis-review",
      kind: "investment",
      severity: "medium",
      title: `${review.length} ${review.length === 1 ? "thesis" : "theses"} changed since the last review`,
      detail: names(review),
      to: "/thesis",
    });
  }

  summary
    .filter((p) => p.tone === "warn")
    .forEach((p, i) => items.push({ id: `summary-${i}`, kind: "investment", severity: "medium", title: p.text }));

  return {
    items,
    passed: summary.filter((p) => p.tone === "good").map((p) => p.text),
    tripwireFiring: firing.length > 0,
  };
}
