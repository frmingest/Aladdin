/** Warning budget (UX noise audit, principle 3).
 *
 * A page shows at most `max` warnings, ranked by what matters most, with a
 * count for the rest. Plumbing (a worker that is offline, an LLM that cannot
 * be reached) is never ranked against investment warnings: it is returned
 * separately so the page can show one small badge that links to System status.
 *
 * Pure functions only, so the rules can be tested without a browser. */

/** investment: something about your money. data: a number you should not trust
 * yet. infrastructure: the app's own plumbing. */
export type WarningKind = "investment" | "data" | "infrastructure";
export type WarningSeverity = "high" | "medium" | "low";

export interface WarningItem {
  id: string;
  kind: WarningKind;
  severity: WarningSeverity;
  title: string;
  /** One short sentence; shown under the title. */
  detail?: string;
  /** Where "look at this" goes. */
  to?: string;
}

export const DEFAULT_WARNING_BUDGET = 3;

const SEVERITY_RANK: Record<WarningSeverity, number> = { high: 0, medium: 1, low: 2 };
// Between equal severities, a warning about your money comes before a data caveat.
const KIND_RANK: Record<Exclude<WarningKind, "infrastructure">, number> = { investment: 0, data: 1 };

export interface BudgetedWarnings {
  /** At most `max`, most important first. Never contains infrastructure items. */
  visible: WarningItem[];
  /** Everything that did not fit, same order. */
  hidden: WarningItem[];
  /** Plumbing items, in input order. Shown as one badge, not ranked. */
  infrastructure: WarningItem[];
}

export function budgetWarnings(items: WarningItem[], max: number = DEFAULT_WARNING_BUDGET): BudgetedWarnings {
  const seen = new Set<string>();
  const unique = items.filter((w) => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
  const infrastructure = unique.filter((w) => w.kind === "infrastructure");
  const ranked = unique
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => w.kind !== "infrastructure")
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.w.severity] - SEVERITY_RANK[b.w.severity] ||
        KIND_RANK[a.w.kind as "investment" | "data"] - KIND_RANK[b.w.kind as "investment" | "data"] ||
        a.index - b.index,
    )
    .map(({ w }) => w);
  const limit = Math.max(0, max);
  return { visible: ranked.slice(0, limit), hidden: ranked.slice(limit), infrastructure };
}
