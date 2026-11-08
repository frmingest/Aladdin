import { describe, expect, it } from "vitest";
import { contrastRatio } from "./gameTokens";
import { SIGN_PAIRS, chalkFor } from "./signTexture";

describe("chalkFor", () => {
  it("a loss is a down glyph, the loss tone and the number as printed", () => {
    expect(chalkFor("-31.5%")).toEqual({ tone: "loss", glyph: "▼", text: "-31.5%" });
    expect(chalkFor("−12.0%")).toMatchObject({ tone: "loss", text: "−12.0%" });
  });
  it("a gain is an up glyph", () => {
    expect(chalkFor("+4.0%")).toEqual({ tone: "gain", glyph: "▲", text: "+4.0%" });
  });
  it("no sign is flat, still with a glyph and the number", () => {
    expect(chalkFor("0.0%")).toEqual({ tone: "flat", glyph: "■", text: "0.0%" });
  });
  it("unknown is a fog seal and never carries a number", () => {
    for (const v of [null, undefined, "", "  ", "?", "—"]) {
      expect(chalkFor(v)).toEqual({ tone: "fog", glyph: "?", text: "" });
    }
  });
  it("every tone has a glyph, so colour is never the only cue", () => {
    for (const v of ["-1%", "+1%", "0%", null]) expect(chalkFor(v).glyph.length).toBeGreaterThan(0);
  });
});

describe("sign tokens", () => {
  it.each(SIGN_PAIRS)("%s is 4.5:1 or better", (_n, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("signHeight", () => {
  it("follows each shape's aspect", async () => {
    const { signHeight } = await import("./signTexture");
    expect(signHeight("plank", 3.84)).toBeCloseTo(0.96, 5);
    expect(signHeight("banner", 3.2)).toBeCloseTo(1.92, 5);
  });
});
