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
