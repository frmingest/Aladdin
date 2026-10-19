import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SURVEY_CHECKS } from "../../../lib/survey";
import type { SurveyState, TowerFog } from "../../../lib/survey";
import WorldMap from "./WorldMap";

function fog(id: string, name: string, state: SurveyState): TowerFog {
  const checks = SURVEY_CHECKS.map((c) => ({ ...c, state, reason: "test" }));
  return { holdingId: id, name, ticker: name.slice(0, 3).toUpperCase(), weightPct: 10, checks, clear: 0, judged: 0 };
}
const towers = [fog("a", "Alpha", "fog"), fog("b", "Beta", "clear"), fog("c", "Gamma", "not_judged")];

function render(imageMap?: boolean) {
  return renderToStaticMarkup(
    <WorldMap
      towers={towers}
      sectors={{ a: "Energy", b: "Materials", c: null }}
      sectorsKnown
      hatchId="h"
      selectedId={null}
      flags={new Map()}
      imageMap={imageMap}
      onSelect={() => undefined}
      onEscape={() => undefined}
    />,
  );
}

describe("the map on the painted picture (prototype)", () => {
  it("is off by default: the generated land, no picture of the base map", () => {
    const html = render();
    expect(html).toContain("url(#wm-sea-");
    expect(html).not.toContain("map-base");
  });

  it("draws the picture instead of sea, coast, ships and the brass frame", () => {
    const html = render(true);
    expect(html).toContain("<image");
    expect(html).not.toContain("url(#wm-sea-");
    expect(html).not.toContain("wm-drift");
    expect(html).not.toContain("wm-frame");
  });

  it("keeps everything that carries data: every settlement button, all twelve survey patches, province names and the legend", () => {
    const html = render(true);
    expect(html.match(/class="wm-tower"/g)?.length ?? 0).toBe(towers.length);
    expect(html.match(/data-patch="fog"/g)?.length ?? 0).toBe(4);
    expect(html.match(/data-patch="clear"/g)?.length ?? 0).toBe(4);
    expect(html.match(/data-patch="not-judged"/g)?.length ?? 0).toBe(4);
    expect(html).toContain("Energy");
    expect(html).toContain("Materials");
    expect(html).toContain("No sector set");
    expect(html).toContain('aria-label="Provinces"');
  });
});
