import { describe, expect, it } from "vitest";
import { REALM_LEVEL_LABEL, REALM_RULES, lookReasons, summarizeRealm } from "./realmVerdict";
import type { GameState, GameTower } from "./types";

function tower(o: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: o.holding_id ?? "id",
    ticker: "AAA",
    name: o.name ?? "Alpha",
    instrument_type: "stock",
    sector: null,
    structure: "keep",
    value_nok: "1000",
    weight_pct: "10",
    size_class: "medium",
    moat: "wide",
    wall: "granite",
    wall_reason: "",
    wall_inputs: {},
    freshness: "fresh",
    analysis_age_days: 10,
    verdict_rating: "Buy",
    land: "full_price",
    land_reason: "",
    margin_of_safety_pct: null,
    thesis: "intact",
    tripwires_fired: 0,
    siege_exposure: "sheltered",
    siege_shock_pct: null,
    siege_method: null,
    shared_wall_with: [],
    ...o,
  };
}

function state(towers: GameTower[], over: Partial<GameState> = {}): GameState {
  return {
    mapping_version: "v1",
    as_of: null,
    demo: false,
    total_value_nok: "1000",
    towers,
    diworsification: {
      position_count: towers.length,
      shack_count: 0,
      shantytown: "none",
      hhi: null,
      effective_holdings: null,
      top1_pct: "25",
      top5_pct: "80",
    },
    vault: {
      level: "stocked",
      cash_nok: "100",
      cash_share_pct: "12",
      accounts_total: 1,
      accounts_with_cash: 1,
      cash_oldest_as_of: null,
      gold_oz: "0",
      silver_oz: "0",
      accounts: [],
      cash_stale: false,
    },
    siege: {
      level: "calm",
      reasons: [],
      regime: null,
      regime_explanation: null,
      portfolio_shock_pct: null,
      portfolio_drawdown_nok: null,
      risk_snapshot_at: null,
      risk_snapshot_age_days: null,
      risk_snapshot_stale: false,
      land_snapshot_at: null,
      land_snapshot_age_days: null,
      land_snapshot_stale: false,
      shared_walls: [],
      breached_count: 0,
    },
    notes: [],
    ...over,
  };
}

const sound = () => [
  tower({ holding_id: "a", name: "A", weight_pct: "40" }),
  tower({ holding_id: "b", name: "B", weight_pct: "35", moat: "narrow", wall: "basalt" }),
  tower({ holding_id: "c", name: "C", weight_pct: "25" }),
];

describe("summarizeRealm: level", () => {
  it("says no rule flags only when nothing fired and the weather is calm", () => {
    const v = summarizeRealm(state(sound()));
    expect(v.level).toBe("sound");
    expect(REALM_LEVEL_LABEL[v.level]).toBe("No rule flags");
    expect(v.lookFirst).toEqual([]);
    expect(v.headline).toMatch(/no rule flags/i);
  });

  it("needs a look first when any tripwire has fired, however small the holding", () => {
    const towers = sound();
    towers.push(tower({ holding_id: "d", name: "Small", weight_pct: "1", thesis: "breached", tripwires_fired: 1 }));
    const v = summarizeRealm(state(towers));
    expect(v.level).toBe("attention");
    expect(v.lookFirst[0].holdingId).toBe("d");
    expect(v.lookFirst[0].reasons).toContain("a tripwire has fired");
    expect(v.lines.find((l) => l.id === "thesis")?.tone).toBe("bad");
  });

  it("needs a look first at 20% weak walls, but only mixed below that", () => {
    const at = REALM_RULES.weakWallAttentionPct;
    const heavy = [tower({ holding_id: "w", weight_pct: String(at), wall: "timber" }), tower({ holding_id: "s", weight_pct: String(100 - at) })];
    expect(summarizeRealm(state(heavy)).level).toBe("attention");
    const light = [tower({ holding_id: "w", weight_pct: String(at - 1), wall: "rotted" }), tower({ holding_id: "s", weight_pct: String(101 - at) })];
    expect(summarizeRealm(state(light)).level).toBe("mixed");
  });

  it("needs a look first when 40% or more has no moat", () => {
    const v = summarizeRealm(
      state([tower({ holding_id: "m", weight_pct: "40", moat: "none" }), tower({ holding_id: "s", weight_pct: "60" })]),
    );
    expect(v.level).toBe("attention");
  });

  it("needs a look first under siege, mixed while the storm gathers", () => {
    const calm = state(sound());
    const base = calm.siege!;
    expect(summarizeRealm({ ...calm, siege: { ...base, level: "besieged" } }).level).toBe("attention");
    expect(summarizeRealm({ ...calm, siege: { ...base, level: "gathering" } }).level).toBe("mixed");
  });

  it("is mixed for a thesis flagged for review, a dear tower at 25%, or a restless temperament", () => {
    const review = sound();
    review[2] = tower({ holding_id: "c", weight_pct: "25", thesis: "review" });
    expect(summarizeRealm(state(review)).level).toBe("mixed");
    const dear = sound();
    dear[2] = tower({ holding_id: "c", weight_pct: "25", land: "overpriced" });
    expect(summarizeRealm(state(dear)).level).toBe("mixed");
    const t = state(sound(), {
      temperament: {
        level: "restless",
        needle_pct: "30",
        low_confidence: false,
        decisions_logged: 8,
        snapshot_comparisons: 1,
        drains: 4,
        restores: 1,
        window_days: 365,
        summary: "Based on 8 logged decisions.",
        events: [],
        turnover: [],
      },
    });
    expect(summarizeRealm(t).level).toBe("mixed");
  });

  it("cannot judge when half or more was never surveyed, and never calls that sound", () => {
    const towers = [
      tower({ holding_id: "u1", weight_pct: "50", wall: "unsurveyed", freshness: "unsurveyed", moat: "unsurveyed", thesis: "not_analyzed", verdict_rating: null }),
      tower({ holding_id: "s", weight_pct: "50" }),
    ];
    const v = summarizeRealm(state(towers));
    expect(v.level).toBe("unknown");
    expect(v.lines.find((l) => l.id === "walls")?.tone).toBe("unknown");
  });

  it("a definite breach beats unknown data", () => {
    const towers = [
      tower({ holding_id: "u1", weight_pct: "70", wall: "unsurveyed", freshness: "unsurveyed", moat: "unsurveyed", thesis: "not_analyzed" }),
      tower({ holding_id: "b", weight_pct: "30", thesis: "breached", tripwires_fired: 2 }),
    ];
    expect(summarizeRealm(state(towers)).level).toBe("attention");
  });

  it("cannot judge an empty fortress", () => {
    const v = summarizeRealm(state([]));
    expect(v.level).toBe("unknown");
    expect(v.lookFirst).toEqual([]);
  });
});

