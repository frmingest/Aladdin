import { describe, expect, it } from "vitest";
import { contrastRatio, LABEL_PAIRS } from "./gameTokens";

describe("label tokens", () => {
  it("computes known contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it.each(LABEL_PAIRS)("%s plate: ink on plate is 4.5:1 or better", (_name, ink, plate) => {
    expect(contrastRatio(ink, plate)).toBeGreaterThanOrEqual(4.5);
  });
});
