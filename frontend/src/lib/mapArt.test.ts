import { describe, expect, it } from "vitest";
import {
  COMPASS_SIZE,
  MAP_KEEP_H,
  SETTLEMENT_MAX,
  pineRect,
  placeLandmarks,
  placeMapKeep,
  placeSettlementArt,
  compassRect,
  hillArtId,
  hillRect,
  mountainArtId,
  mountainRect,
  serpentRect,
  propOnGround,
  rockRect,
  settlementArtId,
} from "./mapArt";
import { TOWER_BOX } from "./realmMap";
import { OBJECT_ART } from "./stitchArt";
import type { FortressSize, FortressStructure } from "./types";
import { CAPITAL, buildWorld, dist, isLand, placeRealm } from "./worldMap";

const SIZES: FortressSize[] = ["great", "medium", "small", "tiny", "unknown"];
const STRUCTURES: FortressStructure[] = ["keep", "outpost", "bullion", "granary"];

describe("settlementArtId", () => {
  it("makes a great stock a citadel and every other stock a town", () => {
    expect(settlementArtId({ structure: "keep", size_class: "great" })).toBe("map-citadel");
    for (const size_class of SIZES.filter((s) => s !== "great")) {
      expect(settlementArtId({ structure: "keep", size_class })).toBe("map-town");
    }
  });

  it("gives funds, gold and cash their own picture", () => {
    for (const size_class of SIZES) {
      expect(settlementArtId({ structure: "outpost", size_class })).toBe("outpost");
      expect(settlementArtId({ structure: "granary", size_class })).toBe("granary");
    }
    expect(settlementArtId({ structure: "bullion", size_class: "great" })).toBe("vault-3");
    expect(settlementArtId({ structure: "bullion", size_class: "medium" })).toBe("vault-2");
    expect(settlementArtId({ structure: "bullion", size_class: "small" })).toBe("vault-1");
    expect(settlementArtId({ structure: "bullion", size_class: "unknown" })).toBe("vault-1");
  });

  it("always returns a packed picture: unknown stays visible as fog over it, never as a missing body", () => {
    for (const structure of STRUCTURES) {
      for (const size_class of SIZES) {
        const id = settlementArtId({ structure, size_class });
        expect(OBJECT_ART[id], `${structure}/${size_class}`).toBeTruthy();
      }
    }
  });
});

describe("placeSettlementArt", () => {
  it("fits every settlement picture inside the maximum, keeping its proportions", () => {
    for (const structure of STRUCTURES) {
      for (const size_class of SIZES) {
        const id = settlementArtId({ structure, size_class });
        const r = placeSettlementArt(id);
        const art = OBJECT_ART[id];
        expect(r.width / r.height).toBeCloseTo(art.width / art.height, 5);
        expect(r.width).toBeLessThanOrEqual(SETTLEMENT_MAX.w + 1e-6);
        expect(r.height).toBeLessThanOrEqual(SETTLEMENT_MAX.h + 1e-6);
      }
    }
  });

  it("stands on the old tower box's bottom edge, centred on it, so the survey patches stay where they were", () => {
    const r = placeSettlementArt("map-town");
    expect(r.y + r.height).toBeCloseTo(TOWER_BOX.y + TOWER_BOX.h, 5);
    expect(r.x + r.width / 2).toBeCloseTo(TOWER_BOX.x + TOWER_BOX.w / 2, 5);
  });
});

describe("placeMapKeep", () => {
  it("stands the Great Keep on the capital", () => {
    const r = placeMapKeep();
    expect(r.height).toBe(MAP_KEEP_H);
    expect(r.x + r.width / 2).toBeCloseTo(CAPITAL.x, 5);
    expect(r.y + r.height).toBeGreaterThanOrEqual(CAPITAL.y);
    expect(r.y + r.height).toBeLessThanOrEqual(CAPITAL.y + 10);
  });
});

describe("props", () => {
  it("stands a prop on its ground point and keeps its proportions", () => {
    const r = propOnGround("prop-pines", 100, 200, 20);
    const art = OBJECT_ART["prop-pines"];
    expect(r.y + r.height).toBe(200);
    expect(r.x + r.width / 2).toBeCloseTo(100, 5);
    expect(r.width / r.height).toBeCloseTo(art.width / art.height, 5);
  });

  it("scales pines and rocks with the glyph, and rocks stay smaller than a settlement", () => {
    const small = pineRect({ x: 0, y: 0, s: 0.7, v: 0 });
    const big = pineRect({ x: 0, y: 0, s: 1.3, v: 0 });
    expect(big.height).toBeGreaterThan(small.height);
    expect(rockRect({ x: 0, y: 0, s: 1.3, v: 0 }).height).toBeLessThan(big.height);
  });
});

