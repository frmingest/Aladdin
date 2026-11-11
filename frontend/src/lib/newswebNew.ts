import type { NewswebNewItem } from "./types";

/** Pure helpers for the "New on Newsweb" card. The backend stores each announcement's category inside
 * its summary sentence ("Category: HALF YEAR FINANCIAL REPORT."), so it is read back from there. */

const REPORT_CATEGORIES = ["ANNUAL FINANCIAL REPORT", "HALF YEAR FINANCIAL REPORT"];

export function categoryOf(item: NewswebNewItem): string | null {
  const match = /Category: ([^.]+)\./.exec(item.summary ?? "");
  return match ? match[1].trim() : null;
}

/** True for the filings the report fetch picks up (annual and half-year/quarterly). */
export function isReport(item: NewswebNewItem): boolean {
  const category = (categoryOf(item) ?? "").toUpperCase();
  return REPORT_CATEGORIES.some((name) => category.includes(name));
}

/** Reports first, then everything else; newest first inside each group. */
export function sortItems(items: NewswebNewItem[]): NewswebNewItem[] {
  const time = (item: NewswebNewItem) => Date.parse(item.published_at ?? item.first_seen_at) || 0;
  return [...items].sort((a, b) => Number(isReport(b)) - Number(isReport(a)) || time(b) - time(a));
}

export function headline(items: NewswebNewItem[]): string {
  if (items.length === 0) return "Nothing new on Newsweb.";
  const reports = items.filter(isReport).length;
  const total = `${items.length} new Newsweb announcement${items.length === 1 ? "" : "s"}`;
  if (reports === 0) return total;
  return `${total}, ${reports} ${reports === 1 ? "is a report" : "are reports"}`;
}
