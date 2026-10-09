import { describe, expect, it } from "vitest";
import {
  formatWallInput,
  ADVISOR_NAME,
  ADVISOR_ROLE,
  ADVISOR_TONE_LABEL,
  LAMP_RECENT_DAYS,
  advisorRuleLabel,
  clockHands,
  clockPoint,
  lampReading,
  TEMPERAMENT_BANDS,
  dialArc,
  dialPoint,
  needlePct,
  temperamentRuleLabel,
  MAX_DRAWN_SHACKS,
  SCENE_WIDTH,
  describeSiegeExposure,
  describeTower,
  drawnShacks,
  formatShock,
  ladderCount,
  landSignText,
  sharedWallLinks,
  siegeSky,
  filterLedger,
  ledgerTotals,
  needsAttention,
  sortLedger,
  layoutTowers,
  groundY,
  moatRuns,
  moatKindOf,
  KEEP_HEIGHT,
  WALL_EDGE,
  sortTowers,
  towerDimensions,
  weightScale,
  siegeCamp,
  WEIGHT_SCALE_MIN,
  WEIGHT_SCALE_MAX,
} from "./fortress";
import type { GameTower } from "./types";

function tower(overrides: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: overrides.holding_id ?? "id",
    ticker: "AAA",
    name: "Alpha",
    instrument_type: "stock",
    sector: null,
    structure: "keep",
    value_nok: "1000",
    weight_pct: "10",
    size_class: "medium",
    moat: "wide",
    wall: "granite",
    wall_reason: "net debt / EBITDA 0.8x",
    wall_inputs: {},
    freshness: "fresh",
    analysis_age_days: 10,
    verdict_rating: "Buy",
    land: "fog",
    land_reason: "no stored margin-of-safety result for this holding",
    margin_of_safety_pct: null,
    thesis: "intact",
    tripwires_fired: 0,
    siege_exposure: "unsurveyed",
    siege_shock_pct: null,
    siege_method: null,
    shared_wall_with: [],
    ...overrides,
  };
}

describe("sortTowers", () => {
  it("puts the biggest holding first, unweighted last, ties by name", () => {
    const sorted = sortTowers([
      tower({ holding_id: "1", name: "Beta", weight_pct: "5" }),
      tower({ holding_id: "2", name: "Zeta", weight_pct: null }),
      tower({ holding_id: "3", name: "Alpha", weight_pct: "5" }),
      tower({ holding_id: "4", name: "Gamma", weight_pct: "20" }),
    ]);
    expect(sorted.map((t) => t.name)).toEqual(["Gamma", "Alpha", "Beta", "Zeta"]);
  });
  it("does not mutate its input", () => {
    const input = [tower({ name: "B", weight_pct: "1" }), tower({ name: "A", weight_pct: "9" })];
    sortTowers(input);
    expect(input[0].name).toBe("B");
  });
});

describe("towerDimensions", () => {
  it("draws a bigger size class bigger", () => {
    const great = towerDimensions(tower({ size_class: "great" }));
    const tiny = towerDimensions(tower({ size_class: "tiny" }));
    expect(great.w).toBeGreaterThan(tiny.w);
    expect(great.h).toBeGreaterThan(tiny.h);
  });
  it("draws funds and gold lower than a keep of the same size", () => {
    const keep = towerDimensions(tower({ structure: "keep" }));
    expect(towerDimensions(tower({ structure: "outpost" })).h).toBeLessThan(keep.h);
    expect(towerDimensions(tower({ structure: "bullion" })).h).toBeLessThan(keep.h);
  });
});

