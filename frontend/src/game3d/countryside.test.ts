import { describe, expect, it } from "vitest";
import { WALL_RADIUS } from "./layout";
import { cornerTowerFootprint } from "./keepModels";
import { HORIZON, HORIZON_MAX_MODELS, HORIZON_MAX_PIECES } from "./horizonPieces";
import * as C from "./countryside";
import {
  FIELDS, RING_RADIUS, RIVER_HALF, THIN_MARGIN,
  countrysideMesh, distToPolyline, fieldReach, inTheWay, polylineGap, riverLine, ringLine, thinnedHorizon, tracks,
} from "./countryside";

/** The gate road is 6 wide. */
const ROAD_HALF = 3;

describe("the river", () => {
  const river = riverLine();
  it("keeps clear of the wall and the corner towers", () => {
    const nearest = Math.min(...river.map((p) => Math.hypot(p.x, p.z)));
    expect(nearest - RIVER_HALF).toBeGreaterThan(WALL_RADIUS + cornerTowerFootprint().radius + 10);
  });
  it("flows on the ground (inside the 160 meadow disc)", () => {
    for (const p of river) expect(Math.hypot(p.x, p.z)).toBeLessThan(150);
  });
  it("never crosses a track", () => {
    for (const t of tracks()) expect(polylineGap(t.points, river), t.id).toBeGreaterThan(RIVER_HALF + t.width / 2);
  });
});

describe("the tracks", () => {
  const all = tracks();
  it("a closed lane round the wall that meets the gate road", () => {
    const ring = ringLine();
    expect(ring[0].x).toBeCloseTo(ring[ring.length - 1].x, 6);
    expect(ring[0].z).toBeCloseTo(ring[ring.length - 1].z, 6);
    for (const p of ring) expect(Math.hypot(p.x, p.z)).toBeCloseTo(RING_RADIUS, 6);
    expect(Math.abs(ring[0].x)).toBeLessThan(ROAD_HALF);
  });
  it("clears the corner towers", () => {
    const edge = RING_RADIUS - all[0].width / 2;
    expect(edge).toBeGreaterThan(WALL_RADIUS + cornerTowerFootprint().radius);
  });
  it("stays outside the wall", () => {
    for (const t of all) for (const p of t.points) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(WALL_RADIUS + 3);
  });
});

describe("the fields", () => {
  it("stay on the meadow, off every track and the river", () => {
    for (const f of FIELDS) {
      expect(Math.hypot(f.x, f.z) + fieldReach(f), f.id).toBeLessThanOrEqual(104 - 2);
      for (const t of tracks()) expect(distToPolyline(f, t.points) - t.width / 2 - fieldReach(f), `${f.id} vs ${t.id}`).toBeGreaterThan(0);
      expect(distToPolyline(f, riverLine()) - RIVER_HALF - fieldReach(f), f.id).toBeGreaterThan(0);
    }
  });
  it("do not overlap each other", () => {
    for (let i = 0; i < FIELDS.length; i++)
      for (let j = i + 1; j < FIELDS.length; j++)
        expect(Math.hypot(FIELDS[i].x - FIELDS[j].x, FIELDS[i].z - FIELDS[j].z)).toBeGreaterThan(fieldReach(FIELDS[i]) + fieldReach(FIELDS[j]) - 2);
  });
});

describe("the landscape carries no fact", () => {
  it("is built from fixed numbers: the same every time, and no builder takes an input", () => {
    expect(countrysideMesh()).toEqual(countrysideMesh());
    expect(tracks()).toEqual(tracks());
    for (const fn of [C.riverLine, C.tracks, C.countrysideMesh, C.thinnedHorizon]) expect(fn.length).toBe(0);
  });
  it("uses earth and water colours only: nothing red and nothing green", () => {
    for (const rgb of Object.values(C.COUNTRYSIDE_COLORS)) {
      const [r, g, b] = rgb;
      expect(r > g + 0.15 && r > b + 0.3, "reads red").toBe(false);
      expect(g > r + 0.05 && g > b + 0.05, "reads green").toBe(false);
    }
  });
});

describe("thinning the grove", () => {
  const kept = thinnedHorizon();
  it("only drops pieces; it never moves one, and the hills and mountains are untouched", () => {
    expect(kept.every((p) => HORIZON.includes(p))).toBe(true);
    for (const ring of ["hill", "mountain"] as const) expect(kept.filter((p) => p.ring === ring)).toHaveLength(HORIZON.filter((p) => p.ring === ring).length);
  });
  it("drops exactly the pieces in the way, and leaves most of the grove", () => {
    const dropped = HORIZON.filter((p) => !kept.includes(p));
    expect(dropped.length).toBeGreaterThan(0);
    for (const p of dropped) expect(inTheWay(p), p.id).toBe(true);
    for (const p of kept) expect(inTheWay(p), p.id).toBe(false);
    const woods = HORIZON.filter((p) => p.ring === "grove" || p.ring === "rock");
    expect(woods.length - dropped.length).toBeGreaterThanOrEqual(woods.length * 0.35);
  });
  it("keeps the horizon inside its piece and draw-call ceilings", () => {
    expect(kept.length).toBeLessThanOrEqual(HORIZON_MAX_PIECES);
    expect(new Set(kept.map((p) => p.model)).size).toBeLessThanOrEqual(HORIZON_MAX_MODELS);
  });
  it("no kept tree stands in the river or on a track", () => {
    for (const p of kept.filter((q) => q.ring === "grove" || q.ring === "rock")) {
      expect(distToPolyline(p, riverLine()), p.id).toBeGreaterThan(RIVER_HALF + THIN_MARGIN);
    }
  });
});

describe("the budget", () => {
  it("the whole countryside is one mesh of a small, fixed size", () => {
    const m = countrysideMesh();
    expect(m.positions.length / 3).toBe(m.colors.length / 3);
    expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
    expect(m.indices.length % 3).toBe(0);
    expect(m.indices.length / 3).toBeLessThan(2000);
  });
});
