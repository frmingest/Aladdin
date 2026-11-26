import { describe, expect, it } from "vitest";
import { MAX_FRAME_DT, MAX_SUBSTEPS, PHYSICS_STEP, capClockDelta, stepsFor } from "./physicsStep";

describe("fixed physics step (#486)", () => {
  it("caps the frame time the world sees, and undoes cleanly", () => {
    let next = 0.4;
    const clock = { getDelta: () => next };
    const undo = capClockDelta(clock);
    expect(clock.getDelta()).toBeCloseTo(MAX_FRAME_DT);
    next = 0.01;
    expect(clock.getDelta()).toBe(0.01);
    undo();
    next = 0.4;
    expect(clock.getDelta()).toBe(0.4);
  });

  it("never runs more than MAX_SUBSTEPS steps in a frame once the frame time is capped, however slow the device", () => {
    let carried = 0;
    for (const raw of [0.5, 2, 0.2, 0.05, 0.3, 1 / 30, 0.5]) {
      const r = stepsFor(Math.min(raw, MAX_FRAME_DT), carried);
      expect(r.steps).toBeLessThanOrEqual(MAX_SUBSTEPS);
      expect(r.carried).toBeLessThan(PHYSICS_STEP);
      carried = r.carried;
    }
  });

  it("without the cap a slow frame would run up to 30 steps", () => {
    expect(stepsFor(2, 0).steps).toBe(30);
  });

  it("a fast display steps about once per 1/60 s on average", () => {
    let carried = 0;
    let steps = 0;
    for (let i = 0; i < 144; i++) {
      const r = stepsFor(1 / 144, carried);
      steps += r.steps;
      carried = r.carried;
    }
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
  });
});
