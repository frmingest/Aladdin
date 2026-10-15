import { describe, expect, it } from "vitest";
import { IMAGE_REGIONS } from "./imageMapRegions";
import { BASE_DY, IMAGE_K, IMAGE_OFFSET_Y, IMAGE_RECT, REGION_NAME, imageMapEnabled, placeImageRealm, regionCell, regionForSector, regionSites, type RegionId } from "./imageMap";
import { WORLD, pointInPolygon, type PlaceInput } from "./worldMap";

const item = (id: string, sector: string | null, weightPct: number | null = 5): PlaceInput => ({ id, sector, weightPct });
const worldPoly = (id: RegionId) => regionCell(id);

describe("the traced picture", () => {
  it("has the 13 regions, the islet and the Keep island", () => {
    const ids = Object.keys(IMAGE_REGIONS).sort();
    expect(ids).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "ISLET", "KEEP", "W1", "W2", "W3", "W4", "W5"]);
  });

  it("fits the picture inside the world, centred", () => {
    expect(IMAGE_RECT.width).toBe(WORLD.w);
    expect(IMAGE_RECT.y).toBeGreaterThanOrEqual(0);
    expect(IMAGE_RECT.y + IMAGE_RECT.height).toBeLessThanOrEqual(WORLD.h);
    expect(IMAGE_OFFSET_Y).toBeCloseTo((WORLD.h - 768 * IMAGE_K) / 2, 6);
  });

  it("names twelve sectors and one catch-all, all different", () => {
    const names = Object.values(REGION_NAME);
    expect(names).toHaveLength(13);
    expect(new Set(names).size).toBe(13);
    expect(names).toContain("Other sectors");
  });
});

describe("regionForSector", () => {
  const cases: [string | null, RegionId][] = [
    ["Energy", "W2"],
    ["Oil & Gas", "W2"],
    ["Materials", "W5"],
    ["Basic Materials", "W5"],
    ["Gold", "W5"],
    ["Industrials", "W1"],
    ["Consumer Staples", "W3"],
    ["Consumer Defensive", "W3"],
    ["Consumer Discretionary", "W4"],
    ["Consumer Cyclical", "W4"],
    ["Consumer", "W4"],
    ["Technology", "E2"],
    ["Information Technology", "E2"],
    ["Financials", "E4"],
    ["Financial Services", "E4"],
    ["Health care", "E3"],
    ["Healthcare", "E3"],
    ["Diversified Fund", "E7"],
    ["ETF", "E7"],
    ["Communication Services", "E5"],
    ["Real Estate", "E1"],
    ["Utilities", "E6"],
    ["Industrial Automation", "W1"],
    ["Media & Entertainment", "E5"],
    ["Something Else Entirely", "E8"],
    [null, "ISLET"],
    ["", "ISLET"],
    ["   ", "ISLET"],
  ];
  it.each(cases)("%s -> %s", (sector, region) => {
    expect(regionForSector(sector)).toBe(region);
  });
});

