import { describe, expect, it } from "vitest";
import { SURVEY_CHECKS } from "../lib/survey";
import type { TowerView } from "./stateToWorld";
import type { TowerFog } from "../lib/survey";
import { SHELF_ORDER } from "./libraryShelves";
import { nearestShelf, readingSpot } from "./libraryRoom";
import {
  BANNER_SHAPE,
  BAY_SCALE,
  GAUGE_FILL,
  LAND_TOWER,
  LAND_TOWER_REACH,
  centreTowerFor,
  GATE_LEAVE_RANGE,
  GATE_RANGE,
  GATE_STONE,
  LAND_SHELF_SLOTS,
  LAND_TABLE,
  LAND_TABLE_SPOT,
  SHELF_RANGE,
  TABLE_RANGE,
  nearLandTable,
  LAND_SPOT_NAMES,
  LAND_GATE,
  LAND_RADIUS,
  LAND_SPAWN,
  LAND_SPOTS,
  LANTERN_LOOKS,
  LANTERN_LEAVE_RANGE,
  LANTERN_RANGE,
  LANTERN_SPOTS,
  MIN_LAND_RADIUS,
  PRICE_POST,
  RECORDS_HOUSE,
  WORKPLACE,
  gateStoneFor,
  insideLand,
  landRadius,
  lanternSummary,
  lanternsFor,
  moatLook,
  nearestLantern,
  pricePostFor,
  workplaceCondition,
} from "./holdingLand";

const fog = (states: Array<"clear" | "fog" | "not_judged">): TowerFog => ({
  holdingId: "h1",
  name: "X",
  ticker: "X",
  weightPct: 10,
  checks: SURVEY_CHECKS.map((c, i) => ({ id: c.id, label: c.label, state: states[i], reason: `r${i}` })),
  clear: states.filter((s) => s === "clear").length,
  judged: states.filter((s) => s !== "not_judged").length,
});

describe("land size", () => {
  it("has four fixed sizes, in order, and unknown never flatters", () => {
    expect(LAND_RADIUS.great).toBeGreaterThan(LAND_RADIUS.medium);
    expect(LAND_RADIUS.medium).toBeGreaterThan(LAND_RADIUS.small);
    expect(LAND_RADIUS.small).toBeGreaterThan(LAND_RADIUS.tiny);
    expect(landRadius("unknown")).toBeLessThanOrEqual(LAND_RADIUS.small);
  });
});

describe("the five spots", () => {
  it("all sit on the smallest land, so no size can push one off the ground", () => {
    const spots = [LAND_SPAWN, GATE_STONE, LAND_GATE, WORKPLACE, PRICE_POST, RECORDS_HOUSE, ...LANTERN_SPOTS];
    for (const s of spots) expect(insideLand(s, MIN_LAND_RADIUS)).toBe(true);
    expect(Object.keys(LAND_SPOTS)).toEqual([...LAND_SPOT_NAMES]);
  });

  it("keeps the lanterns in survey order and apart from each other", () => {
    expect(LANTERN_SPOTS.map((l) => l.check)).toEqual(SURVEY_CHECKS.map((c) => c.id));
    for (let i = 0; i < LANTERN_SPOTS.length; i++)
      for (let j = i + 1; j < LANTERN_SPOTS.length; j++)
        expect(Math.hypot(LANTERN_SPOTS[i].x - LANTERN_SPOTS[j].x, LANTERN_SPOTS[i].z - LANTERN_SPOTS[j].z)).toBeGreaterThan(2.5);
  });

  it("does not let the workplace overlap the records house", () => {
    const gap = Math.hypot(WORKPLACE.x - RECORDS_HOUSE.x, WORKPLACE.z - RECORDS_HOUSE.z);
    expect(gap).toBeGreaterThan(WORKPLACE.r + RECORDS_HOUSE.hx);
  });
});

describe("survey lanterns (fog of war)", () => {
  it("maps clear, fog and not judged to lit, mist and bare", () => {
    const l = lanternsFor(fog(["clear", "fog", "not_judged", "clear"]));
    expect(l.map((x) => x.look)).toEqual(["lit", "mist", "bare", "lit"]);
    expect(l[1].reason).toBe("r1");
    expect(lanternSummary(l)).toBe("2 of 3 lanterns lit");
  });

  it("shows four hooded lanterns when nothing was surveyed, never lit ones", () => {
    const l = lanternsFor(null);
    expect(l.every((x) => x.look === "mist")).toBe(true);
  });

  it("says not surveyed when nothing is judged", () => {
    expect(lanternSummary(lanternsFor(fog(["not_judged", "not_judged", "not_judged", "not_judged"])))).toBe("Not surveyed yet");
  });
});

