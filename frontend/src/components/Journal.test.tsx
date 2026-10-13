import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { JournalEntry } from "../lib/types";
import { JournalEntryCard, JournalEntryForm } from "./Journal";

const entry: JournalEntry = {
  id: "e1",
  holding_id: "h1",
  ticker: "EQNR.OL",
  company_name: "Equinor",
  action: "buy",
  decided_on: "2026-03-02",
  price: "281.5000",
  currency: "NOK",
  quantity: "10.000000",
  thesis: "Cheap on owner earnings",
  invalidation: "Dividend cut",
  confidence: 4,
  verdict_at_decision: null,
  review_6m: "Still holds",
  review_12m: null,
  created_at: "2026-03-02T10:00:00Z",
  updated_at: "2026-03-02T10:00:00Z",
  outcome: {
    days_since: 40,
    latest_price: null,
    latest_price_at: null,
    return_pct: null,
    in_favour: null,
    price_6m: null,
    return_6m_pct: null,
    price_12m: null,
    return_12m_pct: null,
    review_6m_due: false,
    review_12m_due: false,
    note: null,
  },
};

describe("journal entry editing", () => {
  it("shows an Edit action next to Delete on each entry", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <JournalEntryCard entry={entry} onChanged={() => {}} />
      </MemoryRouter>,
    );
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Delete<");
  });

  it("prefills the form from the entry and saves with 'Save changes'", () => {
    const html = renderToStaticMarkup(<JournalEntryForm entry={entry} onSaved={() => {}} />);
    expect(html).toContain("Save changes");
    expect(html).toContain("Cheap on owner earnings");
    expect(html).toContain("Dividend cut");
    expect(html).toContain('value="281.5"'); // trailing zeros trimmed
    expect(html).toContain('value="10"');
    expect(html).toContain('value="2026-03-02"');
    expect(html).toContain("Still holds");
    expect(html).not.toContain("Choose…"); // the company can't be changed when editing
  });

  it("keeps the create form unchanged", () => {
    const html = renderToStaticMarkup(<JournalEntryForm holdings={[]} onSaved={() => {}} />);
    expect(html).toContain("Save entry");
    expect(html).toContain("Choose…");
    expect(html).not.toContain("6-month review");
  });
});
