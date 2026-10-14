import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../../../lib/gameMode";
import { SURVEY_CHECKS } from "../../../lib/survey";
import type { TowerFog } from "../../../lib/survey";
import WorldMap from "./WorldMap";

/** Sector landmarks follow Game mode like every other map picture (no separate switch). */
function stub(game: boolean) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

const checks = SURVEY_CHECKS.map((c) => ({ ...c, state: "fog" as const, reason: "test" }));
const tower = (holdingId: string, name: string): TowerFog => ({ holdingId, name, ticker: name.slice(0, 3), weightPct: 10, checks, clear: 0, judged: 0 });

function render(sectors: Record<string, string | null>, game: boolean) {
  stub(game);
  return renderToStaticMarkup(
    <GameModeProvider>
      <WorldMap
        towers={[tower("a", "Alpha"), tower("b", "Beta")]}
        sectors={sectors}
        sectorsKnown
        hatchId="h"
        selectedId={null}
        flags={new Map()}
        onSelect={() => undefined}
        onEscape={() => undefined}
      />
    </GameModeProvider>,
  );
}

describe("sector landmarks on the map", () => {
  it("draws a gold mine for Materials and a farmhouse for Consumer Staples with game mode on", () => {
    const html = render({ a: "Materials", b: "Consumer Staples" }, true);
    expect(html).toContain("map-gold-mine");
    expect(html).toContain("map-farmhouse");
  });

  it("draws none of them with game mode off, and keeps the provinces legend", () => {
    const html = render({ a: "Materials", b: "Consumer Staples" }, false);
    for (const id of ["map-gold-mine", "map-gold-ingots", "map-quarry", "map-farmhouse", "map-market-stall"]) expect(html).not.toContain(id);
    expect(html).toContain('aria-label="Provinces"');
  });

  it("draws no landmark for a sector without a theme or for holdings with no sector", () => {
    const html = render({ a: "Technology", b: null }, true);
    for (const id of ["map-gold-mine", "map-bank-vault", "map-farmhouse", "map-factory", "map-windmill", "map-watermill", "map-fountain-square", "map-market-stall"]) {
      expect(html, id).not.toContain(id);
    }
  });

  it("is decorative: no landmark is a button, link or labelled image", () => {
    const html = render({ a: "Materials", b: "Energy" }, true);
    expect(html).toContain("map-gold-mine");
    expect(html).not.toMatch(/<image[^>]*map-(gold-mine|windmill)[^>]*(alt=|role=|tabindex)/);
  });
});
