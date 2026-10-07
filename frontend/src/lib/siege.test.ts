import { describe, expect, it } from "vitest";
import {
  allSiegeLines,
  betaSourceLine,
  clampDrop,
  coverageLine,
  damageWidth,
  dropToPercent,
  formatDrop,
  headline,
  holdingLine,
  presetDrop,
} from "./siege";
import type { SiegeSim, SiegeSimHolding } from "./types";

const holding = (over: Partial<SiegeSimHolding> = {}): SiegeSimHolding => ({
  holding_id: "h1", ticker: "AAA.OL", name: "Alpha", structure: "keep", size_class: "medium", wall: "granite",
  value_nok: "400", weight_pct: "40", beta: "1.2", beta_as_of: null, modelled: true, shock_pct: "-0.24",
  loss_nok: "-96", exposure: "exposed", stored_shock_pct: null, reason: null, method: "price_history", observations: 87,
  r_squared: "0.5400", caution: null, ...over,
});

const sim = (over: Partial<SiegeSim> = {}): SiegeSim => ({
  scenarios_version: "v1", mapping_version: "v1", demo: false, market_drop: "0.30", drop_min: "0.05", drop_max: "0.60",
  drop_step: "0.05", level: "gathering", level_reason: "", portfolio_shock_pct: "-0.27", portfolio_loss_nok: "-270",
  covered_value_nok: "1000", total_value_nok: "1000", coverage: "1.0000", weighted_beta: "0.90", gathering_line: "-0.25",
  besieged_line: "-0.40", drop_to_gathering: "0.278", drop_to_besieged: "0.444", reach_note_gathering: "", reach_note_besieged: "",
  counts: {}, oldest_beta_at: null, holdings: [holding()], notes: [], benchmark_ticker: "OSEBX.OL", ...over,
});

describe("slider helpers", () => {
  it("formats a fraction as a whole or one-decimal percent", () => {
    expect(formatDrop("0.30")).toBe("30%");
    expect(formatDrop(0.275)).toBe("27.5%");
    expect(formatDrop(null)).toBe("—");
    expect(formatDrop("abc")).toBe("—");
    expect(dropToPercent(0.3)).toBe(30);
  });

  it("clamps into the range and survives junk", () => {
    expect(clampDrop(0.01, 0.05, 0.6)).toBe(0.05);
    expect(clampDrop(0.9, 0.05, 0.6)).toBe(0.6);
    expect(clampDrop(0.3, 0.05, 0.6)).toBe(0.3);
    expect(clampDrop(Number.NaN, 0.05, 0.6)).toBe(0.05);
  });

  it("rounds a preset up so the button really reaches the line", () => {
    expect(presetDrop("0.278", 0.05, 0.6)).toBe(0.28);
    expect(presetDrop("0.25", 0.05, 0.6)).toBe(0.25); // exactly on a whole percent stays put
    expect(presetDrop("0.400", 0.05, 0.6)).toBe(0.4);
  });

  it("offers no preset when the line is never reached or lies outside the slider", () => {
    expect(presetDrop(null, 0.05, 0.6)).toBeNull();
    expect(presetDrop("0.80", 0.05, 0.6)).toBeNull();
    expect(presetDrop("0.01", 0.05, 0.6)).toBeNull();
    expect(presetDrop("x", 0.05, 0.6)).toBeNull();
  });
});

describe("damage bars and lines", () => {
  it("draws a bar only for losses, capped at the full width", () => {
    expect(damageWidth("-0.24")).toBe(24);
    expect(damageWidth("-1")).toBe(100);
    expect(damageWidth("-1.5")).toBe(100);
    expect(damageWidth("0.1")).toBe(0);
    expect(damageWidth(null)).toBe(0);
  });

  it("words one holding, modelled or not, without guessing", () => {
    expect(holdingLine(holding())).toBe("Falls 24.0% in this what-if (exposed).");
    expect(holdingLine(holding({ shock_pct: "0.09", exposure: "sheltered" }))).toBe("Gains 9.0% in this what-if.");
    expect(holdingLine(holding({ modelled: false, shock_pct: null, reason: "no stored beta, so it is not modelled" }))).toBe(
      "no stored beta, so it is not modelled",
    );
  });
});

describe("where a beta came from", () => {
  it("says what it was measured against, over how many days, and how well it fits", () => {
    expect(betaSourceLine(holding(), "OSEBX.OL")).toBe(
      "Beta 1.20, measured from its own prices against OSEBX.OL on the 87 days it fell, fit 54%.",
    );
  });

  it("labels Yahoo's figure and passes the backend's caution on", () => {
    const line = betaSourceLine(holding({ method: "vendor_beta", caution: "Price history could not be used (x)." }), "OSEBX.OL");
    expect(line).toBe("Beta 1.20 from Yahoo. Price history could not be used (x).");
  });

  it("labels sample data and says nothing for a holding that is not modelled", () => {
    expect(betaSourceLine(holding({ method: "demo" }), "")).toBe("Beta 1.20 (sample data).");
    expect(betaSourceLine(holding({ modelled: false, beta: null }), "OSEBX.OL")).toBe("");
  });
});

describe("headline", () => {
  it("states the fall, the book loss and the level", () => {
    const h = headline(sim());
    expect(h).toContain("30%");
    expect(h).toContain("27.0%");
    expect(h).toContain("storm line");
  });

  it("never gives a book number when the backend withheld it", () => {
    const h = headline(sim({ level: "unsurveyed", portfolio_shock_pct: null }));
    expect(h).not.toMatch(/\d+\.\d%/);
    expect(h).toContain("usable beta");
  });

  it("reports coverage honestly", () => {
    expect(coverageLine(sim({ holdings: [holding(), holding({ modelled: false }), holding()], coverage: "0.8500" }))).toBe(
      "2 of 3 holdings modelled, 85% of the portfolio value.",
    );
    expect(coverageLine(sim({ holdings: [], coverage: null }))).toBe("0 of 0 holdings modelled, none of the portfolio value.");
  });
});

describe("wording rules", () => {
  const FORBIDDEN = /\b(buy|buying|sell|selling|purchase|invest|investing|investment|guarantee|trim|add more|rally|crash will|forecast that|will fall|will rise)\b/i;
  it("never advises or predicts", () => {
    for (const line of allSiegeLines()) expect(line, line).not.toMatch(FORBIDDEN);
  });

  it("always says it is a what-if and not a forecast", () => {
    expect(allSiegeLines().some((l) => /what-if, not a forecast/i.test(l))).toBe(true);
  });
});
