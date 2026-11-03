import { describe, expect, it } from "vitest";
import { DRESSING_BUILT, centreChoice, centreSlotFor, themeOf, themeReadout, themeReadoutTable } from "./landCentre";
import type { Theme3dId } from "../lib/sectors";
import type { GameTower } from "../lib/types";
import type { TowerView } from "./stateToWorld";

type T = Pick<GameTower, "sector" | "holding_id" | "structure" | "name" | "wall" | "moat">;

// The ten fabricated demo holdings (backend/app/services/settings/synthetic_data.py); ids are its fixed uuid5 values.
const DEMO: T[] = (
  [
    ["b6ed475b-02cd-55d9-add8-5b131f31527f", "Apple Inc.", "Technology"],
    ["bfce9bfc-feac-5c81-91a7-99c11d8ff32b", "Microsoft Corporation", "Technology"],
    ["77e9a85a-41ef-5562-94fc-2faa7deecab4", "Alphabet Inc. Class A", "Technology"],
    ["bc058343-0e92-5a2c-a78a-2d901ddde645", "Johnson & Johnson", "Health Care"],
    ["324dca46-9cc6-590e-9377-05288211b59b", "Procter & Gamble Co.", "Consumer Staples"],
    ["f3dccb15-c971-58b6-b0f4-1959f50021c4", "Coca-Cola Co.", "Consumer Staples"],
    ["c03f184f-fd78-5e52-a08b-9c7bd5015b3d", "JPMorgan Chase & Co.", "Financials"],
    ["168ce7f8-1cc6-58b0-90e6-03c4403f2bfc", "Visa Inc. Class A", "Financials"],
    ["68e1769a-2d70-5e79-9d59-311881d96a76", "Home Depot Inc.", "Consumer Discretionary"],
    ["8c9710c0-270f-5e48-9414-08decb12b613", "Exxon Mobil Corp.", "Energy"],
  ] as const
).map(([holding_id, name, sector]) => ({ holding_id, name, sector, structure: "keep" as const, wall: "brick" as const, moat: "narrow" as const }));

const tower = {} as TowerView;
const NONE_BUILT: Record<Theme3dId, boolean> = { ...DRESSING_BUILT };

describe("the centre slot (S26 PR 1)", () => {
  it("a theme with no dressing built keeps S25's plain tower", () => {
    for (const theme of (Object.keys(DRESSING_BUILT) as Theme3dId[]).filter((t) => !DRESSING_BUILT[t])) {
      for (const wall of ["basalt", "rotted", "unsurveyed", "not_applicable"] as const) {
        const slot = centreSlotFor({ ...DEMO[0]!, wall }, tower);
        expect(centreChoice({ theme, condition: slot.condition })).toBe("tower");
      }
    }
  });

  it("draws ghost and neutral once, before any dressing, for every built theme", () => {
    const built = { ...NONE_BUILT, mine: true, farm: true, windmill: true, fountain: true };
    for (const theme of ["mine", "farm", "windmill", "fountain"] as const) {
      const c = (wall: GameTower["wall"]) => centreChoice({ theme, condition: centreSlotFor({ ...DEMO[0]!, wall }, tower).condition }, built);
      expect(c("unsurveyed")).toBe("ghost");
      expect(c("not_applicable")).toBe("neutral");
      expect(c("basalt")).toBe("dressing");
      expect(c("rotted")).toBe("dressing");
    }
    expect(centreChoice({ theme: "plain", condition: centreSlotFor(DEMO[0]!, tower).condition }, { ...built, plain: true })).toBe("tower");
  });

  it("takes condition from the wall alone and stream from the moat alone, whatever the sector", () => {
    const a = centreSlotFor({ ...DEMO[0]!, sector: "Energy" }, tower);
    const b = centreSlotFor({ ...DEMO[0]!, sector: "Materials" }, tower);
    expect(a.condition).toEqual(b.condition);
    expect(a.stream).toEqual(b.stream);
    const weaker = centreSlotFor({ ...DEMO[0]!, wall: "rotted" }, tower);
    expect(weaker.condition).not.toEqual(a.condition);
    expect(weaker.stream).toEqual(a.stream);
    const wetter = centreSlotFor({ ...DEMO[0]!, moat: "wide" }, tower);
    expect(wetter.stream).not.toEqual(a.stream);
    expect(wetter.condition).toEqual(a.condition);
  });

  it("reads the theme from the same call the flat Map uses", () => {
    expect(themeOf({ sector: "Diversified Fund", holding_id: "x", structure: "keep" })).toBe("fountain");
    expect(themeOf({ sector: "Health Care", holding_id: "x", structure: "keep" })).toBe("plain");
    expect(themeOf({ sector: "Materials", holding_id: "x", structure: "bullion" })).toBe("ingots");
  });

  it("prints the theme of every demo holding", () => {
    const rows = themeReadout(DEMO);
    const table = themeReadoutTable(rows);
    console.log(`\n${table}\n`);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.changes === (r.theme !== "plain" && DRESSING_BUILT[r.theme]))).toBe(true);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.theme]));
    expect(byName["Exxon Mobil Corp."]).toMatch(/^(windmill|watermill)$/);
    expect(byName["Procter & Gamble Co."]).toMatch(/^(farm|stall)$/);
    expect(byName["Apple Inc."]).toBe("plain");
    expect(byName["JPMorgan Chase & Co."]).toBe("bank");
  });
});
