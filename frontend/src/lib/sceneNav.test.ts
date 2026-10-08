import { describe, expect, it } from "vitest";
import { isNavKey, nextTower, readingOrder, sceneShouldRun } from "./sceneNav";
import type { PlacedTower } from "./fortress";

const t = (id: string, row: number, x: number, w = 100): PlacedTower =>
  ({ tower: { holding_id: id } as PlacedTower["tower"], x, y: 0, w, h: 100, row, index: 0 });

// Row 0: A B C   Row 1: D E   (D sits under A/B, E under C)
const items = [t("E", 1, 300), t("B", 0, 150), t("A", 0, 0), t("D", 1, 40), t("C", 0, 300)];

describe("tower keyboard map", () => {
  it("reads row by row, left to right", () => {
    expect(readingOrder(items).map((i) => i.tower.holding_id)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("steps left and right through reading order and stops at the ends", () => {
    expect(nextTower(items, "B", "ArrowRight")).toBe("C");
    expect(nextTower(items, "C", "ArrowRight")).toBe("D");
    expect(nextTower(items, "D", "ArrowLeft")).toBe("C");
    expect(nextTower(items, "A", "ArrowLeft")).toBeNull();
    expect(nextTower(items, "E", "ArrowRight")).toBeNull();
  });

  it("goes up and down to the closest tower in the neighbouring row", () => {
    expect(nextTower(items, "A", "ArrowDown")).toBe("D");
    expect(nextTower(items, "C", "ArrowDown")).toBe("E");
    expect(nextTower(items, "E", "ArrowUp")).toBe("C");
    expect(nextTower(items, "B", "ArrowUp")).toBeNull();
    expect(nextTower(items, "D", "ArrowDown")).toBeNull();
  });

  it("jumps to the first and last tower, and is safe with nothing to move between", () => {
    expect(nextTower(items, "C", "Home")).toBe("A");
    expect(nextTower(items, "A", "End")).toBe("E");
    expect(nextTower([], "A", "Home")).toBeNull();
    expect(nextTower(items, "missing", "ArrowRight")).toBeNull();
  });

  it("recognises only navigation keys", () => {
    expect(isNavKey("ArrowUp")).toBe(true);
    expect(isNavKey("Enter")).toBe(false);
    expect(isNavKey("a")).toBe(false);
  });
});

describe("scene animation pause", () => {
  it("runs only when the page is visible and the scene is on screen", () => {
    expect(sceneShouldRun(true, true)).toBe(true);
    expect(sceneShouldRun(false, true)).toBe(false);
    expect(sceneShouldRun(true, false)).toBe(false);
  });
});
