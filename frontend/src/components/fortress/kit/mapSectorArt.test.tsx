import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../../../lib/gameMode";
import { sectorArtId, type SettlementKind } from "../../../lib/mapArt";
import { SURVEY_CHECKS } from "../../../lib/survey";
import type { TowerFog } from "../../../lib/survey";
import WorldMap from "./WorldMap";

/** Sector pictures follow Game mode like every other map picture (no separate switch). */
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
const SECTOR_IDS = ["map-gold-mine", "map-gold-ingots", "map-quarry", "map-farmhouse", "map-market-stall", "map-bank-vault", "map-factory", "map-windmill", "map-watermill", "map-fountain-square"];

function render(sectors: Record<string, string | null>, game: boolean, kinds?: Record<string, SettlementKind>) {
  stub(game);
  return renderToStaticMarkup(
    <GameModeProvider>
      <WorldMap
        towers={[tower("a", "Alpha"), tower("b", "Beta")]}
        sectors={sectors}
        sectorsKnown
        kinds={kinds}
        hatchId="h"
        selectedId={null}
        flags={new Map()}
        onSelect={() => undefined}
        onEscape={() => undefined}
      />
    </GameModeProvider>,
  );
}

describe("sector pictures are the map's towers", () => {
  it("draws each holding as its sector's picture with game mode on", () => {
    const html = render({ a: "Materials", b: "Consumer Staples" }, true);
    expect(html).toContain(sectorArtId("Materials", "a")!);
    expect(html).toContain(sectorArtId("Consumer Staples", "b")!);
  });

  it("draws gold as gold bars when the holding is the bullion structure", () => {
    const html = render({ a: "Materials", b: "Industrials" }, true, { a: { structure: "bullion", size_class: "medium" } });
    expect(html).toContain("map-gold-ingots");
    expect(html).toContain("map-factory");
    expect(html).not.toContain("vault-2");
  });

  it("draws none of them with game mode off, and keeps the provinces legend and the survey patches", () => {
    const html = render({ a: "Materials", b: "Consumer Staples" }, false);
    for (const id of SECTOR_IDS) expect(html).not.toContain(id);
    expect(html).toContain('aria-label="Provinces"');
  });

  it("keeps the structure picture for a holding in an unthemed sector or with no sector", () => {
    const html = render({ a: "Technology", b: null }, true, { a: { structure: "keep", size_class: "great" }, b: { structure: "outpost", size_class: "small" } });
    for (const id of SECTOR_IDS) expect(html, id).not.toContain(id);
    expect(html).toContain("map-citadel");
    expect(html).toContain("outpost");
  });

  it("keeps the five survey patches drawn by code over the picture, and the picture decorative", () => {
    const html = render({ a: "Materials", b: "Energy" }, true);
    expect(html).toContain(sectorArtId("Materials", "a")!);
    expect(html).toContain("<image");
    expect(html).not.toMatch(/<image[^>]*(alt=|role=|tabindex)/);
    expect((html.match(/wm-tower/g) ?? []).length).toBe(2);
  });
});
