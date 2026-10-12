import { describe, expect, it } from "vitest";
import { getObjectArt, OBJECT_ART } from "./stitchArt";

describe("object art", () => {
  it("keeps every picture decorative, so no fact can hide in it", () => {
    for (const art of Object.values(OBJECT_ART)) {
      expect(art.alt).toBe("");
      expect(art.src).toMatch(/\.webp$/);
      expect(art.width).toBeGreaterThan(0);
      expect(art.height).toBeGreaterThan(0);
    }
  });

  it("falls back to the SVG for an id with no picture", () => {
    expect(getObjectArt("no-such-object")).toBeNull();
    expect(getObjectArt("toString")).toBeNull();
    expect(getObjectArt("sal-counter")).toBe(OBJECT_ART["sal-counter"]);
  });
});
