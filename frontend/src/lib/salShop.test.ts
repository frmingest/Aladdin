import { describe, expect, it } from "vitest";
import {
  ALL,
  OTHER,
  SIZE_FILTERS,
  SIZE_HINT,
  SIZE_LABEL,
  allShopLines,
  coinCount,
  countLine,
  filterCatalogue,
  fold,
  formatCap,
  isDusty,
  shelfCounts,
  shelfOf,
  stallInput,
  stockedLine,
  takenTickers,
} from "./salShop";
import { allSalLines } from "./salesRep";
import type { CatalogueItem, CatalogueSizeBand } from "./types";

function item(ticker: string, name: string, sector: string | null, band: CatalogueSizeBand = "big", cap: string | null = "20000000000"): CatalogueItem {
  return { ticker, name, currency: "NOK", sector, size_band: band, market_cap: cap };
}

// Server order: biggest first.
const ITEMS: CatalogueItem[] = [
  item("EQNR.OL", "Equinor ASA", "Energy", "giant", "700000000000"),
  item("DNB.OL", "DNB Bank ASA", "Financials", "giant", "330000000000"),
  item("MOWI.OL", "Mowi ASA", "Consumer Staples", "giant", "90000000000"),
  item("AKRBP.OL", "Aker BP ASA", "Energy", "big", "120000000000"),
  item("ORK.OL", "Orkla ASA", "Consumer Staples", "big", "90000000000"),
  item("NEL.OL", "Nel ASA", "Industrials", "small", "3000000000"),
  item("ORSTED.OL", "Ørsted A/S", "Utilities", "big", "20000000000"),
  item("MYST.OL", "Mystery Holdings", null, "unknown", null),
  item("ODD.OL", "Odd Sector AS", "Crypto Mining", "tiny", "200000000"),
];

describe("shelves", () => {
  it("puts a company on its sector's shelf, and anything unknown on Odds & Ends", () => {
    expect(shelfOf(ITEMS[0])).toBe("Energy");
    expect(shelfOf(ITEMS[7])).toBe(OTHER); // no sector
    expect(shelfOf(ITEMS[8])).toBe(OTHER); // a sector the app does not know
  });

  it("counts shelves in a fixed order, Everything first, and hides empty shelves", () => {
    const shelves = shelfCounts(ITEMS);
    expect(shelves.map((s) => s.key)).toEqual([ALL, "Energy", "Financials", "Industrials", "Consumer Staples", "Utilities", OTHER]);
    expect(shelves[0].count).toBe(ITEMS.length);
    expect(Object.fromEntries(shelves.map((s) => [s.key, s.count]))).toMatchObject({ Energy: 2, "Consumer Staples": 2, [OTHER]: 2 });
    // The counts add up: nobody is lost between shelves.
    expect(shelves.slice(1).reduce((n, s) => n + s.count, 0)).toBe(ITEMS.length);
  });

  it("keeps the real sector next to the game name", () => {
    const energy = shelfCounts(ITEMS).find((s) => s.key === "Energy")!;
    expect(energy.title).toBe("Oil & Power");
    expect(energy.real).toBe("Energy");
  });
});

describe("filtering and search", () => {
  const f = (over: Partial<Parameters<typeof filterCatalogue>[1]> = {}) => filterCatalogue(ITEMS, { shelf: ALL, band: null, query: "", ...over }).map((i) => i.ticker);

  it("returns everything, in server (size) order, with no filter", () => {
    expect(f()).toEqual(ITEMS.map((i) => i.ticker));
  });

  it("filters by shelf and by size", () => {
    expect(f({ shelf: "Energy" })).toEqual(["EQNR.OL", "AKRBP.OL"]);
    expect(f({ band: "giant" })).toEqual(["EQNR.OL", "DNB.OL", "MOWI.OL"]);
    expect(f({ shelf: "Energy", band: "giant" })).toEqual(["EQNR.OL"]);
    expect(f({ shelf: OTHER })).toEqual(["MYST.OL", "ODD.OL"]);
  });

  it("fog sizes are reachable under any size, not under a size chip", () => {
    expect(f()).toContain("MYST.OL");
    for (const band of SIZE_FILTERS) expect(f({ band })).not.toContain("MYST.OL");
  });

  it("searches name or ticker, any case, any word order", () => {
    expect(f({ query: "equinor" })).toEqual(["EQNR.OL"]);
    expect(f({ query: "EQNR" })).toEqual(["EQNR.OL"]);
    expect(f({ query: "bp aker" })).toEqual(["AKRBP.OL"]);
    expect(f({ query: "eqnr.ol" })).toEqual(["EQNR.OL"]);
  });

  it("folds Norwegian letters both ways", () => {
    expect(f({ query: "orsted" })).toEqual(["ORSTED.OL"]);
    expect(f({ query: "Ørsted" })).toEqual(["ORSTED.OL"]);
    expect(fold("Æ Ø Å é")).toBe("ae o a e");
  });

  it("floats prefix matches above looser ones, then keeps size order", () => {
    // "or" is a ticker start for ORK/ORSTED and inside "Equinor", "Orkla"... ticker-prefix ranks first.
    expect(f({ query: "or" }).slice(0, 2)).toEqual(["ORK.OL", "ORSTED.OL"]);
    expect(f({ query: "or" })).toContain("EQNR.OL"); // "Equinor" contains "or"
  });

  it("combines a search with a shelf", () => {
    expect(f({ query: "asa", shelf: "Consumer Staples" })).toEqual(["MOWI.OL", "ORK.OL"]);
    expect(f({ query: "equinor", shelf: "Financials" })).toEqual([]);
  });

  it("returns nothing for a word that is nowhere", () => {
    expect(f({ query: "zzzz" })).toEqual([]);
  });
});