describe("lantern looks and reach", () => {
  it("gives each look its own shape and its own mark, so colour is never the only signal", () => {
    const looks = Object.values(LANTERN_LOOKS);
    expect(new Set(looks.map((l) => l.shape)).size).toBe(3);
    expect(new Set(looks.map((l) => l.mark)).size).toBe(3);
  });

  it("never draws a not-judged or fogged check as lit", () => {
    const l = lanternsFor(fog(["fog", "not_judged", "fog", "not_judged"]));
    expect(l.some((x) => x.look === "lit")).toBe(false);
  });

  it("finds the lantern you stand at, and none from far off", () => {
    const [a, b] = LANTERN_SPOTS;
    expect(nearestLantern({ x: a.x, z: a.z + 0.5 }, LANTERN_SPOTS, null)).toBe(a.check);
    expect(nearestLantern({ x: b.x, z: b.z }, LANTERN_SPOTS, null)).toBe(b.check);
    expect(nearestLantern({ x: 0, z: 20 }, LANTERN_SPOTS, null)).toBeNull();
  });

  it("keeps a lantern in reach a little further out, so the edge does not flicker", () => {
    const a = LANTERN_SPOTS[0];
    const p = { x: a.x, z: a.z + (LANTERN_RANGE + LANTERN_LEAVE_RANGE) / 2 };
    expect(nearestLantern(p, LANTERN_SPOTS, null)).toBeNull();
    expect(nearestLantern(p, LANTERN_SPOTS, a.check)).toBe(a.check);
  });

  it("never offers a lantern at the spot you arrive, or at the gate", () => {
    expect(nearestLantern(LAND_SPAWN, LANTERN_SPOTS, null)).toBeNull();
    expect(nearestLantern(LAND_GATE, LANTERN_SPOTS, null)).toBeNull();
  });
});

describe("workplace and moat", () => {
  it("follows the wall tier only, and an unknown wall is never healthy", () => {
    expect(workplaceCondition("basalt", false)).toBe("sound");
    expect(workplaceCondition("brick", false)).toBe("worn");
    expect(workplaceCondition("rotted", false)).toBe("cracked");
    expect(workplaceCondition("unsurveyed", false)).toBe("unknown");
    expect(workplaceCondition("basalt", true)).toBe("unknown");
    expect(workplaceCondition(null, false)).toBe("unknown");
  });

  it("draws mist for a moat that was not surveyed", () => {
    expect(moatLook("wide")).toBe("wide");
    expect(moatLook("none")).toBe("none");
    expect(moatLook("unsurveyed")).toBe("mist");
    expect(moatLook("not_applicable")).toBe("mist");
    expect(moatLook(null)).toBe("mist");
  });
});

describe("gate stone", () => {
  it("prints name, weight and value, and keeps unknowns unknown", () => {
    const g = gateStoneFor({ name: "Equinor", weight_pct: "12.44", value_nok: "84200" }, true);
    expect(g).toEqual({ title: "Equinor", weight: "12.4% of the realm", value: "NOK 84 200", note: null });
    const u = gateStoneFor({ name: "Equinor", weight_pct: null, value_nok: null }, false);
    expect(u.weight).toBe("Weight not known");
    expect(u.value).toBe("Value not known");
    expect(u.note).toBe("Not surveyed yet");
  });
});

describe("price post", () => {
  it("maps thesis and siege exposure, with fog for anything unread", () => {
    const p = pricePostFor({ land: "discount", land_reason: "why", thesis: "review", siege_exposure: "breach_risk" });
    expect(p).toEqual({ gauge: "discount", scroll: "cracked", banner: "breach_risk", gaugeReason: "why" });
    const f = pricePostFor({ land: "fog", land_reason: "none", thesis: "not_analyzed", siege_exposure: "unsurveyed" });
    expect(f.scroll).toBe("fog");
    expect(f.banner).toBe("fog");
  });
});