describe("placeLandmarks", () => {
  const world = buildWorld();
  const realm = placeRealm(Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, weightPct: 10 - i, sector: i % 2 ? "A" : "B" })));
  const marks = placeLandmarks(world, realm.settlements);

  it("places the port, the island sanctuary and a palm on every other islet", () => {
    expect(marks.port?.id).toBe("map-port");
    expect(marks.island?.id).toBe("map-island");
    expect(marks.palms).toHaveLength(world.islands.length - 1);
    for (const p of marks.palms) expect(p.id).toBe("prop-palms");
  });

  it("is the same every time: the realm is one place", () => {
    expect(placeLandmarks(world, realm.settlements)).toEqual(marks);
  });

  it("keeps the port clear of the capital and every settlement", () => {
    const port = marks.port!;
    const foot = { x: port.x + port.width / 2, y: port.y + port.height };
    expect(dist(foot, CAPITAL)).toBeGreaterThan(60);
    for (const s of realm.settlements) expect(dist(foot, s)).toBeGreaterThan(40);
  });

  it("stands the island sanctuary and the palms on the islets, never on the mainland", () => {
    const foot = (r: { x: number; y: number; width: number; height: number }) => ({ x: r.x + r.width / 2, y: r.y + r.height });
    const islets = { coast: [], islands: world.islands };
    expect(isLand(islets, foot(marks.island!))).toBe(true);
    for (const p of marks.palms) expect(isLand(islets, foot(p))).toBe(true);
  });

  it("copes with a world that has no islands", () => {
    const bare = placeLandmarks({ coast: world.coast, islands: [] }, []);
    expect(bare.island).toBeNull();
    expect(bare.palms).toEqual([]);
    expect(bare.port).not.toBeNull();
  });
});

describe("map scenery pictures (Sprint 6)", () => {
  const g = (v: number, s = 1) => ({ x: 100, y: 200, s, v });

  it("picks a mountain picture from the glyph's own number: bare for low, snow-capped for high, always stable", () => {
    expect(mountainArtId(g(0))).toBe("map-mountain-bare-a");
    expect(mountainArtId(g(0.3))).toBe("map-mountain-bare-b");
    expect(mountainArtId(g(0.6))).toBe("map-mountain-snow-a");
    expect(mountainArtId(g(0.999))).toBe("map-mountain-snow-b");
    expect(mountainArtId(g(1))).toBe("map-mountain-snow-b");
    expect(mountainArtId(g(0.42))).toBe(mountainArtId(g(0.42)));
  });

  it("stands a mountain on its glyph, keeping the picture's proportions", () => {
    const r = mountainRect(g(0.6, 1.2));
    const art = OBJECT_ART[r.id];
    expect(r.width / r.height).toBeCloseTo(art.width / art.height, 5);
    expect(r.x + r.width / 2).toBeCloseTo(100, 5);
    expect(r.y + r.height).toBeGreaterThan(200);
  });

  it("uses the grassy mound for most hills and rocks for the rest", () => {
    expect(hillArtId(g(0.1))).toBe("prop-rocks");
    expect(hillArtId(g(0.9))).toBe("map-hill");
    expect(hillRect(g(0.9)).id).toBe("map-hill");
    expect(hillRect(g(0.1)).id).toBe("prop-rocks");
  });

  it("centres the compass rose on its water spot and keeps it round", () => {
    const r = compassRect({ x: 800, y: 500 });
    expect(r.id).toBe("map-compass");
    expect(r.width).toBe(COMPASS_SIZE);
    expect(r.x + r.width / 2).toBeCloseTo(800, 5);
    expect(r.y + r.height / 2).toBeCloseTo(500, 5);
  });

  it("puts the serpent's coils on the water spot", () => {
    const r = serpentRect({ x: 200, y: 600 });
    expect(r.id).toBe("map-serpent");
    expect(r.x + r.width / 2).toBeCloseTo(200, 5);
  });
});
