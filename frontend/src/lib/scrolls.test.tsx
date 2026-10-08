import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ScrollsLibrary from "../components/ScrollsLibrary";
import {
  MAX_OPENED,
  OPENED_KEY,
  formatTag,
  groupScrolls,
  loadOpened,
  readsAsScroll,
  saveOpened,
  scrollDate,
  shelfOf,
  unopenedCount,
  withOpened,
} from "./scrolls";
import type { DocumentSummary } from "./types";

function doc(over: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    holding_id: "h1",
    type: "annual_report",
    original_filename: "report.pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    uploaded_at: "2026-10-01T10:00:00Z",
    reporting_period: null,
    sha256: "x",
    status: "processed",
    quality_flags: {},
    page_count: 1,
    fact_count: 0,
    ...over,
  };
}

describe("shelves", () => {
  it("annual on one shelf, quarterly and half-year on another, everything else in miscellaneous", () => {
    expect(shelfOf("annual_report")).toBe("annual");
    expect(shelfOf("quarterly_report")).toBe("quarterly");
    for (const t of ["presentation", "prospectus", "transcript", "other", "fund_factsheet", "fund_report", "sec_filing"]) {
      expect(shelfOf(t)).toBe("misc");
    }
  });

  it("always returns the three shelves in the same order, empty ones included", () => {
    const shelves = groupScrolls([]);
    expect(shelves.map((s) => s.id)).toEqual(["annual", "quarterly", "misc"]);
    expect(shelves.every((s) => s.documents.length === 0)).toBe(true);
  });

  it("puts each document on its shelf, newest first, using Newsweb's date when it has one", () => {
    const docs = [
      doc({ id: "a-old", type: "annual_report", uploaded_at: "2026-10-05T00:00:00Z", quality_flags: { newsweb_source: { published_at: "2025-03-01T00:00:00Z" } } }),
      doc({ id: "a-new", type: "annual_report", uploaded_at: "2026-09-01T00:00:00Z", quality_flags: { newsweb_source: { published_at: "2026-03-01T00:00:00Z" } } }),
      doc({ id: "q1", type: "quarterly_report", uploaded_at: "2026-08-01T00:00:00Z" }),
      doc({ id: "p1", type: "presentation" }),
      doc({ id: "t1", type: "transcript" }),
    ];
    const [annual, quarterly, misc] = groupScrolls(docs);
    expect(annual.documents.map((d) => d.id)).toEqual(["a-new", "a-old"]);
    expect(quarterly.documents.map((d) => d.id)).toEqual(["q1"]);
    expect(misc.documents.map((d) => d.id).sort()).toEqual(["p1", "t1"]);
  });

  it("falls back to the upload time when the source date is missing or junk", () => {
    expect(scrollDate(doc({ id: "x", quality_flags: { newsweb_source: { published_at: 5 } } }))).toBe("2026-10-01T10:00:00Z");
    expect(scrollDate(doc({ id: "x", quality_flags: { newsweb_source: "nope" } }))).toBe("2026-10-01T10:00:00Z");
  });

  it("names the file format on a scroll's tag", () => {
    expect(formatTag("a.PDF")).toBe("PDF");
    expect(formatTag("a.xhtml")).toBe("XHTML");
    expect(formatTag("a.xlsx")).toBe("Table");
    expect(formatTag("a.pptx")).toBe("Slides");
    expect(formatTag("a.zip")).toBe("File");
  });
});

describe("opened scrolls (per browser)", () => {
  const memory = () => {
    const data: Record<string, string> = {};
    return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
  };

  it("round-trips, and reads junk or blocked storage as nothing opened", () => {
    const m = memory();
    saveOpened(new Set(["a", "b"]), m);
    expect([...loadOpened(m)]).toEqual(["a", "b"]);
    m.data[OPENED_KEY] = "{not json";
    expect(loadOpened(m).size).toBe(0);
    m.data[OPENED_KEY] = JSON.stringify([1, "ok", null]);
    expect([...loadOpened(m)]).toEqual(["ok"]);
    expect(loadOpened(null).size).toBe(0);
    expect(() => saveOpened(new Set(["a"]), null)).not.toThrow();
  });

  it("keeps the newest ids when the list is capped", () => {
    const m = memory();
    saveOpened(new Set(Array.from({ length: MAX_OPENED + 5 }, (_, i) => `d${i}`)), m);
    const kept = loadOpened(m);
    expect(kept.size).toBe(MAX_OPENED);
    expect(kept.has(`d${MAX_OPENED + 4}`)).toBe(true);
    expect(kept.has("d0")).toBe(false);
  });

  it("marks one opened and counts the sealed rest", () => {
    const docs = [doc({ id: "a" }), doc({ id: "b" })];
    const opened = withOpened(new Set(), "a");
    expect(unopenedCount(docs, opened)).toBe(1);
    expect(unopenedCount(docs, withOpened(opened, "b"))).toBe(0);
  });
});

describe("which reader a document opens in", () => {
  it("every document opens as a scroll except an annual report in XHTML", () => {
    expect(readsAsScroll({ original_filename: "q3.pdf", type: "quarterly_report" })).toBe(true);
    expect(readsAsScroll({ original_filename: "annual.pdf", type: "annual_report" })).toBe(true);
    expect(readsAsScroll({ original_filename: "q3.xhtml", type: "quarterly_report" })).toBe(true);
    expect(readsAsScroll({ original_filename: "deck.pptx", type: "presentation" })).toBe(true);
    expect(readsAsScroll({ original_filename: "annual.xhtml", type: "annual_report" })).toBe(false);
    expect(readsAsScroll({ original_filename: "annual.HTM", type: "annual_report" })).toBe(false);
  });
  it("an XHTML filing opened without a known type (the eye next to a figure) keeps the side-by-side reader", () => {
    expect(readsAsScroll({ original_filename: "annual.xhtml" })).toBe(false);
    expect(readsAsScroll({ original_filename: "file.pdf" })).toBe(true);
  });
});

describe("scrolls library markup", () => {
  const docs = [
    doc({ id: "a", type: "annual_report", reporting_period: "FY2025", original_filename: "annual.xhtml", fact_count: 120 }),
    doc({ id: "q", type: "quarterly_report", reporting_period: "Q3 2026" }),
    doc({ id: "p", type: "presentation" }),
  ];
  const html = renderToStaticMarkup(<ScrollsLibrary documents={docs} deletingId={null} onDelete={() => {}} />);

  it("shows the three shelves, the periods and the sealed count, and no reward wording", () => {
    expect(html).toContain("Annual reports");
    expect(html).toContain("Quarterly and half-year reports");
    expect(html).toContain("Miscellaneous");
    expect(html).toContain("FY2025");
    expect(html).toContain("Q3 2026");
    expect(html).toContain("3 of 3 scrolls still sealed");
    expect(html).not.toMatch(/\b(unlock|points?|streak|reward|level up|buy|sell)\b/i);
  });
  it("says so when a shelf is empty and when the library is", () => {
    const empty = renderToStaticMarkup(<ScrollsLibrary documents={[]} deletingId={null} onDelete={() => {}} />);
    expect(empty).toContain("The shelves are empty.");
    expect(empty).toContain("No annual report on this shelf yet.");
  });
});
