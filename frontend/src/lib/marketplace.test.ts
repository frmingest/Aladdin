import { describe, expect, it } from "vitest";
import {
  MARKET_RULES,
  MERCHANT_LINE,
  STORE_LEVEL_LABEL,
  analysisAgeDays,
  buildGates,
  buildLadder,
  cushionPrice,
  earningsGate,
  evidenceGate,
  judgeStore,
  moatGate,
  nextSteps,
  orderStreet,
  priceGate,
  scenarioPoints,
  shopFront,
  shopPips,
  thesisGate,
  verdictGate,
  wallsGate,
  yourPriceGate,
  type StoreInput,
} from "./marketplace";
import type { AnalysisRun, HoldingMetrics, HoldingThesis, HoldingValuation, WatchlistRow } from "./types";

const NOW = Date.parse("2026-10-01T12:00:00Z");

function row(over: Partial<WatchlistRow> = {}): WatchlistRow {
  return {
    id: "w1",
    holding_id: "h1",
    ticker: "ORK.OL",
    name: "Orkla",
    sector: null,
    instrument_type: "stock",
    owned: false,
    buy_below_price: "100",
    buy_below_currency: "NOK",
    notes: null,
    added_at: "2026-09-01T00:00:00Z",
    price: "90",
    price_currency: "NOK",
    price_as_of: null,
    distance_to_buy_pct: "-10",
    status: "buy_zone",
    dcf_base: null,
    margin_of_safety_base: null,
    verdict_rating: null,
    moat_rating: null,
    analyzed_at: null,
    unavailable_reason: null,
    ...over,
  } as WatchlistRow;
}

function valuation(over: Partial<HoldingValuation> = {}): HoldingValuation {
  return {
    holding_id: "h1",
    ticker: "ORK.OL",
    valuation_currency: "NOK",
    as_of: null,
    base_growth_rate: null,
    discount_rate: null,
    risk_free_rate_pct: null,
    beta: null,
    equity_risk_premium: null,
    current_price_per_share: "90",
    dcf: {
      discount_rate: "0.08",
      terminal_growth_rate: "0.025",
      scenarios: [
        { label: "Bear", growth_rate: "0.01", intrinsic_value_per_share: "100", margin_of_safety: "0.1" },
        { label: "Base", growth_rate: "0.04", intrinsic_value_per_share: "160", margin_of_safety: "0.4375" },
        { label: "Bull", growth_rate: "0.07", intrinsic_value_per_share: "220", margin_of_safety: "0.59" },
      ],
    },
    reverse_dcf_implied_growth: null,
    multiples: [],
    assumptions_version: "v2",
    unavailable_reasons: [],
    valuation_method: "owner_earnings_dcf",
    valuation_status: "ok",
    ...over,
  } as HoldingValuation;
}

function metrics(computed: Record<string, string>, skipped: Record<string, string> = {}): HoldingMetrics {
  return { holding_id: "h1", period: "2025", facts: {}, computed, skipped, currency: "NOK", notes: {}, warnings: [], fact_details: [] } as HoldingMetrics;
}

function analysis(over: Record<string, unknown> = {}): AnalysisRun {
  return {
    id: "a1",
    holding_id: "h1",
    status: "COMPLETED",
    started_at: "2026-09-20T00:00:00Z",
    completed_at: "2026-09-20T01:00:00Z",
    blind_completed_at: "2026-09-20T00:30:00Z",
    blind_pass: { moat: { overall_rating: "Wide" }, verdict: { rating: "Buy" } },
    reconciliation: null,
    ...over,
  } as unknown as AnalysisRun;
}

const thesis = (status: HoldingThesis["status"]): HoldingThesis => ({ status }) as HoldingThesis;

function strong(): StoreInput {
  return {
    instrumentType: "stock",
    row: row(),
    valuation: valuation(),
    analysis: analysis(),
    thesis: thesis("intact"),
    metrics: metrics({ net_debt: "-50", net_debt_to_ebitda: "-0.5", interest_coverage: "12", roic: "0.2" }),
    now: NOW,
  };
}

