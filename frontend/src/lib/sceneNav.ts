import type { PlacedTower } from "./fortress";

/**
 * G42 (Sprint 29): arrow-key movement between the towers of the Fortress scene, and the pure rule for
 * pausing its looping animation (G41). Both are view conveniences: they never change a stored value.
 */

export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export const NAV_KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.includes(key);
}

const centre = (t: PlacedTower) => t.x + t.w / 2;

/** Reading order: row by row, left to right. */
export function readingOrder(items: PlacedTower[]): PlacedTower[] {
  return [...items].sort((a, b) => a.row - b.row || a.x - b.x);
}

/**
 * Which tower an arrow key moves to from `currentId`. Left and right step through reading order (and
 * stop at the ends rather than wrap); up and down go to the tower in the neighbouring row whose centre
 * is closest. Null when there is nowhere to go, or when the current tower is unknown.
 */
export function nextTower(items: PlacedTower[], currentId: string, key: NavKey): string | null {
  const order = readingOrder(items);
  if (order.length === 0) return null;
  if (key === "Home") return order[0].tower.holding_id;
  if (key === "End") return order[order.length - 1].tower.holding_id;
  const at = order.findIndex((t) => t.tower.holding_id === currentId);
  if (at < 0) return null;
  if (key === "ArrowLeft") return at > 0 ? order[at - 1].tower.holding_id : null;
  if (key === "ArrowRight") return at < order.length - 1 ? order[at + 1].tower.holding_id : null;
  const here = order[at];
  const targetRow = here.row + (key === "ArrowDown" ? 1 : -1);
  const row = order.filter((t) => t.row === targetRow);
  if (row.length === 0) return null;
  let best = row[0];
  for (const t of row) if (Math.abs(centre(t) - centre(here)) < Math.abs(centre(best) - centre(here))) best = t;
  return best.tower.holding_id;
}

/** G41: the scene's looping animation runs only while the page is visible and the scene is on screen. */
export function sceneShouldRun(pageVisible: boolean, sceneOnScreen: boolean): boolean {
  return pageVisible && sceneOnScreen;
}
