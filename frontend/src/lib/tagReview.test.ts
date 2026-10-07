import { describe, expect, it } from "vitest";
import {
  acceptScopeText,
  bannerText,
  checkLabel,
  checkTone,
  pendingHoldings,
  reextractSummary,
  ruleScopeLabel,
  ruleStatusLabel,
  scopeLabel,
  secondConfirmationText,
} from "./tagReview";
import type { TagReview } from "./types";

const review = (metrics: string[]): TagReview => ({
  holdings_needing_review: metrics.length ? 1 : 0,
  total_gaps: metrics.length,
  holdings: [
    {
      holding_id: "h1",
      ticker: "ACME.OL",
      name: "Acme",
      document_id: "d1",
      filename: "acme.xhtml",
      fiscal_year: "FY2025",
      gaps: metrics.map((metric) => ({ metric, fiscal_year: "FY2025", candidates: [], rejected_hidden: 0, rule_pending: false })),
      unused: [],
      chat_summary: "",
    },
  ],
});

describe("tag review labels", () => {
  it("says what a check means and never relies on colour", () => {
    expect(checkLabel("ties")).toMatch(/ties/i);
    expect(checkLabel("does_not_tie")).toMatch(/does not tie/i);
    expect(checkTone("ties")).toBe("good");
    expect(checkTone("does_not_tie")).toBe("warn");
    expect(checkTone("no_check")).toBe("plain");
  });

  it("names the scope of a suggestion", () => {
    expect(scopeLabel("all")).toMatch(/all companies/i);
    expect(scopeLabel("company")).toMatch(/this company only/i);
  });
});

describe("bannerText", () => {
  it("is null when nothing is missing", () => {
    expect(bannerText(review([]))).toBeNull();
    expect(bannerText({ holdings: [], holdings_needing_review: 0, total_gaps: 0 })).toBeNull();
  });

  it("lists up to four inputs and counts the rest", () => {
    expect(bannerText(review(["capital expenditure"]))).toBe(
      "1 input not extracted from the FY2025 report: capital expenditure.",
    );
    expect(bannerText(review(["a", "b", "c", "d", "e", "f"]))).toBe(
      "6 inputs not extracted from the FY2025 report: a, b, c, d and 2 more.",
    );
  });
});

describe("accepting a suggestion (PR 2)", () => {
  it("says who a rule will apply to, following the tag type", () => {
    expect(acceptScopeText({ suggested_scope: "company" }, "Orkla")).toMatch(/Orkla only/);
    expect(acceptScopeText({ suggested_scope: "all" }, "Orkla")).toMatch(/every company/i);
  });

  it("explains a failed check in the second confirmation and warns about the valuation", () => {
    const text = secondConfirmationText({
      check: "does_not_tie",
      check_detail: "assets − equity = 100, this line = 900",
      warning: "larger than twice revenue",
    });
    expect(text).toMatch(/failed its own check/);
    expect(text).toMatch(/assets − equity = 100/);
    expect(text).toMatch(/larger than twice revenue/);
    expect(text).toMatch(/Accept it anyway\?/);
  });

  it("finds the companies with a saved rule waiting for a re-extract", () => {
    const base = review(["total debt"]);
    expect(pendingHoldings(base)).toHaveLength(0);
    base.holdings[0].gaps[0].rule_pending = true;
    expect(pendingHoldings(base).map((h) => h.ticker)).toEqual(["ACME.OL"]);
  });

  it("labels rules by scope and by how they were accepted", () => {
    expect(ruleScopeLabel({ scope: "all", ticker: "ACME.OL" })).toBe("All companies");
    expect(ruleScopeLabel({ scope: "company", ticker: "ORK.OL" })).toBe("ORK.OL only");
    expect(ruleStatusLabel({ status: "rejected", check_overridden: false })).toMatch(/Rejected/);
    expect(ruleStatusLabel({ status: "accepted", check_overridden: true })).toMatch(/failed check/);
    expect(ruleStatusLabel({ status: "accepted", check_overridden: false })).toBe("Rule");
  });

  it("summarises a re-extract without claiming figures that were not added", () => {
    const base = { holding_id: "h", ticker: "ORK.OL", documents: 2, rule_figures: 0, notes: [] as string[] };
    expect(reextractSummary({ ...base, facts_before: 80, facts_after: 80 })).toMatch(/unchanged.*none read by a rule/);
    expect(reextractSummary({ ...base, facts_before: 80, facts_after: 84, rule_figures: 4 })).toMatch(/80 → 84.*4 read by a rule/);
    expect(reextractSummary({ ...base, documents: 0, facts_before: 5, facts_after: 5, notes: ["file missing"] })).toMatch(
      /no stored tagged report.*file missing/,
    );
  });
});
