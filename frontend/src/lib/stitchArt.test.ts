import { describe, expect, it } from "vitest";
import { getObjectArt, OBJECT_ART, parseArtParam, resolveArtMode } from "./stitchArt";

describe("stitch art switch", () => {
  it("defaults to the SVG art", () => {
    expect(resolveArtMode("", null)).toBe("svg");
    expect(resolveArtMode("", "garbage")).toBe("svg");
  });

  it("remembers the stitch choice", () => {
    expect(resolveArtMode("", "stitch")).toBe("stitch");
  });

  it("lets the URL win over the remembered choice, both ways", () => {
    expect(resolveArtMode("?art=svg", "stitch")).toBe("svg");
    expect(resolveArtMode("?art=stitch", "svg")).toBe("stitch");
    expect(resolveArtMode("?x=1&art=stitch", null)).toBe("stitch");
  });

  it("ignores unknown values", () => {
    expect(parseArtParam("?art=painted")).toBeNull();
    expect(parseArtParam("")).toBeNull();
    expect(resolveArtMode("?art=painted", "stitch")).toBe("stitch");
  });

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
