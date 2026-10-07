import type { TagCandidate, TagCheck, TagReview } from "./types";

/** Plain-language labels for the tag review page (read-only, PR 1). */

export function checkLabel(check: TagCheck): string {
  switch (check) {
    case "ties":
      return "Ties to the statement";
    case "plausible":
      return "Plausible, not a tie";
    case "does_not_tie":
      return "Does not tie, check first";
    default:
      return "Not checkable";
  }
}

/** Tone for the check badge; the label always says it too, so never colour alone. */
export function checkTone(check: TagCheck): "good" | "warn" | "plain" {
  if (check === "ties") return "good";
  if (check === "does_not_tie") return "warn";
  return "plain";
}

export function scopeLabel(scope: TagCandidate["suggested_scope"]): string {
  return scope === "company" ? "This company only (its own tag)" : "All companies (standard tag)";
}

/** The sentence under a fetch: how many inputs one holding is still missing. */
export function bannerText(review: TagReview): string | null {
  const row = review.holdings.find((h) => h.gaps.length > 0);
  if (!row) return null;
  const names = row.gaps.map((g) => g.metric);
  const shown = names.slice(0, 4).join(", ");
  const more = names.length > 4 ? ` and ${names.length - 4} more` : "";
  return `${names.length} input${names.length === 1 ? "" : "s"} not extracted from the ${row.fiscal_year} report: ${shown}${more}.`;
}