describe("what a picked stall carries", () => {
  it("passes name, currency and the app sector to the watchlist", () => {
    expect(stallInput(item("eqnr.ol", "Equinor ASA", "Energy"))).toEqual({ ticker: "EQNR.OL", name: "Equinor ASA", currency: "NOK", sector: "Energy" });
    expect(stallInput(ITEMS[7]).sector).toBeNull();
  });

  it("knows which tickers already have a stall, case-insensitively", () => {
    const taken = takenTickers([{ ticker: "eqnr.ol" }, { ticker: "DNB.OL" }]);
    expect(taken.has("EQNR.OL") && taken.has("DNB.OL") && !taken.has("ORK.OL")).toBe(true);
  });
});

describe("size", () => {
  it("draws more coins for bigger companies and none for fog", () => {
    expect(["giant", "big", "small", "tiny", "unknown"].map((b) => coinCount(b as CatalogueSizeBand))).toEqual([4, 3, 2, 1, 0]);
  });

  it("words every band, so colour and coins are never the only signal", () => {
    for (const band of ["giant", "big", "small", "tiny", "unknown"] as CatalogueSizeBand[]) {
      expect(SIZE_LABEL[band].length).toBeGreaterThan(2);
      expect(SIZE_HINT[band].length).toBeGreaterThan(5);
    }
  });

  it("keeps the hints in step with the backend thresholds (50 bn, 10 bn, 1 bn NOK)", () => {
    expect(SIZE_HINT.giant).toContain("50 bn");
    expect(SIZE_HINT.big).toContain("10 to 50 bn");
    expect(SIZE_HINT.small).toContain("1 to 10 bn");
    expect(SIZE_HINT.tiny).toContain("1 bn");
  });

  it("formats market value compactly and never invents one", () => {
    expect(formatCap("712000000000", "NOK")).toBe("712 bn");
    expect(formatCap("8400000000", "NOK")).toBe("8.4 bn");
    expect(formatCap("420000000", "NOK")).toBe("420 m");
    expect(formatCap("1200000000000", "NOK")).toBe("1.2 tn");
    expect(formatCap("12000000000", "USD")).toBe("USD 12 bn");
    expect(formatCap(null, "NOK")).toBe("size in fog");
    expect(formatCap("0", "NOK")).toBe("size in fog");
    expect(formatCap("junk", "NOK")).toBe("size in fog");
  });
});

describe("freshness", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  it("says how long ago the shelves were stocked", () => {
    expect(stockedLine("2026-11-11T03:00:00Z", now)).toBe("Stocked today");
    expect(stockedLine("2026-11-10T03:00:00Z", now)).toBe("Stocked yesterday");
    expect(stockedLine("2026-11-04T12:00:00Z", now)).toBe("Stocked 7 days ago");
    expect(stockedLine(null, now)).toBeNull();
    expect(stockedLine("nonsense", now)).toBeNull();
  });
  it("calls old shelves dusty, never wrong", () => {
    expect(isDusty("2026-10-20T00:00:00Z", now)).toBe(true);
    expect(isDusty("2026-11-01T00:00:00Z", now)).toBe(false);
    expect(isDusty(null, now)).toBe(false);
  });
  it("counts stalls", () => {
    expect(countLine(1, 1)).toBe("1 stall");
    expect(countLine(9, 9)).toBe("9 stalls");
    expect(countLine(3, 9)).toBe("3 of 9 stalls");
  });
});

describe("Sal's shop words", () => {
  const FORBIDDEN = /\b(buy|buying|sell|selling|purchase|invest|investing|investment|guarantee|guaranteed|can't lose|moon|sure thing|winner|trim|rally|crash|best|cheap|undervalued|recommend)\b/i;
  it("never says what to do with money", () => {
    for (const line of allShopLines()) expect(line, line).not.toMatch(FORBIDDEN);
  });
  it("has real words everywhere", () => {
    for (const line of allShopLines()) expect(line.trim().length, line).toBeGreaterThan(2);
  });
  it("stays out of the older Sal lines (no overlap to drift apart)", () => {
    const old = new Set(allSalLines());
    for (const line of allShopLines()) expect(old.has(line)).toBe(false);
  });
});