describe("the records house", () => {
  const { x, z, hx, hz } = RECORDS_HOUSE;
  const inside = (p: { x: number; z: number }, pad = 0) => p.x >= x - hx + pad && p.x <= x + hx - pad && p.z >= z - hz + pad && p.z <= z + hz - pad;

  it("holds all seven shelves, in the library's order, each exactly once", () => {
    expect(LAND_SHELF_SLOTS.map((s) => s.id)).toEqual([...SHELF_ORDER]);
    expect(new Set(LAND_SHELF_SLOTS.map((s) => s.id)).size).toBe(7);
  });

  it("keeps every bay inside the house walls, and every reading spot inside the house too", () => {
    for (const s of LAND_SHELF_SLOTS) {
      expect(inside(s)).toBe(true);
      expect(inside(readingSpot(s))).toBe(true);
    }
  });

  it("keeps the bays from overlapping each other (bays are 3.6 wide at full size)", () => {
    const w = 3.6 * BAY_SCALE;
    for (let i = 0; i < LAND_SHELF_SLOTS.length; i++)
      for (let j = i + 1; j < LAND_SHELF_SLOTS.length; j++) {
        const a = LAND_SHELF_SLOTS[i];
        const b = LAND_SHELF_SLOTS[j];
        // Each bay is a w x 0.8*scale box turned by its yaw; compare the boxes' axis-aligned extents (yaw is a multiple of a quarter turn).
        const ext = (s: (typeof a)) => {
          const turned = Math.abs(Math.sin(s.yaw)) > 0.5;
          const hxs = (turned ? 0.8 * BAY_SCALE : w) / 2;
          const hzs = (turned ? w : 0.8 * BAY_SCALE) / 2;
          return { minX: s.x - hxs, maxX: s.x + hxs, minZ: s.z - hzs, maxZ: s.z + hzs };
        };
        const A = ext(a);
        const B = ext(b);
        const apart = A.maxX <= B.minX || B.maxX <= A.minX || A.maxZ <= B.minZ || B.maxZ <= A.minZ;
        expect(apart).toBe(true);
      }
  });

  it("fits inside the smallest land with the walls, so no size can push the house onto the hedge", () => {
    for (const corner of [
      { x: x - hx - 0.3, z: z - hz - 0.3 },
      { x: x - hx - 0.3, z: z + hz + 0.3 },
    ])
      expect(insideLand(corner, MIN_LAND_RADIUS - 0.5)).toBe(true);
  });

  it("puts the table in the open middle, away from the shelves and from the walls", () => {
    expect(inside(LAND_TABLE, LAND_TABLE.hx)).toBe(true);
    expect(LAND_TABLE_SPOT.z).toBeGreaterThan(LAND_TABLE.z + LAND_TABLE.hz);
    for (const s of LAND_SHELF_SLOTS) {
      const d = Math.hypot(readingSpot(s).x - LAND_TABLE_SPOT.x, readingSpot(s).z - LAND_TABLE_SPOT.z);
      expect(d).toBeGreaterThan(SHELF_RANGE);
      expect(d).toBeGreaterThan(TABLE_RANGE);
    }
  });

  it("finds exactly the shelf you stand at, and the table only at its own spot", () => {
    for (const s of LAND_SHELF_SLOTS) expect(nearestShelf(readingSpot(s), LAND_SHELF_SLOTS, SHELF_RANGE)?.id).toBe(s.id);
    expect(nearestShelf(LAND_TABLE_SPOT, LAND_SHELF_SLOTS, SHELF_RANGE)).toBeNull();
    expect(nearLandTable(LAND_TABLE_SPOT)).toBe(true);
    expect(nearLandTable({ x: 0, z: 0 })).toBe(false);
  });
});

describe("arriving and leaving", () => {
  it("never puts you at the gate, the stone or a shelf on arrival", () => {
    expect(Math.hypot(LAND_SPAWN.x - LAND_GATE.x, LAND_SPAWN.z - LAND_GATE.z)).toBeGreaterThan(GATE_RANGE);
    expect(Math.hypot(LAND_SPAWN.x - GATE_STONE.x, LAND_SPAWN.z - GATE_STONE.z)).toBeGreaterThan(1.5);
    expect(nearestShelf(LAND_SPAWN, LAND_SHELF_SLOTS, SHELF_RANGE)).toBeNull();
    expect(nearLandTable(LAND_SPAWN)).toBe(false);
  });

  it("is wider to leave the gate than to arrive at it, so the edge does not flicker", () => {
    expect(GATE_LEAVE_RANGE).toBeGreaterThan(GATE_RANGE);
  });

  it("keeps the gate stone, the gate and the price post on every land, whatever its size", () => {
    for (const r of Object.values(LAND_RADIUS)) for (const p of [GATE_STONE, LAND_GATE, PRICE_POST, LAND_SPAWN]) expect(insideLand(p, r)).toBe(true);
  });
});

