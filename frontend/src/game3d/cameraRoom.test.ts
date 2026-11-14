import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import type { AreaId } from "./areas";
import { CAMERA_ROOMS, CAMERA_WALL_GAP, cameraPull, cameraRoomOf } from "./cameraRoom";
import type { CameraRoom } from "./cameraRoom";
import { MAX_DISTANCE, MIN_DISTANCE, cameraOffset } from "./movement";

const ROOM: CameraRoom = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, height: 7 };
const at = (focus: readonly [number, number, number], offset: readonly [number, number, number], t: number) =>
  [focus[0] + offset[0] * t, focus[1] + offset[1] * t, focus[2] + offset[2] * t] as const;
const inside = (p: readonly [number, number, number], room: CameraRoom, slack = 1e-9) =>
  p[0] >= room.minX + CAMERA_WALL_GAP - slack &&
  p[0] <= room.maxX - CAMERA_WALL_GAP + slack &&
  p[2] >= room.minZ + CAMERA_WALL_GAP - slack &&
  p[2] <= room.maxZ - CAMERA_WALL_GAP + slack &&
  p[1] >= CAMERA_WALL_GAP - slack &&
  p[1] <= room.height - CAMERA_WALL_GAP + slack;

describe("cameraPull: the camera stops at walls", () => {
  it("leaves the camera alone when its usual spot is inside the room", () => {
    expect(cameraPull([0, 1.5, 0], [0, 3, 6], ROOM)).toBe(1);
  });
  it("pulls the camera in to just inside the wall behind the hero", () => {
    const focus = [0, 1.5, 8] as const;
    const offset = [0, 3, 6] as const;
    const t = cameraPull(focus, offset, ROOM);
    expect(t).toBeLessThan(1);
    expect(at(focus, offset, t)[2]).toBeCloseTo(ROOM.maxZ - CAMERA_WALL_GAP);
  });
  it("stops under the ceiling when the camera looks down from high up", () => {
    const focus = [0, 1.5, 0] as const;
    const offset = [0, 10, 2] as const;
    const t = cameraPull(focus, offset, ROOM);
    expect(at(focus, offset, t)[1]).toBeCloseTo(ROOM.height - CAMERA_WALL_GAP);
  });
  it("stays clear of the door leaves, which stand 0.23 into the room, by more than the camera's near plane", () => {
    expect(CAMERA_WALL_GAP).toBeGreaterThanOrEqual(0.23 + 0.1);
    expect(CAMERA_WALL_GAP).toBeLessThan(0.35);
  });
  it("keeps the same line of sight: only the distance changes", () => {
    const t = cameraPull([8, 1.5, 8], [5, 3, 5], ROOM);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
  });
  it("comes in to the hero's own head with her back to the wall, and still knows which way it looks", () => {
    const focus = [0, 1.5, ROOM.maxZ - 0.35] as const;
    const offset = [0, 0.4, 7] as const;
    const t = cameraPull(focus, offset, ROOM);
    expect(t).toBeGreaterThan(0);
    expect(at(focus, offset, t)[2]).toBeLessThanOrEqual(ROOM.maxZ - CAMERA_WALL_GAP + 1e-9);
  });
});

describe("the rooms the camera stays inside", () => {
  it("are exactly the indoor places", () => {
    const indoor = (Object.keys(AREAS) as AreaId[]).filter((id) => AREAS[id].kind === "indoor").sort();
    expect(Object.keys(CAMERA_ROOMS).sort()).toEqual(indoor);
    expect(cameraRoomOf("courtyard")).toBeNull();
    expect(cameraRoomOf("holding")).toBeNull();
  });
  it("match the walls each place is walked in", () => {
    for (const id of Object.keys(CAMERA_ROOMS) as AreaId[]) {
      const room = cameraRoomOf(id)!;
      expect({ minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ }).toEqual(AREAS[id].bounds);
    }
  });
  it("hold the camera for every spot the hero can stand on, every way she can look, at every zoom", () => {
    for (const id of Object.keys(CAMERA_ROOMS) as AreaId[]) {
      const room = cameraRoomOf(id)!;
      // The hero's middle never gets closer to a wall than her own half-width.
      const reach = 0.35;
      for (const x of [room.minX + reach, 0, room.maxX - reach]) {
        for (const z of [room.minZ + reach, 0, room.maxZ - reach]) {
          for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 8) {
            for (const pitch of [-0.4, 0.05, 0.45, 1.2]) {
              for (const distance of [MIN_DISTANCE, 7, MAX_DISTANCE]) {
                const focus = [x, 1.5, z] as const;
                const offset = cameraOffset(yaw, pitch, distance);
                const t = cameraPull(focus, offset, room);
                const cam = at(focus, offset, t);
                // Always inside the gap: the hero's middle is never closer to a wall than the gap is.
                expect(inside(cam, room, 0.01), `${id} x${x} z${z} yaw${yaw.toFixed(2)} pitch${pitch} d${distance}`).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});