describe("layoutTowers", () => {
  it("is empty and still has a height for no holdings", () => {
    const layout = layoutTowers([]);
    expect(layout.items).toEqual([]);
    expect(layout.rows).toBe(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("keeps every tower inside the scene and never overlaps neighbours", () => {
    const many = Array.from({ length: 23 }, (_, i) =>
      tower({
        holding_id: `h${i}`,
        name: `Co ${i}`,
        weight_pct: String(30 - i),
        size_class: (["great", "medium", "small", "tiny"] as const)[i % 4],
      }),
    );
    const layout = layoutTowers(many);
    expect(layout.items).toHaveLength(23);
    for (const item of layout.items) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.x + item.w).toBeLessThanOrEqual(SCENE_WIDTH);
    }
    for (let r = 0; r < layout.rows; r++) {
      const row = layout.items.filter((i) => i.row === r).sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) {
        expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + row[i - 1].w);
      }
    }
  });

  it("wraps onto more rows as holdings grow, and grows the scene with them", () => {
    const few = layoutTowers([tower({ holding_id: "a" })]);
    const lots = layoutTowers(
      Array.from({ length: 30 }, (_, i) => tower({ holding_id: `h${i}`, size_class: "great" })),
    );
    expect(few.rows).toBe(1);
    expect(lots.rows).toBeGreaterThan(1);
    expect(lots.height).toBeGreaterThan(few.height);
  });

  it("assigns draw order matching the size ordering", () => {
    const layout = layoutTowers([
      tower({ holding_id: "small", name: "S", weight_pct: "2" }),
      tower({ holding_id: "big", name: "B", weight_pct: "40" }),
    ]);
    expect(layout.items.map((i) => i.tower.holding_id)).toEqual(["big", "small"]);
    expect(layout.items.map((i) => i.index)).toEqual([0, 1]);
  });
});

describe("the fortress as one structure", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      tower({
        holding_id: `h${i}`,
        name: `Co ${i}`,
        weight_pct: String(40 - i),
        size_class: (["great", "medium", "small", "tiny"] as const)[i % 4],
        moat: (["wide", "narrow", "none", "unsurveyed", "not_applicable"] as const)[i % 5],
      }),
    );

  it("puts the Great Keep in the middle of the top terrace, even with no holdings", () => {
    const empty = layoutTowers([]);
    expect(empty.keep.x + empty.keep.w / 2).toBe(SCENE_WIDTH / 2);
    const layout = layoutTowers(many(9));
    expect(layout.keep.x + layout.keep.w / 2).toBe(SCENE_WIDTH / 2);
    expect(layout.keep.y).toBe(groundY(0));
    expect(layout.keep.h).toBe(KEEP_HEIGHT);
  });

  it("never lets a tower overlap the keep and keeps the biggest holdings beside it", () => {
    const layout = layoutTowers(many(9));
    const top = layout.items.filter((i) => i.row === 0);
    expect(top.length).toBeGreaterThan(1);
    for (const it of top) {
      const clear = it.x + it.w <= layout.keep.x || it.x >= layout.keep.x + layout.keep.w;
      expect(clear).toBe(true);
    }
    // The two heaviest holdings are on the top terrace, one on each side.
    const heaviest = layout.items.filter((i) => i.tower.holding_id === "h0" || i.tower.holding_id === "h1");
    expect(heaviest.every((i) => i.row === 0)).toBe(true);
    expect(new Set(heaviest.map((i) => i.x < layout.keep.x)).size).toBe(2);
  });

  it("puts every tower on a terrace that exists and keeps rows contiguous", () => {
    const layout = layoutTowers(many(31));
    const rows = new Set(layout.items.map((i) => i.row));
    for (let r = 0; r < layout.rows; r++) expect(rows.has(r)).toBe(true);
    expect(layout.items).toHaveLength(31);
  });

  it("moat runs: one stretch per tower tier, no gaps and no overlap along a row", () => {
    const layout = layoutTowers(many(9));
    const runs = moatRuns(layout);
    for (const run of runs) {
      expect(run.x1).toBeGreaterThan(run.x0);
      for (let i = 1; i < run.segs.length; i++) expect(run.segs[i].x0).toBeCloseTo(run.segs[i - 1].x1, 5);
    }
    // Every tower owns exactly one stretch of moat.
    const owned = runs.flatMap((r) => r.segs.map((sg) => sg.holdingId));
    expect(owned.sort()).toEqual(layout.items.map((i) => i.tower.holding_id).sort());
  });

  it("moat runs: water for wide and narrow, a dry ditch for none, fog for unsurveyed, plain for funds", () => {
    expect(moatKindOf("wide")).toBe("water");
    expect(moatKindOf("narrow")).toBe("water");
    expect(moatKindOf("none")).toBe("dry");
    expect(moatKindOf("unsurveyed")).toBe("fog");
    expect(moatKindOf("not_applicable")).toBe("plain");
  });

  it("moat runs: neighbours with the same kind join into one stretch", () => {
    const layout = layoutTowers([
      tower({ holding_id: "a", weight_pct: "30", moat: "wide" }),
      tower({ holding_id: "b", weight_pct: "20", moat: "narrow" }),
      tower({ holding_id: "c", weight_pct: "10", moat: "none" }),
    ]);
    const runs = moatRuns(layout);
    const water = runs.filter((r) => r.kind === "water");
    const dry = runs.filter((r) => r.kind === "dry");
    expect(water.reduce((n, r) => n + r.segs.length, 0)).toBe(2);
    expect(dry).toHaveLength(1);
    expect(dry[0].segs[0].holdingId).toBe("c");
  });

  it("the outer moat ends reach the corner bastions", () => {
    const layout = layoutTowers(many(9));
    const top = moatRuns(layout).filter((r) => r.row === 0);
    expect(Math.min(...top.map((r) => r.x0))).toBe(WALL_EDGE);
    expect(Math.max(...top.map((r) => r.x1))).toBe(SCENE_WIDTH - WALL_EDGE);
  });
});

