import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SURVEY_CHECKS } from "../../../lib/survey";
import type { SurveyState, TowerFog } from "../../../lib/survey";
import mapSource from "./WorldMap.tsx?raw";
import { FogDefs, TowerFigure } from "./FogPatch";
import WorldMap from "./WorldMap";

function fog(id: string, name: string, state: SurveyState): TowerFog {
  const checks = SURVEY_CHECKS.map((c) => ({ ...c, state, reason: "test" }));
  return { holdingId: id, name, ticker: name.slice(0, 3).toUpperCase(), weightPct: 10, checks, clear: 0, judged: 0 };
}

const towers = [fog("a", "Alpha", "fog"), fog("b", "Beta", "clear"), fog("c", "Gamma", "not_judged")];

function render(kinds?: Record<string, { structure: "keep" | "outpost" | "bullion" | "granary"; size_class: "great" | "small" }>) {
  return renderToStaticMarkup(
    <WorldMap
      towers={towers}
      sectors={{ a: "Energy", b: "Energy", c: null }}
      sectorsKnown
      hatchId="h"
      selectedId={null}
      flags={new Map()}
      kinds={kinds}
      onSelect={() => undefined}
      onEscape={() => undefined}
    />,
  );
}

describe("map art stays behind the Settings switch", () => {
  it("draws no picture by default (art off), with or without kinds, and keeps every survey patch", () => {
    for (const html of [render(), render({ a: { structure: "keep", size_class: "great" }, b: { structure: "outpost", size_class: "small" }, c: { structure: "granary", size_class: "small" } })]) {
      expect(html).not.toContain("<image");
      expect(html.match(/data-patch="fog"/g)?.length ?? 0).toBe(4);
      expect(html.match(/data-patch="clear"/g)?.length ?? 0).toBe(4);
      expect(html.match(/data-patch="not-judged"/g)?.length ?? 0).toBe(4);
      expect(html.match(/class="wm-tower"/g)?.length ?? 0).toBe(towers.length);
    }
  });
});

describe("TowerFigure body", () => {
  const slots = towers[0].checks.map((c, i) => ({ index: i, id: c.id, label: c.label, state: c.state, look: {} as never, reason: "", cx: 10 + i * 10, cy: 40, r: 16 }));

  it("shows the silhouette unless a picture body is given, and always the four patches over it", () => {
    const plain = renderToStaticMarkup(<svg><FogDefs id="h" /><TowerFigure slots={slots} hatchId="h" /></svg>);
    const withBody = renderToStaticMarkup(
      <svg>
        <TowerFigure slots={slots} hatchId="h" body={<image data-test="body" href="x.webp" />} />
      </svg>,
    );
    expect(plain).toContain("<path");
    expect(withBody).toContain('data-test="body"');
    expect(withBody.match(/data-patch="fog"/g)?.length).toBe(4);
    // the survey patch comes after the picture, so fog lies over it
    expect(withBody.indexOf('data-test="body"')).toBeLessThan(withBody.indexOf('data-patch="fog"'));
  });
});

describe("WorldMap source rules for art", () => {
  it("never makes a picture carry a fact: pictures are hidden from assistive tech and fall back on error", () => {
    expect(mapSource).toContain("aria-hidden");
    expect(mapSource).toContain("onError");
  });

  it("falls back to the SVG when the art switch is off or a picture fails to load", () => {
    expect(mapSource).toContain('artMode === "stitch"');
    expect(mapSource).toContain("failedArt");
  });
});
