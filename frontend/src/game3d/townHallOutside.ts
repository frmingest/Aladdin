/**
 * The Town Hall on the meadow, just outside the gate (2026-11-10). Pure data and maths, no three.js and no React.
 *
 * It used to stand in the Town, two walks away (gate, Town, door). Now it stands beside the gate road, a few steps out of
 * the gate on the west side, where the holdings used to crowd the road. Its door leads straight into the hall (area
 * `townhall`, whose parent is now the courtyard) and the hall's door brings you back out onto the meadow here.
 *
 * It is the same KayKit market-hall model, size and door rules as every Town building (townPlan.ts), so nothing about the
 * building is new art. It carries no fact: where it stands is fixed.
 *
 * Coordinates are the courtyard's: x east, z south, the gate road at x 0 (6 wide). The wall stands at WALL_RADIUS 54.
 */
import { BUILDINGS, DOOR_LEAVE_RANGE, DOOR_RANGE, doorSpot, stepOutOf } from "./townPlan";
import type { Building } from "./townPlan";

/** West of the road, facing it (yaw PI / 2 faces east). The building's long side runs along the road. */
export const TOWN_HALL_OUTSIDE: Building = BUILDINGS.find((b) => b.id === "townhall")!;

/** Where you stand to knock: on the road side of the building, a few steps off the road. */
export const TOWN_HALL_GATE = doorSpot(TOWN_HALL_OUTSIDE);
export const TOWN_HALL_GATE_RANGE = DOOR_RANGE;
export const TOWN_HALL_GATE_LEAVE_RANGE = DOOR_LEAVE_RANGE;

/** Where you stand on stepping back out: past the door's reach, on the road, with the camera on the building's side. */
export const TOWN_HALL_RETURN = stepOutOf(TOWN_HALL_OUTSIDE);
export const TOWN_HALL_RETURN_YAW = TOWN_HALL_RETURN.yaw;

/** How far the building's ground reaches from its middle (half the diagonal of its footprint): trees and plants keep off it. */
export const TOWN_HALL_REACH = Math.hypot(TOWN_HALL_OUTSIDE.hx, TOWN_HALL_OUTSIDE.hz);

export const townHallGatePrompt = "Press E to go into the Town Hall";