describe("drawnShacks", () => {
  it("caps the huts drawn but never goes negative", () => {
    expect(drawnShacks(0)).toBe(0);
    expect(drawnShacks(-3)).toBe(0);
    expect(drawnShacks(5)).toBe(5);
    expect(drawnShacks(400)).toBe(MAX_DRAWN_SHACKS);
  });
});

describe("describeTower", () => {
  it("names size, moat and walls for a keep", () => {
    expect(describeTower(tower({ name: "Equinor", size_class: "great" }))).toBe(
      "Equinor, great tower, wide moat, granite walls",
    );
  });
  it("leaves out moat and walls where they do not apply", () => {
    const text = describeTower(
      tower({ name: "Gold ETC", structure: "bullion", moat: "not_applicable", wall: "not_applicable" }),
    );
    expect(text).toBe("Gold ETC, medium tower, gold store");
  });
});

describe("ledger helpers (G3)", () => {
  const strong = tower({ holding_id: "s", name: "Strong", weight_pct: "30", wall: "basalt", moat: "wide", freshness: "fresh" });
  const weak = tower({ holding_id: "w", name: "Weak", weight_pct: "5", wall: "rotted", moat: "none", freshness: "overgrown" });
  const fog = tower({ holding_id: "f", name: "Fog", weight_pct: null, wall: "unsurveyed", moat: "unsurveyed", freshness: "unsurveyed" });
  const mid = tower({ holding_id: "m", name: "Mid", weight_pct: "15", wall: "brick", moat: "narrow", freshness: "weathered" });

  it("sorts weight descending by default and puts unweighted last", () => {
    expect(sortLedger([weak, fog, strong, mid], "weight").map((t) => t.holding_id)).toEqual(["s", "m", "w", "f"]);
  });

  it("sorts walls strongest first and puts unsurveyed after real ratings", () => {
    expect(sortLedger([fog, weak, mid, strong], "wall").map((t) => t.holding_id)).toEqual(["s", "m", "w", "f"]);
    expect(sortLedger([fog, weak, mid, strong], "wall", "desc")[0].holding_id).toBe("f");
  });

  it("sorts by moat, freshness and name", () => {
    expect(sortLedger([weak, mid, strong], "moat").map((t) => t.holding_id)).toEqual(["s", "m", "w"]);
    expect(sortLedger([weak, mid, strong], "freshness").map((t) => t.holding_id)).toEqual(["s", "m", "w"]);
    expect(sortLedger([weak, mid, strong], "name").map((t) => t.name)).toEqual(["Mid", "Strong", "Weak"]);
  });

  it("does not mutate its input", () => {
    const input = [weak, strong];
    sortLedger(input, "weight");
    expect(input[0]).toBe(weak);
  });

  it("flags attention on timber/rotted walls, no moat, stale or missing analysis", () => {
    expect(needsAttention(strong)).toBe(false);
    expect(needsAttention(mid)).toBe(false);
    expect(needsAttention(weak)).toBe(true);
    expect(needsAttention(fog)).toBe(true);
    expect(needsAttention(tower({ wall: "timber" }))).toBe(true);
    expect(needsAttention(tower({ moat: "none" }))).toBe(true);
    expect(needsAttention(tower({ freshness: "overgrown" }))).toBe(true);
  });

  it("filters to the attention list", () => {
    expect(filterLedger([strong, weak, fog, mid], "all")).toHaveLength(4);
    expect(filterLedger([strong, weak, fog, mid], "attention").map((t) => t.holding_id)).toEqual(["w", "f"]);
  });

  it("totals count, weight and attention, ignoring missing weights", () => {
    expect(ledgerTotals([strong, weak, fog, mid])).toEqual({ count: 4, weightPct: 50, attention: 2 });
    expect(ledgerTotals([])).toEqual({ count: 0, weightPct: 0, attention: 0 });
  });
});


