import { describe, expect, it } from "vitest";
import { layoutTowers } from "./fortress";
import {
  plainAttentionWord,
  plainBarPct,
  plainFacts,
  plainHeading,
  plainRows,
  plainSharedWall,
} from "./plainFortress";
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

describe("plainRows", () => {
  it("has no rows for an empty portfolio", () => {
    expect(plainRows(layoutTowers([]))).toEqual([]);
  });

  it("puts the keep after the left-hand towers of row 0 and lists every tower once", () => {
    const towers = Array.from({ length: 5 }, (_, i) =>
      tower({ holding_id: `t${i}`, name: `T${i}`, weight_pct: String(30 - i * 5) }),
    );
    const layout = layoutTowers(towers);
    const rows = plainRows(layout);
    expect(rows[0].keepAfter).toBe(layout.items.filter((i) => i.row === 0 && i.x < layout.keep.x).length);
    expect(rows.slice(1).every((r) => r.keepAfter === null)).toBe(true);
    const ids = rows.flatMap((r) => r.items.map((i) => i.tower.holding_id)).sort();
    expect(ids).toEqual(towers.map((t) => t.holding_id).sort());
    for (const r of rows) {
      const xs = r.items.map((i) => i.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    }
  });

  it("keeps the scene's terraces when there are many holdings", () => {
    const towers = Array.from({ length: 30 }, (_, i) => tower({ holding_id: `t${i}`, name: `T${String(i).padStart(2, "0")}`, weight_pct: "3" }));
    const layout = layoutTowers(towers);
    const rows = plainRows(layout);
    expect(rows.length).toBe(layout.rows);
    expect(rows.reduce((n, r) => n + r.items.length, 0)).toBe(30);
  });
});

describe("plainFacts", () => {
  it("states every category in words, with ages, margins, tripwires and the what-if", () => {
    const facts = plainFacts(
      tower({
        analysis_age_days: 40,
        land: "discount",
        margin_of_safety_pct: "22.5",
        thesis: "breached",
        tripwires_fired: 2,
        siege_exposure: "exposed",
        siege_shock_pct: "-0.25",
      }),
    );
    expect(facts.map((f) => f.label)).toEqual(["Moat", "Walls", "Analysis", "Land", "Thesis", "Siege"]);
    const by = Object.fromEntries(facts.map((f) => [f.label, f]));
    expect(by.Moat.value).toBe("Wide moat");
    expect(by.Walls.note).toBe("net debt / EBITDA 0.8x");
    expect(by.Analysis.note).toBe("40 days old");
    expect(by.Land.value).toBe("On offer");
    expect(by.Land.note).toBe("22.5% margin of safety");
    expect(by.Thesis.note).toBe("2 tripwires fired");
    expect(by.Siege.note).toBe("−25.0% in the what-if");
  });

  it("adds no note for fog, and says one tripwire in the singular", () => {
    const facts = Object.fromEntries(plainFacts(tower({ thesis: "breached", tripwires_fired: 1 })).map((f) => [f.label, f]));
    expect(facts.Land.note).toBeUndefined();
    expect(facts.Siege.note).toBeUndefined();
    expect(facts.Thesis.note).toBe("1 tripwire fired");
  });
});

describe("plain block helpers", () => {
  it("heading shows the dash for an unknown weight and value", () => {
    const h = plainHeading(tower({ weight_pct: null, value_nok: null }));
    expect(h.weight).toBe("—");
    expect(h.value).toBe("—");
    expect(h.sub).toContain("AAA");
  });

  it("bar width is clamped and null when unweighted", () => {
    expect(plainBarPct(tower({ weight_pct: null }))).toBeNull();
    expect(plainBarPct(tower({ weight_pct: "12.5" }))).toBe(12.5);
    expect(plainBarPct(tower({ weight_pct: "140" }))).toBe(100);
    expect(plainBarPct(tower({ weight_pct: "nope" }))).toBeNull();
  });

  it("says 'Needs a look' only where the Ledger's attention filter would", () => {
    expect(plainAttentionWord(tower())).toBeNull();
    expect(plainAttentionWord(tower({ wall: "rotted" }))).toBe("Needs a look");
    expect(plainAttentionWord(tower({ thesis: "breached" }))).toBe("Needs a look");
  });

  it("names shared walls", () => {
    expect(plainSharedWall(tower())).toBeNull();
    expect(plainSharedWall(tower({ shared_wall_with: ["Beta", "Gamma"] }))).toBe("Shares a wall with Beta, Gamma");
  });
});
