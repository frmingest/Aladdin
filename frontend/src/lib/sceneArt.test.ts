import { describe, expect, it } from "vitest";
import { siegeCamp } from "./fortress";
import { fireArrowSprites, ravenSprite, siegeCampSprites, spriteOnGround } from "./sceneArt";
import { OBJECT_ART } from "./stitchArt";

describe("siegeCampSprites", () => {
  const count = (levelCamp: ReturnType<typeof siegeCamp>, id: string) =>
    siegeCampSprites(levelCamp, 100).filter((s) => s.id === id).length;

  it("draws nothing in calm or unsurveyed weather", () => {
    for (const level of [null, undefined, "calm"] as const) {
      const camp = siegeCamp(level as never);
      expect(siegeCampSprites(camp, 100)).toEqual([]);
      expect(fireArrowSprites(camp, 100)).toEqual([]);
    }
  });

  it("matches the SVG camp's counts when the enemy gathers", () => {
    const camp = siegeCamp("gathering");
    expect(count(camp, "siege-tent")).toBe(3);
    expect(count(camp, "siege-soldier")).toBe(7);
    expect(siegeCampSprites(camp, 100)).toHaveLength(10);
    expect(fireArrowSprites(camp, 100)).toHaveLength(0);
  });

  it("matches the SVG camp's counts when besieged: one of each engine, five arrows", () => {
    const camp = siegeCamp("besieged");
    expect(count(camp, "siege-tent")).toBe(7);
    expect(count(camp, "siege-soldier")).toBe(20);
    for (const id of ["siege-trebuchet", "siege-ram", "siege-tower"]) expect(count(camp, id)).toBe(1);
    expect(fireArrowSprites(camp, 100)).toHaveLength(5);
  });

  it("keeps each picture's proportions and stands it on the ground line", () => {
    const s = spriteOnGround("siege-tent", 50, 200, 26);
    const art = OBJECT_ART["siege-tent"];
    expect(s.width / s.height).toBeCloseTo(art.width / art.height, 5);
    expect(s.top + s.height).toBe(200);
    expect(s.left + s.width / 2).toBeCloseTo(50, 5);
  });
});

describe("fireArrowSprites", () => {
  it("points each arrow down along the arc, towards its target", () => {
    const camp = siegeCamp("besieged");
    for (const a of fireArrowSprites(camp, 100)) {
      // Tip heading = rotate + native tip direction (-135 deg); the arc descends, so 0..180 deg.
      const heading = a.rotate - 135;
      const norm = ((heading % 360) + 360) % 360;
      expect(norm).toBeGreaterThan(0);
      expect(norm).toBeLessThan(180);
    }
  });
});

describe("ravenSprite", () => {
  it("perches its feet on the given point", () => {
    const r = ravenSprite(80, 40);
    expect(r.id).toBe("raven");
    expect(r.top + r.height).toBe(44);
  });
});
