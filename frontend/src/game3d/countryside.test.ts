import { describe, expect, it } from "vitest";
import { WALL_RADIUS } from "./layout";
import { cornerTowerFootprint } from "./keepModels";
import { HORIZON, HORIZON_MAX_MODELS, HORIZON_MAX_PIECES } from "./horizonPieces";
import { FOOTPRINT, OUTDOOR_SPOTS, OUTDOOR_ZONES, PLOT_FOOTPRINT_MAX, ROAD_HALF } from "./outdoorPlan";
import * as C from "./countryside";
import {
  DOOR_REACH, FIELDS, RING_RADIUS, RIVER_HALF, WATER_NEAR_MAX, WATER_NEAR_MIN, THIN_MARGIN,
  countrysideMesh, distToPolyline, doorPoint, fieldReach, inTheWay, polylineGap, riverLine, ringLine, thinnedHorizon, tracks,
} from "./countryside";

const spots = OUTDOOR_ZONES.flatMap((zone) => OUTDOOR_SPOTS[zone].map((spot, index) => ({ zone, index, spot })));
const WATER_ZONES = ["river", "rise"];

describe("the river", () => {
  const river = riverLine();
  it("keeps clear of the wall and the corner towers", () => {
    const nearest = Math.min(...river.map((p) => Math.hypot(p.x, p.z)));
    expect(nearest - RIVER_HALF).toBeGreaterThan(WALL_RADIUS + cornerTowerFootprint().radius + 10);
  });
  it("flows on the ground (inside the 160 meadow disc)", () => {
    for (const p of river) expect(Math.hypot(p.x, p.z)).toBeLessThan(150);
  });
  it("runs beside the river and rise plots, never under them", () => {
    for (const s of spots.filter((x) => WATER_ZONES.includes(x.zone))) {
      const d = distToPolyline(s.spot, river);
      expect(d, `${s.zone}[${s.index}]`).toBeGreaterThanOrEqual(WATER_NEAR_MIN);
      expect(d, `${s.zone}[${s.index}]`).toBeLessThanOrEqual(WATER_NEAR_MAX);
    }
  });
  it("leaves every other plot dry, with room for its building", () => {
    for (const s of spots.filter((x) => !WATER_ZONES.includes(x.zone))) {
      expect(distToPolyline(s.spot, river), `${s.zone}[${s.index}]`).toBeGreaterThanOrEqual(RIVER_HALF + PLOT_FOOTPRINT_MAX);
    }
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
  it("every one of the plots has a track to its door, starting on the ring or the road", () => {
    for (const s of spots) {
      const t = all.find((x) => x.to?.zone === s.zone && x.to.index === s.index);
      expect(t, `${s.zone}[${s.index}]`).toBeDefined();
      const door = doorPoint(s.zone, s.index);
      const end = t!.points[t!.points.length - 1];
      expect(end).toEqual(door);
      expect(Math.hypot(door.x - s.spot.x, door.z - s.spot.z)).toBeCloseTo(DOOR_REACH, 6);
      const start = t!.points[0];
      const onRing = Math.abs(Math.hypot(start.x, start.z) - RING_RADIUS) < 1e-6;
      expect(onRing || start.x === 0, `${s.zone}[${s.index}] start`).toBe(true);
    }
  });
  it("no track runs through a plot that is not its own", () => {
    for (const t of all) {
      for (const s of spots) {
        if (t.to?.zone === s.zone && t.to.index === s.index) continue;
        // The lane passes the road-edge plots, which hold the plain-tower footprint at most (the farm fence lives in the fields).
        const room = s.zone === "road" ? FOOTPRINT.plain : PLOT_FOOTPRINT_MAX;
        expect(distToPolyline(s.spot, t.points) - t.width / 2, `${t.id} vs ${s.zone}[${s.index}]`).toBeGreaterThanOrEqual(room);
      }
    }
  });
  it("a branch stays outside the wall", () => {
    for (const t of all) for (const p of t.points) if (t.kind !== "stub") expect(Math.hypot(p.x, p.z)).toBeGreaterThan(WALL_RADIUS + 3);
  });
});

describe("the fields", () => {
  it("stay on the meadow, off every plot, track and the river", () => {
    for (const f of FIELDS) {
      expect(Math.hypot(f.x, f.z) + fieldReach(f), f.id).toBeLessThanOrEqual(104 - 2);
      for (const s of spots) expect(Math.hypot(s.spot.x - f.x, s.spot.z - f.z) - fieldReach(f), `${f.id} vs ${s.zone}[${s.index}]`).toBeGreaterThanOrEqual(PLOT_FOOTPRINT_MAX);
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
    expect(woods.length - dropped.length).toBeGreaterThanOrEqual(woods.length * 0.4);
  });
  it("keeps the horizon inside its piece and draw-call ceilings", () => {
    expect(kept.length).toBeLessThanOrEqual(HORIZON_MAX_PIECES);
    expect(new Set(kept.map((p) => p.model)).size).toBeLessThanOrEqual(HORIZON_MAX_MODELS);
  });
  it("no kept tree stands in the river, on a track or on a plot", () => {
    for (const p of kept.filter((q) => q.ring === "grove" || q.ring === "rock")) {
      expect(distToPolyline(p, riverLine()), p.id).toBeGreaterThan(RIVER_HALF + THIN_MARGIN);
      for (const s of spots) expect(Math.hypot(p.x - s.spot.x, p.z - s.spot.z), p.id).toBeGreaterThan(PLOT_FOOTPRINT_MAX + THIN_MARGIN);
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
