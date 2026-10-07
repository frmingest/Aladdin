import type { TagCandidate, TagCheck, TagReextractResult, TagReview, TagReviewHolding, TagRule } from "./types";

/** Plain-language labels for the tag review page. */

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

// --- PR 2: decisions on suggestions ------------------------------------------

/** What pressing "Use this tag" will do, in one sentence. The scope follows from
 * the tag (a standard tag is read in every company, a company's own tag only in
 * that company) and is decided by the server; this only tells the person. */
export function acceptScopeText(c: Pick<TagCandidate, "suggested_scope">, companyName: string): string {
  return c.suggested_scope === "company"
    ? `Saves a rule that reads this tag for ${companyName} only.`
    : "Saves a rule that reads this standard tag in every company, after the built-in mapping.";
}

/** The warning shown before a suggestion that failed its own check can be accepted. */
export function secondConfirmationText(c: Pick<TagCandidate, "check_detail" | "warning" | "check">): string {
  const reasons = [c.check === "does_not_tie" ? c.check_detail : null, c.warning].filter(Boolean);
  return `This tag failed its own check${reasons.length ? `: ${reasons.join("; ")}` : ""}. A wrong rule would put a wrong number into the valuation. Accept it anyway?`;
}

/** Holdings that have a saved rule waiting for a re-extract. */
export function pendingHoldings(review: TagReview): TagReviewHolding[] {
  return review.holdings.filter((h) => h.gaps.some((g) => g.rule_pending));
}

export function ruleScopeLabel(rule: Pick<TagRule, "scope" | "ticker">): string {
  return rule.scope === "all" ? "All companies" : `${rule.ticker ?? "One company"} only`;
}

export function ruleStatusLabel(rule: Pick<TagRule, "status" | "check_overridden">): string {
  if (rule.status === "rejected") return "Rejected suggestion";
  return rule.check_overridden ? "Rule (accepted after a failed check)" : "Rule";
}

/** One line per re-extracted company. Says what changed and never claims a figure was added unless the count rose. */
export function reextractSummary(r: TagReextractResult): string {
  if (r.documents === 0) return `${r.ticker}: no stored tagged report could be read again.${r.notes.length ? ` ${r.notes.join(" ")}` : ""}`;
  const figures =
    r.facts_after === r.facts_before
      ? `${r.facts_after} figures (unchanged)`
      : `${r.facts_before} → ${r.facts_after} figures`;
  const viaRule = r.rule_figures > 0 ? `, ${r.rule_figures} read by a rule` : ", none read by a rule";
  const notes = r.notes.length ? ` ${r.notes.join(" ")}` : "";
  return `${r.ticker}: re-read ${r.documents} report${r.documents === 1 ? "" : "s"}, ${figures}${viaRule}.${notes}`;
}
