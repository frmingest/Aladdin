import { describe, expect, it } from "vitest";
import { HERBS, PIECES, SHOP, STOCK_RING, STOCK_SLOTS, apothecaryPlan, stockAt, stockNode } from "./apothecaryDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbBytes, glbJson, glbTopNodes } from "./glbJson";
import { HOLDING_OWN, HOLDING_REUSE, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, DRESSING_DRAWS_NEUTRAL, centreChoice, centreSlotFor, themeOf } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(apothecaryPlan);
const pos = (p: (typeof PIECES)[number]) => ({ x: Math.cos(p.angle) * p.r, z: Math.sin(p.angle) * p.r });
const shop = { x: Math.cos(SHOP.angle) * SHOP.r, z: Math.sin(SHOP.angle) * SHOP.r };
const toShop = (x: number, z: number) => Math.hypot(Math.max(Math.abs(x - shop.x) - SHOP.halfX, 0), Math.max(Math.abs(z - shop.z) - SHOP.halfZ, 0));

describe("the apothecary wears the ladder (A7)", () => {
  it("a worse wall never has more standing pieces, fewer props or fewer cracks than a better one", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i]!.standing).toBeLessThanOrEqual(plans[i - 1]!.standing);
      expect(plans[i]!.props.length).toBeGreaterThanOrEqual(plans[i - 1]!.props.length);
      expect(plans[i]!.cracks.length).toBeGreaterThanOrEqual(plans[i - 1]!.cracks.length);
    }
  });

  it("sound has all six ring pieces and a footing; failing has fallen pieces, a crack and no footing", () => {
    expect(plans[0]!.standing).toBe(STOCK_SLOTS);
    expect(plans[0]!.footing).toBeGreaterThan(0);
    expect(plans[4]!.fallen).toBeGreaterThan(0);
    expect(plans[4]!.cracks.length).toBeGreaterThan(0);
    expect(plans[4]!.footing).toBe(0);
  });

  it("the neutral and the ghost are not Sound", () => {
    expect(JSON.stringify(apothecaryPlan(NEUTRAL))).not.toBe(JSON.stringify(plans[0]));
    expect(apothecaryPlan(NEUTRAL).footing).toBe(0);
    expect(apothecaryPlan(GHOST).standing).toBe(STOCK_SLOTS);
  });

  it("the plan reads the wall tier alone, never the sector", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", wall: "brick" as const, moat: "none" as const };
    const a = centreSlotFor({ ...base, sector: "Health Care" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(apothecaryPlan(a))).toBe(JSON.stringify(apothecaryPlan(b)));
    expect(JSON.stringify(apothecaryPlan(landCondition("rotted")))).not.toBe(JSON.stringify(apothecaryPlan(a)));
  });
});

describe("the apothecary never grows (A7)", () => {
  it("the shop floor is fixed: four jars, one table, one shelf, one candle, four herb bundles", () => {
    expect(PIECES.filter((p) => p.node.startsWith("jar_"))).toHaveLength(4);
    expect(PIECES.filter((p) => p.node === "table_decorated")).toHaveLength(1);
    expect(PIECES.filter((p) => p.node === "shelf_small_candles")).toHaveLength(1);
    expect(PIECES.filter((p) => p.node === "candle_lit")).toHaveLength(1);
    expect(HERBS).toHaveLength(4);
    expect(apothecaryPlan.length).toBe(1);
  });

  it("no herb colour reads red or green", () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d || d / mx < 0.3) return null;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const h of HERBS) {
      const v = hue(h.colour);
      if (v !== null) expect(v >= 340 || v <= 10 || (v >= 75 && v <= 165), h.colour).toBe(false);
    }
  });

  it("every piece stands inside the ring, the ring inside the stream band, and nothing overlaps", () => {
    expect(STOCK_RING + 0.4).toBeLessThan(STREAM_INNER);
    for (const p of PIECES) {
      expect(p.r + p.reach, p.node).toBeLessThan(STOCK_RING - 0.25);
      const q = pos(p);
      expect(toShop(q.x, q.z), `${p.node} vs shop`).toBeGreaterThan(p.reach * 0.6);
    }
    for (let i = 0; i < PIECES.length; i++)
      for (let j = i + 1; j < PIECES.length; j++) {
        const a = pos(PIECES[i]!);
        const b = pos(PIECES[j]!);
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${PIECES[i]!.node} vs ${PIECES[j]!.node}`).toBeGreaterThan((PIECES[i]!.reach + PIECES[j]!.reach) * 0.85);
      }
  });

  it("the shop fits inside the ring, and ring slots do not overlap with casks and boxes alternating", () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(Math.hypot(shop.x + sx * SHOP.halfX, shop.z + sz * SHOP.halfZ)).toBeLessThan(STOCK_RING - 0.1);
    const pts = plans[0]!.columns.map((c) => stockAt(c.angle));
    for (let i = 0; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(pts[i]!.x - n.x, pts[i]!.z - n.z)).toBeGreaterThan(1.6);
    }
    expect(stockNode(0).node).not.toBe(stockNode(1).node);
    expect(stockNode(2).node).toBe(stockNode(0).node);
  });
});

describe("the slot and the files (A7)", () => {
  it("health care takes the apothecary theme; it has a dressing but not a drawn neutral; the ghost stays fog", () => {
    expect(themeOf({ sector: "Health Care", holding_id: "x", structure: "keep" })).toBe("apothecary");
    expect(DRESSING_BUILT.apothecary).toBe(true);
    expect(DRESSING_DRAWS_NEUTRAL.apothecary).toBeUndefined();
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", sector: "Health Care", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "apothecary", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("neutral");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("every piece the apothecary places exists in its files, and the file fits the budget", () => {
    const nodes = glbTopNodes(glbJson(HOLDING_URL("apothecary")));
    const used = [...new Set([...PIECES.map((p) => p.node), stockNode(0).node, stockNode(1).node])];
    for (const n of used) {
      expect(nodes, n).toContain(n);
      expect(HOLDING_OWN.apothecary).toContain(n);
    }
    expect(HOLDING_REUSE.apothecary.flatMap((r) => r.nodes)).toContain("market");
    expect(glbTopNodes(glbJson("/models/town-buildings.glb"))).toContain("market");
    expect(glbBytes(HOLDING_URL("apothecary"))).toBeLessThan(600 * 1024);
  });
});