describe("single gates", () => {
  it("reads the moat", () => {
    expect(moatGate("Wide").status).toBe("open");
    expect(moatGate("Narrow").status).toBe("ajar");
    expect(moatGate("None").status).toBe("closed");
    expect(moatGate(null).status).toBe("unknown");
  });

  it("reads the stored analyst verdict, Hold is ajar and no analysis is unknown", () => {
    expect(verdictGate("Strong Buy").status).toBe("open");
    expect(verdictGate("Buy").status).toBe("open");
    expect(verdictGate("Hold").status).toBe("ajar");
    expect(verdictGate("Sell").status).toBe("closed");
    expect(verdictGate("Avoid").status).toBe("closed");
    expect(verdictGate(null).status).toBe("unknown");
  });

  it("reads the thesis", () => {
    expect(thesisGate("intact").status).toBe("open");
    expect(thesisGate("review").status).toBe("ajar");
    expect(thesisGate("tripwire_fired").status).toBe("closed");
    expect(thesisGate("not_analyzed").status).toBe("unknown");
    expect(thesisGate(null).status).toBe("unknown");
  });

  it("freshness uses the 90 / 180 day cut-offs at their boundaries", () => {
    expect(evidenceGate(MARKET_RULES.analysisFreshDays).status).toBe("open");
    expect(evidenceGate(MARKET_RULES.analysisFreshDays + 1).status).toBe("ajar");
    expect(evidenceGate(MARKET_RULES.analysisStaleDays).status).toBe("ajar");
    expect(evidenceGate(MARKET_RULES.analysisStaleDays + 1).status).toBe("closed");
    expect(evidenceGate(null).status).toBe("unknown");
  });

  it("price gate: 25% is open, a thin cushion is ajar, none is closed", () => {
    const mk = (mos: string) =>
      valuation({
        dcf: {
          discount_rate: "0.08",
          terminal_growth_rate: "0.025",
          scenarios: [{ label: "Base", growth_rate: "0.03", intrinsic_value_per_share: "100", margin_of_safety: mos }],
        },
      });
    expect(priceGate(mk("0.25"), null).status).toBe("open");
    expect(priceGate(mk("0.2499"), null).status).toBe("ajar");
    expect(priceGate(mk("0.01"), null).status).toBe("ajar");
    expect(priceGate(mk("0"), null).status).toBe("closed");
    expect(priceGate(mk("-0.3"), null).status).toBe("closed");
  });

  it("price gate never invents a number: withheld, unavailable and missing are unknown", () => {
    const implausible = priceGate(valuation({ valuation_status: "implausible", valuation_status_reason: "DCF far above price" }), null);
    expect(implausible.status).toBe("unknown");
    expect(implausible.reading).not.toMatch(/\d+%/);
    expect(priceGate(valuation({ valuation_status: "unavailable" }), null).status).toBe("unknown");
    expect(priceGate(null, row()).status).toBe("unknown");
    expect(priceGate(null, row({ margin_of_safety_base: "0.3" })).status).toBe("open");
  });

  it("your price follows the watchlist status", () => {
    expect(yourPriceGate(row({ status: "buy_zone" })).status).toBe("open");
    expect(yourPriceGate(row({ status: "near" })).status).toBe("ajar");
    expect(yourPriceGate(row({ status: "above" })).status).toBe("closed");
    expect(yourPriceGate(row({ status: "no_target" })).status).toBe("unknown");
    expect(yourPriceGate(row({ status: "currency_mismatch" })).status).toBe("unknown");
    expect(yourPriceGate(null).status).toBe("na");
  });
});

describe("walls gate", () => {
  it("net cash is open", () => {
    expect(wallsGate("stock", valuation(), metrics({ net_debt: "-10" })).status).toBe("open");
  });
  it("net debt / EBITDA boundaries: 2.5 open, 4 ajar, above closed", () => {
    const g = (lev: string, cover = "10") => wallsGate("stock", valuation(), metrics({ net_debt: "10", net_debt_to_ebitda: lev, interest_coverage: cover })).status;
    expect(g("2.5")).toBe("open");
    expect(g("2.51")).toBe("ajar");
    expect(g("4")).toBe("ajar");
    expect(g("4.01")).toBe("closed");
  });
  it("thin interest cover drops the gate one step but never past closed", () => {
    expect(wallsGate("stock", valuation(), metrics({ net_debt: "10", net_debt_to_ebitda: "1", interest_coverage: "2.9" })).status).toBe("ajar");
    expect(wallsGate("stock", valuation(), metrics({ net_debt: "10", net_debt_to_ebitda: "3", interest_coverage: "2" })).status).toBe("closed");
    expect(wallsGate("stock", valuation(), metrics({ net_debt: "10", net_debt_to_ebitda: "5", interest_coverage: "1" })).status).toBe("closed");
  });
  it("debt with no positive EBITDA is closed", () => {
    const m = metrics({ net_debt: "100" }, { net_debt_to_ebitda: "not meaningful: EBITDA is negative" });
    expect(wallsGate("stock", valuation(), m).status).toBe("closed");
  });
  it("no ratios is unknown, never a guess", () => {
    expect(wallsGate("stock", valuation(), metrics({})).status).toBe("unknown");
    expect(wallsGate("stock", valuation(), null).status).toBe("unknown");
  });
  it("funds and banks are not judged on net debt", () => {
    expect(wallsGate("equity_etf", null, null).status).toBe("na");
    expect(wallsGate("stock", valuation({ valuation_method: "financials_price_to_book" }), metrics({})).status).toBe("na");
  });
});

