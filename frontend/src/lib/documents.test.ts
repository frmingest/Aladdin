import { describe, expect, it } from "vitest";
import { viewKindOf } from "./documents";

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
