import { describe, expect, it } from "vitest";
import { BARRIER_RING, BARRIER_SLOTS, PILES, barrierAt, ingotsPlan } from "./ingotsDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbBytes, glbJson, glbTopNodes } from "./glbJson";
import { HOLDING_OWN, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, DRESSING_DRAWS_NEUTRAL, centreChoice, centreSlotFor } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(ingotsPlan);

describe("the bullion vault wears the ladder (S27 PR 1)", () => {
  it("a worse wall never has more standing barriers, fewer props or fewer cracks than a better one", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i]!.standing).toBeLessThanOrEqual(plans[i - 1]!.standing);
      expect(plans[i]!.props.length).toBeGreaterThanOrEqual(plans[i - 1]!.props.length);
      expect(plans[i]!.cracks.length).toBeGreaterThanOrEqual(plans[i - 1]!.cracks.length);
    }
  });

  it("sound has all six barriers and a footing; failing has fallen barriers, a crack and no footing", () => {
    expect(plans[0]!.standing).toBe(BARRIER_SLOTS);
    expect(plans[0]!.footing).toBeGreaterThan(0);
    expect(plans[4]!.fallen).toBeGreaterThan(0);
    expect(plans[4]!.cracks.length).toBeGreaterThan(0);
    expect(plans[4]!.footing).toBe(0);
  });

  it("the neutral and the ghost are not Sound", () => {
    expect(JSON.stringify(ingotsPlan(NEUTRAL))).not.toBe(JSON.stringify(plans[0]));
    expect(ingotsPlan(NEUTRAL).footing).toBe(0);
    expect(ingotsPlan(GHOST).standing).toBe(BARRIER_SLOTS);
  });

  it("the plan reads the wall tier alone, never the sector", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "bullion" as const, name: "x", wall: "brick" as const, moat: "none" as const };
    const a = centreSlotFor({ ...base, sector: "Materials" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(ingotsPlan(a))).toBe(JSON.stringify(ingotsPlan(b)));
    expect(JSON.stringify(ingotsPlan(landCondition("rotted")))).not.toBe(JSON.stringify(ingotsPlan(a)));
  });
});

describe("the gold never moves (S27 PR 1)", () => {
  it("the pile list is fixed: seven pieces, one chest, and nothing about it takes a condition", () => {
    expect(PILES).toHaveLength(7);
    expect(PILES.filter((p) => p.node === "chest_gold")).toHaveLength(1);
    expect(ingotsPlan.length).toBe(1); // takes only the condition, no value, weight or size
  });

  it("every pile stands inside the barrier ring, and the ring inside the stream band", () => {
    for (const p of PILES) expect(p.r + 0.45 * p.scale * 2).toBeLessThan(BARRIER_RING);
    expect(BARRIER_RING + 0.4).toBeLessThan(STREAM_INNER);
  });

  it("barriers face along the ring and the six slots do not overlap", () => {
    const pts = plans[0]!.columns.map((c) => barrierAt(c.angle));
    for (let i = 0; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(pts[i]!.x - n.x, pts[i]!.z - n.z)).toBeGreaterThan(1.9);
    }
  });
});

describe("the slot and the files (S27 PR 1)", () => {
  it("ingots has a dressing and draws its neutral (bullion has no balance sheet), but the ghost stays fog", () => {
    expect(DRESSING_BUILT.ingots).toBe(true);
    expect(DRESSING_DRAWS_NEUTRAL.ingots).toBe(true);
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "bullion" as const, name: "x", sector: "Materials", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "ingots", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("dressing");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("every piece the vault places exists in holding-ingots.glb, and the file fits the budget", () => {
    const nodes = glbTopNodes(glbJson(HOLDING_URL("ingots")));
    for (const n of [...new Set(PILES.map((p) => p.node)), "barrier_column"]) {
      expect(nodes, n).toContain(n);
      expect(HOLDING_OWN.ingots).toContain(n);
    }
    expect(glbBytes(HOLDING_URL("ingots"))).toBeLessThan(600 * 1024);
  });
});
