import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "../../../lib/artManifest";
import { SURVEY_CHECKS } from "../../../lib/survey";
import type { TowerFog } from "../../../lib/survey";
import WorldMap from "./WorldMap";

const checks = SURVEY_CHECKS.map((c) => ({ ...c, state: "fog" as const, reason: "test" }));
const towers: TowerFog[] = [{ holdingId: "a", name: "Alpha", ticker: "ALP", weightPct: 10, checks, clear: 0, judged: 0 }];

describe("the map table frame stays behind the Settings switch (Sprint 13)", () => {
  const html = renderToStaticMarkup(
    <WorldMap
      towers={towers}
      sectors={{ a: "Energy" }}
      sectorsKnown
      hatchId="h"
      selectedId={null}
      flags={new Map()}
      onSelect={() => undefined}
      onEscape={() => undefined}
    />,
  );

  it("draws no frame corner, dividers or rolled map with art off, and keeps the legend and the zoom buttons", () => {
    expect(html).not.toContain("wm-frame");
    expect(html).not.toContain("wm-tools");
    expect(html).not.toContain("<img");
    expect(html).toContain('aria-label="Provinces"');
    expect(html).toContain('aria-label="Zoom in"');
  });

  it("has the three pictures packed for when it is on", () => {
    expect(Object.keys(ART_MANIFEST)).toEqual(expect.arrayContaining(["map-frame-corner", "map-dividers", "map-rolled"]));
  });
});