describe("siegeSky", () => {
  it("is clear for calm, clouded for gathering, red with fires for besieged", () => {
    expect(siegeSky("calm")).toMatchObject({ clouds: 0, fires: 0, mist: false });
    expect(siegeSky("gathering").clouds).toBeGreaterThan(0);
    expect(siegeSky("gathering").fires).toBe(0);
    expect(siegeSky("besieged").clouds).toBeGreaterThan(siegeSky("gathering").clouds);
    expect(siegeSky("besieged").fires).toBeGreaterThan(0);
  });
  it("draws mist, not clear skies, when the weather was never surveyed", () => {
    for (const level of ["unsurveyed", null, undefined] as const) {
      expect(siegeSky(level)).toMatchObject({ clouds: 0, fires: 0, mist: true });
    }
    expect(siegeSky("calm").mist).toBe(false);
  });
});

describe("ladderCount", () => {
  it("draws no ladders in calm or unsurveyed weather, whatever the exposure", () => {
    for (const level of ["calm", "unsurveyed", null] as const) {
      expect(ladderCount("breach_risk", level)).toBe(0);
      expect(ladderCount("exposed", level)).toBe(0);
    }
  });
  it("draws two ladders for breach risk and one for exposed once the weather turns", () => {
    for (const level of ["gathering", "besieged"] as const) {
      expect(ladderCount("breach_risk", level)).toBe(2);
      expect(ladderCount("exposed", level)).toBe(1);
      expect(ladderCount("sheltered", level)).toBe(0);
      expect(ladderCount("unsurveyed", level)).toBe(0);
    }
  });
});

describe("landSignText", () => {
  it("signs bargain, offer and dear land, and leaves full price and fog bare", () => {
    expect(landSignText("bargain")).toBe("SALE");
    expect(landSignText("discount")).toBe("OFFER");
    expect(landSignText("overpriced")).toBe("DEAR");
    expect(landSignText("full_price")).toBeNull();
    expect(landSignText("fog")).toBeNull();
  });
});

describe("formatShock", () => {
  it("formats a stored fraction as a signed percentage", () => {
    expect(formatShock("-0.25")).toBe("−25.0%");
    expect(formatShock("-0.4321")).toBe("−43.2%");
    expect(formatShock("0.05")).toBe("5.0%");
    expect(formatShock("0")).toBe("0.0%");
  });
  it("shows a dash for nothing stored and passes odd text through", () => {
    expect(formatShock(null)).toBe("—");
    expect(formatShock("n/a")).toBe("n/a");
  });
});

describe("describeSiegeExposure", () => {
  it("says no stress result is stored instead of inventing one", () => {
    expect(describeSiegeExposure(tower({ siege_exposure: "unsurveyed" }))).toMatch(/no stress result stored/i);
    // a category without its number is not trusted either
    expect(describeSiegeExposure(tower({ siege_exposure: "exposed", siege_shock_pct: null }))).toMatch(
      /no stress result stored/i,
    );
  });
  it("gives the label, the number and how the number was made", () => {
    const text = describeSiegeExposure(
      tower({ siege_exposure: "breach_risk", siege_shock_pct: "-0.45", siege_method: "volatility" }),
    );
    expect(text).toMatch(/risk of breach/i);
    expect(text).toContain("−45.0%");
    expect(text).toMatch(/two-standard-deviation/);
  });
});

describe("describeTower (G4 facts)", () => {
  it("mentions a fired tripwire, a review flag and cheap land for screen readers", () => {
    expect(describeTower(tower({ thesis: "breached" }))).toMatch(/tripwire has fired/);
    expect(describeTower(tower({ thesis: "review" }))).toMatch(/flagged for review/);
    expect(describeTower(tower({ land: "bargain" }))).toMatch(/for sale/);
    expect(describeTower(tower({ land: "discount" }))).toMatch(/on offer/);
  });
  it("stays quiet about intact theses and fog or fully priced land", () => {
    const text = describeTower(tower({ thesis: "intact", land: "full_price" }));
    expect(text).not.toMatch(/tripwire|review|sale|offer/);
    expect(describeTower(tower({ land: "fog" }))).not.toMatch(/sale|offer/);
  });
});

