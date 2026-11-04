import { describe, expect, it } from "vitest";
import { COUNTER_THINGS, PENNANTS, PIECES, STALL_HALF, STOCK_RING, STOCK_SLOTS, stallPlan, stockAt, stockNode } from "./stallDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbBytes, glbJson, glbTopNodes } from "./glbJson";
import { HOLDING_OWN, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, DRESSING_DRAWS_NEUTRAL, centreChoice, centreSlotFor } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(stallPlan);
const pos = (p: (typeof PIECES)[number]) => ({ x: Math.cos(p.angle) * p.r, z: Math.sin(p.angle) * p.r });

describe("the market stall wears the ladder (A3)", () => {
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
    expect(JSON.stringify(stallPlan(NEUTRAL))).not.toBe(JSON.stringify(plans[0]));
    expect(stallPlan(NEUTRAL).footing).toBe(0);
    expect(stallPlan(GHOST).standing).toBe(STOCK_SLOTS);
  });

  it("the plan reads the wall tier alone, never the sector", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", wall: "brick" as const, moat: "none" as const };
    const a = centreSlotFor({ ...base, sector: "Consumer Discretionary" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(stallPlan(a))).toBe(JSON.stringify(stallPlan(b)));
    expect(JSON.stringify(stallPlan(landCondition("rotted")))).not.toBe(JSON.stringify(stallPlan(a)));
  });
});

describe("the goods never grow (A3)", () => {
  it("the lists are fixed: two pennants, four counter goods, six ground pieces, no gold or silver, and the plan takes only the condition", () => {
    expect(PENNANTS).toHaveLength(2);
    expect(COUNTER_THINGS.map((t) => t.node)).toEqual(["textiles_B", "textiles_A", "scales_lantern", "coin_stack_small"]);
    expect(PIECES).toHaveLength(6);
    for (const n of [...PIECES.map((p) => p.node), ...COUNTER_THINGS.map((t) => t.node)]) expect(n).not.toMatch(/gold|silver/);
    expect(stallPlan.length).toBe(1);
  });

  it("every ground piece stands inside the ring, the ring inside the stream band, clear of the counter and of each other", () => {
    expect(STOCK_RING + 0.4).toBeLessThan(STREAM_INNER);
    for (const p of PIECES) {
      expect(p.r + p.reach, p.node).toBeLessThan(STOCK_RING - 0.25);
      const c = pos(p);
      const clearX = Math.abs(c.x) - STALL_HALF.x - p.reach * 0.6;
      const clearZ = Math.abs(c.z) - STALL_HALF.z - p.reach * 0.6;
      expect(Math.max(clearX, clearZ), `${p.node} clear of counter`).toBeGreaterThan(0);
    }
    // a crate standing on the pallet shares its spot on purpose
    const ground = PIECES.filter((q) => q.y === undefined);
    for (let i = 0; i < ground.length; i++)
      for (let j = i + 1; j < ground.length; j++) {
        const a = pos(ground[i]!);
        const b = pos(ground[j]!);
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${ground[i]!.node} vs ${ground[j]!.node}`).toBeGreaterThan((ground[i]!.reach + ground[j]!.reach) * 0.85);
      }
  });

  it("ring slots do not overlap and cloth stacks and crates alternate", () => {
    const pts = plans[0]!.columns.map((c) => stockAt(c.angle));
    for (let i = 0; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(pts[i]!.x - n.x, pts[i]!.z - n.z)).toBeGreaterThan(1.6);
    }
    expect(stockNode(0).node).not.toBe(stockNode(1).node);
  });
});

describe("the slot and the files (A3)", () => {
  it("stall has a dressing but not a drawn neutral; the ghost stays fog", () => {
    expect(DRESSING_BUILT.stall).toBe(true);
    expect(DRESSING_DRAWS_NEUTRAL.stall).toBeUndefined();
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", sector: "Consumer Discretionary", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "stall", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("neutral");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("every piece the stall places exists in holding-stall.glb, and the file fits the budget", () => {
    const nodes = glbTopNodes(glbJson(HOLDING_URL("stall")));
    const used = [...new Set([...PIECES.map((p) => p.node), ...COUNTER_THINGS.map((t) => t.node), ...PENNANTS.map((p) => p.node), stockNode(0).node, stockNode(1).node])];
    for (const n of used) {
      expect(nodes, n).toContain(n);
      expect(HOLDING_OWN.stall).toContain(n);
    }
    expect(glbBytes(HOLDING_URL("stall"))).toBeLessThan(600 * 1024);
  });
});
