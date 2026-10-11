import { describe, expect, it } from "vitest";
import { HORIZON, worldPalette } from "./fortressArt";

describe("worldPalette", () => {
  it("paints every weather, with the ambient life that fits it", () => {
    expect(worldPalette("calm").motes).toBe("fireflies");
    expect(worldPalette("gathering").motes).toBe("rain");
    expect(worldPalette("besieged").motes).toBe("embers");
    expect(worldPalette("unsurveyed").motes).toBe("none");
  });

  it("treats a missing siege like an unsurveyed one, never like calm", () => {
    expect(worldPalette(null)).toEqual(worldPalette("unsurveyed"));
    expect(worldPalette(null)).not.toEqual(worldPalette("calm"));
  });

  it("keeps the horizon above the first row of towers", () => {
    // First row stands on SCENE_TOP + 170; the hills must sit behind it.
    expect(HORIZON).toBeLessThan(96 + 170);
  });
});

describe("object picture grade", () => {
  it("grades pictures per weather, and storm weather is darker than calm", () => {
    const bright = (level: Parameters<typeof worldPalette>[0]) =>
      Number(/brightness\(([\d.]+)\)/.exec(worldPalette(level).grade)?.[1]);
    for (const level of ["calm", "gathering", "besieged", "unsurveyed", null] as const) {
      expect(worldPalette(level).grade).toMatch(/brightness/);
    }
    expect(bright("gathering")).toBeLessThan(bright("calm"));
    expect(bright("besieged")).toBeLessThan(bright("calm"));
  });
});
