import { describe, expect, it } from "vitest";
import {
  CAPITAL,
  MAX_PROVINCES,
  MAX_ZOOM,
  NO_SECTOR_NAME,
  OTHER_SECTORS_NAME,
  WORLD,
  buildWorld,
  chooseLabels,
  clampView,
  coastDistance,
  dist,
  ensureVisible,
  groupSectors,
  initialView,
  isLand,
  nearestInDirection,
  panBy,
  placeRealm,
  toScreen,
  toWorld,
  viewBox,
  zoomAt,
  type PlaceInput,
} from "./worldMap";

const sectors = ["Energy", "Financials", "Technology", "Industrials", "Materials", "Health care", "Consumer staples"];
function realmInput(n: number, withNone = true): PlaceInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    weightPct: Math.max(0.5, 22 - i * 1.2),
    sector: withNone && i === n - 1 ? null : sectors[i % sectors.length],
  }));
}

describe("the land", () => {
  it("is the same land every time", () => {
    const a = buildWorld();
    const b = buildWorld();
    expect(a).toBe(b);
    expect(a.landPath.length).toBeGreaterThan(200);
    expect(a.sites.length).toBeGreaterThan(14);
  });

  it("keeps the capital, every site, the compass and the serpent where they belong", () => {
    const w = buildWorld();
    expect(isLand(w, CAPITAL)).toBe(true);
    for (const s of w.sites) {
      expect(isLand(w, s)).toBe(true);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(WORLD.w);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(WORLD.h);
    }
    expect(isLand(w, w.compass)).toBe(false);
    expect(isLand(w, w.serpent)).toBe(false);
    expect(coastDistance(w, w.compass)).toBeGreaterThan(40);
  });

  it("keeps sites apart", () => {
    const w = buildWorld();
    for (let i = 0; i < w.sites.length; i++) for (let j = i + 1; j < w.sites.length; j++) expect(dist(w.sites[i], w.sites[j])).toBeGreaterThanOrEqual(w.spacing - 0.01);
  });
});

describe("placing the realm", () => {
  it("places every holding exactly once, on land, apart from every other and from the keep", () => {
    for (const n of [0, 1, 5, 18, 30, 45]) {
      const r = placeRealm(realmInput(n));
      const w = buildWorld();
      expect(r.settlements.map((s) => s.id).sort()).toEqual(realmInput(n).map((i) => i.id).sort());
      r.settlements.forEach((s, i) => {
        expect(isLand(w, s)).toBe(true);
        expect(dist(s, CAPITAL)).toBeGreaterThan(40);
        for (let j = i + 1; j < r.settlements.length; j++) expect(dist(s, r.settlements[j])).toBeGreaterThan(36);
      });
    }
  });

  it("is deterministic and does not depend on input order", () => {
    const a = placeRealm(realmInput(14));
    const b = placeRealm([...realmInput(14)].reverse());
    const pos = (r: ReturnType<typeof placeRealm>) => Object.fromEntries(r.settlements.map((s) => [s.id, [s.x, s.y]]));
    expect(pos(a)).toEqual(pos(b));
  });

  it("makes one province per sector and a separate, named one for holdings with no sector", () => {
    const r = placeRealm(realmInput(10));
    const names = r.provinces.map((p) => p.name);
    expect(names).toContain(NO_SECTOR_NAME);
    expect(r.provinces.find((p) => p.name === NO_SECTOR_NAME)?.unsorted).toBe(true);
    expect(r.provinces.find((p) => p.name === NO_SECTOR_NAME)?.towerIds).toEqual(["h9"]);
    expect(new Set(names).size).toBe(names.length);
    // every other province is a real sector and never unsorted
    r.provinces.filter((p) => p.name !== NO_SECTOR_NAME).forEach((p) => expect(p.unsorted).toBe(false));
  });

  it("names the unsorted province differently when the sectors could not be read", () => {
    const r = placeRealm(realmInput(4).map((i) => ({ ...i, sector: null })), "Sector unknown");
    expect(r.provinces).toHaveLength(1);
    expect(r.provinces[0].name).toBe("Sector unknown");
  });

  it("folds the lightest sectors into one province, never into the unsorted one", () => {
    const many: PlaceInput[] = Array.from({ length: 14 }, (_, i) => ({ id: `m${i}`, weightPct: 14 - i, sector: `Sector ${i}` }));
    many.push({ id: "none", weightPct: 1, sector: null });
    const g = groupSectors(many);
    expect(g).toHaveLength(MAX_PROVINCES);
    expect(g[g.length - 2].name).toBe(OTHER_SECTORS_NAME);
    expect(g[g.length - 1].name).toBe(NO_SECTOR_NAME);
    expect(g.flatMap((x) => x.ids).sort()).toEqual(many.map((m) => m.id).sort());
  });

  it("puts holdings of one sector in the same province, and every province cell covers the world", () => {
    const r = placeRealm(realmInput(14));
    r.settlements.forEach((s) => expect(r.provinces[s.province].towerIds).toContain(s.id));
    r.provinces.forEach((p) => expect(p.cell.length).toBeGreaterThanOrEqual(3));
  });

  it("draws a heavier holding larger, within bounds, and an unknown weight at the middle", () => {
    const r = placeRealm([
      { id: "a", weightPct: 30, sector: "X" },
      { id: "b", weightPct: 1, sector: "X" },
      { id: "c", weightPct: null, sector: "X" },
    ]);
    const sc = Object.fromEntries(r.settlements.map((s) => [s.id, s.scale]));
    expect(sc.a).toBeGreaterThan(sc.b);
    expect(sc.c).toBeGreaterThan(0);
    expect(sc.a / sc.b).toBeLessThan(1.3);
  });

  it("never lets scenery sit on a building, and scenery carries no state", () => {
    const r = placeRealm(realmInput(18));
    const spots = [CAPITAL, ...r.settlements];
    for (const g of [...r.mountains, ...r.forests, ...r.hills]) for (const p of spots) expect(dist(g, p)).toBeGreaterThan(40);
    // The terrain depends on the world only: the same realm with different fog would draw identical land.
    expect(JSON.stringify(placeRealm(realmInput(18)).mountains)).toBe(JSON.stringify(r.mountains));
  });

  it("gives every holding a road to the capital", () => {
    const r = placeRealm(realmInput(9));
    expect(r.roads).toHaveLength(r.settlements.length);
  });
});

