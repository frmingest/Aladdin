import { describe, expect, it } from "vitest";
import { bannerText, checkLabel, checkTone, scopeLabel } from "./tagReview";
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
      gaps: metrics.map((metric) => ({ metric, fiscal_year: "FY2025", candidates: [] })),
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
