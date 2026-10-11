import { describe, expect, it } from "vitest";
import { OBJECT_ART } from "./stitchArt";
import { litWindows, overlayBox, placeGreatKeep, placeTowerArt, towerArtId } from "./towerArt";
import type { FortressSize, FortressStructure, FortressWall } from "./types";

const WALLS: FortressWall[] = ["granite", "basalt", "brick", "timber", "rotted", "unsurveyed", "not_applicable"];
const SIZES: FortressSize[] = ["great", "medium", "small", "tiny", "unknown"];

const t = (wall: FortressWall, size_class: FortressSize, structure: FortressStructure = "keep") => ({
  wall,
  size_class,
  structure,
});

describe("towerArtId", () => {
  it("picks spire for great and medium, bastion for the rest, across every surveyed wall", () => {
    for (const wall of ["granite", "basalt", "brick", "timber", "rotted"] as const) {
      for (const size of SIZES) {
        const expected = `${size === "great" || size === "medium" ? "spire" : "bastion"}-${wall}`;
        expect(towerArtId(t(wall, size))).toBe(expected);
      }
    }
  });

  it("uses granite when the wall does not apply", () => {
    expect(towerArtId(t("not_applicable", "great"))).toBe("spire-granite");
    expect(towerArtId(t("not_applicable", "tiny"))).toBe("bastion-granite");
  });

  it("never returns a picture for unsurveyed walls: the ghost keep stays code", () => {
    for (const size of SIZES) expect(towerArtId(t("unsurveyed", size))).toBeNull();
  });

  it("gives each other structure its picture, whatever its wall", () => {
    for (const wall of WALLS) {
      for (const size of SIZES) {
        expect(towerArtId(t(wall, size, "outpost"))).toBe("outpost");
        expect(towerArtId(t(wall, size, "granary"))).toBe("granary");
      }
    }
  });

  it("picks the gold store's vault by size class", () => {
    expect(towerArtId(t("not_applicable", "great", "bullion"))).toBe("vault-3");
    expect(towerArtId(t("not_applicable", "medium", "bullion"))).toBe("vault-2");
    for (const size of ["small", "tiny", "unknown"] as const) {
      expect(towerArtId(t("not_applicable", size, "bullion"))).toBe("vault-1");
    }
  });

  it("only returns ids that have a packed picture", () => {
    for (const wall of WALLS) for (const size of SIZES) for (const s of ["keep", "outpost", "bullion", "granary"] as const) {
      const id = towerArtId(t(wall, size, s));
      if (id) expect(OBJECT_ART[id]).toBeDefined();
    }
  });
});

describe("placeTowerArt", () => {
  const box = { x: 100, y: 300, w: 90, h: 120 };

  it("stands the picture on the ground line, centred on the layout box", () => {
    const p = placeTowerArt("spire-granite", box);
    expect(p.left + p.width / 2).toBeCloseTo(145, 5);
    expect(p.top + p.height).toBeCloseTo(p.ground, 5);
    expect(p.ground).toBeGreaterThanOrEqual(box.y);
  });

  it("keeps the picture's own proportions and never overhangs its neighbours much", () => {
    for (const id of ["spire-granite", "bastion-granite", "bastion-rotted"] as const) {
      const art = OBJECT_ART[id];
      for (const b of [{ x: 0, y: 300, w: 118, h: 156 }, { x: 0, y: 300, w: 48, h: 62 }]) {
        const p = placeTowerArt(id, b);
        expect(p.width / p.height).toBeCloseTo(art.width / art.height, 5);
        expect(p.width).toBeLessThanOrEqual(b.w + 14 + 1e-9);
      }
    }
  });

  it("puts windows and the door inside the picture, door below the windows", () => {
    const p = placeTowerArt("spire-granite", box);
    expect(p.windows.length).toBeGreaterThan(0);
    for (const w of p.windows) {
      expect(w.cx).toBeGreaterThan(p.left);
      expect(w.cx).toBeLessThan(p.left + p.width);
      expect(w.cy).toBeGreaterThan(p.top);
      expect(w.cy).toBeLessThan(p.ground);
    }
    expect(p.door).not.toBeNull();
    expect(p.door!.bottom).toBeGreaterThan(Math.max(...p.windows.map((w) => w.cy)));
  });

  it("gives rotted pictures no windows to light", () => {
    expect(placeTowerArt("spire-rotted", box).windows).toEqual([]);
    expect(placeTowerArt("bastion-rotted", box).windows).toEqual([]);
  });

  it("hands the old overlays a body box that sits on the same ground", () => {
    const p = placeTowerArt("bastion-brick", box);
    const o = overlayBox(p, box);
    expect(o.y).toBe(box.y);
    expect(o.h).toBeGreaterThan(0);
    expect(o.w).toBeGreaterThan(0);
    expect(o.x).toBeGreaterThan(p.left);
    expect(o.x + o.w).toBeLessThan(p.left + p.width);
  });
});

