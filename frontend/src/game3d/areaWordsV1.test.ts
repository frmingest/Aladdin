import { describe, expect, it } from "vitest";
import { AREA_LINES, AREA_STUCK, areaLine, areaName } from "./areaWordsV1";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("area words v1", () => {
  it("keeps every plate short", () => {
    for (const line of [...Object.values(AREA_LINES), AREA_STUCK, areaLine({ id: "holding", holdingId: "h" }, "Vår Energi")]) {
      expect(words(line)).toBeLessThanOrEqual(6);
    }
  });
  it("names a land after its own holding, and invents nothing without one", () => {
    expect(areaLine({ id: "holding", holdingId: "h" }, "Vår Energi")).toBe("Into Vår Energi's land");
    expect(areaLine({ id: "holding", holdingId: "h" })).toBe("Into the land");
    expect(areaName({ id: "holding", holdingId: "h" }, "Vår Energi")).toBe("Vår Energi's land");
  });
  it("has a plain name for every place", () => {
    expect(areaName({ id: "courtyard" })).toBe("3D courtyard");
    expect(areaName({ id: "townhall" })).toBe("Town Hall");
  });
});
