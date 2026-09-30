import { describe, expect, it } from "vitest";
import { factFragment, pageFragment, viewKindOf } from "./documents";

describe("viewKindOf", () => {
  it("shows PDFs and HTML/XHTML filings inline", () => {
    expect(viewKindOf("Q2 Report English.PDF")).toBe("pdf");
    expect(viewKindOf("kongsberg-2025-12-31-1-nb.xhtml")).toBe("html");
    expect(viewKindOf("report.htm")).toBe("html");
  });
  it("treats office files and CSV as downloads", () => {
    expect(viewKindOf("deck.pptx")).toBe("download");
    expect(viewKindOf("positions.xlsx")).toBe("download");
    expect(viewKindOf("export.csv")).toBe("download");
  });
});

describe("pageFragment", () => {
  it("uses the PDF viewer's #page=N and the backend's anchors for XHTML", () => {
    expect(pageFragment("pdf", 12)).toBe("#page=12");
    expect(pageFragment("html", 12)).toBe("#aladdin-page-12");
  });
  it("has nothing to jump to without a real page or for downloads", () => {
    expect(pageFragment("html", null)).toBe("");
    expect(pageFragment("html", 0)).toBe("");
    expect(pageFragment("pdf", 1.5)).toBe("");
    expect(pageFragment("download", 3)).toBe("");
  });
});

describe("factFragment", () => {
  const revenue = { metric: "revenue", period: "FY2025", source_page: 7 };
  it("targets the figure itself in XHTML and its page in a PDF", () => {
    expect(factFragment("html", revenue)).toBe("#aladdin-fact-revenue-FY2025");
    expect(factFragment("pdf", revenue)).toBe("#page=7");
  });
  it("matches the backend's id rule for unusual characters", () => {
    expect(factFragment("html", { metric: "a b", period: "FY/2025", source_page: 2 })).toBe("#aladdin-fact-a_b-FY_2025");
  });
  it("has nothing to open at without a page, or for downloads", () => {
    expect(factFragment("html", { ...revenue, source_page: null })).toBe("");
    expect(factFragment("html", { ...revenue, source_page: 0 })).toBe("");
    expect(factFragment("download", revenue)).toBe("");
  });
});