describe("freshness never changes the picture", () => {
  it("draws the same picture for a fresh and an overgrown tower; light is code", () => {
    const base = { structure: "keep", size_class: "medium", wall: "brick" } as const;
    expect(towerArtId({ ...base, freshness: "fresh" } as never)).toBe(towerArtId({ ...base, freshness: "overgrown" } as never));
  });
});

describe("structure and Great Keep placement", () => {
  it("stands every low structure on its ground line, inside the layout box plus the overhang", () => {
    for (const id of ["outpost", "granary", "vault-1", "vault-2", "vault-3"] as const) {
      const box = { x: 100, y: 300, w: 90, h: 80 };
      const p = placeTowerArt(id, box);
      expect(p.top + p.height).toBeCloseTo(p.ground, 5);
      expect(p.width).toBeLessThanOrEqual(box.w + 14 + 0.001);
      expect(p.body.w).toBeGreaterThan(0);
      expect(p.door).not.toBeNull();
    }
  });

  it("centres the Great Keep on its box and stands it on the keep's ground", () => {
    const p = placeGreatKeep({ x: 405, y: 300, w: 190 });
    expect(p.left + p.width / 2).toBeCloseTo(500, 5);
    expect(p.top + p.height).toBeCloseTo(p.ground, 5);
    expect(p.door?.cx).toBeCloseTo(500, 0);
  });
});

describe("litWindows", () => {
  const ids = Array.from({ length: 60 }, (_, i) => `holding-${i}`);

  it("is stable for the same tower", () => {
    for (const id of ids) expect([...litWindows(id, 5, "fresh")]).toEqual([...litWindows(id, 5, "fresh")]);
  });

  it("lights 3-5 of 5 windows when fresh, 1-2 when weathered, none otherwise", () => {
    for (const id of ids) {
      const f = litWindows(id, 5, "fresh").size;
      const w = litWindows(id, 5, "weathered").size;
      expect(f).toBeGreaterThanOrEqual(3);
      expect(f).toBeLessThanOrEqual(5);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(2);
      expect(f).toBeGreaterThan(w);
      for (const fr of ["overgrown", "unsurveyed", "not_applicable"]) expect(litWindows(id, 5, fr).size).toBe(0);
    }
  });

  it("varies which windows and how many across towers", () => {
    expect(new Set(ids.map((id) => litWindows(id, 5, "fresh").size)).size).toBeGreaterThan(1);
    expect(new Set(ids.map((id) => [...litWindows(id, 5, "fresh")].sort().join())).size).toBeGreaterThan(3);
  });

  it("keeps fresh above weathered and indexes in range for any window count", () => {
    for (const n of [0, 1, 2, 3, 4, 5]) {
      for (const id of ids) {
        const f = litWindows(id, n, "fresh");
        const w = litWindows(id, n, "weathered");
        expect(f.size).toBeLessThanOrEqual(n);
        if (n >= 3) expect(f.size).toBeGreaterThan(w.size);
        if (n >= 1) expect(f.size).toBeGreaterThanOrEqual(1);
        for (const i of f) expect(i).toBeLessThan(n);
      }
    }
  });
});
