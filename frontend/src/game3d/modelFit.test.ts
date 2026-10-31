import { describe, expect, it } from "vitest";
import { MODELS3D } from "./models3d";
import { MODEL_YAW, fitToHeight } from "./modelFit";

describe("fitting a model", () => {
  it("scales to the wanted height and puts the feet on the ground", () => {
    const fit = fitToHeight({ x: -1, y: 4, z: -2 }, { x: 1, y: 6, z: 2 }, 1.9);
    expect(fit.scale).toBeCloseTo(0.95);
    expect(4 * fit.scale + fit.offset[1]).toBeCloseTo(0);
    expect(6 * fit.scale + fit.offset[1]).toBeCloseTo(1.9);
  });

  it("centres the model on its spot", () => {
    const fit = fitToHeight({ x: 10, y: 0, z: 20 }, { x: 14, y: 2, z: 26 }, 2);
    expect(((10 + 14) / 2) * fit.scale + fit.offset[0]).toBeCloseTo(0);
    expect(((20 + 26) / 2) * fit.scale + fit.offset[2]).toBeCloseTo(0);
  });

  it("leaves an empty or flat model alone instead of dividing by zero", () => {
    expect(fitToHeight({ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 }, 2)).toEqual({ scale: 1, offset: [0, 0, 0] });
    expect(fitToHeight({ x: 0, y: 0, z: 0 }, { x: 1, y: NaN, z: 1 }, 2).scale).toBe(1);
  });

  it("registers the hero, the Oracle, the Partner and the two townsfolk, weapons hidden", () => {
    expect(Object.keys(MODELS3D)).toEqual(["hero", "oracle", "partner", "guard", "scout"]);
    expect(MODELS3D.hero?.url).toBe("/models/Rogue_Hooded.glb");
    expect(MODELS3D.hero?.hide).toContain("1H_Crossbow");
    expect(MODELS3D.oracle?.url).toBe("/models/Mage.glb");
    expect(MODELS3D.oracle?.hide).toEqual(expect.arrayContaining(["2H_Staff", "1H_Wand", "Spellbook"]));
    expect(MODELS3D.oracle?.hide).not.toContain("Mage_Hat");
    expect(MODELS3D.partner?.url).toBe("/models/Knight.glb");
    expect(MODELS3D.partner?.hide).toEqual(expect.arrayContaining(["1H_Sword", "2H_Sword", "Round_Shield"]));
    expect(MODELS3D.partner?.hide).not.toContain("Knight_Helmet");
    expect(Object.keys(MODEL_YAW).length).toBe(0);
  });
});
