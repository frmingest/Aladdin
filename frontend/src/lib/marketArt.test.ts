import { describe, expect, it } from "vitest";
import { STALL_ART_IDS, salBustId, stallArtId } from "./marketArt";
import type { Mood } from "./salesRep";
import { OBJECT_ART } from "./stitchArt";

describe("stallArtId", () => {
  it("is stable: the same company always gets the same stall", () => {
    for (const id of ["a", "holding-1", "0f3c-77", ""]) {
      expect(stallArtId(id)).toBe(stallArtId(id));
    }
  });

  it("only ever returns a stall that has a picture", () => {
    for (let i = 0; i < 200; i++) {
      const id = stallArtId(`holding-${i}`);
      expect(STALL_ART_IDS).toContain(id);
      expect(OBJECT_ART[id]).toBeDefined();
    }
  });

  it("spreads companies over all four stalls", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => stallArtId(`holding-${i}`)));
    expect(seen.size).toBe(STALL_ART_IDS.length);
  });
});

describe("salBustId", () => {
  it("maps pitch, oops and think to their busts, all of which exist", () => {
    expect(salBustId("pitch")).toBe("sal-pitch");
    expect(salBustId("oops")).toBe("sal-oops");
    expect(salBustId("think")).toBe("sal-think");
    for (const mood of ["pitch", "oops", "think"] as Mood[]) {
      expect(OBJECT_ART[salBustId(mood)!]).toBeDefined();
    }
  });

  it("leaves cheer as the SVG until its picture is generated", () => {
    expect(salBustId("cheer")).toBeNull();
  });
});