describe("placeImageRealm", () => {
  const book: PlaceInput[] = [
    item("gold", "Materials", 12),
    item("mine", "Materials", 6),
    item("salmon", "Consumer Staples", 4),
    item("vaar", "Energy", 8),
    item("bank", "Financials", 3),
    item("factory", "Industrials", 7),
    item("fund", "Diversified Fund", 5),
    item("mystery", null, 2),
    item("odd", "Space Tourism", 1),
  ];

  it("places every holding exactly once, in the region of its sector", () => {
    const realm = placeImageRealm(book);
    expect(realm.settlements).toHaveLength(book.length);
    expect(new Set(realm.settlements.map((s) => s.id)).size).toBe(book.length);
    for (const it of book) {
      const s = realm.settlements.find((x) => x.id === it.id)!;
      const region = regionForSector(it.sector);
      // the middle of the picture is inside its own region's outline
      expect(pointInPolygon({ x: s.x, y: s.y - BASE_DY * s.scale }, worldPoly(region))).toBe(true);
    }
  });

  it("is the same every time and does not depend on the order of the book", () => {
    const a = placeImageRealm(book);
    const b = placeImageRealm([...book].reverse());
    const at = (r: ReturnType<typeof placeImageRealm>, id: string) => {
      const s = r.settlements.find((x) => x.id === id)!;
      return [s.x, s.y, s.scale];
    };
    for (const it of book) expect(at(a, it.id)).toEqual(at(b, it.id));
    expect(JSON.stringify(placeImageRealm(book))).toBe(JSON.stringify(a));
  });

  it("keeps a sector in the same place when the weights change (the map does not move)", () => {
    const heavy = placeImageRealm(book.map((i) => (i.id === "bank" ? { ...i, weightPct: 40 } : i)));
    const light = placeImageRealm(book);
    const poly = (r: ReturnType<typeof placeImageRealm>) => r.provinces.find((p) => p.name === "Financials")!.path;
    expect(poly(heavy)).toBe(poly(light));
  });

  it("puts holdings with no sector on the dashed islet, named as unknown, and never in a sector region", () => {
    const realm = placeImageRealm(book);
    const islet = realm.provinces.find((p) => p.unsorted)!;
    expect(islet.name).toBe("No sector set");
    expect(islet.towerIds).toEqual(["mystery"]);
    expect(realm.provinces.filter((p) => p.unsorted)).toHaveLength(1);
    expect(placeImageRealm(book, "Sector unknown").provinces.find((p) => p.unsorted)!.name).toBe("Sector unknown");
  });

  it("sends a sector that matches none of the twelve to Other sectors", () => {
    const realm = placeImageRealm(book);
    expect(realm.provinces.find((p) => p.name === "Other sectors")!.towerIds).toEqual(["odd"]);
  });

  it("never spills a crowded sector into another region: 14 holdings in one region all stay inside it", () => {
    const crowd = Array.from({ length: 14 }, (_, i) => item(`h${i}`, "Utilities", 1 + (i % 5)));
    const realm = placeImageRealm(crowd);
    const poly = worldPoly("E6");
    for (const s of realm.settlements) expect(pointInPolygon({ x: s.x, y: s.y - BASE_DY * s.scale }, poly)).toBe(true);
    // pictures shrink as the region fills
    const alone = placeImageRealm([item("one", "Utilities", 3)]).settlements[0]!.scale;
    const crowded = realm.settlements.find((s) => s.id === "h2")!.scale;
    expect(crowded).toBeLessThan(alone);
  });

  it("keeps settlements apart in a normal book", () => {
    const realm = placeImageRealm(book);
    for (let i = 0; i < realm.settlements.length; i++) {
      for (let j = i + 1; j < realm.settlements.length; j++) {
        const a = realm.settlements[i]!;
        const b = realm.settlements[j]!;
        expect(Math.hypot(a.x - b.x, a.y - BASE_DY * a.scale - (b.y - BASE_DY * b.scale))).toBeGreaterThan(30);
      }
    }
  });

  it("gives the heaviest holding of a region the site nearest its heart", () => {
    const { sites } = regionSites("W5", 2);
    const realm = placeImageRealm([item("light", "Materials", 1), item("heavy", "Materials", 9)]);
    const heavy = realm.settlements.find((s) => s.id === "heavy")!;
    const w0 = { x: sites[0]!.x * IMAGE_K, y: sites[0]!.y * IMAGE_K + IMAGE_OFFSET_Y };
    expect(Math.hypot(heavy.x - w0.x, heavy.y - BASE_DY * heavy.scale - w0.y)).toBeLessThan(0.3);
  });

  it("builds a province per used region with the partition of the book, no roads or terrain, and the Keep on its island", () => {
    const realm = placeImageRealm(book);
    expect(realm.provinces.flatMap((p) => p.towerIds).sort()).toEqual(book.map((b) => b.id).sort());
    expect(realm.roads).toEqual([]);
    expect(realm.mountains).toEqual([]);
    expect(realm.keep.x).toBeGreaterThan(450);
    expect(realm.keep.x).toBeLessThan(550);
    expect(placeImageRealm([]).settlements).toEqual([]);
  });

  it("never draws terrain that depends on a state: the land is the same for any survey", () => {
    // regionCell takes only the region id: nothing about the holdings can change the drawn land
    expect(regionCell("W1")).toEqual(regionCell("W1"));
  });
});

describe("the names and pictures fit their regions", () => {
  it("never draws a picture bigger than a region can carry, and shrinks as it fills", () => {
    const one = placeImageRealm([item("a", "Energy", 12)]).settlements[0]!;
    expect(one.scale).toBeLessThanOrEqual((62 * 0.8) / 120 + 1e-9);
    const many = placeImageRealm(Array.from({ length: 6 }, (_, i) => item(`e${i}`, "Energy", 12)));
    expect(Math.max(...many.settlements.map((s) => s.scale))).toBeLessThan(one.scale);
  });

  it("puts every region's name inside the region, with a smaller type for the long ones", () => {
    const sectors = Object.values(REGION_NAME);
    const realm = placeImageRealm(sectors.map((s, i) => item(`h${i}`, s === "Other sectors" ? "Space Tourism" : s, 5)));
    expect(realm.provinces).toHaveLength(13);
    for (const p of realm.provinces) {
      expect(pointInPolygon(p.label, p.cell)).toBe(true);
      expect(p.labelFs).toBeGreaterThanOrEqual(8);
      expect(p.labelFs).toBeLessThanOrEqual(12);
    }
    const it = realm.provinces.find((p) => p.name === "Information Technology")!;
    const en = realm.provinces.find((p) => p.name === "Energy")!;
    expect(it.labelFs).toBeLessThanOrEqual(en.labelFs);
  });
});

describe("imageMapEnabled", () => {
  it("is on by default and off only for ?map=classic", () => {
    expect(imageMapEnabled("")).toBe(true);
    expect(imageMapEnabled("?map=image")).toBe(true);
    expect(imageMapEnabled("?tab=map")).toBe(true);
    expect(imageMapEnabled("?map=classic")).toBe(false);
    expect(imageMapEnabled("?tab=map&map=classic")).toBe(false);
  });
});
