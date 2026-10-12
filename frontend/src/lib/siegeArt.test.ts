import { describe, expect, it } from "vitest";
import { siegeCamp } from "./fortress";
import { MAX_TOWERS, crackCount, crackShape, rubbleCount, rubbleStones, breachHole, arrowHits, rand, rampartTiles, sceneWidth, siegeStripCamp, siegeTowers } from "./siegeArt";
import type { SiegeSimHolding } from "./types";

function holding(over: Partial<SiegeSimHolding> = {}): SiegeSimHolding {
  return {
    holding_id: "h1",
    ticker: "AAA.OL",
    name: "Alpha",
    structure: "keep",
    size_class: "medium",
    wall: "granite",
    value_nok: "100000",
    weight_pct: "10",
    beta: "1",
    beta_as_of: null,
    modelled: true,
    shock_pct: "-0.30",
    loss_nok: "-30000",
    exposure: "exposed",
    stored_shock_pct: null,
    reason: null,
    method: "price_history",
    observations: 40,
    r_squared: "0.5",
    caution: null,
    ...over,
  } as SiegeSimHolding;
}

describe("siege strip towers", () => {
  it("gives a surveyed keep its wall-material picture and an unsurveyed one none", () => {
    const [a, b] = siegeTowers([holding(), holding({ holding_id: "h2", wall: "unsurveyed" })]);
    expect(a.placement?.id).toBe("spire-granite");
    expect(b.placement).toBeNull();
  });

  it("shows damage that rises with the loss and never for a gain or a tower that is not modelled", () => {
    const rows = [
      holding({ holding_id: "a", shock_pct: "-0.10" }),
      holding({ holding_id: "b", shock_pct: "-0.50" }),
      holding({ holding_id: "c", shock_pct: "0.05" }),
      holding({ holding_id: "d", modelled: false, shock_pct: null }),
    ];
    const [a, b, c, d] = siegeTowers(rows);
    expect(b.scorchPx).toBeGreaterThan(a.scorchPx);
    expect(a.scorchPx).toBeGreaterThan(0);
    expect(c.scorchPx).toBe(0);
    expect(d.scorchPx).toBe(0);
    expect(d.cracks).toBe(0);
  });

  it("keeps the scorched band inside the wall", () => {
    const [t] = siegeTowers([holding({ shock_pct: "-0.95" })]);
    const wall = t.placement!.ground - t.placement!.body.top;
    expect(t.scorchPx).toBeLessThanOrEqual(wall);
  });

  it("draws at most the worst 18 and spaces them inside the scene", () => {
    const rows = Array.from({ length: 25 }, (_, i) => holding({ holding_id: `h${i}` }));
    const towers = siegeTowers(rows);
    expect(towers).toHaveLength(MAX_TOWERS);
    expect(towers[0].cx).toBeGreaterThan(0);
    expect(towers[MAX_TOWERS - 1].cx).toBeLessThan(sceneWidth(25));
  });

  it("is stable between calls (no flicker)", () => {
    expect(siegeTowers([holding()])).toEqual(siegeTowers([holding()]));
  });
});

describe("cracks", () => {
  it("grow in steps with the loss", () => {
    expect(crackCount(0)).toBe(0);
    expect(crackCount(9)).toBe(0);
    expect(crackCount(10)).toBe(1);
    expect(crackCount(30)).toBe(2);
    expect(crackCount(50)).toBe(3);
    expect(crackCount(100)).toBe(3);
  });

  it("are deterministic paths that stay inside the wall", () => {
    const body = { x: 10, w: 30 };
    const a = crackShape(body, 20, 80, 2, 1);
    expect(a).toEqual(crackShape(body, 20, 80, 2, 1));
    expect(a.main.startsWith("M")).toBe(true);
    const xs = [...a.main.matchAll(/[ML]([\d.]+) /g)].map((m) => Number(m[1]));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(40);
    }
  });
});

describe("besieging camp", () => {
  const counts = (level: Parameters<typeof siegeStripCamp>[0]) => {
    const c = siegeStripCamp(level);
    return {
      tents: c.filter((s) => s.id === "siege-tent").length,
      soldiers: c.filter((s) => s.id === "siege-soldier").length,
      engines: c.filter((s) => s.id.startsWith("siege-") && !["siege-tent", "siege-soldier", "siege-arrow"].includes(s.id)).length,
    };
  };

  it("is the Fortress's own camp for the same siege level", () => {
    for (const level of ["calm", "gathering", "besieged", "unsurveyed"] as const) {
      const want = siegeCamp(level);
      expect(counts(level)).toEqual({ tents: want.tents, soldiers: want.soldiers, engines: want.engines });
    }
  });

  it("draws no enemy when calm or unsurveyed", () => {
    expect(siegeStripCamp("calm")).toEqual([]);
    expect(siegeStripCamp("unsurveyed")).toEqual([]);
  });
});

describe("rampart", () => {
  it("covers the scene width", () => {
    const tiles = rampartTiles(960);
    const last = tiles[tiles.length - 1];
    expect(last.left + last.width).toBeGreaterThanOrEqual(960);
  });
});

describe("rubble, breach and arrows", () => {
  it("rubble grows with the loss and is none below 10%", () => {
    expect(rubbleCount(5)).toBe(0);
    expect(rubbleCount(10)).toBeLessThan(rubbleCount(50));
    expect(rubbleCount(100)).toBe(12);
    expect(rubbleStones({ x: 0, w: 30 }, 100, 40, 1, 1)).toHaveLength(rubbleCount(40));
    expect(rubbleStones({ x: 0, w: 30 }, 100, 5, 1, 1)).toEqual([]);
  });

  it("a breach is drawn only where the backend says wall at risk of breach", () => {
    const rows = [
      holding({ holding_id: "a", exposure: "breach_risk", shock_pct: "-0.5" }),
      holding({ holding_id: "b", exposure: "exposed", shock_pct: "-0.5" }),
      holding({ holding_id: "c", exposure: "breach_risk", modelled: false, shock_pct: null }),
    ];
    const [a, b, c] = siegeTowers(rows);
    expect([a.breach, b.breach, c.breach]).toEqual([true, false, false]);
  });

  it("breach hole and arrow hits are deterministic and in the wall", () => {
    const body = { x: 10, w: 30 };
    const hole = breachHole(body, 20, 80, 3);
    expect(hole).toEqual(breachHole(body, 20, 80, 3));
    expect(hole.cx).toBeGreaterThan(10);
    expect(hole.cx).toBeLessThan(40);
    expect(arrowHits(body, 20, 80, 10, 1)).toHaveLength(0);
    expect(arrowHits(body, 20, 80, 30, 1)).toHaveLength(1);
    expect(arrowHits(body, 20, 80, 60, 1)).toHaveLength(2);
    for (const h of arrowHits(body, 20, 80, 60, 1)) {
      expect(h.x).toBeGreaterThan(10);
      expect(h.x).toBeLessThan(40);
      expect(h.y).toBeGreaterThanOrEqual(20);
      expect(h.y).toBeLessThanOrEqual(80);
    }
  });

  it("rand stays in [0, 1) and is stable", () => {
    for (let i = 0; i < 50; i += 1) {
      const v = rand(i, i * 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(rand(i, i * 3));
    }
  });
});