describe("sharedWallLinks", () => {
  const layout = layoutTowers([
    tower({ holding_id: "a", ticker: "AAA", name: "Alpha", weight_pct: "30" }),
    tower({ holding_id: "b", ticker: "BBB", name: "Beta", weight_pct: "20" }),
    tower({ holding_id: "c", ticker: "CCC", name: "Gamma", weight_pct: "10" }),
  ]);
  const wall = (tickers: string[]) => ({
    names: tickers,
    tickers,
    correlation: "0.85",
    combined_weight_pct: "50",
  });

  it("links same-row neighbours in left-to-right order", () => {
    const links = sharedWallLinks(layout.items, [wall(["CCC", "AAA"])]);
    expect(links).toHaveLength(1);
    const a = layout.items.find((i) => i.tower.ticker === "AAA");
    const c = layout.items.find((i) => i.tower.ticker === "CCC");
    // The biggest holding stands next to the keep and Gamma is outside it, so Gamma is on the left.
    expect(a && c && c.x < a.x).toBe(true);
    expect(links[0]).toMatchObject({ fromId: "c", toId: "a", correlation: "0.85" });
  });

  it("chains three members and ignores tickers that are not in the scene", () => {
    expect(sharedWallLinks(layout.items, [wall(["AAA", "BBB", "CCC"])])).toHaveLength(2);
    expect(sharedWallLinks(layout.items, [wall(["AAA", "NOPE"])])).toEqual([]);
    expect(sharedWallLinks(layout.items, [])).toEqual([]);
  });

  it("draws no wall through the Great Keep", () => {
    const keepLayout = layoutTowers([
      tower({ holding_id: "a", ticker: "AAA", weight_pct: "30" }),
      tower({ holding_id: "b", ticker: "BBB", weight_pct: "20" }),
    ]);
    // Alpha and Beta are on opposite sides of the keep.
    const a = keepLayout.items.find((i) => i.tower.ticker === "AAA")!;
    const b = keepLayout.items.find((i) => i.tower.ticker === "BBB")!;
    expect(a.x + a.w).toBeLessThanOrEqual(keepLayout.keep.x);
    expect(b.x).toBeGreaterThanOrEqual(keepLayout.keep.x + keepLayout.keep.w);
    expect(sharedWallLinks(keepLayout.items, [wall(["AAA", "BBB"])], keepLayout.keep)).toEqual([]);
    expect(sharedWallLinks(keepLayout.items, [wall(["AAA", "BBB"])])).toHaveLength(1);
  });

  it("does not draw a wall across rows", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      tower({ holding_id: `t${i}`, ticker: `T${i}`, name: `Tower ${i}`, weight_pct: String(20 - i), size_class: "great" }),
    );
    const big = layoutTowers(many);
    const first = big.items[0];
    const other = big.items.find((i) => i.row !== first.row);
    expect(other).toBeDefined();
    expect(sharedWallLinks(big.items, [wall([first.tower.ticker, other!.tower.ticker])])).toEqual([]);
  });
});

describe("Ledger with G4 columns", () => {
  const rows = [
    tower({ holding_id: "1", name: "Aa", land: "overpriced", thesis: "intact", siege_exposure: "sheltered" }),
    tower({ holding_id: "2", name: "Bb", land: "bargain", thesis: "breached", siege_exposure: "breach_risk", tripwires_fired: 2 }),
    tower({ holding_id: "3", name: "Cc", land: "fog", thesis: "review", siege_exposure: "unsurveyed" }),
    tower({ holding_id: "4", name: "Dd", land: "discount", thesis: "not_analyzed", siege_exposure: "exposed" }),
  ];
  it("sorts land cheapest first with fog last", () => {
    expect(sortLedger(rows, "land", "asc").map((t) => t.name)).toEqual(["Bb", "Dd", "Aa", "Cc"]);
  });
  it("sorts thesis most urgent first and siege most exposed first, unknown last", () => {
    expect(sortLedger(rows, "thesis", "asc").map((t) => t.name)).toEqual(["Bb", "Cc", "Aa", "Dd"]);
    expect(sortLedger(rows, "siege", "asc").map((t) => t.name)).toEqual(["Bb", "Dd", "Aa", "Cc"]);
  });
  it("puts a fired tripwire in 'needs a look', but not cheap land or a hypothetical exposure", () => {
    expect(needsAttention(tower({ thesis: "breached" }))).toBe(true);
    expect(needsAttention(tower({ thesis: "review" }))).toBe(false);
    expect(needsAttention(tower({ land: "bargain", siege_exposure: "breach_risk" }))).toBe(false);
    expect(filterLedger(rows, "attention").map((t) => t.name)).toEqual(["Bb"]);
    expect(ledgerTotals(rows).attention).toBe(1);
  });
});

