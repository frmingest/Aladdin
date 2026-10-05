/** Groups a document's stored figures into statement tables (income
 * statement, balance sheet, cash flow) for the reader's side pane. Display
 * only — no figure is computed here (CLAUDE.md rule 1). */
import { formatDecimal, formatMoney } from "./format";
import { FACT_LABELS } from "./types";
import type { DocumentFact } from "./types";

export type StatementKey = "income" | "balance" | "cashflow" | "other";

export const STATEMENT_TITLES: Record<StatementKey, string> = {
  income: "Income statement",
  balance: "Balance sheet",
  cashflow: "Cash flow",
  other: "Other figures",
};

/** Row order inside each statement; also decides which statement a metric is in. */
const STATEMENT_METRICS: Record<Exclude<StatementKey, "other">, string[]> = {
  income: [
    "revenue",
    "raw_materials_used",
    "cost_of_goods_sold",
    "depreciation_and_amortization",
    "ebitda",
    "operating_income",
    "ebit",
    "interest_expense",
    "income_before_tax",
    "income_tax_expense",
    "profit_continuing_operations",
    "profit_discontinued_operations",
    "impairment_loss",
    "net_income",
    "eps_basic",
  ],
  balance: [
    "total_assets",
    "cash_and_equivalents",
    "total_liabilities",
    "total_debt",
    "lease_liabilities",
    "hybrid_capital",
    "minority_interests",
    "total_equity",
  ],
  cashflow: [
    "operating_cash_flow",
    "capital_expenditures",
    "decommissioning_payments",
    "interest_paid_financing",
    "lease_payments_financing",
    "hybrid_distributions",
  ],
};

const STATEMENT_ORDER: StatementKey[] = ["income", "balance", "cashflow", "other"];

export function statementOf(metric: string): StatementKey {
  for (const key of ["income", "balance", "cashflow"] as const) {
    if (STATEMENT_METRICS[key].includes(metric)) return key;
  }
  return "other";
}

export interface StatementRow {
  metric: string;
  label: string;
  /** One figure per period (latest period first in the group's `periods`). */
  cells: Record<string, DocumentFact>;
}

export interface StatementGroup {
  key: StatementKey;
  title: string;
  /** Newest first, e.g. ["FY2025", "FY2024"]. */
  periods: string[];
  rows: StatementRow[];
}

export function groupStatements(facts: DocumentFact[]): StatementGroup[] {
  const byGroup = new Map<StatementKey, Map<string, StatementRow>>();
  for (const fact of facts) {
    const key = statementOf(fact.metric);
    const rows = byGroup.get(key) ?? new Map<string, StatementRow>();
    const row = rows.get(fact.metric) ?? {
      metric: fact.metric,
      label: FACT_LABELS[fact.metric] ?? fact.metric,
      cells: {},
    };
    const existing = row.cells[fact.period];
    // The extractor never stores two figures for one metric+period; if it
    // ever did, show the more trusted one.
    if (!existing || fact.confidence > existing.confidence) row.cells[fact.period] = fact;
    rows.set(fact.metric, row);
    byGroup.set(key, rows);
  }

  const groups: StatementGroup[] = [];
  for (const key of STATEMENT_ORDER) {
    const rows = byGroup.get(key);
    if (!rows) continue;
    const order = key === "other" ? [] : STATEMENT_METRICS[key];
    const sorted = [...rows.values()].sort((a, b) => {
      const ai = order.indexOf(a.metric);
      const bi = order.indexOf(b.metric);
      if (ai !== bi) return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
      return a.label.localeCompare(b.label);
    });
    const periods = [...new Set(sorted.flatMap((r) => Object.keys(r.cells)))].sort((a, b) => b.localeCompare(a));
    groups.push({ key, title: STATEMENT_TITLES[key], periods, rows: sorted });
  }
  return groups;
}

/** A figure as shown in a cell: filing-scale money, plain counts, per-share. */
export function formatFactValue(fact: DocumentFact): string {
  if (fact.metric === "shares_outstanding") return formatDecimal(fact.value, 0);
  if (fact.unit.includes("/")) return `${fact.currency ?? ""} ${formatDecimal(fact.value, 2)}`.trim();
  return formatMoney(fact.value, fact.currency);
}

/** Only a figure with a real page can be jumped to. */
export function jumpablePage(fact: DocumentFact): number | null {
  return fact.source_page && fact.source_page > 0 ? fact.source_page : null;
}

/** Stable identity of one cell, for "which figure is showing in the filing". */
export function factKey(fact: Pick<DocumentFact, "metric" | "period">): string {
  return `${fact.metric}|${fact.period}`;
}
