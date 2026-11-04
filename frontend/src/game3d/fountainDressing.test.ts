import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { COLUMN_RING, COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import { DAMAGE_FIELDS, GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";
import { glbJson, glbTopNodes, glbBytes } from "./glbJson";
import { HOLDING_OWN, HOLDING_REUSE, HOLDING_URL } from "./holdingPieces";
import { DRESSING_BUILT, centreChoice, centreSlotFor } from "./landCentre";
import { PAL } from "./Inked";
import type { TowerView } from "./stateToWorld";

const plans = RUNGS.map(fountainPlan);
const lostSlots = (i: number) => plans[i]!.columns.filter((c) => c.state !== "standing").map((c) => c.slot);

describe("the fountain square wears the ladder (S26 PR 4)", () => {
  it("a worse wall never has more standing columns, less rubble or fewer props than a better one", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i]!.standing).toBeLessThanOrEqual(plans[i - 1]!.standing);
      expect(plans[i]!.props.length).toBeGreaterThanOrEqual(plans[i - 1]!.props.length);
      expect(plans[i]!.cracks.length).toBeGreaterThanOrEqual(plans[i - 1]!.cracks.length);
      expect(plans[i]!.looseBoards).toBeGreaterThanOrEqual(plans[i - 1]!.looseBoards);
      // a column lost on a better rung is still lost on a worse one: the same slots go first
      for (const s of lostSlots(i - 1)) expect(lostSlots(i)).toContain(s);
    }
  });

  it("sound is upright and whole with a footing; failing has fallen columns, a crack and broken props", () => {
    const sound = plans[0]!, failing = plans[4]!;
    expect(sound.standing).toBe(COLUMN_SLOTS);
    expect(sound.columns.every((c) => c.lean === 0)).toBe(true);
    expect(sound.footing).toBeGreaterThan(0);
    expect(sound.cracks).toHaveLength(0);
    expect(failing.fallen).toBeGreaterThan(0);
    expect(failing.cracks.length).toBeGreaterThan(0);
    expect(failing.props.some((p) => p.broken)).toBe(true);
    expect(failing.footing).toBe(0);
    expect(failing.standing).toBeLessThan(sound.standing);
  });

  it("the five rungs all look different, and the neutral is not Sound", () => {
    const keys = [...plans, fountainPlan(NEUTRAL)].map((p) => JSON.stringify({ ...p, pale: undefined }));
    expect(new Set(keys).size).toBe(keys.length);
    const n = fountainPlan(NEUTRAL);
    expect(n.footing).toBe(0);
    expect(n.standing).toBe(COLUMN_SLOTS);
    expect(n.cracks).toHaveLength(0);
    expect(n.props).toHaveLength(0);
    expect(JSON.stringify(n)).not.toEqual(JSON.stringify(plans[0]));
  });

  it("the plan depends on the condition numbers alone (so the wall tier alone), never the sector, size or verdict", () => {
    const tower = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", wall: "granite" as const, moat: "wide" as const };
    const a = centreSlotFor({ ...base, sector: "Funds" }, tower).condition;
    const b = centreSlotFor({ ...base, sector: "Energy" }, tower).condition;
    expect(JSON.stringify(fountainPlan(a))).toBe(JSON.stringify(fountainPlan(b)));
    const worse = centreSlotFor({ ...base, sector: "Funds", wall: "rotted" }, tower).condition;
    expect(JSON.stringify(fountainPlan(worse))).not.toBe(JSON.stringify(fountainPlan(a)));
    for (const f of DAMAGE_FIELDS) expect(typeof landCondition("brick")[f]).toBe("number");
  });

  it("nothing grows: the piece counts are capped by the slots and the ladder, not by any value", () => {
    for (const p of plans) {
      expect(p.columns).toHaveLength(COLUMN_SLOTS);
      expect(p.standing + p.fallen).toBeLessThanOrEqual(COLUMN_SLOTS);
      expect(p.props.length).toBeLessThanOrEqual(3);
    }
    expect(fountainPlan(GHOST).standing).toBe(COLUMN_SLOTS);
  });

  it("the columns stand inside the stream band", () => {
    expect(COLUMN_RING + 0.4).toBeLessThan(STREAM_INNER);
  });

  it("the slot hands the fountain its neutral and its five rungs, and keeps the ghost for itself", () => {
    expect(DRESSING_BUILT.fountain).toBe(true);
    const t = {} as TowerView;
    const base = { holding_id: "x", structure: "keep" as const, name: "x", sector: "Diversified Fund", moat: "none" as const };
    const c = (wall: "basalt" | "rotted" | "unsurveyed" | "not_applicable") => centreChoice({ theme: "fountain", condition: centreSlotFor({ ...base, wall }, t).condition });
    expect(c("basalt")).toBe("dressing");
    expect(c("rotted")).toBe("dressing");
    expect(c("not_applicable")).toBe("dressing");
    expect(c("unsurveyed")).toBe("ghost");
  });

  it("the pieces exist: column and well and fountain_round_detail are in their files, and the file fits the budget", () => {
    expect(glbTopNodes(glbJson(HOLDING_URL("fountain")))).toContain("column");
    expect(HOLDING_OWN.fountain).toContain("column");
    expect(HOLDING_REUSE.fountain.find((r) => r.file === "town-nature.glb")!.nodes).toContain("fountain_round_detail");
    expect(glbTopNodes(glbJson("/models/town-nature.glb"))).toContain("fountain_round_detail");
    expect(glbTopNodes(glbJson("/models/market.glb"))).toContain("well");
    expect(existsSync(join(__dirname, "../../public/models/holding-fountain.glb"))).toBe(true);
    expect(glbBytes(HOLDING_URL("fountain"))).toBeLessThan(600 * 1024);
  });

  it("the code-built bits are stone, timber and ink: no red, no green", () => {
    for (const hex of [PAL.slate, PAL.timber, PAL.timberDark, PAL.timberLight]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(g > r + 25 && g > b + 25, `${hex} reads green`).toBe(false);
      expect(r > g + 60 && r > b + 60, `${hex} reads red`).toBe(false);
    }
  });
});
