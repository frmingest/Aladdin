import { describe, expect, it } from "vitest";
import type { DocumentSummary } from "../lib/types";
import { latestReport } from "./libraryReport";

function doc(id: string, type: string, uploaded_at: string, flags: Record<string, unknown> = {}): DocumentSummary {
  return {
    id, holding_id: "h1", type, original_filename: `${id}.xhtml`, mime_type: "application/xhtml+xml", size_bytes: 1,
    uploaded_at, reporting_period: null, sha256: id, status: "done", quality_flags: flags, page_count: 1, fact_count: 1,
  };
}

describe("latestReport", () => {
  it("is null when no financial report is stored", () => {
    expect(latestReport([])).toBeNull();
    expect(latestReport([doc("a", "other", "2026-01-01T00:00:00Z")])).toBeNull();
  });
  it("picks the newest annual or quarterly report by its own date", () => {
    const docs = [
      doc("old", "annual_report", "2026-01-01T00:00:00Z"),
      doc("new", "quarterly_report", "2026-05-01T00:00:00Z"),
      doc("memo", "other", "2026-09-01T00:00:00Z"),
    ];
    expect(latestReport(docs)?.id).toBe("new");
  });
  it("uses the Newsweb date over the upload date", () => {
    const docs = [
      doc("a", "annual_report", "2026-09-01T00:00:00Z", { newsweb_source: { published_at: "2025-03-01T00:00:00Z" } }),
      doc("b", "quarterly_report", "2026-02-01T00:00:00Z"),
    ];
    expect(latestReport(docs)?.id).toBe("b");
  });
  it("lets the annual report win a tie", () => {
    const docs = [doc("q", "quarterly_report", "2026-05-01T00:00:00Z"), doc("a", "annual_report", "2026-05-01T00:00:00Z")];
    expect(latestReport(docs)?.id).toBe("a");
  });
});