describe("temperament helpers (G6)", () => {
  it("places the dial ends and the middle", () => {
    const left = dialPoint(0, 100, 100, 50);
    const top = dialPoint(50, 100, 100, 50);
    const right = dialPoint(100, 100, 100, 50);
    expect(left.x).toBeCloseTo(50);
    expect(left.y).toBeCloseTo(100);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    expect(right.x).toBeCloseTo(150);
  });

  it("clamps the dial to 0–100", () => {
    expect(dialPoint(-20, 100, 100, 50)).toEqual(dialPoint(0, 100, 100, 50));
    expect(dialPoint(140, 100, 100, 50)).toEqual(dialPoint(100, 100, 100, 50));
  });

  it("never invents a needle for a missing reading", () => {
    expect(needlePct(null)).toBeNull();
    expect(needlePct("not a number")).toBeNull();
    expect(needlePct("60.0")).toBe(60);
  });

  it("bands cover 0–100 with the mapping's edges", () => {
    expect(TEMPERAMENT_BANDS.map((b) => [b.from, b.to])).toEqual([
      [0, 20],
      [20, 40],
      [40, 70],
      [70, 100],
    ]);
  });

  it("labels known rules and degrades gracefully for unknown ones", () => {
    expect(temperamentRuleLabel("churn")).toBe("Churn");
    expect(temperamentRuleLabel("some_new_rule")).toBe("some new rule");
  });

  it("draws an arc path", () => {
    expect(dialArc(0, 100, 100, 100, 50)).toMatch(/^M50\.00 100\.00 A50 50 0 0 1 150\.00 100\.00$/);
  });
});


describe("advisor wording (G7b)", () => {
  it("names both advisors and every tone, and never presents them as the real people", () => {
    expect(ADVISOR_NAME.oracle).toBe("The Oracle");
    expect(ADVISOR_NAME.partner).toBe("The Partner");
    expect(Object.keys(ADVISOR_ROLE).sort()).toEqual(["oracle", "partner"]);
    expect(Object.keys(ADVISOR_TONE_LABEL).sort()).toEqual(["calm", "note", "warning"]);
    const all = [...Object.values(ADVISOR_NAME), ...Object.values(ADVISOR_ROLE)].join(" ").toLowerCase();
    expect(all).not.toMatch(/buffett|munger/);
  });

  it("shows a rule id as readable words", () => {
    expect(advisorRuleLabel("weak_walls_big_tower")).toBe("weak walls big tower");
    expect(advisorRuleLabel("all_quiet")).toBe("all quiet");
  });
});

describe("study lamp (G7b)", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("is lit for a snapshot from the last week, with the age in words", () => {
    expect(lampReading("2026-10-01T08:00:00Z", now)).toMatchObject({ state: "lit", ageDays: 0 });
    expect(lampReading("2026-10-01T08:00:00Z", now).text).toContain("today");
    expect(lampReading("2026-09-30T08:00:00Z", now).text).toContain("yesterday");
    expect(lampReading("2026-09-27T12:00:00Z", now)).toMatchObject({ state: "lit", ageDays: 4 });
  });

  it("flips from lit to dim exactly after the recent-days limit", () => {
    const edge = new Date(now.getTime() - LAMP_RECENT_DAYS * 86_400_000).toISOString();
    const past = new Date(now.getTime() - (LAMP_RECENT_DAYS + 1) * 86_400_000).toISOString();
    expect(lampReading(edge, now).state).toBe("lit");
    expect(lampReading(past, now)).toMatchObject({ state: "dim", ageDays: LAMP_RECENT_DAYS + 1 });
    expect(lampReading(past, now).text).toContain("Upload a new one");
  });

  it("is out, never lit, with no snapshot or an unreadable date", () => {
    expect(lampReading(null, now)).toMatchObject({ state: "out", ageDays: null });
    expect(lampReading("not a date", now).state).toBe("out");
  });

  it("treats a future-dated snapshot as age zero rather than a negative age", () => {
    expect(lampReading("2026-10-05T00:00:00Z", now)).toMatchObject({ state: "lit", ageDays: 0 });
  });
});

