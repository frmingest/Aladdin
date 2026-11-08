import { describe, expect, it } from "vitest";
import { labelFor, NEAR_FULL, NEAR_GONE } from "./labelPlan";

const base = { distance: 5, focused: false, fog: false } as const;

describe("labelFor", () => {
  it("always shows a painted sign, at any distance", () => {
    expect(labelFor({ ...base, kind: "sign", distance: 200 })).toEqual({ tier: "sign", opacity: 1, fog: false });
  });

  it("shows a name plate in full when near", () => {
    expect(labelFor({ ...base, kind: "name", distance: NEAR_FULL }).opacity).toBe(1);
  });

  it("fades a name plate between near and gone, then hides it", () => {
    const mid = labelFor({ ...base, kind: "name", distance: (NEAR_FULL + NEAR_GONE) / 2 });
    expect(mid.tier).toBe("plate");
    expect(mid.opacity).toBeCloseTo(0.5, 5);
    expect(labelFor({ ...base, kind: "name", distance: NEAR_GONE })).toEqual({ tier: "hidden", opacity: 0, fog: false });
  });

  it("keeps the focused name plate at any distance", () => {
    expect(labelFor({ ...base, kind: "name", distance: 90, focused: true })).toEqual({ tier: "plate", opacity: 1, fog: false });
  });

  it("shows a prompt only for the thing you can act on", () => {
    expect(labelFor({ ...base, kind: "prompt" }).tier).toBe("hidden");
    expect(labelFor({ ...base, kind: "prompt", focused: true }).tier).toBe("prompt");
  });

  it("never turns fog into a known label, at any distance or focus", () => {
    for (const kind of ["sign", "name", "prompt"] as const) {
      for (const distance of [0, 6, 15, 40]) {
        for (const focused of [false, true]) {
          expect(labelFor({ kind, distance, focused, fog: true }).fog).toBe(true);
        }
      }
    }
  });
});
