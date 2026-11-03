import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PerfBreakdown from "./PerfBreakdown";
import type { PerfStats } from "./PerfProbe";

const base: PerfStats = { fps: 60, calls: 528, triangles: 139000, geometries: 210, textures: 14 };

describe("stats breakdown", () => {
  it("shows nothing until there are stats", () => {
    expect(renderToStaticMarkup(<PerfBreakdown stats={null} />)).toBe("");
  });

  it("shows memory and says it is still counting before the first walk", () => {
    const html = renderToStaticMarkup(<PerfBreakdown stats={base} />);
    expect(html).toContain("210 shapes");
    expect(html).toContain("14 textures");
    expect(html).toContain("Counting parts");
  });

  it("lists the biggest parts and how much of the renderer's total they explain", () => {
    const groups = [
      { group: "scenery", calls: 200, triangles: 31000, instanced: 0 },
      { group: "market", calls: 120, triangles: 20000, instanced: 1 },
    ];
    const html = renderToStaticMarkup(<PerfBreakdown stats={{ ...base, groups }} />);
    expect(html).toContain("scenery 200 · 31k");
    expect(html).toContain("market 120 · 20k");
    expect(html).toContain("parts add up to 320 of 528 draws");
  });

  it("folds the long tail into a count", () => {
    const groups = Array.from({ length: 13 }, (_, i) => ({ group: `g${i}`, calls: 13 - i, triangles: 1000, instanced: 0 }));
    expect(renderToStaticMarkup(<PerfBreakdown stats={{ ...base, groups }} />)).toContain("3 more");
  });
});