describe("clock geometry (G7b)", () => {
  it("puts the hands where an analog clock does", () => {
    expect(clockHands(new Date(2026, 9, 1, 3, 0))).toEqual({ hour: 90, minute: 0 });
    expect(clockHands(new Date(2026, 9, 1, 0, 30))).toEqual({ hour: 15, minute: 180 });
    expect(clockHands(new Date(2026, 9, 1, 15, 15))).toEqual({ hour: 97.5, minute: 90 });
    expect(clockHands(new Date(2026, 9, 1, 12, 0))).toEqual({ hour: 0, minute: 0 });
  });

  it("maps degrees clockwise from 12 o'clock to points on the face", () => {
    const top = clockPoint(0, 22, 22, 10);
    const right = clockPoint(90, 22, 22, 10);
    const bottom = clockPoint(180, 22, 22, 10);
    expect([top.x, top.y]).toEqual([22, 12]);
    expect(right.x).toBeCloseTo(32);
    expect(right.y).toBeCloseTo(22);
    expect(bottom.x).toBeCloseTo(22);
    expect(bottom.y).toBeCloseTo(32);
  });
});

describe("formatWallInput", () => {
  it("shows ratios with a multiplication sign", () => {
    expect(formatWallInput("net_debt_to_ebitda", "1.4")).toBe("net debt / EBITDA: 1.40×");
    expect(formatWallInput("interest_coverage", "5.236")).toBe("EBIT / interest: 5.24×");
  });
  it("compacts large amounts instead of printing raw digits", () => {
    expect(formatWallInput("ebitda", "6041500000.00")).toBe("EBITDA: 6.04 bn");
    expect(formatWallInput("ebitda", "-2500000")).toBe("EBITDA: -2.5 m");
  });
  it("leaves unparseable values as given", () => {
    expect(formatWallInput("ebitda", "n/a")).toBe("EBITDA: n/a");
  });
});

describe("weightScale (option D)", () => {
  it("is neutral when the weight is unknown or not a number", () => {
    expect(weightScale(null)).toBe(1);
    expect(weightScale("abc")).toBe(1);
  });
  it("grows with weight and stays inside its bounds", () => {
    expect(weightScale("22")).toBeGreaterThan(weightScale("10"));
    expect(weightScale("10")).toBeGreaterThan(weightScale("2"));
    expect(weightScale("0")).toBe(WEIGHT_SCALE_MIN);
    expect(weightScale("-5")).toBe(WEIGHT_SCALE_MIN);
    expect(weightScale("90")).toBe(WEIGHT_SCALE_MAX);
  });
  it("changes height only, never width", () => {
    const heavy = towerDimensions(tower({ size_class: "medium", weight_pct: "30" }));
    const light = towerDimensions(tower({ size_class: "medium", weight_pct: "1" }));
    expect(heavy.w).toBe(light.w);
    expect(heavy.h).toBeGreaterThan(light.h);
  });
});

describe("siegeCamp (option C)", () => {
  it("draws no enemy in calm or unsurveyed weather", () => {
    for (const lvl of ["calm", "unsurveyed", null, undefined] as const) {
      expect(siegeCamp(lvl)).toEqual({ tents: 0, soldiers: 0, engines: 0, arrows: 0 });
    }
  });
  it("shows scouts while gathering and engines and arrows only when besieged", () => {
    const g = siegeCamp("gathering");
    const b = siegeCamp("besieged");
    expect(g.tents).toBeGreaterThan(0);
    expect(g.engines).toBe(0);
    expect(g.arrows).toBe(0);
    expect(b.tents).toBeGreaterThan(g.tents);
    expect(b.engines).toBeGreaterThan(0);
    expect(b.arrows).toBeGreaterThan(0);
  });
});
