import { describe, expect, it } from "vitest";
import { DESK_HALF_DEPTH, DESK_HALF_WIDTH, DESK_R, DESK_THINGS, PILES, WALL_RING, WALL_SLOTS, bankPlan, deskAt, wallAt, wallNode } from "./bankDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbBytes, glbJson, glbTopNodes } from "./glbJson";
import { HOLDING_OWN, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, DRESSING_DRAWS_NEUTRAL, centreChoice, centreSlotFor } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(bankPlan);

describe("the bank vault wears the ladder (A2)", () => {
  it("a worse wall never has more standing walls, fewer props or fewer cracks than a better one", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i]!.standing).toBeLessThanOrEqual(plans[i - 1]!.standing);
      expect(plans[i]!.props.length).toBeGreaterThanOrEqual(plans[i - 1]!.props.length);
      expect(plans[i]!.cracks.length).toBeGreaterThanOrEqual(plans[i - 1]!.cracks.length);
    }
  });

  it("sound has all six walls and a footing; failing has fallen walls, a crack and no footing", () => {
    expect(plans[0]!.standing).toBe(WALL_SLOTS);
    expect(plans[0]!.footing).toBeGreaterThan(0);
    expect(plans[4]!.fallen).toBeGreaterThan(0);
    expect(plans[4]!.cracks.length).toBeGreaterThan(0);
    expect(plans[4]!.footing).toBe(0);
  });

  it("the neutral and the ghost are not Sound", () => {
    expect(JSON.stringify(bankPlan(NEUTRAL))).not.toBe(JSON.stringify(plans[0]));
    expect(bankPlan(NEUTRAL).footing).toBe(0);
    expect(bankPlan(GHOST).standing).toBe(WALL_SLOTS);
  });

  it("the plan reads the wall tier alone, never the sector", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", wall: "brick" as const, moat: "none" as const };
    const a = centreSlotFor({ ...base, sector: "Financials" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(bankPlan(a))).toBe(JSON.stringify(bankPlan(b)));
    expect(JSON.stringify(bankPlan(landCondition("rotted")))).not.toBe(JSON.stringify(bankPlan(a)));
  });
});

describe("the treasure never moves (A2)", () => {
  it("the pile and desk lists are fixed: six piles, one chest, four desk things, and the plan takes only the condition", () => {
    expect(PILES).toHaveLength(6);
    expect(PILES.filter((p) => p.node === "chest_gold")).toHaveLength(1);
    expect(DESK_THINGS.map((t) => t.node)).toEqual(["journal_open", "pencil", "key", "candle_triple"]);
    expect(bankPlan.length).toBe(1);
  });

  it("every pile stands inside the ring, the ring inside the stream band, and nothing overlaps the desk", () => {
    for (const p of PILES) expect(p.r + p.reach).toBeLessThan(WALL_RING - 0.25);
    expect(WALL_RING + 0.4).toBeLessThan(STREAM_INNER);
    const d = deskAt();
    expect(DESK_R + DESK_HALF_DEPTH).toBeLessThan(WALL_RING - 0.25);
    for (const p of PILES) {
      const x = Math.cos(p.angle) * p.r;
      const z = Math.sin(p.angle) * p.r;
      expect(Math.hypot(x - d.x, z - d.z) - p.reach, p.node).toBeGreaterThan(Math.min(DESK_HALF_WIDTH, DESK_HALF_DEPTH) - 0.1);
    }
    // the chest at the middle is clear of the desk's near edge
    expect(DESK_R - DESK_HALF_DEPTH).toBeGreaterThan(PILES[0]!.reach);
  });

  it("walls face along the ring, the six slots do not overlap, and windowed and plain alternate", () => {
    const pts = plans[0]!.columns.map((c) => wallAt(c.angle));
    for (let i = 0; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(pts[i]!.x - n.x, pts[i]!.z - n.z)).toBeGreaterThan(1.6);
    }
    expect(new Set([0, 1, 2, 3].map(wallNode)).size).toBe(2);
    expect(wallNode(0)).not.toBe(wallNode(1));
  });
});

describe("the slot and the files (A2)", () => {
  it("bank has a dressing and draws its neutral, but the ghost stays fog", () => {
    expect(DRESSING_BUILT.bank).toBe(true);
    expect(DRESSING_DRAWS_NEUTRAL.bank).toBe(true);
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", sector: "Financials", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "bank", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("dressing");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("every piece the vault places exists in holding-bank.glb, and the file fits the budget", () => {
    const nodes = glbTopNodes(glbJson(HOLDING_URL("bank")));
    const used = [...new Set([...PILES.map((p) => p.node), ...DESK_THINGS.map((t) => t.node), "gate_wall", "gate_wall_window", "column", "shelf_large"])];
    for (const n of used) {
      expect(nodes, n).toContain(n);
      expect(HOLDING_OWN.bank).toContain(n);
    }
    expect(glbBytes(HOLDING_URL("bank"))).toBeLessThan(600 * 1024);
  });
});