describe("earning power gate", () => {
  it("ROIC boundaries 15% and 8%", () => {
    const g = (v: string) => earningsGate("stock", valuation(), metrics({ roic: v })).status;
    expect(g("0.15")).toBe("open");
    expect(g("0.149")).toBe("ajar");
    expect(g("0.08")).toBe("ajar");
    expect(g("0.079")).toBe("closed");
  });
  it("banks use ROE with 10% and 6%", () => {
    const bank = valuation({ valuation_method: "financials_price_to_book" });
    expect(earningsGate("stock", bank, metrics({ roe: "0.1" })).status).toBe("open");
    expect(earningsGate("stock", bank, metrics({ roe: "0.06" })).status).toBe("ajar");
    expect(earningsGate("stock", bank, metrics({ roe: "0.05" })).status).toBe("closed");
  });
  it("missing is unknown and funds are not applicable", () => {
    expect(earningsGate("stock", valuation(), metrics({})).status).toBe("unknown");
    expect(earningsGate("equity_fund", null, null).status).toBe("na");
  });
});

describe("judging the store", () => {
  it("every gate open and a real cushion: gates open", () => {
    const v = judgeStore(buildGates(strong()));
    expect(v.level).toBe("ready");
    expect(v.counts.closed).toBe(0);
  });

  it("a closed business gate is a pass whatever the price", () => {
    const i = strong();
    i.analysis = analysis({ blind_pass: { moat: { overall_rating: "None" }, verdict: { rating: "Buy" } } });
    expect(judgeStore(buildGates(i)).level).toBe("pass");
    const j = strong();
    j.thesis = thesis("tripwire_fired");
    expect(judgeStore(buildGates(j)).level).toBe("pass");
  });

  it("good business at no cushion: wait", () => {
    const i = strong();
    i.valuation = valuation({
      dcf: {
        discount_rate: "0.08",
        terminal_growth_rate: "0.025",
        scenarios: [{ label: "Base", growth_rate: "0.03", intrinsic_value_per_share: "80", margin_of_safety: "-0.1" }],
      },
    });
    expect(judgeStore(buildGates(i)).level).toBe("wait");
  });

  it("above the price you named: wait, even when the base case is cheap", () => {
    const i = strong();
    i.row = row({ status: "above", distance_to_buy_pct: "30" });
    const v = judgeStore(buildGates(i));
    expect(v.level).toBe("wait");
    expect(v.headline).toMatch(/price you named/);
  });

  it("an ajar business gate keeps it at promising, not ready", () => {
    const i = strong();
    i.analysis = analysis({ blind_pass: { moat: { overall_rating: "Narrow" }, verdict: { rating: "Buy" } } });
    expect(judgeStore(buildGates(i)).level).toBe("promising");
  });

  it("a stale analysis keeps it at promising even with every other gate open", () => {
    const i = strong();
    i.analysis = analysis({ completed_at: "2026-01-01T00:00:00Z" });
    const v = judgeStore(buildGates(i));
    expect(v.level).toBe("promising");
    expect(v.reasons.join(" ")).toMatch(/stale/);
  });

  it("nothing known is cannot judge, and never promising or ready", () => {
    const v = judgeStore(
      buildGates({ instrumentType: "stock", row: row({ status: "no_target", buy_below_price: null }), valuation: null, analysis: null, thesis: null, metrics: null, now: NOW }),
    );
    expect(v.level).toBe("unknown");
  });

  it("a withheld valuation blocks a positive verdict", () => {
    const i = strong();
    i.valuation = valuation({ valuation_status: "implausible" });
    i.row = row({ margin_of_safety_base: "0.9" });
    expect(judgeStore(buildGates(i)).level).toBe("unknown");
  });

  it("funds skip the balance-sheet gates instead of failing them", () => {
    const i = strong();
    i.instrumentType = "equity_etf";
    i.metrics = null;
    const gates = buildGates(i);
    expect(gates.find((g) => g.id === "walls")?.status).toBe("na");
    expect(gates.find((g) => g.id === "earnings")?.status).toBe("na");
    expect(judgeStore(gates).level).toBe("ready");
  });

  it("the analyst's reconciled verdict wins over the blind one", () => {
    const i = strong();
    i.analysis = analysis({ reconciliation: { verdict: { rating: "Avoid" } } });
    expect(judgeStore(buildGates(i)).level).toBe("pass");
  });

  it("never tells the reader to buy, sell, add or trim, in any level", () => {
    const texts: string[] = [...Object.values(STORE_LEVEL_LABEL), ...Object.values(MERCHANT_LINE)];
    const cases: StoreInput[] = [strong()];
    const a = strong(); a.thesis = thesis("tripwire_fired"); cases.push(a);
    const b = strong(); b.row = row({ status: "above" }); cases.push(b);
    cases.push({ instrumentType: "stock", row: row({ status: "no_target" }), valuation: null, analysis: null, thesis: null, metrics: null, now: NOW });
    for (const c of cases) {
      const gates = buildGates(c);
      const v = judgeStore(gates);
      texts.push(v.headline, ...v.reasons, ...gates.flatMap((g) => [g.reading, g.question]), ...nextSteps(gates, c.valuation));
    }
    for (const t of texts) {
      expect(t).not.toMatch(/\b(you should|buy more|sell|add to|trim|accumulate|invest)\b/i);
    }
  });
});

