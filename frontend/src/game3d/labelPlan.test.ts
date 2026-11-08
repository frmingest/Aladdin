import { describe, expect, it } from "vitest";
import { labelFor, labelOpacity, labelPx, MIN_LABEL_PX, NEAR_FULL, NEAR_GONE } from "./labelPlan";

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

describe("labelPx", () => {
  it("follows drei's scale: factor / (2 tan(fov/2) * distance), times the 12 px font", () => {
    // fov 60: 2 tan 30deg = 1.1547. Factor 16 at 10 m: 12 * 16 / 11.547 = 16.6 px.
    expect(labelPx(16, 60, 10)).toBeCloseTo(16.63, 1);
  });

  it("shrinks as you move away and grows as you come close", () => {
    expect(labelPx(9, 60, 20)).toBeLessThan(labelPx(9, 60, 10));
    expect(labelPx(9, 60, 3)).toBeGreaterThan(labelPx(9, 60, 10));
  });

  it("crosses the 12 px floor at distanceFactor / (2 tan(fov/2)) metres", () => {
    const edge = 9 / (2 * Math.tan(Math.PI / 6));
    expect(labelPx(9, 60, edge)).toBeCloseTo(MIN_LABEL_PX, 5);
  });
});

describe("labelOpacity", () => {
  const near = { tier: "plate", opacity: 1, fog: false } as const;
  const half = { tier: "plate", opacity: 0.5, fog: false } as const;
  const gone = { tier: "hidden", opacity: 0, fog: false } as const;

  it("hides a label that would be smaller than the floor, instead of shrinking it", () => {
    expect(labelOpacity(near, MIN_LABEL_PX - 0.5, false, false)).toBe(0);
    expect(labelOpacity(near, MIN_LABEL_PX, false, false)).toBe(1);
  });

  it("keeps the thing you face at any size", () => {
    expect(labelOpacity(near, 4, true, false)).toBe(1);
  });

  it("follows the plan's fade, and never draws what the plan hides", () => {
    expect(labelOpacity(half, 20, false, false)).toBe(0.5);
    expect(labelOpacity(gone, 40, true, false)).toBe(0);
  });

  it("under reduced motion is fully on or fully off, never in between", () => {
    expect(labelOpacity({ ...half, opacity: 0.7 }, 20, false, true)).toBe(1);
    expect(labelOpacity({ ...half, opacity: 0.3 }, 20, false, true)).toBe(0);
  });
});
