import { describe, expect, it } from "vitest";
import { STALL_ART_IDS, salBustId, shopkeeperFaceId, stallArtId } from "./marketArt";
import type { StoreLevel } from "./marketplace";
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

  it("has a bust for cheer too (Sprint 6): every Sal mood is a picture", () => {
    expect(salBustId("cheer")).toBe("sal-cheer");
    for (const mood of ["pitch", "oops", "think", "cheer"] as Mood[]) {
      expect(OBJECT_ART[salBustId(mood)!]).toBeDefined();
    }
  });
});

describe("shopkeeperFaceId", () => {
  it("gives every verdict its own face, and each face exists", () => {
    const faces: StoreLevel[] = ["ready", "promising", "wait", "pass", "unknown"];
    const ids = faces.map((l) => shopkeeperFaceId(l));
    for (const id of ids) expect(OBJECT_ART[id!]).toBeDefined();
    expect(new Set(ids).size).toBe(5);
    expect(shopkeeperFaceId("ready")).toBe("shopkeeper-ready");
  });
});
