import { describe, expect, it } from "vitest";
import { LAND_WORDS } from "./holdingLandWordsV1";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("holding land words v1", () => {
  it("keeps every label and plate short", () => {
    expect(words(LAND_WORDS.plate("Vår Energi"))).toBeLessThanOrEqual(6);
    expect(words(LAND_WORDS.plateNoName)).toBeLessThanOrEqual(6);
    expect(words(LAND_WORDS.gatePrompt)).toBeLessThanOrEqual(8);
    expect(words(LAND_WORDS.houseLabel)).toBeLessThanOrEqual(4);
  });
  it("names the land after its own holding and invents nothing without one", () => {
    expect(LAND_WORDS.plate("Vår Energi")).toBe("Into Vår Energi's land");
    expect(LAND_WORDS.title("Vår Energi")).toBe("Vår Energi's land");
    expect(LAND_WORDS.titleNoName).toBe("Holding land");
  });
});
