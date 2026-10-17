import { describe, expect, it } from "vitest";
import {
  BENCHMARK_SHORT,
  allSiegeLines,
  betaSourceLine,
  clampDrop,
  coverageLine,
  damageWidth,
  dropToPercent,
  fallStage,
  fallSubject,
  formatDrop,
  headline,
  holdingLine,
  isRoughGuide,
  parseBenchmarkChoice,
  presetDrop,
  rowFacts,
  rowStatus,
  stressGapNote,
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

describe("the short row and its detail", () => {
  const shock = (s: string | null) => (s === null ? "—" : `${(Number(s) * 100).toFixed(1)}%`);

  it("gives each row one short status word", () => {
    expect(rowStatus(holding())).toBe("Exposed");
    expect(rowStatus(holding({ exposure: "breach_risk" }))).toBe("Wall at risk of breach");
    expect(rowStatus(holding({ shock_pct: "0.07", exposure: "sheltered" }))).toBe("Gains");
    expect(rowStatus(holding({ modelled: false, exposure: "unmodelled", shock_pct: null }))).toBe("Not modelled");
  });

  it("flags a rough guide only when the backend attached a caution to a modelled holding", () => {
    expect(isRoughGuide(holding())).toBe(false);
    expect(isRoughGuide(holding({ caution: "The benchmark explains only 0% of this holding's moves on those days, so the number is a rough guide." }))).toBe(true);
    expect(isRoughGuide(holding({ modelled: false, caution: "x" }))).toBe(false);
  });

  it("lists the facts as labelled values: beta, fit, days, benchmark, the what-if and the stress case", () => {
    const facts = rowFacts(holding({ stored_shock_pct: "-0.209" }), "OSEBX.OL", shock);
    expect(facts).toEqual([
      { label: "Beta", value: "1.20" },
      { label: "Fit", value: "54%" },
      { label: "Falling days used", value: "87" },
      { label: "Measured against", value: "OSEBX.OL" },
      { label: "This what-if", value: "-24.0%" },
      { label: "Fortress stress case", value: "-20.9%" },
    ]);
  });

  it("says where a Yahoo or sample beta came from, and lists nothing for a holding that is not modelled", () => {
    expect(rowFacts(holding({ method: "vendor_beta" }), "OSEBX.OL", shock).map((f) => f.label)).toEqual(["Beta", "Beta from", "This what-if"]);
    expect(rowFacts(holding({ method: "demo" }), "", shock).find((f) => f.label === "Beta from")?.value).toBe("Sample data");
    expect(rowFacts(holding({ modelled: false }), "OSEBX.OL", shock)).toEqual([]);
  });

  it("explains a big gap between the what-if and the Fortress's stress case, once, and stays quiet otherwise", () => {
    expect(stressGapNote(holding({ shock_pct: "0.07", stored_shock_pct: "-0.619" }))).toContain("different questions");
    expect(stressGapNote(holding({ shock_pct: "0.107", stored_shock_pct: "-0.014" }))).not.toBeNull(); // sign flip, 12 points
    expect(stressGapNote(holding({ shock_pct: "-0.10", stored_shock_pct: "-0.053" }))).toBeNull();
    expect(stressGapNote(holding({ shock_pct: "-0.024", stored_shock_pct: "-0.168" }))).toBeNull(); // 14 points, same sign
    expect(stressGapNote(holding({ shock_pct: "-0.436", stored_shock_pct: null }))).toBeNull();
    expect(stressGapNote(holding({ modelled: false, shock_pct: null, stored_shock_pct: "-0.3" }))).toBeNull();
  });
});

describe("scenarios v3 headline", () => {
  it("names the unmodelled share beside the number it qualifies", () => {
    const text = headline(sim({ unmodelled_note: "40.0% of the book's value (1 holding) is not modelled and is left out of this result; it could fall more or less." }));
    expect(text).toContain("40.0% of the book's value");
    expect(text.indexOf("costs the modelled book")).toBeLessThan(text.indexOf("not modelled"));
  });

  it("says nothing extra when nothing is unmodelled or under older scenarios", () => {
    expect(headline(sim())).not.toContain("not modelled");
    expect(headline(sim({ unmodelled_note: "" }))).not.toContain("not modelled");
  });

  it("keeps the gap in the headline when no portfolio result can be given", () => {
    const text = headline(sim({ level: "unsurveyed", portfolio_shock_pct: null, unmodelled_note: "90.0% of the book's value (3 holdings) is not modelled." }));
    expect(text).toContain("90.0%");
  });
});

describe("scenarios v4: the choice of yardstick", () => {
  it("names the two yardsticks in short words", () => {
    expect(BENCHMARK_SHORT.local).toBe("Oslo");
    expect(BENCHMARK_SHORT.global).toBe("World");
  });

  it("keeps the long-standing wording for Oslo and for versions with no choice", () => {
    expect(fallSubject(sim()).label).toBe("Market falls by");
    expect(fallSubject(sim({ benchmark_key: "local" })).sentence).toBe("market fall");
    expect(fallSubject(null).sentence).toBe("market fall");
    expect(headline(sim({ benchmark_key: "local" }))).toContain("A 30% market fall costs the modelled book");
  });

  it("says the fall is of world stocks when the World yardstick is active", () => {
    expect(fallSubject(sim({ benchmark_key: "global" })).label).toBe("World stocks fall by");
    expect(headline(sim({ benchmark_key: "global" }))).toContain("A 30% fall in world stocks costs the modelled book");
    expect(headline(sim({ benchmark_key: "global", level: "unsurveyed", portfolio_shock_pct: null }))).toContain("fall in world stocks");
  });

  it("falls back to Oslo for a missing or unknown remembered choice", () => {
    expect(parseBenchmarkChoice(null)).toBe("local");
    expect(parseBenchmarkChoice(undefined)).toBe("local");
    expect(parseBenchmarkChoice("moon")).toBe("local");
    expect(parseBenchmarkChoice("global")).toBe("global");
  });
});

describe("fallStage (the towers' backdrop follows the slider)", () => {
  it("is calm under 15%, storm from 15%, siege from 30%, ruin from 45%", () => {
    expect([0.05, 0.1, 0.149].map(fallStage)).toEqual(["calm", "calm", "calm"]);
    expect([0.15, 0.2, 0.299].map(fallStage)).toEqual(["storm", "storm", "storm"]);
    expect([0.3, 0.4, 0.449].map(fallStage)).toEqual(["siege", "siege", "siege"]);
    expect([0.45, 0.6].map(fallStage)).toEqual(["ruin", "ruin"]);
  });
  it("reads the backend's decimal strings and falls back to calm on rubbish", () => {
    expect(fallStage("0.30")).toBe("siege");
    expect(fallStage(null)).toBe("calm");
    expect(fallStage("abc")).toBe("calm");
  });
});