describe("price ladder", () => {
  it("orders the stored scenarios and places today's price in a zone", () => {
    const l = buildLadder(valuation(), row())!;
    expect(l.markers.map((m) => m.kind)).toEqual(expect.arrayContaining(["bear", "base", "bull", "cushion", "price", "yours"]));
    expect(l.zone).toBe("bargain"); // 90 < bear 100
    expect(l.min).toBeLessThan(90);
    expect(l.max).toBeGreaterThan(220);
  });

  it("zone boundaries: bear and base are inclusive upward, bull is inclusive", () => {
    const z = (price: string) => buildLadder(valuation({ current_price_per_share: price }), null)!.zone;
    expect(z("99.99")).toBe("bargain");
    expect(z("100")).toBe("discount");
    expect(z("159.99")).toBe("discount");
    expect(z("160")).toBe("fair");
    expect(z("220")).toBe("fair");
    expect(z("220.01")).toBe("dear");
  });

  it("with only a base case it neither invents a bear or bull nor names the three zones", () => {
    const v = valuation({
      dcf: { discount_rate: "0.08", terminal_growth_rate: "0.025", scenarios: [{ label: "Base", growth_rate: "0.03", intrinsic_value_per_share: "100", margin_of_safety: "0.1" }] },
      current_price_per_share: "90",
    });
    const l = buildLadder(v, null)!;
    expect(l.markers.map((m) => m.kind).sort()).toEqual(["base", "cushion", "price"]);
    expect(l.zone).toBe("belowBase");
    expect(buildLadder({ ...v, current_price_per_share: "120" } as HoldingValuation, null)!.zone).toBe("aboveBase");
  });

  it("the cushion is the base value less 25%", () => {
    expect(cushionPrice(valuation())).toBeCloseTo(120, 6);
  });

  it("omits your price when the currencies differ and says why", () => {
    const l = buildLadder(valuation(), row({ buy_below_currency: "USD" }))!;
    expect(l.markers.some((m) => m.kind === "yours")).toBe(false);
    expect(l.notes.join(" ")).toMatch(/not drawn/);
  });

  it("draws nothing when the valuation is withheld or missing", () => {
    expect(buildLadder(null, row())).toBeNull();
    expect(buildLadder(valuation({ valuation_status: "implausible" }), row())).toBeNull();
    expect(scenarioPoints(valuation({ valuation_status: "unavailable" }))).toEqual([]);
  });

  it("reads banks and funds from their own scenario lists", () => {
    const bank = valuation({
      valuation_method: "financials_price_to_book",
      dcf: null,
      financials: {
        cost_of_equity: "0.09",
        growth_rate: "0.03",
        book_value_per_share: "50",
        roe_periods_used: 3,
        roe_was_capped: false,
        scenarios: [
          { label: "Bear", roe: "0.08", justified_price_to_book: "1", value_per_share: "50", margin_of_safety: null },
          { label: "Base", roe: "0.1", justified_price_to_book: "1.4", value_per_share: "70", margin_of_safety: "0.2" },
        ],
      },
    });
    expect(scenarioPoints(bank).map((p) => p.value)).toEqual([50, 70]);
    const fund = valuation({
      valuation_method: "fund_look_through_pe",
      dcf: null,
      fund_look_through: {
        scenarios: [{ label: "Base", growth_rate: "0.03", fair_pe: "15", value_per_unit: "42", margin_of_safety: "0.3" }],
      } as unknown as HoldingValuation["fund_look_through"],
    });
    expect(scenarioPoints(fund).map((p) => p.value)).toEqual([42]);
  });
});

