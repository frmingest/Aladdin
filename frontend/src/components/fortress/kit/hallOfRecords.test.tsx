import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { DecisionRecord, Records } from "../../../lib/types";
import HallOfRecords from "./HallOfRecords";
import TorchPair from "./TorchPair";

const rec = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "r1", holding_id: null, ticker: "X", company_name: "Acme", action: "buy", decided_on: "2026-01-02", days_since: 100,
  thesis: "My thesis", invalidation: null, confidence: 3, verdict_then: null, verdict_now: null, price_then: "10", price_now: "20", price_now_at: null,
  currency: "NOK", price_change_pct: "100", price_note: null, review_6m: "not_due", review_12m: "not_due", review_6m_text: null, review_12m_text: null, ...over,
});
const records = (list: DecisionRecord[]): Records => ({ rules_version: "t", demo: true, records: list, reviews_due: 0, caption: "Caption." });
const html = (list: DecisionRecord[]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <HallOfRecords records={records(list)} />
    </MemoryRouter>,
  );

describe("hall of records art", () => {
  it("draws the torches as two undistorted lamps, never one stretched picture", () => {
    const out = renderToStaticMarkup(<TorchPair />);
    expect(out.match(/<svg/g)).toHaveLength(2);
    expect(out).not.toContain("preserveAspectRatio");
  });

  it("repeats the arches at a fixed size instead of stretching them across the page", () => {
    const out = html([rec()]);
    expect(out).toContain("<pattern");
    expect(out).not.toContain('preserveAspectRatio="none"');
  });

  it("puts the name, the act and the date on the nameplate, with the full name as a tooltip", () => {
    const out = html([rec({ company_name: "Xtrackers Europe Defence Technologies UCITS ETF 1C" })]);
    expect(out).toContain('title="Xtrackers Europe Defence Technologies UCITS ETF 1C"');
    expect(out).toContain("hall-label-action");
    expect(out).toContain("hall-label-date");
  });

  it("shows the opened book at once on load: the swinging cover is decoration and the swing is off until a press", () => {
    const out = html([rec()]);
    expect(out).not.toContain("hall-book--opening");
    expect(out).toMatch(/class="hall-cover" aria-hidden="true"/);
    expect(out).toContain("What you wrote then");
  });

  it("hangs a ribbon in the book only when a review is owed", () => {
    expect(html([rec()])).not.toContain("hall-ribbon");
    expect(html([rec({ review_6m: "due" })])).toContain("hall-ribbon");
  });
});