describe("the centre tower and the price post (S25 PR 3)", () => {
  const view = (over: Partial<TowerView> = {}): TowerView => ({
    slot: 0,
    spot: { x: 40, z: -30 },
    holdingId: "h1",
    name: "Test",
    ticker: "TST",
    shape: "tower",
    height: 15,
    radius: 2.1,
    wallColor: "#4a4f57",
    strength: "strong",
    crenels: 8,
    cracks: 0,
    moatWidth: 2.2,
    moatFog: false,
    fog: false,
    freshness: "fresh",
    flag: "intact",
    facts: { size: "great", wall: "basalt", moat: "wide", thesis: "intact", weightPct: "10", wallReason: "" },
    ...over,
  } as TowerView);

  it("stands on the fixed centre with a fixed footprint, whatever the size class", () => {
    for (const r of [2.1, 1.8, 1.5, 1.2, 1.3]) {
      const c = centreTowerFor(view({ radius: r }));
      expect(c.spot).toEqual({ x: WORKPLACE.x, z: WORKPLACE.z });
      expect(c.radius).toBe(LAND_TOWER.radius);
    }
    expect(centreTowerFor(view({ height: 15 })).height).toBe(LAND_TOWER.maxHeight);
    expect(centreTowerFor(view({ height: 5.5 })).height).toBe(5.5);
  });

  it("keeps the tower and its moat clear of the lanterns, the records house and the gate", () => {
    expect(LAND_TOWER_REACH).toBeLessThan(WORKPLACE.r + 1.5);
    for (const l of LANTERN_SPOTS) expect(Math.hypot(l.x - WORKPLACE.x, l.z - WORKPLACE.z)).toBeGreaterThan(LAND_TOWER_REACH + 0.5);
    expect(WORKPLACE.x - LAND_TOWER_REACH).toBeGreaterThan(RECORDS_HOUSE.x + RECORDS_HOUSE.hx);
  });

  it("keeps each moat tier its own width and mist, and drops the red and green flag", () => {
    expect(centreTowerFor(view({ moatWidth: 2.2 })).moatWidth).toBe(LAND_TOWER.moatWide);
    expect(centreTowerFor(view({ moatWidth: 1 })).moatWidth).toBe(LAND_TOWER.moatNarrow);
    expect(centreTowerFor(view({ moatWidth: 0 })).moatWidth).toBe(0);
    expect(centreTowerFor(view({ moatFog: true, moatWidth: 0 })).moatFog).toBe(true);
    expect(centreTowerFor(view()).flag).toBe("none");
  });

  it("changes nothing about wall, crown, cracks, fog or ivy: a weak tower is not prettier", () => {
    const weak = view({ wallColor: "#5f6a4f", crenels: 2, cracks: 4, freshness: "overgrown" });
    const c = centreTowerFor(weak);
    expect(c.wallColor).toBe(weak.wallColor);
    expect(c.crenels).toBe(2);
    expect(c.cracks).toBe(4);
    expect(c.freshness).toBe("overgrown");
    expect(centreTowerFor(view({ fog: true })).fog).toBe(true);
  });

  it("draws the price post from stored facts only, and unknown as mist", () => {
    const p = pricePostFor({ land: "fog", land_reason: "no result", thesis: "not_analyzed", siege_exposure: "unsurveyed" });
    expect(GAUGE_FILL[p.gauge]).toBeNull();
    expect(p.scroll).toBe("fog");
    expect(BANNER_SHAPE[p.banner]).toBe("mist");
  });

  it("gives a better margin of safety a higher marker and every known banner its own shape", () => {
    const f = (["overpriced", "full_price", "discount", "bargain"] as const).map((k) => GAUGE_FILL[k] as number);
    expect([...f].sort((a, b) => a - b)).toEqual(f);
    expect(new Set(f).size).toBe(4);
    expect(new Set(["sheltered", "exposed", "breach_risk"].map((b) => BANNER_SHAPE[b as keyof typeof BANNER_SHAPE])).size).toBe(3);
  });
});
