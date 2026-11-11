import { describe, expect, it } from "vitest";
import { categoryOf, headline, isReport, sortItems } from "./newswebNew";
import type { NewswebNewItem } from "./types";

const item = (id: string, category: string, published: string, title = "T"): NewswebNewItem => ({
  id,
  holding_id: "h1",
  ticker: "VAR.OL",
  holding_name: "Vår Energi ASA",
  title,
  summary: `Regulated announcement by Vår Energi ASA (VAR). Category: ${category}. Published: ${published.slice(0, 10)}. Attachments: 2.`,
  source_url: `https://newsweb.oslobors.no/message/${id}`,
  published_at: published,
  first_seen_at: published,
});

describe("newswebNew", () => {
  it("reads the category out of the summary", () => {
    expect(categoryOf(item("1", "HALF YEAR FINANCIAL REPORT", "2026-10-21T07:01:00Z"))).toBe("HALF YEAR FINANCIAL REPORT");
    expect(categoryOf({ ...item("1", "X", "2026-10-21T07:01:00Z"), summary: null })).toBeNull();
  });

  it("flags annual and half-year reports, not other categories", () => {
    expect(isReport(item("1", "HALF YEAR FINANCIAL REPORT", "2026-10-21T07:01:00Z"))).toBe(true);
    expect(isReport(item("2", "ANNUAL FINANCIAL REPORT", "2026-04-17T07:01:00Z"))).toBe(true);
    expect(isReport(item("3", "MANAGERS' TRANSACTION", "2026-10-22T07:01:00Z"))).toBe(false);
  });

  it("puts reports first, then newest first", () => {
    const sorted = sortItems([
      item("a", "MANAGERS' TRANSACTION", "2026-10-25T07:00:00Z"),
      item("b", "HALF YEAR FINANCIAL REPORT", "2026-10-21T07:01:00Z"),
      item("c", "INSIDE INFORMATION", "2026-10-23T07:00:00Z"),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("words the headline", () => {
    expect(headline([])).toBe("Nothing new on Newsweb.");
    expect(headline([item("a", "INSIDE INFORMATION", "2026-10-23T07:00:00Z")])).toBe("1 new Newsweb announcement");
    expect(
      headline([
        item("a", "INSIDE INFORMATION", "2026-10-23T07:00:00Z"),
        item("b", "HALF YEAR FINANCIAL REPORT", "2026-10-21T07:01:00Z"),
      ]),
    ).toBe("2 new Newsweb announcements, 1 is a report");
  });
});
