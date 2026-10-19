import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DIVE_MS, DIVE_ZOOM, SCENES, SCENE_IDS, diveView, irisOrigin, irisRadius, sceneFor } from "./mapScenes";
import { MAX_ZOOM } from "./worldMap";

describe("sceneFor", () => {
  it("gives gold and metals the mines, by sector, name or structure", () => {
    expect(sceneFor({ sector: "Materials" })).toBe("mines");
    expect(sceneFor({ sector: "Metals & Mining" })).toBe("mines");
    expect(sceneFor({ sector: "Diversified / Fund", name: "Xetra-Gold ETC" })).toBe("mines");
    expect(sceneFor({ sector: null, name: "Invesco Physical Gold ETC" })).toBe("mines");
    expect(sceneFor({ sector: "Financials", name: "Anything", structure: "bullion" })).toBe("mines");
    expect(sceneFor({ sector: "Basic Resources", name: "Gold Miners UCITS ETF" })).toBe("mines");
  });

  it("sends defence and industry to the forge, power and energy to the mill, food to the farm", () => {
    expect(sceneFor({ sector: "Industrials" })).toBe("forge");
    expect(sceneFor({ sector: "Aerospace & Defense" })).toBe("forge");
    expect(sceneFor({ sector: "Energy" })).toBe("mill");
    expect(sceneFor({ sector: "Utilities" })).toBe("mill");
    expect(sceneFor({ sector: "Consumer Staples" })).toBe("farm");
    expect(sceneFor({ sector: "Agriculture" })).toBe("farm");
  });

  it("sends health care to the apothecary and consumer discretionary to the workshop", () => {
    expect(sceneFor({ sector: "Health Care" })).toBe("clinic");
    expect(sceneFor({ sector: "Pharmaceuticals & Biotech" })).toBe("clinic");
    expect(sceneFor({ sector: "Consumer Discretionary" })).toBe("workshop");
    expect(sceneFor({ sector: "Retail" })).toBe("workshop");
    expect(sceneFor({ sector: "Consumer Staples" })).toBe("farm");
  });

  it("sends financials to the counting house and information technology to the guild hall", () => {
    expect(sceneFor({ sector: "Financials" })).toBe("bank");
    expect(sceneFor({ sector: "Banks" })).toBe("bank");
    expect(sceneFor({ sector: "Insurance" })).toBe("bank");
    expect(sceneFor({ sector: "Information Technology" })).toBe("tech");
    expect(sceneFor({ sector: "Software & Services" })).toBe("tech");
    expect(sceneFor({ sector: "Communication Services" })).toBe("tech");
  });

  it("sends money to the exchange, and so does anything with no scene of its own", () => {
    expect(sceneFor({ sector: "Diversified / Fund" })).toBe("exchange");
    expect(sceneFor({ sector: "Real Estate" })).toBe("exchange");
    expect(sceneFor({ sector: null })).toBe("exchange");
    expect(sceneFor({})).toBe("exchange");
  });

  it("does not take a metal word buried in a company name for the trade", () => {
    expect(sceneFor({ sector: "Information Technology", name: "Materialise NV" })).toBe("tech");
  });

  it("is decided by the holding's own facts only: the same input always gives the same scene", () => {
    const a = sceneFor({ sector: "Energy", name: "Equinor" });
    expect(sceneFor({ sector: "Energy", name: "Equinor" })).toBe(a);
  });
});

describe("scene pictures", () => {
  it("has a picture, a short kicker and no text-heavy copy for every scene", () => {
    for (const id of SCENE_IDS) {
      const s = SCENES[id];
      expect(s.src, id).toBeTruthy();
      expect(s.kicker.split(/\s+/).length, id).toBeLessThanOrEqual(5);
      expect(s.width / s.height).toBeCloseTo(16 / 9, 1);
    }
    expect([...SCENE_IDS].sort()).toEqual(["bank", "clinic", "exchange", "farm", "forge", "mill", "mines", "tech", "workshop"]);
  });

  it("keeps each shipped picture under the 150 KB image guard", () => {
    for (const id of SCENE_IDS) {
      const kb = statSync(resolve(__dirname, `../assets/map/scenes/${id}.webp`)).size / 1024;
      expect(kb, id).toBeLessThanOrEqual(150);
    }
  });
});

describe("the dive", () => {
  const box = { cw: 1000, ch: 560 };
  it("centres on the settlement and goes in close, but never past the map's ceiling", () => {
    const v = diveView({ cx: 500, cy: 360, z: 1 }, { x: 400, y: 300 }, box.cw, box.ch);
    expect(v.cx).toBe(400);
    expect(v.cy).toBe(300);
    expect(v.z).toBe(DIVE_ZOOM);
    expect(diveView({ cx: 0, cy: 0, z: 9 }, { x: 1, y: 1 }, box.cw, box.ch).z).toBe(MAX_ZOOM);
  });

  it("never zooms out when already closer than the dive", () => {
    expect(diveView({ cx: 500, cy: 360, z: 4 }, { x: 400, y: 300 }, box.cw, box.ch).z).toBe(4);
  });

  it("opens the iris wide enough to cover the whole box from any point", () => {
    for (const p of [{ x: 0, y: 0 }, { x: 500, y: 280 }, { x: 1000, y: 560 }, { x: 120, y: 500 }]) {
      const r = irisRadius(p, box.cw, box.ch);
      for (const c of [{ x: 0, y: 0 }, { x: box.cw, y: 0 }, { x: 0, y: box.ch }, { x: box.cw, y: box.ch }]) {
        expect(Math.hypot(c.x - p.x, c.y - p.y)).toBeLessThanOrEqual(r);
      }
    }
  });

  it("keeps the iris origin inside the box", () => {
    expect(irisOrigin({ x: -40, y: 900 }, box.cw, box.ch)).toEqual({ x: 0, y: box.ch });
    expect(irisOrigin({ x: 300, y: 200 }, box.cw, box.ch)).toEqual({ x: 300, y: 200 });
  });

  it("starts the iris while the camera is still flying, and ends the iris after the camera lands", () => {
    expect(DIVE_MS.irisAt).toBeLessThan(DIVE_MS.fly);
    expect(DIVE_MS.irisAt + DIVE_MS.iris).toBeGreaterThanOrEqual(DIVE_MS.fly - 100);
  });
});

describe("the scene stylesheet", () => {
  const css = readFileSync(resolve(__dirname, "../components/fortress/kit/sceneDive.css"), "utf-8");
  it("moves nothing for reduced motion: every animation sits behind no-preference", () => {
    const before = css.split("@media (prefers-reduced-motion: no-preference)")[0];
    expect(before).not.toMatch(/animation\s*:/);
  });
  it("uses no filter (phone performance)", () => {
    expect(css).not.toMatch(/filter\s*:|backdrop-filter/);
  });
});
