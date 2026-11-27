import { describe, expect, it } from "vitest";
import { fitHeight } from "./fitToScreen";

describe("fitHeight (#528)", () => {
  it("keeps the old 5rem room when the view starts higher than that (desktop, demo mode off)", () => {
    expect(fitHeight(45)).toBe("calc(100dvh - max(5rem, 45px))");
  });

  it("subtracts the real start when a wrapped demo strip pushes the view down (a phone)", () => {
    expect(fitHeight(166.4)).toBe("calc(100dvh - max(5rem, 167px))");
  });

  it("falls back to the old rule when nothing is measured yet", () => {
    expect(fitHeight(0)).toBe("calc(100dvh - max(5rem, 0px))");
    expect(fitHeight(Number.NaN)).toBe("calc(100dvh - max(5rem, 0px))");
    expect(fitHeight(-10)).toBe("calc(100dvh - max(5rem, 0px))");
  });
});
