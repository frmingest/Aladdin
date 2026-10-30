import { describe, expect, it } from "vitest";
import {
  MAX_DISTANCE,
  MAX_PITCH,
  MIN_DISTANCE,
  MIN_PITCH,
  NO_KEYS,
  cameraOffset,
  clampDistance,
  clampPitch,
  lookUpHeight,
  MIN_CAMERA_PITCH,
  facingYaw,
  moveVector,
  shortestAngle,
} from "./movement";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("moveVector", () => {
  it("stands still with no keys", () => {
    expect(moveVector(NO_KEYS, 1.2)).toEqual({ x: 0, z: 0 });
  });

  it("walks north (-z) when the camera sits south", () => {
    const v = moveVector({ ...NO_KEYS, forward: true }, 0);
    close(v.x, 0);
    close(v.z, -1);
  });

  it("steps right (+x) and left (-x) relative to the camera", () => {
    const r = moveVector({ ...NO_KEYS, right: true }, 0);
    close(r.x, 1);
    close(r.z, 0);
    const l = moveVector({ ...NO_KEYS, left: true }, 0);
    close(l.x, -1);
  });

  it("follows the camera when it orbits", () => {
    // Camera a quarter-turn round: forward is now west (-x).
    const v = moveVector({ ...NO_KEYS, forward: true }, Math.PI / 2);
    close(v.x, -1);
    close(v.z, 0);
  });

  it("does not run faster diagonally", () => {
    const v = moveVector({ ...NO_KEYS, forward: true, right: true }, 0.7);
    close(Math.hypot(v.x, v.z), 1);
  });

  it("cancels opposite keys", () => {
    expect(moveVector({ ...NO_KEYS, forward: true, back: true }, 0)).toEqual({ x: 0, z: 0 });
  });
});

describe("camera limits", () => {
  it("lets the view tilt up without putting the camera under the ground", () => {
    expect(MIN_PITCH).toBeLessThan(0);
    // The camera body never drops below its floor angle, however far you look up.
    expect(cameraOffset(0, MIN_PITCH, 7)[1]).toBeCloseTo(Math.sin(MIN_CAMERA_PITCH) * 7, 6);
    // Aim stays on the player while looking down, rises as you look up, and is far above at the limit.
    expect(lookUpHeight(0.45, 7)).toBe(0);
    expect(lookUpHeight(-0.5, 7)).toBeGreaterThan(lookUpHeight(-0.1, 7));
    expect(lookUpHeight(MIN_PITCH, 7)).toBeGreaterThan(30);
  });

  it("keeps pitch and distance in range", () => {
    expect(clampPitch(-3)).toBe(MIN_PITCH);
    expect(clampPitch(3)).toBe(MAX_PITCH);
    expect(clampDistance(0)).toBe(MIN_DISTANCE);
    expect(clampDistance(99)).toBe(MAX_DISTANCE);
  });

  it("puts the camera behind and above the player", () => {
    const [x, y, z] = cameraOffset(0, 0.5, 8);
    close(x, 0);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
    close(Math.hypot(x, y, z), 8);
  });
});

describe("facing", () => {
  it("turns a +z model towards its movement", () => {
    close(facingYaw({ x: 0, z: 1 }), 0);
    close(facingYaw({ x: 1, z: 0 }), Math.PI / 2);
  });

  it("turns the short way round", () => {
    close(shortestAngle(0.1, -0.1), -0.2);
    close(shortestAngle(3, -3), 2 * Math.PI - 6);
  });
});
