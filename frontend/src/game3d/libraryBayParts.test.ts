import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BAY_CARCASS, BAY_H, BAY_W, BOARD_Y, coplanarClashes } from "./libraryBayParts";
import type { CarcassBox } from "./libraryBayParts";

// #516: the library shelves blinked because carcass faces of different colours lay in one plane (the moat did the same, #510).
describe("library shelf bay carcass", () => {
  it("has no two faces in one plane pointing the same way", () => {
    expect(coplanarClashes(BAY_CARCASS)).toEqual([]);
  });

  it("would have caught the old carcass (back panel and side panels flush with the boards)", () => {
    const old: CarcassBox[] = [
      { key: "back", tone: "back", at: [0, BAY_H / 2, -0.32], size: [BAY_W, BAY_H, 0.1], grow: 1.02 },
      ...([-1, 1] as const).map((s): CarcassBox => ({ key: `side${s}`, tone: "side", at: [s * (BAY_W / 2 - 0.05), BAY_H / 2, 0], size: [0.12, BAY_H, 0.8], grow: 1.1 })),
      ...[...BOARD_Y, BAY_H - 0.05].map((y): CarcassBox => ({ key: `board${y.toFixed(2)}`, tone: "board", at: [0, y, 0], size: [BAY_W, 0.1, 0.8], grow: 1.05 })),
    ];
    const clashes = coplanarClashes(old);
    expect(clashes).toContain("back/board3.40 y+"); // back panel top level with the top board's top, full width
    expect(clashes).toContain("side-1/board0.15 z+"); // board fronts level with the side panel fronts
    expect(clashes).toContain("side1/board3.40 y+"); // side panel tops level with the top board's top
  });

  it("keeps the shelf's footprint: boards span the bay, books still stand on the same boards", () => {
    const boards = BAY_CARCASS.filter((b) => b.tone === "board");
    expect(boards.map((b) => b.at[1])).toEqual([...BOARD_Y, BAY_H - 0.05]);
    for (const b of boards) expect(b.size[0]).toBe(BAY_W);
  });

  it("is what the bay draws", () => {
    const src = readFileSync(new URL("./LibraryBay.tsx", import.meta.url), "utf8");
    expect(src).toContain("BAY_CARCASS.map");
  });
});
