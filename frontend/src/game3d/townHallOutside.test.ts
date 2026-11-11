import { describe, expect, it } from "vitest";
import { WALL_RADIUS, WALL_THICKNESS } from "./layout";
import { ROAD_HALF_WIDTH, onGateRoad } from "./horizonPieces";
import { AREAS, returnSpot, transitionSpot } from "./areas";
import { RING_RADIUS, RING_WIDTH, RIVER_HALF, distToPolyline, riverLine, tracks } from "./countryside";
import { hallExit } from "./townHallRoom";
import { BUILDINGS, DOOR_LEAVE_RANGE, DOOR_RANGE, nearestBuilding } from "./townPlan";
import {
  TOWN_HALL_GATE,
  TOWN_HALL_GATE_LEAVE_RANGE,
  TOWN_HALL_GATE_RANGE,
  TOWN_HALL_OUTSIDE,
  TOWN_HALL_REACH,
  TOWN_HALL_RETURN,
  TOWN_HALL_RETURN_YAW,
  townHallGatePrompt,
} from "./townHallOutside";

const GATE_ROAD_HALF = 3;

describe("the Town Hall outside the gate", () => {
  it("is the Town Hall, one of the Town buildings", () => {
    expect(TOWN_HALL_OUTSIDE.id).toBe("townhall");
    expect(TOWN_HALL_OUTSIDE.label).toBe("Town Hall");
    expect(BUILDINGS.some((b) => b.id === "townhall")).toBe(true);
  });

  it("stands on the meadow just outside the wall, a few steps from the gate road", () => {
    const wallOuter = WALL_RADIUS + WALL_THICKNESS / 2;
    expect(Math.hypot(TOWN_HALL_OUTSIDE.x, TOWN_HALL_OUTSIDE.z) - TOWN_HALL_REACH).toBeGreaterThan(wallOuter + 3);
    // Within sight and a short walk of the gate: nearer than 20 from the gate's outside.
    expect(Math.hypot(TOWN_HALL_GATE.x, TOWN_HALL_GATE.z - (wallOuter + 1))).toBeLessThan(20);
  });

  it("keeps off the gate road (building edge), the lane round the wall, the river and the grove clearing's road", () => {
    // Its east edge (its footprint turns with the yaw) is clear of the 6-wide road.
    const eastEdge = TOWN_HALL_OUTSIDE.x + Math.abs(Math.sin(TOWN_HALL_OUTSIDE.yaw)) * TOWN_HALL_OUTSIDE.hz + Math.abs(Math.cos(TOWN_HALL_OUTSIDE.yaw)) * TOWN_HALL_OUTSIDE.hx;
    expect(-eastEdge).toBeGreaterThanOrEqual(GATE_ROAD_HALF + 2);
    expect(ROAD_HALF_WIDTH).toBeGreaterThan(GATE_ROAD_HALF);
    const ring = tracks().find((t) => t.kind === "ring")!;
    expect(distToPolyline(TOWN_HALL_OUTSIDE, ring.points) - RING_WIDTH / 2).toBeGreaterThanOrEqual(TOWN_HALL_REACH);
    expect(RING_RADIUS).toBeGreaterThan(WALL_RADIUS);
    expect(distToPolyline(TOWN_HALL_OUTSIDE, riverLine()) - RIVER_HALF).toBeGreaterThan(TOWN_HALL_REACH + 10);
    expect(onGateRoad(TOWN_HALL_OUTSIDE.x, TOWN_HALL_OUTSIDE.z, ROAD_HALF_WIDTH)).toBe(false);
  });

  it("has its door on the road side, within reach of the door spot and nothing else", () => {
    expect(TOWN_HALL_GATE.x).toBeGreaterThan(TOWN_HALL_OUTSIDE.x);
    expect(TOWN_HALL_GATE.x).toBeLessThan(0);
    expect(TOWN_HALL_GATE_RANGE).toBe(DOOR_RANGE);
    expect(TOWN_HALL_GATE_LEAVE_RANGE).toBe(DOOR_LEAVE_RANGE);
    expect(nearestBuilding(TOWN_HALL_GATE, [TOWN_HALL_OUTSIDE])).toBe("townhall");
    expect(AREAS.courtyard.doors.find((d) => d.to === "townhall")).toMatchObject({ x: TOWN_HALL_GATE.x, z: TOWN_HALL_GATE.z });
  });

  it("is a door of the courtyard now: one step in, one step out, no Town in between", () => {
    expect(AREAS.townhall.parent).toBe("courtyard");
    expect(AREAS.courtyard.doors.some((d) => d.to === "townhall")).toBe(true);
    expect(transitionSpot({ id: "courtyard" }, { id: "townhall" }, [])).toEqual(AREAS.townhall.spawn);
    expect(returnSpot({ id: "townhall" }, { id: "courtyard" }, [])).toEqual(hallExit());
  });

  it("steps you back out past the door's reach, on the meadow, looking away from the door", () => {
    expect(Math.hypot(TOWN_HALL_RETURN.x - TOWN_HALL_GATE.x, TOWN_HALL_RETURN.z - TOWN_HALL_GATE.z)).toBeGreaterThan(TOWN_HALL_GATE_LEAVE_RANGE);
    expect(Math.hypot(TOWN_HALL_RETURN.x, TOWN_HALL_RETURN.z)).toBeGreaterThan(WALL_RADIUS + WALL_THICKNESS);
    expect(hallExit()).toEqual({ x: TOWN_HALL_RETURN.x, z: TOWN_HALL_RETURN.z, yaw: TOWN_HALL_RETURN_YAW });
  });

  it("says what E does", () => {
    expect(townHallGatePrompt).toBe("Press E to go into the Town Hall");
  });
});
