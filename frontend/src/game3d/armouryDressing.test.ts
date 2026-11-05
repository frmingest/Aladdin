import { describe, expect, it } from "vitest";
import { FENCE_SLOTS, HUT, PIECES, RACK, RACK_WEAPONS, TARGET, YARD_RING, armouryPlan, fenceAt, fenceNode, spotOf } from "./armouryDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbBytes, glbJson, glbTopNodes } from "./glbJson";
import { HOLDING_OWN, HOLDING_REUSE, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, DRESSING_DRAWS_NEUTRAL, centreChoice, centreSlotFor, themeOf } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(armouryPlan);
const hut = spotOf(HUT.angle, HUT.r);

/** Distance from a point to the hut's footprint (0 when inside it). */
const toHut = (x: number, z: number) => Math.hypot(Math.max(Math.abs(x - hut.x) - HUT.halfX, 0), Math.max(Math.abs(z - hut.z) - HUT.halfZ, 0));

describe("the armoury wears the ladder (A7)", () => {
  it("a worse wall never has more standing fences, fewer props or fewer cracks than a better one", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i]!.standing).toBeLessThanOrEqual(plans[i - 1]!.standing);
      expect(plans[i]!.props.length).toBeGreaterThanOrEqual(plans[i - 1]!.props.length);
      expect(plans[i]!.cracks.length).toBeGreaterThanOrEqual(plans[i - 1]!.cracks.length);
    }
  });

  it("sound has all six fence sections and a footing; failing has fallen sections, a crack and no footing", () => {
    expect(plans[0]!.standing).toBe(FENCE_SLOTS);
    expect(plans[0]!.footing).toBeGreaterThan(0);
    expect(plans[4]!.fallen).toBeGreaterThan(0);
    expect(plans[4]!.cracks.length).toBeGreaterThan(0);
    expect(plans[4]!.footing).toBe(0);
  });

  it("the neutral and the ghost are not Sound", () => {
    expect(JSON.stringify(armouryPlan(NEUTRAL))).not.toBe(JSON.stringify(plans[0]));
    expect(armouryPlan(NEUTRAL).footing).toBe(0);
    expect(armouryPlan(GHOST).standing).toBe(FENCE_SLOTS);
  });

  it("the plan reads the wall tier alone, never the sector", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", wall: "brick" as const, moat: "none" as const };
    const a = centreSlotFor({ ...base, sector: "Aerospace & Defense" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(armouryPlan(a))).toBe(JSON.stringify(armouryPlan(b)));
    expect(JSON.stringify(armouryPlan(landCondition("rotted")))).not.toBe(JSON.stringify(armouryPlan(a)));
  });
});

describe("the armoury never grows (A7)", () => {
  it("the yard is fixed: one gate, four weapons in the rack, one shield, and the plan takes only the condition", () => {
    expect(RACK_WEAPONS).toHaveLength(4);
    expect(new Set(RACK_WEAPONS.map((w) => w.node)).size).toBe(4);
    expect(PIECES).toHaveLength(1);
    expect(PIECES[0]!.node).toBe("shield_A");
    expect(Array.from({ length: FENCE_SLOTS }, (_, s) => fenceNode(s).node).filter((n) => n === "fence_wood_gate")).toHaveLength(1);
    expect(fenceNode(0).node).toBe("fence_wood_gate");
    expect(armouryPlan.length).toBe(1);
  });

  it("the fence ring sits inside the stream band and its sections do not overlap", () => {
    expect(YARD_RING + 0.4).toBeLessThan(STREAM_INNER);
    const pts = plans[0]!.columns.map((c) => fenceAt(c.angle));
    for (let i = 0; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(pts[i]!.x - n.x, pts[i]!.z - n.z)).toBeGreaterThan(1.6);
    }
  });

  it("the rack, the target and the shield stand inside the fence, clear of the barracks and of each other", () => {
    const ground = [
      { id: "rack", ...spotOf(RACK.angle, RACK.r), r: RACK.r, reach: RACK.reach },
      { id: "target", ...spotOf(TARGET.angle, TARGET.r), r: TARGET.r, reach: TARGET.reach },
      ...PIECES.map((p) => ({ id: p.node, ...spotOf(p.angle, p.r), r: p.r, reach: p.reach })),
    ];
    for (const g of ground) {
      expect(g.r + g.reach, g.id).toBeLessThan(YARD_RING - 0.25);
      expect(toHut(g.x, g.z), `${g.id} vs barracks`).toBeGreaterThan(g.reach * 0.6);
    }
    for (let i = 0; i < ground.length; i++)
      for (let j = i + 1; j < ground.length; j++)
        expect(Math.hypot(ground[i]!.x - ground[j]!.x, ground[i]!.z - ground[j]!.z), `${ground[i]!.id} vs ${ground[j]!.id}`).toBeGreaterThan((ground[i]!.reach + ground[j]!.reach) * 0.85);
  });

  it("the barracks itself fits inside the fence", () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(Math.hypot(hut.x + sx * HUT.halfX, hut.z + sz * HUT.halfZ)).toBeLessThan(YARD_RING - 0.1);
  });

  it("the weapons stand along the rack", () => {
    for (const w of RACK_WEAPONS) expect(Math.abs(w.x)).toBeLessThan(RACK.halfLength);
  });
});

describe("the slot and the files (A7)", () => {
  it("defence and aerospace take the armoury theme; it has a dressing but not a drawn neutral; the ghost stays fog", () => {
    expect(themeOf({ sector: "Aerospace & Defense", holding_id: "x", structure: "keep" })).toBe("armoury");
    expect(DRESSING_BUILT.armoury).toBe(true);
    expect(DRESSING_DRAWS_NEUTRAL.armoury).toBeUndefined();
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", sector: "Aerospace & Defense", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "armoury", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("neutral");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("every piece the armoury places exists in its files, and the file fits the budget", () => {
    const nodes = glbTopNodes(glbJson(HOLDING_URL("armoury")));
    const used = [...new Set([...PIECES.map((p) => p.node), ...RACK_WEAPONS.map((w) => w.node), fenceNode(0).node, fenceNode(1).node])];
    for (const n of used) {
      expect(nodes, n).toContain(n);
      expect(HOLDING_OWN.armoury).toContain(n);
    }
    expect(HOLDING_REUSE.armoury.flatMap((r) => r.nodes)).toContain("barracks");
    expect(glbTopNodes(glbJson("/models/town-buildings.glb"))).toContain("barracks");
    expect(glbBytes(HOLDING_URL("armoury"))).toBeLessThan(600 * 1024);
  });
});