describe("next steps", () => {
  it("names the concrete way to open each gate that is not open", () => {
    const gates = buildGates({ instrumentType: "stock", row: row({ status: "no_target", buy_below_price: null }), valuation: null, analysis: null, thesis: null, metrics: null, now: NOW });
    const steps = nextSteps(gates, null).join(" | ");
    expect(steps).toMatch(/Run the analysis/);
    expect(steps).toMatch(/Upload the latest annual report/);
    expect(steps).toMatch(/Name your price/);
  });
  it("gives the 25% cushion price when the price gate is closed", () => {
    const i = strong();
    i.valuation = valuation({ current_price_per_share: "200", dcf: { discount_rate: "0.08", terminal_growth_rate: "0.025", scenarios: [{ label: "Base", growth_rate: "0.03", intrinsic_value_per_share: "160", margin_of_safety: "-0.25" }] } });
    const steps = nextSteps(buildGates(i), i.valuation);
    expect(steps.join(" ")).toMatch(/120\.00 NOK/);
  });
});

describe("the street", () => {
  it("orders in-range first, then nearest to your price, then by name", () => {
    const rows = [
      row({ id: "a", name: "Zeta", status: "above", distance_to_buy_pct: "40" }),
      row({ id: "b", name: "Beta", status: "buy_zone", distance_to_buy_pct: "-5" }),
      row({ id: "c", name: "Alpha", status: "above", distance_to_buy_pct: "12" }),
      row({ id: "d", name: "Delta", status: "no_target", distance_to_buy_pct: null }),
      row({ id: "e", name: "Gamma", status: "near", distance_to_buy_pct: "4" }),
    ];
    expect(orderStreet(rows).map((r) => r.id)).toEqual(["b", "e", "c", "a", "d"]);
  });
  it("the shop window shows your own price, not a verdict", () => {
    expect(shopFront(row({ status: "buy_zone" })).tone).toBe("gold");
    expect(shopFront(row({ status: "near" })).tone).toBe("amber");
    expect(shopFront(row({ status: "no_target" })).tone).toBe("mist");
  });
  it("pips carry only what a watchlist row knows, unknown otherwise", () => {
    const pips = shopPips(row({ moat_rating: "Wide", verdict_rating: null }));
    expect(pips.map((p) => p.id)).toEqual(["moat", "price", "yourprice", "verdict", "evidence"]);
    expect(pips.find((p) => p.id === "verdict")?.status).toBe("unknown");
    expect(pips.find((p) => p.id === "moat")?.status).toBe("open");
  });
});

describe("analysis age", () => {
  it("counts whole days from the completion time and is never negative", () => {
    expect(analysisAgeDays(analysis(), null, NOW)).toBe(11);
    expect(analysisAgeDays(analysis({ completed_at: "2026-12-01T00:00:00Z" }), null, NOW)).toBe(0);
    expect(analysisAgeDays(null, null, NOW)).toBeNull();
    expect(analysisAgeDays(null, "2026-09-21T12:00:00Z", NOW)).toBe(10);
  });
});