describe("summarizeRealm: content", () => {
  it("reports shares of the portfolio per wall, moat and analysis age", () => {
    const v = summarizeRealm(state(sound()));
    expect(v.lines.find((l) => l.id === "walls")?.text).toContain("100% behind basalt or granite");
    expect(v.lines.find((l) => l.id === "moat")?.text).toContain("65% behind a wide moat");
    expect(v.lines.find((l) => l.id === "moat")?.text).toContain("35% behind a narrow moat");
    expect(v.lines.find((l) => l.id === "analysis")?.text).toContain("100% analysed recently");
  });

  it("lists the towers to open first, breached then biggest, with reasons, at most five", () => {
    const towers = [
      ...Array.from({ length: 7 }, (_, i) => tower({ holding_id: `r${i}`, name: `Rot ${i}`, weight_pct: String(i + 1), wall: "rotted" })),
      tower({ holding_id: "x", name: "Fired", weight_pct: "0.5", thesis: "breached" }),
    ];
    const v = summarizeRealm(state(towers));
    expect(v.lookFirst).toHaveLength(5);
    expect(v.lookFirst[0].holdingId).toBe("x");
    expect(v.lookFirst[1].holdingId).toBe("r6");
    expect(v.lookFirst[1].reasons).toContain("rotted walls");
  });

  it("counts the stored analyst verdicts, in rating order, with Not analyzed last", () => {
    const towers = [
      tower({ holding_id: "1", verdict_rating: "Hold" }),
      tower({ holding_id: "2", verdict_rating: "Strong Buy" }),
      tower({ holding_id: "3", verdict_rating: null }),
      tower({ holding_id: "4", verdict_rating: "Hold" }),
    ];
    expect(summarizeRealm(state(towers)).analystMix).toEqual([
      { rating: "Strong Buy", count: 1 },
      { rating: "Hold", count: 2 },
      { rating: "Not analyzed", count: 1 },
    ]);
  });

  it("never tells the reader to buy, sell, add or trim", () => {
    const states = [
      state(sound()),
      state([tower({ weight_pct: "100", thesis: "breached", wall: "rotted", moat: "none", land: "bargain" })]),
      state([]),
    ];
    for (const s of states) {
      const v = summarizeRealm(s);
      const text = [v.headline, v.oneLine, ...v.lines.map((l) => l.text)].join(" ");
      expect(text).not.toMatch(/\b(you should|buy more|sell|add to|trim|accumulate|invest)\b/i);
    }
  });

  it("explains why a tower is on the look-first list the same way the Ledger filter does", () => {
    expect(lookReasons(tower({ wall: "timber", moat: "none", freshness: "overgrown" }))).toEqual([
      "timber walls",
      "no moat",
      "analysis is stale",
    ]);
    expect(lookReasons(tower())).toEqual([]);
  });
});
