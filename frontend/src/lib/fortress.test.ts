import { describe, expect, it } from "vitest";
import {
  MAX_DRAWN_SHACKS,
  SCENE_WIDTH,
  describeTower,
  drawnShacks,
  layoutTowers,
  sortTowers,
  towerDimensions,
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
