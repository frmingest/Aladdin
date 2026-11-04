import { describe, expect, it } from "vitest";
import { FORGE_REACH, PIECES, STOCK_RING, STOCK_SLOTS, factoryPlan, stockAt, stockNode } from "./factoryDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbBytes, glbJson, glbTopNodes } from "./glbJson";
import { HOLDING_OWN, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, DRESSING_DRAWS_NEUTRAL, centreChoice, centreSlotFor } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(factoryPlan);
const pos = (p: (typeof PIECES)[number]) => ({ x: Math.cos(p.angle) * p.r, z: Math.sin(p.angle) * p.r });

describe("the workshop wears the ladder (A3)", () => {
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
    expect(JSON.stringify(factoryPlan(NEUTRAL))).not.toBe(JSON.stringify(plans[0]));
    expect(factoryPlan(NEUTRAL).footing).toBe(0);
    expect(factoryPlan(GHOST).standing).toBe(STOCK_SLOTS);
  });

  it("the plan reads the wall tier alone, never the sector", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", wall: "brick" as const, moat: "none" as const };
    const a = centreSlotFor({ ...base, sector: "Industrials" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(factoryPlan(a))).toBe(JSON.stringify(factoryPlan(b)));
    expect(JSON.stringify(factoryPlan(landCondition("rotted")))).not.toBe(JSON.stringify(factoryPlan(a)));
  });
});

describe("the workshop never grows (A3)", () => {
  it("the piece list is fixed: one forge, one anvil, no duplicates, and the plan takes only the condition", () => {
    expect(PIECES).toHaveLength(8);
    expect(PIECES.filter((p) => p.node === "blacksmith")).toHaveLength(1);
    expect(PIECES.filter((p) => p.node === "anvil")).toHaveLength(1);
    expect(factoryPlan.length).toBe(1);
  });

  it("every piece stands inside the ring, the ring inside the stream band, and nothing overlaps", () => {
    expect(STOCK_RING + 0.4).toBeLessThan(STREAM_INNER);
    for (const p of PIECES.filter((q) => q.r > 0)) {
      expect(p.r + p.reach, p.node).toBeLessThan(STOCK_RING - 0.25);
      expect(p.r - p.reach, p.node).toBeGreaterThan(FORGE_REACH * 0.75);
    }
    const ground = PIECES.filter((q) => q.r > 0);
    for (let i = 0; i < ground.length; i++)
      for (let j = i + 1; j < ground.length; j++) {
        const a = pos(ground[i]!);
        const b = pos(ground[j]!);
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${ground[i]!.node} vs ${ground[j]!.node}`).toBeGreaterThan((ground[i]!.reach + ground[j]!.reach) * 0.85);
      }
  });

  it("ring slots do not overlap and barrels and iron-bar stacks alternate", () => {
    const pts = plans[0]!.columns.map((c) => stockAt(c.angle));
    for (let i = 0; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(pts[i]!.x - n.x, pts[i]!.z - n.z)).toBeGreaterThan(1.6);
    }
    expect(stockNode(0).node).not.toBe(stockNode(1).node);
    expect(stockNode(2).node).toBe(stockNode(0).node);
  });
});

describe("the slot and the files (A3)", () => {
  it("factory has a dressing but not a drawn neutral; the ghost stays fog", () => {
    expect(DRESSING_BUILT.factory).toBe(true);
    expect(DRESSING_DRAWS_NEUTRAL.factory).toBeUndefined();
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", sector: "Industrials", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "factory", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("neutral");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("every piece the workshop places exists in holding-factory.glb, and the file fits the budget", () => {
    const nodes = glbTopNodes(glbJson(HOLDING_URL("factory")));
    const used = [...new Set([...PIECES.map((p) => p.node), stockNode(0).node, stockNode(1).node])];
    for (const n of used) {
      expect(nodes, n).toContain(n);
      expect(HOLDING_OWN.factory).toContain(n);
    }
    expect(glbBytes(HOLDING_URL("factory"))).toBeLessThan(600 * 1024);
  });
});
