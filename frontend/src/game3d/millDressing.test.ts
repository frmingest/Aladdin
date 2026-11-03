import { describe, expect, it } from "vitest";
import { glbJson, glbTopNodes } from "./glbJson";
import { GHOST, NEUTRAL, RUNGS, DAMAGE_FIELDS, landCondition } from "./landCondition";
import type { LandCondition } from "./landCondition";
import { MILL_FILE_URL, MILL_MAX_PIECES, MILL_NODES, millPlan } from "./millDressing";
import type { MillTheme } from "./millDressing";
import { DRESSING_BUILT, centreChoice } from "./landCentre";

const THEMES: MillTheme[] = ["windmill", "watermill"];
const scenery = (theme: MillTheme, c: LandCondition) =>
  millPlan(theme, c).pieces.filter((p) => ["sack", "barrel", "crate_A_big", "wheelbarrow", "bucket_water", "water_tile", theme].includes(p.node));

describe("the mill dressings (S26 PR 2)", () => {
  it("flips the switch for the windmill and the watermill only", () => {
    expect(DRESSING_BUILT.windmill).toBe(true);
    expect(DRESSING_BUILT.watermill).toBe(true);
    expect(centreChoice({ theme: "windmill", condition: RUNGS[0]! })).toBe("dressing");
    expect(centreChoice({ theme: "watermill", condition: GHOST })).toBe("ghost");
    expect(centreChoice({ theme: "windmill", condition: NEUTRAL })).toBe("neutral");
  });

  for (const theme of THEMES) {
    it(`${theme}: every piece the plan can place exists in its file`, () => {
      for (const { file, node } of MILL_NODES[theme]) {
        const nodes = glbTopNodes(glbJson(MILL_FILE_URL[file].replace(/^\/?/, "/")));
        expect(nodes, `${file}:${node}`).toContain(node);
      }
      const known = new Set(MILL_NODES[theme].map((n) => n.node));
      for (const r of RUNGS) for (const p of millPlan(theme, r).pieces) expect(known.has(p.node), p.node).toBe(true);
    });

    it(`${theme}: a worse wall never has fewer broken things than a better one`, () => {
      const plans = RUNGS.map((r) => millPlan(theme, r));
      for (let i = 1; i < plans.length; i++) {
        const a = plans[i - 1]!;
        const b = plans[i]!;
        const count = (pl: typeof a, node: string) => pl.pieces.filter((p) => p.node === node).length;
        expect(count(b, "fence_wood")).toBeLessThanOrEqual(count(a, "fence_wood")); // more gaps
        expect(count(b, "planks_small")).toBeGreaterThanOrEqual(count(a, "planks_small")); // props and loose boards
        expect(b.buildingLean).toBeGreaterThanOrEqual(a.buildingLean);
        expect(b.code.patches).toBeGreaterThanOrEqual(a.code.patches);
        expect(Number(b.code.crack)).toBeGreaterThanOrEqual(Number(a.code.crack));
        expect(b.code.footing).toBeLessThanOrEqual(a.code.footing);
      }
      expect(plans[0]!.buildingLean).toBe(0);
      expect(plans[4]!.code.crack).toBe(true);
      expect(plans[0]!.code.crack).toBe(false);
    });

    it(`${theme}: each rung looks different, and Sound is not Neutral`, () => {
      const looks = RUNGS.map((r) => JSON.stringify(millPlan(theme, r)));
      expect(new Set(looks).size).toBe(5);
      expect(JSON.stringify(millPlan(theme, NEUTRAL))).not.toBe(looks[0]); // no footing, so it never reads as Sound
      expect(millPlan(theme, NEUTRAL).code.footing).toBe(0);
    });

    it(`${theme}: scenery is identical on every rung (nothing grows or shrinks with a value)`, () => {
      const base = JSON.stringify(scenery(theme, RUNGS[0]!));
      for (const r of [...RUNGS, NEUTRAL]) expect(JSON.stringify(scenery(theme, r))).toBe(base);
    });

    it(`${theme}: the plan depends on the wall tier alone`, () => {
      for (const wall of ["basalt", "granite", "brick", "timber", "rotted", "not_applicable"] as const) {
        expect(JSON.stringify(millPlan(theme, landCondition(wall)))).toBe(JSON.stringify(millPlan(theme, landCondition(wall))));
      }
      // The only input is the condition: two equal conditions give an equal plan, whatever else a holding has.
      expect(millPlan(theme, { ...RUNGS[2]! })).toEqual(millPlan(theme, RUNGS[2]!));
    });

    it(`${theme}: stays inside the piece budget and never grows past the worst rung`, () => {
      for (const r of [...RUNGS, NEUTRAL]) expect(millPlan(theme, r).pieces.length).toBeLessThanOrEqual(MILL_MAX_PIECES);
      const sum = (c: LandCondition) => DAMAGE_FIELDS.reduce((s, f) => s + c[f], 0);
      expect(sum(RUNGS[4]!)).toBeGreaterThan(sum(RUNGS[0]!));
    });

    it(`${theme}: pieces stay clear of the stream band`, () => {
      for (const r of RUNGS) for (const p of millPlan(theme, r).pieces) expect(Math.hypot(p.x, p.z), p.node).toBeLessThan(2.5);
    });
  }

  it("the windmill stands still: no plan field moves, and the watermill's water tile is scenery only", () => {
    const w = millPlan("watermill", RUNGS[0]!).pieces.filter((p) => p.node === "water_tile");
    expect(w).toHaveLength(1);
    expect(millPlan("watermill", RUNGS[4]!).pieces.filter((p) => p.node === "water_tile")).toHaveLength(1);
    expect(millPlan("windmill", RUNGS[0]!).pieces.some((p) => p.node === "water_tile")).toBe(false);
  });
});
