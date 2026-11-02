import { describe, expect, it } from "vitest";
import { sectorArtId, sectorLandmarkIds } from "./mapArt";
import { sceneFor } from "./mapScenes";
import { SECTOR_ROWS, holdingTheme3d, sectorRow, theme3dOfArt, type Theme3dId } from "./sectors";
import type { FortressStructure } from "./types";

const SECTORS = [
  "Materials", "Metals & Mining", "Energy", "Utilities", "Financials", "Industrials", "Consumer Staples",
  "Consumer Discretionary", "Retail", "Diversified Fund", "Health Care", "Information Technology", "Real Estate",
  "Aerospace & Defense", "No sector set", "", null, undefined,
];
const IDS = ["a", "b", "c", "d", "e", "f", "xetra-gold", "salmon", "h42", "h-long-id-7"];
const STRUCTURES: (FortressStructure | undefined)[] = [undefined, "keep", "bullion", "outpost", "granary"];

describe("one sector table", () => {
  it("gives the 3D theme the same pick as the flat Map picture, for every sector, id and structure", () => {
    for (const s of SECTORS) for (const id of IDS) for (const st of STRUCTURES) {
      expect(holdingTheme3d(s, id, st), `${s} ${id} ${st}`).toBe(theme3dOfArt(sectorArtId(s, id, st)));
    }
  });

  it("names the theme for known sectors and gold, and keeps unknown sectors plain", () => {
    expect(holdingTheme3d("Financials", "x")).toBe("bank");
    expect(holdingTheme3d("Consumer Discretionary", "x")).toBe("stall");
    expect(holdingTheme3d("Diversified Fund", "x")).toBe("fountain");
    expect(holdingTheme3d("Industrials", "x")).toBe("factory");
    expect(holdingTheme3d("Materials", "xetra-gold", "bullion")).toBe("ingots");
    const mat = new Set<Theme3dId>(IDS.map((id) => holdingTheme3d("Materials", id, "keep")));
    expect([...mat].every((t) => t === "mine" || t === "quarry")).toBe(true);
    const en = new Set<Theme3dId>(IDS.map((id) => holdingTheme3d("Energy", id)));
    expect([...en].every((t) => t === "windmill" || t === "watermill")).toBe(true);
    for (const none of ["Health Care", "Information Technology", "Real Estate", "No sector set", "", null, undefined]) expect(holdingTheme3d(none, "x")).toBe("plain");
  });

  it("is stable: the same holding always gets the same theme", () => {
    expect(holdingTheme3d("Materials", "h9", "keep")).toBe(holdingTheme3d("Materials", "h9", "keep"));
  });

  it("makes the Map picture and the dive scene agree for every sector with a picture", () => {
    const sceneOfArt: Record<string, string> = {
      "map-fountain-square": "exchange", "map-windmill": "mill", "map-watermill": "mill", "map-bank-vault": "bank",
      "map-factory": "forge", "map-farmhouse": "farm", "map-market-stall": "exchange|farm", "map-gold-mine": "mines",
      "map-quarry": "mines", "map-gold-ingots": "mines",
    };
    for (const s of SECTORS) {
      for (const art of sectorLandmarkIds(s)) expect(sceneOfArt[art]!.split("|"), `${s} ${art}`).toContain(sceneFor({ sector: s }));
    }
  });

  it("changes these dive scenes when the Map picture disagreed: Discretionary and Retail go to the exchange floor", () => {
    expect(sceneFor({ sector: "Consumer Discretionary" })).toBe("exchange");
    expect(sceneFor({ sector: "Retail" })).toBe("exchange");
    expect(sceneOfRow("Automobiles")).toBe("workshop");
  });

  it("keeps the scenes the Map has no picture for: health, tech, defence", () => {
    expect(sceneFor({ sector: "Health Care" })).toBe("clinic");
    expect(sceneFor({ sector: "Information Technology" })).toBe("tech");
    expect(sceneFor({ sector: "Aerospace & Defense" })).toBe("forge");
  });

  it("returns no row for an empty or unknown sector", () => {
    expect(sectorRow(null)).toBeNull();
    expect(sectorRow("  ")).toBeNull();
    expect(sectorRow("Zzz")).toBeNull();
    expect(SECTOR_ROWS.length).toBeGreaterThan(8);
  });
});

function sceneOfRow(s: string) {
  return sceneFor({ sector: s });
}
