import { describe, expect, it } from "vitest";
import { FORTRESS_NAV } from "./nav";
import { bannerArtFor, emblemForPath } from "./artAssets";

describe("art pack assets", () => {
  it("Council gets the fact-free strip; Records and Chronicle share the study; the rest keep the plate", () => {
    expect(bannerArtFor("council")?.url).toBe("/art/banner-council.webp");
    expect(bannerArtFor("records")?.url).toBe(bannerArtFor("chronicle")?.url);
    for (const k of ["circle", "map", "siege", "market", "fortress"] as const) expect(bannerArtFor(k)).toBeNull();
  });

  it("every Fortress tab has its own emblem", () => {
    const urls = FORTRESS_NAV.map((n) => emblemForPath(n.to));
    expect(urls.every(Boolean)).toBe(true);
    expect(new Set(urls).size).toBe(FORTRESS_NAV.length);
    expect(emblemForPath("/elsewhere")).toBeNull();
  });
});
