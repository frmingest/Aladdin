import { describe, expect, it } from "vitest";
import { resolveArtPack } from "./artPack";

describe("resolveArtPack", () => {
  it("a ?art= link beats the stored choice", () => {
    expect(resolveArtPack("?art=off", "on")).toBe(false);
    expect(resolveArtPack("?art=on", "off")).toBe(true);
  });

  it("without a link, the stored choice wins over the default", () => {
    expect(resolveArtPack("", "off", true)).toBe(false);
    expect(resolveArtPack("", "on", false)).toBe(true);
  });

  it("with neither, the default decides, and junk values are ignored", () => {
    expect(resolveArtPack("", null, true)).toBe(true);
    expect(resolveArtPack("", null, false)).toBe(false);
    expect(resolveArtPack("?art=maybe", "banana", false)).toBe(false);
  });
});
