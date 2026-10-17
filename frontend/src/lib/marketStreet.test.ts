import { describe, expect, it } from "vitest";
import { BLOCK, decorId, decorSlots, districtOf, gapLabel, jitterPx, STREET_DECOR, streetDistricts, stallLabel, TONE_FLAG } from "./marketStreet";
import { orderStreet, shopFront } from "./marketplace";
import { OBJECT_ART } from "./stitchArt";
import type { WatchlistRow } from "./types";

function row(over: Partial<WatchlistRow>): WatchlistRow {
  return {
    id: "r1",
    holding_id: "h1",
    name: "Equinor",
    ticker: "EQNR.OL",
    sector: "Energy",
    status: "above",
    distance_to_buy_pct: null,
    price: null,
    price_currency: null,
    buy_below_price: null,
    buy_below_currency: null,
    owned: false,
    verdict_rating: null,
    moat_rating: null,
    analyzed_at: null,
    ...over,
  } as unknown as WatchlistRow;
}

describe("districtOf", () => {
  it("reads the stored status, and sends every unpriced status to the fog lane", () => {
    expect(districtOf(row({ status: "buy_zone" }))).toBe("range");
    expect(districtOf(row({ status: "near" }))).toBe("near");
    expect(districtOf(row({ status: "above" }))).toBe("above");
    for (const s of ["no_target", "no_price", "currency_mismatch"] as const) expect(districtOf(row({ status: s }))).toBe("fog");
  });
});

describe("streetDistricts", () => {
  it("keeps street order and the place numbers of the whole street, and drops empty districts", () => {
    const rows = orderStreet([
      row({ id: "a", name: "Aker", status: "above", distance_to_buy_pct: "12" }),
      row({ id: "b", name: "Bouvet", status: "no_target" }),
      row({ id: "c", name: "Cavendish", status: "buy_zone", distance_to_buy_pct: "-3" }),
    ]);
    const ds = streetDistricts(rows);
    expect(ds.map((d) => d.id)).toEqual(["range", "above", "fog"]);
    expect(ds.flatMap((d) => d.rows.map((r) => `${r.place}:${r.row.name}`))).toEqual(["1:Cavendish", "2:Aker", "3:Bouvet"]);
  });

  it("is empty for an empty street", () => {
    expect(streetDistricts([])).toEqual([]);
  });
});

describe("tone flags", () => {
  it("gives every tone its own shape and its own word (colour is never the only signal)", () => {
    const tones = ["gold", "amber", "plain", "mist"] as const;
    expect(new Set(tones.map((t) => TONE_FLAG[t].shape)).size).toBe(4);
    expect(new Set(tones.map((t) => TONE_FLAG[t].word)).size).toBe(4);
  });
});

describe("gapLabel", () => {
  it("signs a gap above your price and leaves a gap below it plain", () => {
    expect(gapLabel(row({ distance_to_buy_pct: "4" }))).toBe("+4%");
    expect(gapLabel(row({ distance_to_buy_pct: "-3" }))).toBe("-3%");
  });
  it("is null when there is nothing to compare: unknown stays unknown", () => {
    expect(gapLabel(row({ distance_to_buy_pct: null }))).toBeNull();
  });
});

describe("stallLabel", () => {
  it("says the whole fact in one sentence", () => {
    const r = row({ status: "buy_zone", distance_to_buy_pct: "-3", owned: true });
    const s = stallLabel(r);
    expect(s).toContain("Equinor, EQNR.OL.");
    expect(s).toContain(shopFront(r).tag);
    expect(s).toContain("-3% versus yours");
    expect(s).toContain("In your fortress.");
    expect(s).toContain("Step inside.");
  });
  it("admits a missing price instead of leaving it out", () => {
    expect(stallLabel(row({ status: "no_price" }))).toContain("No price on file.");
  });
});

describe("decor", () => {
  it("cycles through props that all have a picture", () => {
    for (let i = 0; i < STREET_DECOR.length * 2; i++) expect(OBJECT_ART[decorId(i)]).toBeDefined();
    expect(decorId(STREET_DECOR.length)).toBe(decorId(0));
  });
  it("puts a prop after every BLOCK stalls, never at the ends", () => {
    expect(decorSlots(BLOCK)).toEqual([]);
    expect(decorSlots(BLOCK * 2 + 1)).toEqual([BLOCK, BLOCK * 2]);
    expect(decorSlots(0)).toEqual([]);
  });
});

describe("jitterPx", () => {
  it("is stable and stays within five pixels", () => {
    for (let i = 0; i < 100; i++) {
      const j = jitterPx(`holding-${i}`);
      expect(j).toBe(jitterPx(`holding-${i}`));
      expect(Math.abs(j)).toBeLessThanOrEqual(5);
    }
  });
});
