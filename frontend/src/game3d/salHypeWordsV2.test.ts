import { describe, expect, it } from "vitest";
import { readTip, type HypeReading } from "../lib/hype";
import type { CaptureSummary } from "../lib/salesRep";
import {
  BOOTH_BANNED, NOT_ANALYSED_YET_V2, NOTHING_HEADLINE_V2, PARTNER_BUSY_V2, PARTNER_LINES_V2, CANT_READ_V2, QUEUE_FAILED_V2,
  addedLineV2, captureLineV2, missingV2, readingV2,
} from "./salHypeWordsV2";

const BUY_SELL = /\b(buy|sell|avoid)\b/i;
const outcomes = ["captured", "up_to_date", "empty", "not_found", "not_oslo", "switched_off", "failed"] as const;
const summary = (outcome: (typeof outcomes)[number]): CaptureSummary => ({ outcome, annualCount: 3, halfYearCount: 2, newlyImported: 1, alreadyOnFile: 1, notes: [], detail: "boom" });

describe("Sal and Hype Booth game voice (3D)", () => {
  it("no system words on the page face", () => {
    const lines = [
      ...Object.values(PARTNER_LINES_V2), NOT_ANALYSED_YET_V2, NOTHING_HEADLINE_V2, PARTNER_BUSY_V2, CANT_READ_V2, QUEUE_FAILED_V2,
      ...outcomes.map((o) => captureLineV2(summary(o))),
      ...[0, 1, 2].flatMap((s) => [true, false, null].map((p) => addedLineV2({ name: "Acme", ticker: "ACME", owned: false, hasPrice: p, oslo: false }, s))),
    ];
    for (const l of lines) {
      for (const re of BOOTH_BANNED) expect(l, l).not.toMatch(re);
      expect(l, l).not.toMatch(BUY_SELL);
    }
  });

  it("an unseen ticker is fog, with no raw missing words", () => {
    const r = readingV2(readTip(null, true));
    expect(r.key).toBe("nothing");
    expect(r.headline).toBe(NOTHING_HEADLINE_V2);
    for (const m of r.missing) for (const re of BOOTH_BANNED) expect(`${m.label} ${m.fixText}`).not.toMatch(re);
  });

  it("the reading keeps the same gates, verdict and key as V1", () => {
    const v1: HypeReading = readTip(null, false);
    const v2 = readingV2(v1);
    expect(v2.key).toBe(v1.key);
    expect(v2.gates).toBe(v1.gates);
    expect(v2.verdict).toBe(v1.verdict);
    expect(v2.steps).toEqual(v1.steps);
  });

  it("keeps the reason on a valuation gap", () => {
    const m = missingV2({ id: "valuation", label: "No usable valuation: no filings", fix: "queue", fixText: "x" });
    expect(m.label).toBe("No worth estimate yet: no filings");
  });
});
