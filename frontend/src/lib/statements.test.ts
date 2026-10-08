import { describe, expect, it } from "vitest";
import type { DocumentFact } from "./types";
import {
  factKey,
  formatFactValue,
  groupStatements,
  isComparativePeriod,
  jumpablePage,
  ownPeriodOf,
  statementOf,
} from "./statements";

function fact(metric: string, period: string, value: string, page: number | null = 2, extra: Partial<DocumentFact> = {}): DocumentFact {
  return { metric, period, value, unit: "USD", currency: "USD", source_page: page, confidence: 1, ...extra };
}

describe("statementOf", () => {
  it("files metrics under their statement and everything else under other", () => {
    expect(statementOf("revenue")).toBe("income");
    expect(statementOf("total_assets")).toBe("balance");
    expect(statementOf("capital_expenditures")).toBe("cashflow");
    expect(statementOf("shares_outstanding")).toBe("other");
    expect(statementOf("something_new")).toBe("other");
  });
});

describe("groupStatements", () => {
  const facts = [
    fact("net_income", "FY2024", "100"),
    fact("revenue", "FY2025", "8095600000"),
    fact("revenue", "FY2024", "7450100000"),
    fact("net_income", "FY2025", "846400000"),
    fact("total_assets", "FY2025", "26145300000", 3),
    fact("shares_outstanding", "FY2025", "2500000000", null, { unit: "shares", currency: null }),
  ];
  const groups = groupStatements(facts);

  it("orders statements and their rows the way a filing reads", () => {
    expect(groups.map((g) => g.key)).toEqual(["income", "balance", "other"]);
    expect(groups[0].rows.map((r) => r.metric)).toEqual(["revenue", "net_income"]);
  });
  it("puts the newest period first and gives each row one cell per period", () => {
    expect(groups[0].periods).toEqual(["FY2025", "FY2024"]);
    expect(groups[0].rows[0].cells["FY2024"].value).toBe("7450100000");
    expect(groups[1].periods).toEqual(["FY2025"]);
  });
  it("labels rows with the app's names", () => {
    expect(groups[0].rows[0].label).toBe("Revenue");
  });
  it("omits statements with no figures", () => {
    expect(groupStatements([fact("revenue", "FY2025", "1")]).map((g) => g.key)).toEqual(["income"]);
    expect(groupStatements([])).toEqual([]);
  });
  it("keeps the more trusted figure if a metric+period ever repeats", () => {
    const g = groupStatements([
      fact("revenue", "FY2025", "1", 2, { confidence: 0.6 }),
      fact("revenue", "FY2025", "2", 2, { confidence: 1 }),
    ]);
    expect(g[0].rows[0].cells["FY2025"].value).toBe("2");
  });
});

describe("formatFactValue / jumpablePage / factKey", () => {
  it("formats money, share counts and per-share amounts", () => {
    expect(formatFactValue(fact("revenue", "FY2025", "8095600000"))).toBe("USD 8,095.6m");
    expect(formatFactValue(fact("shares_outstanding", "FY2025", "2500000000", null, { unit: "shares", currency: null }))).toBe("2,500,000,000");
    expect(formatFactValue(fact("eps_basic", "FY2025", "0.42", 2, { unit: "USD/shares" }))).toBe("USD 0.42");
  });
  it("only pages above zero are jumpable", () => {
    expect(jumpablePage(fact("revenue", "FY2025", "1", 7))).toBe(7);
    expect(jumpablePage(fact("revenue", "FY2025", "1", 0))).toBeNull();
    expect(jumpablePage(fact("revenue", "FY2025", "1", null))).toBeNull();
  });
  it("identifies a cell by metric and period", () => {
    expect(factKey(fact("revenue", "FY2025", "1"))).toBe("revenue|FY2025");
  });
});

describe("ownPeriodOf / isComparativePeriod", () => {
  it("reads the latest year an iXBRL filing reports", () => {
    expect(ownPeriodOf({ ixbrl: { fiscal_years: ["FY2020", "FY2021", "FY2019"] } })).toBe("FY2021");
    expect(ownPeriodOf({ esef_index: { fiscal_years: ["FY2024", "FY2023"] } })).toBe("FY2024");
  });

  it("is null for files without tags", () => {
    expect(ownPeriodOf({ page_count: 3 })).toBeNull();
    expect(ownPeriodOf(null)).toBeNull();
    expect(ownPeriodOf({ ixbrl: { fiscal_years: "FY2021" } })).toBeNull();
  });

  it("marks only years older than the filing's own as comparatives", () => {
    expect(isComparativePeriod("FY2020", "FY2021")).toBe(true);
    expect(isComparativePeriod("FY2021", "FY2021")).toBe(false);
    expect(isComparativePeriod("FY2020", null)).toBe(false);
  });
});
