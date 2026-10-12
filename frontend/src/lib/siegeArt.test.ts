import { describe, expect, it } from "vitest";
import { siegeCamp } from "./fortress";
import { MAX_TOWERS, crackCount, crackPath, rampartTiles, sceneWidth, siegeStripCamp, siegeTowers } from "./siegeArt";
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

  it("are deterministic paths", () => {
    const body = { x: 10, w: 30 };
    expect(crackPath(body, 20, 80, 2, 1)).toBe(crackPath(body, 20, 80, 2, 1));
    expect(crackPath(body, 20, 80, 2, 1).startsWith("M")).toBe(true);
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
