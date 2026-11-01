import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { JournalEntry, JournalOutcome } from "../lib/types";
import JournalBooksPanel from "./JournalBooksPanel";

function outcome(o: Partial<JournalOutcome> = {}): JournalOutcome {
  return {
    days_since: 200, latest_price: "100", latest_price_at: null, return_pct: "12.5", in_favour: true, price_6m: null, return_6m_pct: null,
    price_12m: null, return_12m_pct: null, review_6m_due: false, review_12m_due: false, note: null, ...o,
  };
}
function entry(o: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "e1", holding_id: "h1", ticker: "EQNR.OL", company_name: "Equinor", action: "buy", decided_on: "2026-03-10", price: "300", currency: "NOK",
    quantity: "10", thesis: "Cheap for the cash it makes.", invalidation: "Dividend cut.", confidence: 4, verdict_at_decision: null,
    review_6m: null, review_12m: null, created_at: "2026-03-10T09:00:00Z", updated_at: "2026-03-10T09:00:00Z", outcome: outcome(), ...o,
  };
}

function html(entries: JournalEntry[] | null, failed = false) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <JournalBooksPanel entries={entries} failed={failed} onChanged={() => {}} onBack={() => {}} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("JournalBooksPanel (the old books)", () => {
  it("reads an old entry in the journal's own words, with the server's number, and links to the flat journal", () => {
    const h = html([entry()]);
    expect(h).toContain("The old books");
    expect(h).toContain("Equinor");
    expect(h).toContain("Cheap for the cash it makes.");
    expect(h).toContain("Dividend cut.");
    expect(h).toContain("since then 12.5%");
    expect(h).toContain('href="/journal"');
    expect(h).toContain("Back to the desk");
    expect(h).toContain('aria-label="Close"');
  });

  it("is read only: no edit, no delete, no save box when no look-back is due", () => {
    const h = html([entry()]);
    expect(h).not.toMatch(/Edit|Delete|Save review/);
  });

  it("offers the flat journal's own look-back box when the 6-month review is due, and nothing else to write", () => {
    const h = html([entry({ outcome: outcome({ review_6m_due: true }) })]);
    expect(h).toContain("6-month review due");
    expect(h).toContain("Save review");
    expect(h).not.toMatch(/Delete/);
  });

  it("shows a written review and says plainly when the wrong-if line was never written", () => {
    const h = html([entry({ invalidation: null, review_6m: "Held up." })]);
    expect(h).toContain("Not written");
    expect(h).toContain("6-month review: ");
    expect(h).toContain("Held up.");
  });

  it("lists the newest decision first", () => {
    const h = html([entry({ id: "old", company_name: "Oldco", decided_on: "2026-01-02" }), entry({ id: "new", company_name: "Newco", decided_on: "2026-06-02" })]);
    expect(h.indexOf("Newco")).toBeLessThan(h.indexOf("Oldco"));
  });

  it("says so when the journal is empty, and says it could not be read instead of looking empty", () => {
    expect(html([])).toContain("No entries yet. Write the first one at the desk.");
    const failed = html(null, true);
    expect(failed).toContain("The journal could not be read just now.");
    expect(failed).not.toContain("No entries yet");
  });
});
