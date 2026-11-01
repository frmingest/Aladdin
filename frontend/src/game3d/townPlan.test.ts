import { describe, expect, it } from "vitest";
import { MARKET } from "./marketPieces";
import { REGISTER, doorsAt } from "./parity3d";
import {
  BUILDINGS,
  DOOR_RANGE,
  GATE_RANGE,
  GATE_RETURN,
  GATE_SPOT,
  TOWN_EXIT,
  TOWN_RADIUS,
  TOWN_SPAWN,
  WELL,
  buildingPrompt,
  doorAction,
  doorSpot,
  exitPrompt,
  gatePrompt,
  nearGate,
  nearTownExit,
  nearestBuilding,
} from "./townPlan";
import { TOWN_PIECES } from "./townPieces";
import { WALL_RADIUS } from "./layout";

const BUY_SELL = /\b(buy|sell|trade|invest)\b/i;

describe("the Town beyond the gate", () => {
  it("uses only models that the town-buildings file holds", () => {
    for (const b of BUILDINGS) expect(TOWN_PIECES.buildings as readonly string[]).toContain(b.model);
  });

  it("has four buildings with distinct ids, all inside the ground", () => {
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(4);
    for (const b of BUILDINGS) expect(Math.hypot(b.x, b.z) + Math.hypot(b.hx, b.hz)).toBeLessThan(TOWN_RADIUS);
  });

  it("keeps buildings, the well and the arrival clear of each other", () => {
    const things = [
      ...BUILDINGS.map((b) => ({ id: b.id, x: b.x, z: b.z, r: Math.hypot(b.hx, b.hz) })),
      { id: "well", x: WELL.x, z: WELL.z, r: WELL.r },
    ];
    for (let i = 0; i < things.length; i++)
      for (let j = i + 1; j < things.length; j++)
        expect(Math.hypot(things[i].x - things[j].x, things[i].z - things[j].z), `${things[i].id} / ${things[j].id}`).toBeGreaterThan(things[i].r + things[j].r - 1);
    for (const t of things) expect(Math.hypot(t.x - TOWN_SPAWN.x, t.z - TOWN_SPAWN.z), `spawn / ${t.id}`).toBeGreaterThan(t.r + 2);
  });

  it("puts every door spot on open ground, in reach of exactly one door", () => {
    for (const b of BUILDINGS) {
      const s = doorSpot(b);
      expect(nearestBuilding(s), b.id).toBe(b.id);
      for (const o of BUILDINGS) {
        if (o.id === b.id) continue;
        expect(Math.hypot(s.x - o.x, s.z - o.z), `${b.id} door in ${o.id}`).toBeGreaterThan(Math.hypot(o.hx, o.hz));
      }
      expect(Math.hypot(s.x - WELL.x, s.z - WELL.z)).toBeGreaterThan(WELL.r);
    }
  });

  it("leaves the spawn and the road back out of reach of every door", () => {
    expect(nearestBuilding(TOWN_SPAWN)).toBeNull();
    expect(nearTownExit(TOWN_SPAWN)).toBe(false);
    expect(nearTownExit(TOWN_EXIT)).toBe(true);
    for (const b of BUILDINGS) expect(nearTownExit(doorSpot(b))).toBe(false);
  });

  it("opens a real register row, or a place that has doors", () => {
    for (const b of BUILDINGS) {
      const a = doorAction(b);
      expect(a, b.id).not.toBeNull();
      if (a?.kind === "page") expect(a.door.route).toBe((b.opens as { route: string }).route);
      if (a?.kind === "place") expect(doorsAt(a.place).length).toBeGreaterThan(1);
    }
  });

  it("covers every register row placed in the Town or the Workshop", () => {
    const routes = new Set<string>();
    for (const b of BUILDINGS) {
      const a = doorAction(b);
      if (a?.kind === "page" && a.door.route) routes.add(a.door.route);
      if (a?.kind === "place") for (const d of doorsAt(a.place)) if (d.route) routes.add(d.route);
    }
    for (const d of REGISTER.filter((r) => (r.place === "town" || r.place === "workshop") && r.route && !r.via))
      expect(routes.has(d.route as string), `${d.route} has a building`).toBe(true);
  });

  it("returns the hero to the courtyard out of reach of the gate prompt", () => {
    expect(nearGate(GATE_SPOT)).toBe(true);
    expect(nearGate(GATE_RETURN)).toBe(false);
    expect(Math.hypot(GATE_SPOT.x, GATE_SPOT.z)).toBeLessThan(WALL_RADIUS);
    // No courtyard market piece sits on the gate road.
    for (const m of MARKET) expect(Math.hypot(m.x - GATE_SPOT.x, m.z - GATE_SPOT.z), m.id).toBeGreaterThan(GATE_RANGE + 2);
  });

  it("speaks plainly: no buy or sell words", () => {
    for (const s of [gatePrompt, exitPrompt, ...BUILDINGS.map(buildingPrompt)]) expect(s).not.toMatch(BUY_SELL);
    expect(DOOR_RANGE).toBeGreaterThan(0);
  });
});
