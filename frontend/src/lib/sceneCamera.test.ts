import { describe, expect, it } from "vitest";
import {
  LABEL_FLOOR_PX,
  MAX_ZOOM,
  SCENE_MIN_PX,
  baseWidth,
  clampZoom,
  labelFloorZoom,
  labelPx,
  scrollAfterZoom,
  scrollToReveal,
  stepZoom,
  zoomPercent,
} from "./sceneCamera";

describe("sceneCamera", () => {
  it("never goes below fit or above the maximum, and survives bad input", () => {
    expect(clampZoom(0.4)).toBe(1);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(zoomPercent(1.5)).toBe(150);
  });

  it("draws at least the minimum width, so a phone scrolls sideways at fit", () => {
    expect(baseWidth(390)).toBe(SCENE_MIN_PX);
    expect(baseWidth(1100)).toBe(1100);
    expect(baseWidth(Number.NaN)).toBe(SCENE_MIN_PX);
  });

  it("steps up and down and snaps back onto fit", () => {
    expect(stepZoom(1, 1)).toBeCloseTo(1.25);
    expect(stepZoom(1.25, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
  });

  it("the label floor zoom makes the smallest label exactly the floor (or fit, when already large enough)", () => {
    for (const w of [390, 720, 900, 1100]) {
      const z = labelFloorZoom(w);
      expect(z).toBeGreaterThanOrEqual(1);
      if (z > 1) expect(labelPx(w, z)).toBeCloseTo(LABEL_FLOOR_PX, 5);
      else expect(labelPx(w, z)).toBeGreaterThanOrEqual(LABEL_FLOOR_PX);
    }
    // A 1100 px frame needs about 1.18x; a phone needs about 1.8x.
    expect(labelFloorZoom(1100)).toBeCloseTo(1.176, 2);
    expect(labelFloorZoom(390)).toBeCloseTo(1.797, 2);
    // A very wide frame is already readable at fit.
    expect(labelFloorZoom(1600)).toBe(1);
  });

  it("reports the smallest label in pixels", () => {
    expect(labelPx(720, 1)).toBeCloseTo(6.12, 2);
    expect(labelPx(720, 2)).toBeCloseTo(12.24, 2);
  });

  it("keeps the point under the anchor fixed while zooming", () => {
    // Point at scene offset (scroll + anchor) / zoom must stay under the anchor.
    const before = (100 + 200) / 1;
    const next = scrollAfterZoom(100, 200, 1, 2);
    expect((next + 200) / 2).toBeCloseTo(before);
    expect(scrollAfterZoom(0, 0, 2, 1)).toBe(0);
    expect(scrollAfterZoom(10, 300, 2, 1)).toBe(0);
  });

  it("scrolls a tower into view only when it is not fully visible", () => {
    expect(scrollToReveal(50, 100, 800, 300)).toBeNull();
    expect(scrollToReveal(900, 100, 800, 300)).toBe(300 + 900 + 50 - 400);
    expect(scrollToReveal(-200, 100, 800, 100)).toBe(0);
  });
});
