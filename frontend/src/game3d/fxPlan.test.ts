import { describe, expect, it } from "vitest";
import { CHIMNEYS, SMOKE, SPARKS, fxState } from "./fxPlan";

describe("fxPlan", () => {
  it("a sprite rises, grows (smoke) or shrinks (sparks) and never leaves its range", () => {
    for (let t = 0; t < 12; t += 0.37) {
      for (let i = 0; i < SMOKE.count; i++) {
        const s = fxState(SMOKE, i, t);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(SMOKE.rise);
        expect(s.alpha).toBeGreaterThanOrEqual(0);
        expect(s.alpha).toBeLessThanOrEqual(SMOKE.alpha);
      }
    }
    expect(fxState(SMOKE, 0, 4.9).size).toBeGreaterThan(fxState(SMOKE, 0, 0.1).size);
    expect(fxState(SPARKS, 0, 1.0).size).toBeLessThan(fxState(SPARKS, 0, 0.05).size);
  });
  it("is fully faded at birth, so nothing pops in", () => {
    expect(fxState(SMOKE, 0, 0).alpha).toBe(0);
  });
  it("is the same every time", () => {
    expect(fxState(SMOKE, 3, 2.5)).toEqual(fxState(SMOKE, 3, 2.5));
  });
  it("puts a chimney on the Archive and the Workshop models", () => {
    expect(CHIMNEYS.map((c) => c.model).sort()).toEqual(["house", "lumbermill"]);
  });
});
