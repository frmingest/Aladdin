import { describe, expect, it } from "vitest";
import { MARKET } from "./marketPieces";
import { REGISTER, doorsAt } from "./parity3d";
import {
  BUILDINGS,
  DOOR_LEAVE_RANGE,
  DOOR_RANGE,
  GATE_LEAVE_RANGE,
  GATE_RANGE,
  GATE_RETURN,
  GATE_SPOT,
  buildingPrompt,
  buildingReach,
  doorAction,
  doorSpot,
  nearestBuilding,
  stepOutOf,
} from "./townPlan";
import { TOWN_PIECES } from "./townPieces";
import { WALL_RADIUS, WALL_THICKNESS } from "./layout";

const BUY_SELL = /\b(buy|sell|trade|invest)\b/i;

describe("the Town beside the gate road", () => {
  it("uses only models that the town-buildings file holds", () => {
    for (const b of BUILDINGS) expect(TOWN_PIECES.buildings as readonly string[]).toContain(b.model);
  });

  it("has six buildings with distinct ids, all on the meadow outside the wall", () => {
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(6);
    for (const b of BUILDINGS) expect(Math.hypot(b.x, b.z) - buildingReach(b), b.id).toBeGreaterThan(WALL_RADIUS + WALL_THICKNESS + 3);
  });

  it("keeps the buildings clear of each other and of the gate road, with the door mats on open ground", () => {
    for (let i = 0; i < BUILDINGS.length; i++)
      for (let j = i + 1; j < BUILDINGS.length; j++) {
        const a = BUILDINGS[i];
        const b = BUILDINGS[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} / ${b.id}`).toBeGreaterThan(buildingReach(a) + buildingReach(b));
      }
    for (const b of BUILDINGS) {
      const wide = Math.abs(Math.sin(b.yaw)) * b.hz + Math.abs(Math.cos(b.yaw)) * b.hx;
      expect(Math.abs(b.x) - wide, `${b.id} off the road`).toBeGreaterThanOrEqual(5);
    }
  });

  it("faces every building at the road", () => {
    for (const b of BUILDINGS) expect(Math.sign(Math.sin(b.yaw)), b.id).toBe(-Math.sign(b.x));
  });

  it("puts every door spot on open ground, in reach of exactly one door", () => {
    for (const b of BUILDINGS) {
      const s = doorSpot(b);
      expect(nearestBuilding(s), b.id).toBe(b.id);
      for (const o of BUILDINGS) {
        if (o.id === b.id) continue;
        expect(Math.hypot(s.x - o.x, s.z - o.z), `${b.id} door in ${o.id}`).toBeGreaterThan(buildingReach(o));
        expect(Math.hypot(s.x - doorSpot(o).x, s.z - doorSpot(o).z), `${b.id} / ${o.id} doors`).toBeGreaterThan(DOOR_LEAVE_RANGE);
      }
    }
  });

  it("steps out of a door past its reach, on the road side, looking at the door", () => {
    for (const b of BUILDINGS) {
      const out = stepOutOf(b);
      const s = doorSpot(b);
      expect(Math.hypot(out.x - s.x, out.z - s.z), b.id).toBeGreaterThan(DOOR_LEAVE_RANGE);
      expect(nearestBuilding(out, BUILDINGS, DOOR_LEAVE_RANGE), b.id).toBeNull();
      expect(Math.abs(out.x), b.id).toBeLessThan(Math.abs(s.x));
      expect(Math.sin(out.yaw) * (s.x - out.x), b.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("opens a real register row, or a place that has doors", () => {
    for (const b of BUILDINGS) {
      const a = doorAction(b);
      expect(a, b.id).not.toBeNull();
      if (a?.kind === "page") expect(a.door.route).toBe((b.opens as { route: string }).route);
      if (a?.kind === "place") expect(doorsAt(a.place).length).toBeGreaterThan(1);
    }
  });

  it("covers every register row placed in the Town, the Workshop or the Town Hall", () => {
    const routes = new Set<string>();
    for (const b of BUILDINGS) {
      const a = doorAction(b);
      if (a?.kind === "page" && a.door.route) routes.add(a.door.route);
      if (a?.kind === "place") for (const d of doorsAt(a.place)) if (d.route) routes.add(d.route);
    }
    for (const d of REGISTER.filter((r) => (r.place === "town" || r.place === "workshop" || r.place === "townhall") && r.route && !r.via))
      expect(routes.has(d.route as string), `${d.route} has a building`).toBe(true);
  });

  it("returns the hero to the courtyard spawn out of reach of the gate road, with the market pieces clear of it", () => {
    expect(Math.hypot(GATE_SPOT.x - GATE_RETURN.x, GATE_SPOT.z - GATE_RETURN.z)).toBeGreaterThan(GATE_LEAVE_RANGE);
    expect(Math.hypot(GATE_SPOT.x, GATE_SPOT.z)).toBeLessThan(WALL_RADIUS);
    for (const m of MARKET) expect(Math.hypot(m.x - GATE_SPOT.x, m.z - GATE_SPOT.z), m.id).toBeGreaterThan(GATE_RANGE + 2);
  });

  it("speaks plainly: no buy or sell words", () => {
    for (const s of BUILDINGS.map(buildingPrompt)) expect(s).not.toMatch(BUY_SELL);
    expect(DOOR_RANGE).toBeGreaterThan(0);
  });
});
