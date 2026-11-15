import { describe, expect, it } from "vitest";
import { Texture } from "three";
import type { Object3D } from "three";
import { LampRig, MarkRig, bellGeometry, birdGeometry, lampCapGeometry, postGeometry } from "./markRig";
import { HOLDING_SPOT_COUNT } from "./outdoorPlan";
import { holdingMarks, placeMarks, stallLamps } from "./marks";
import { stateToWorld } from "./stateToWorld";
import { tallyScene } from "./perfGroups";
import { THIN_SMOKE, fxFrozen } from "./fxPlan";
import type { GameState, GameTower } from "../lib/types";

function tower(i: number): GameTower {
  return {
    holding_id: `h${String(i).padStart(2, "0")}`, ticker: "A", name: "A", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: String(90 - i), size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "review", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [],
  } as unknown as GameTower;
}
const towers = stateToWorld({ mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", towers: Array.from({ length: HOLDING_SPOT_COUNT }, (_, i) => tower(i)), notes: [], siege: null } as unknown as GameState).towers;
const ids = new Set(towers.map((t) => t.holdingId));
const marks = holdingMarks(towers, { recentRavenHoldingIds: ids, unseenWireHoldingIds: ids, watchState: "ok", stallsRead: true });
const placed = placeMarks(towers, marks);

function build() {
  return new MarkRig(placed, new Texture());
}
const lights = (root: Object3D) => {
  let n = 0;
  root.traverse((o) => {
    if ((o as unknown as { isLight?: boolean }).isLight) n++;
  });
  return n;
};

describe("a full yard: 18 holdings, three marks each", () => {
  const rig = build();
  rig.update(1, false, 0.3);
  const [row] = tallyScene(rig.group);
  it("holds all 54 marks", () => {
    expect(placed.ravens.length + placed.smoke.length + placed.bells.length).toBe(54);
  });
  it("costs at most 8 draw calls and 3000 triangles, all instanced", () => {
    expect(row.group).toBe("marks");
    expect(row.calls).toBeLessThanOrEqual(8);
    expect(row.triangles).toBeLessThanOrEqual(3000);
    expect(row.instanced).toBeGreaterThanOrEqual(3);
    expect(row.instanced).toBe(row.calls);
  });
  it("has no light", () => expect(lights(rig.group)).toBe(0));
  it("one holding costs the same calls as eighteen", () => {
    const one = new MarkRig({ ravens: placed.ravens.slice(0, 1), smoke: placed.smoke.slice(0, 1), bells: placed.bells.slice(0, 1) }, new Texture());
    expect(tallyScene(one.group)[0].calls).toBe(row.calls);
  });
  it("no marks, no meshes", () => {
    expect(tallyScene(new MarkRig({ ravens: [], smoke: [], bells: [] }, null).group)).toEqual([]);
  });
  it("lit stalls: twelve lamps cost two calls", () => {
    const stalls = Array.from({ length: 12 }, (_, i) => ({ holdingId: `s${i}`, x: 7, z: 18 - 7 * i, yaw: 1.5 }));
    const lamps = new LampRig(stallLamps(stalls, new Set(stalls.map((s) => s.holdingId))), "marks");
    expect(tallyScene(lamps.group)[0].calls).toBeLessThanOrEqual(2);
    expect(lights(lamps.group)).toBe(0);
  });
});

describe("merged geometry", () => {
  it("bell, post, bird and lamp cap merge with no failure and no console error", () => {
    const errs: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errs.push(a);
    try {
      for (const g of [bellGeometry(), postGeometry(), birdGeometry(), lampCapGeometry()]) {
        expect(g.getAttribute("position").count).toBeGreaterThan(0);
        expect(g.getAttribute("uv")).toBeTruthy();
      }
    } finally {
      console.error = orig;
    }
    expect(errs).toEqual([]);
  });
});

describe("motion", () => {
  it("reduced: positions do not change between frames, and every mark still stands", () => {
    const rig = build();
    rig.update(1, true);
    const a = rig.ravenPositions();
    rig.update(9, true);
    expect(rig.ravenPositions()).toEqual(a);
    expect(a).toHaveLength(HOLDING_SPOT_COUNT);
  });
  it("with no preference: the ravens circle", () => {
    const rig = build();
    rig.update(1, false);
    const a = rig.ravenPositions();
    rig.update(4, false);
    expect(rig.ravenPositions()).not.toEqual(a);
  });
  it("reduced: the smoke turns to the camera about the vertical axis only, and the posts never move", () => {
    const rig = build();
    rig.update(0, true, 0);
    rig.update(0, true, 1.2);
    expect(tallyScene(rig.group)[0].calls).toBeLessThanOrEqual(8);
  });
  it("the frozen smoke is the same for any clock and still a column", () => {
    const ys = Array.from({ length: THIN_SMOKE.count }, (_, k) => fxFrozen(THIN_SMOKE, k).y);
    expect(new Set(ys).size).toBe(THIN_SMOKE.count);
    expect(Math.max(...ys)).toBeGreaterThan(THIN_SMOKE.rise * 0.6);
    expect(fxFrozen(THIN_SMOKE, 2)).toEqual(fxFrozen(THIN_SMOKE, 2));
  });
});

describe("one frame loop", () => {
  it("the layer registers exactly one useFrame", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./MarkLayer.tsx", import.meta.url), "utf8");
    const inLayer = src.split("export function HangingLamps")[0];
    expect((inLayer.match(/useFrame\(/g) ?? []).length).toBe(1);
  });
});
