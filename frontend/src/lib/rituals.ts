import type {
  CompetenceLevel,
  CompetenceStatus,
  CouncilKind,
  DecisionRecord,
  RecordReviewState,
} from "./types";

/** Wording and classes for the Sprint 25 rituals (game mode G17 Council, G18 Hall of Records, G19
 * Circle of Competence). Pure, so it is unit-tested. The backend decides every agenda item, review
 * state and status from stored facts; this file only chooses labels and colours and never scores
 * anything. A decision is not its outcome: nothing here counts wins or ranks a decision. */

export const COUNCIL_LABEL: Record<CouncilKind, string> = {
  tripwire: "Tripwire fired",
  thesis_review: "Thesis to revisit",
  review_due: "Reviews owed",
  weak_walls: "Weak walls",
  no_moat: "No moat found",
  stale_analysis: "Analysis old or missing",
  outside_circle: "Outside your circle",
  cash: "Vault figure",
};

export const REVIEW_LABEL: Record<RecordReviewState, string> = {
  written: "Written",
  due: "Owed",
  not_due: "Not due yet",
};

export const REVIEW_CLASS: Record<RecordReviewState, string> = {
  written: "bg-positive-subtle text-positive",
  due: "bg-caution-subtle text-caution",
  not_due: "bg-raised text-ink-faint",
};

export const LEVEL_LABEL: Record<CompetenceLevel, string> = {
  know: "I know this",
  partly: "On the edge",
  outside: "Outside my circle",
};

export const STATUS_LABEL: Record<CompetenceStatus, string> = {
  inside: "Inside",
  edge: "On the edge",
  outside: "Outside",
  unmarked: "Unmarked",
  unclassified: "No sector set",
  not_applicable: "Not judged",
};

export const STATUS_CLASS: Record<CompetenceStatus, string> = {
  inside: "bg-positive-subtle text-positive",
  edge: "bg-caution-subtle text-caution",
  outside: "bg-negative-subtle text-negative",
  unmarked: "bg-raised text-ink-muted",
  unclassified: "bg-raised text-ink-faint",
  not_applicable: "bg-raised text-ink-faint",
};

export const ACTION_LABEL: Record<string, string> = {
  buy: "Bought",
  add: "Added",
  trim: "Trimmed",
  sell: "Sold",
  hold: "Held",
  pass: "Passed",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/** "+12.0%" / "-3.4%"; never a verdict word. Unknown is "unknown", never 0. */
export function changeText(pct: string | null): string {
  if (pct === null) return "unknown";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "unknown";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** One line: what the price did since the decision, or why it cannot be said. */
export function priceLine(r: DecisionRecord): string {
  if (r.price_then === null) return "No price was written with this decision.";
  if (r.price_now === null) return r.price_note ?? "No stored price since the decision.";
  const cur = r.currency ? ` ${r.currency}` : "";
  return `${Number(r.price_then).toLocaleString(undefined, { maximumFractionDigits: 2 })}${cur} then, ${Number(
    r.price_now,
  ).toLocaleString(undefined, { maximumFractionDigits: 2 })}${cur} now (${changeText(r.price_change_pct)})`;
}

/** The verdict then and now, said plainly; "unknown" when either is missing. */
export function verdictLine(r: DecisionRecord): string {
  const then = r.verdict_then ?? "none recorded";
  const now = r.verdict_now ?? "unknown";
  return then === now ? `Analyst verdict then and now: ${then}` : `Analyst verdict then: ${then}; now: ${now}`;
}

export function daysText(days: number): string {
  if (days < 1) return "today";
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `${months} months ago` : `${(days / 365.25).toFixed(1)} years ago`;
}

/** Filter used by the Hall of Records: all, or only those with a review owed. */
export function filterRecords(records: DecisionRecord[], onlyOwed: boolean): DecisionRecord[] {
  return onlyOwed ? records.filter((r) => r.review_6m === "due" || r.review_12m === "due") : records;
}

/** Share of the portfolio as text, or "unknown" for a missing weight. */
export function weightText(weight: string | null): string {
  if (weight === null) return "unknown";
  const n = Number(weight);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "unknown";
}

/** Width in percent for the circle bar segments (sums to 100 or less; the rest is not judged). */
export function circleSegments(c: {
  inside_weight_pct: string;
  edge_weight_pct: string;
  outside_weight_pct: string;
  unmarked_weight_pct: string;
  unclassified_weight_pct: string;
}): { key: CompetenceStatus; pct: number }[] {
  const raw: { key: CompetenceStatus; pct: number }[] = [
    { key: "inside", pct: Number(c.inside_weight_pct) },
    { key: "edge", pct: Number(c.edge_weight_pct) },
    { key: "outside", pct: Number(c.outside_weight_pct) },
    { key: "unmarked", pct: Number(c.unmarked_weight_pct) },
    { key: "unclassified", pct: Number(c.unclassified_weight_pct) },
  ];
  return raw.filter((s) => Number.isFinite(s.pct) && s.pct > 0);
}
