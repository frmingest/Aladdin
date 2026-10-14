import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getObjectArt } from "../../../lib/stitchArt";
import SiegeWorldBanner from "./SiegeWorldBanner";

describe("SiegeWorldBanner stays behind the Game mode switch", () => {
  it("draws nothing with art off (the default and the server render), World or not", () => {
    expect(renderToStaticMarkup(<SiegeWorldBanner active />)).toBe("");
    expect(renderToStaticMarkup(<SiegeWorldBanner active={false} />)).toBe("");
  });

  it("has its picture packed, decorative and 960 wide", () => {
    const art = getObjectArt("backdrop-siege-world");
    expect(art).not.toBeNull();
    expect(art?.alt).toBe("");
    expect(art?.width).toBe(960);
  });
});
