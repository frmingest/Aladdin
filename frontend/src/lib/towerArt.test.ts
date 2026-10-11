import { describe, expect, it } from "vitest";
import { OBJECT_ART } from "./stitchArt";
import { overlayBox, placeTowerArt, towerArtId } from "./towerArt";
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

  it("leaves outposts, gold stores and granaries to their own sprint", () => {
    for (const s of ["outpost", "bullion", "granary"] as const) expect(towerArtId(t("granite", "medium", s))).toBeNull();
  });

  it("only returns ids that have a packed picture", () => {
    for (const wall of WALLS) for (const size of SIZES) {
      const id = towerArtId(t(wall, size));
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
