import { describe, expect, it } from "vitest";
import {
  HEARD_FROM,
  NOT_ANALYSED_YET,
  PARTNER_LINES,
  allHypeLines,
  heardNote,
  hypeIntroLine,
  missingForJudgement,
  partnerLine,
  pitchLine,
  readTip,
  withHeardNote,
} from "./hype";
import type { StoreData } from "./marketStore";
import type { WatchlistRow } from "./types";

const row = (over: Partial<WatchlistRow> = {}): WatchlistRow =>
  ({
    id: "w1", holding_id: "h1", ticker: "AAA.OL", name: "Alpha", sector: null, instrument_type: "stock", owned: false,
    buy_below_price: null, buy_below_currency: null, notes: null, added_at: "2026-10-01", price: "100",
    price_currency: "NOK", price_as_of: null, distance_to_buy_pct: null, status: "no_target", dcf_base: null,
    margin_of_safety_base: null, verdict_rating: null, moat_rating: null, analyzed_at: null, unavailable_reason: null,
    ...over,
  }) as WatchlistRow;

const data = (over: Partial<StoreData> = {}): StoreData => ({
  holding: null, row: row(), valuation: null, analysis: null, thesis: null, metrics: null, problems: [], ...over,
});

describe("the tip note", () => {
  it("records where and when, with an optional detail", () => {
    expect(heardNote("Reddit", "", "2026-10-03T10:00:00Z")).toBe("Heard from Reddit on 2026-10-03.");
    expect(heardNote("a friend", " Ola ", "2026-10-03")).toBe("Heard from a friend (Ola) on 2026-10-03.");
    expect(HEARD_FROM).toContain("a newsletter");
  });

  it("appends to existing notes and never duplicates", () => {
    const note = heardNote("Reddit", "", "2026-10-03");
    expect(withHeardNote(null, note)).toBe(note);
    expect(withHeardNote("my own thought", note)).toBe(`my own thought\n${note}`);
    expect(withHeardNote(`x\n${note}`, note)).toBe(`x\n${note}`);
  });
});

describe("what is missing", () => {
  it("lists everything for a ticker the app has never seen, with the Oslo fix when it is an Oslo symbol", () => {
    const m = missingForJudgement(null, true);
    expect(m.map((x) => x.id)).toEqual(["price", "filings", "valuation", "analysis"]);
    expect(m.find((x) => x.id === "filings")?.fix).toBe("newsweb");
    expect(missingForJudgement(null, false).find((x) => x.id === "filings")?.fix).toBe("upload");
  });

  it("lists only what is actually absent for a known company", () => {
    const m = missingForJudgement(data({ row: row({ price: null }) }), true);
    expect(m.map((x) => x.id)).toEqual(["price", "filings", "valuation", "analysis"]);
    const priced = missingForJudgement(data(), true);
    expect(priced.map((x) => x.id)).not.toContain("price");
  });
});

describe("reading a tip", () => {
  it("an unknown ticker is Cannot judge yet, with no gates and no verdict", () => {
    const r = readTip(null, true);
    expect(r.key).toBe("nothing");
    expect(r.gates).toEqual([]);
    expect(r.verdict).toBeNull();
    expect(r.headline).toMatch(/cannot judge yet/i);
    expect(r.partner).toBe(partnerLine("nothing"));
    expect(r.missing.length).toBe(4);
  });

  it("a known company with almost nothing stored is also not judged, never called good", () => {
    const r = readTip(data(), true);
    expect(r.verdict?.level).toBe("unknown");
    expect(r.key).toBe("unknown");
    expect(r.partner).toBe(PARTNER_LINES.unknown);
    expect(r.gates).toHaveLength(8);
    expect(r.rulesVersion).toBe("market-v1");
  });
});

describe("wording rules", () => {
  const FORBIDDEN = /\b(buy|buying|sell|selling|purchase|invest|investing|investment|guarantee|guaranteed|can't lose|moon|sure thing|winner|trim|rally|crash|rocket)\b/i;
  it("never advises, promises returns or talks of trades", () => {
    for (const line of allHypeLines()) expect(line, line).not.toMatch(FORBIDDEN);
  });

  it("is not a real person's name or catchphrase", () => {
    for (const line of allHypeLines()) expect(line, line).not.toMatch(/cramer|booyah|mad money|buffett|munger/i);
  });

  it("has a line for every level, a pitch for every seed, and the honest not-analysed sentence", () => {
    for (const key of Object.keys(PARTNER_LINES)) expect(PARTNER_LINES[key as keyof typeof PARTNER_LINES].length).toBeGreaterThan(20);
    for (let s = 0; s < 8; s++) expect(pitchLine("TICK", s)).toContain("TICK");
    expect(hypeIntroLine(7).length).toBeGreaterThan(20);
    expect(NOT_ANALYSED_YET).toMatch(/nothing is analysed yet/i);
  });

  it("never calls an unsettled tip good", () => {
    expect(PARTNER_LINES.nothing).toMatch(/cannot judge/i);
    expect(PARTNER_LINES.ready).toMatch(/not a signal/i);
    expect(PARTNER_LINES.promising).toMatch(/not a signal/i);
  });
});