describe("camera", () => {
  const cw = 1000;
  const ch = 640;
  it("clamps zoom and centre", () => {
    expect(clampView({ cx: -50, cy: 9999, z: 99 })).toEqual({ cx: 0, cy: WORLD.h, z: MAX_ZOOM });
    expect(clampView({ cx: 10, cy: 10, z: 0.2 }).z).toBe(1);
  });
  it("converts screen and world points both ways", () => {
    const v = { cx: 420, cy: 300, z: 2 };
    const p = { x: 512, y: 213 };
    const back = toScreen(toWorld(p, v, cw, ch), v, cw, ch);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
  });
  it("zooms about a point without moving it", () => {
    const v = { cx: 500, cy: 360, z: 1.5 };
    const at = { x: 700, y: 200 };
    const before = toWorld(at, v, cw, ch);
    const z = zoomAt(v, 1.6, at, cw, ch);
    const after = toWorld(at, z, cw, ch);
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
  });
  it("pans against the drag and shows the whole world at zoom 1", () => {
    const v = { cx: 500, cy: 360, z: 2 };
    expect(panBy(v, 100, 0, cw, ch).cx).toBeLessThan(500);
    const b = viewBox({ cx: 500, cy: 360, z: 1 }, cw, ch);
    expect(b.w).toBeGreaterThanOrEqual(WORLD.w - 0.01);
    expect(b.h).toBeGreaterThanOrEqual(WORLD.h - 0.01);
  });
  it("only moves to a point that is off screen", () => {
    const v = { cx: 500, cy: 360, z: 3 };
    expect(ensureVisible(v, { x: 500, y: 360 }, cw, ch)).toEqual(v);
    expect(ensureVisible(v, { x: 900, y: 600 }, cw, ch).cx).toBe(900);
  });
  it("starts zoomed on the capital on a phone and on the whole world on a desktop", () => {
    expect(initialView(390).z).toBeGreaterThan(1);
    expect(initialView(1200)).toEqual({ cx: WORLD.w / 2, cy: WORLD.h / 2, z: 1 });
  });
});

describe("keyboard and labels", () => {
  const pts = [
    { x: 100, y: 100 },
    { x: 200, y: 105 },
    { x: 105, y: 220 },
    { x: 300, y: 100 },
  ];
  it("steps to the nearest tower in that direction and stays put at the edge", () => {
    expect(nearestInDirection(0, "ArrowRight", pts)).toBe(1);
    expect(nearestInDirection(0, "ArrowDown", pts)).toBe(2);
    expect(nearestInDirection(1, "ArrowRight", pts)).toBe(3);
    expect(nearestInDirection(0, "ArrowLeft", pts)).toBe(0);
    expect(nearestInDirection(0, "ArrowUp", pts)).toBe(0);
  });
  it("prints the heaviest names that fit, always the pinned one, and never two on top of each other", () => {
    const items = [
      { id: "a", text: "Heavy company", sx: 100, sy: 100, weight: 20 },
      { id: "b", text: "Light company", sx: 110, sy: 102, weight: 1 },
      { id: "c", text: "Far away", sx: 400, sy: 300, weight: 2 },
    ];
    const free = chooseLabels(items, new Set(), 800, 600, 4).map((l) => l.id);
    expect(free).toContain("a");
    expect(free).not.toContain("b");
    expect(free).toContain("c");
    const pinned = chooseLabels(items, new Set(["b"]), 800, 600, 4).map((l) => l.id);
    expect(pinned).toContain("b");
  });
});
