import { afterEach, describe, expect, it } from "vitest";
import { DOOR_OPEN_ANGLE, DOOR_SWING_SECONDS, getOpenDoor, setOpenDoor, stepSwing, swingSign } from "./doorSwing";

describe("doorSwing", () => {
  afterEach(() => setOpenDoor(null));

  it("opens fully in the swing time and never overshoots", () => {
    let a = 0;
    for (let t = 0; t < DOOR_SWING_SECONDS * 3; t += 1 / 60) {
      a = stepSwing(a, true, 1 / 60, false);
      expect(a).toBeLessThanOrEqual(DOOR_OPEN_ANGLE);
    }
    expect(a).toBe(DOOR_OPEN_ANGLE);
  });
  it("is part-way after half the swing time, then closes again", () => {
    let a = 0;
    for (let i = 0; i < 12; i++) a = stepSwing(a, true, DOOR_SWING_SECONDS / 24, false);
    expect(a).toBeCloseTo(DOOR_OPEN_ANGLE / 2, 5);
    for (let i = 0; i < 100; i++) a = stepSwing(a, false, 1 / 30, false);
    expect(a).toBe(0);
  });
  it("cuts straight to open or shut with reduced motion", () => {
    expect(stepSwing(0, true, 0.016, true)).toBe(DOOR_OPEN_ANGLE);
    expect(stepSwing(DOOR_OPEN_ANGLE, false, 0.016, true)).toBe(0);
  });
  it("a zero or negative frame time does not move the leaf", () => {
    expect(stepSwing(0.5, true, 0, false)).toBe(0.5);
    expect(stepSwing(0.5, true, -1, false)).toBe(0.5);
  });
  it("the two leaves of a gate turn opposite ways, and in is the reverse of out", () => {
    expect(swingSign(1, "in")).toBe(-swingSign(-1, "in"));
    expect(swingSign(1, "in")).toBe(-swingSign(1, "out"));
  });
  it("remembers which door is open", () => {
    expect(getOpenDoor()).toBeNull();
    setOpenDoor("abc");
    expect(getOpenDoor()).toBe("abc");
  });
});
