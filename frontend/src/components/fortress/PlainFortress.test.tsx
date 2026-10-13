import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PlainFortress from "./PlainFortress";
import { layoutTowers } from "../../lib/fortress";
import type { GameTower } from "../../lib/types";

function tower(overrides: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: overrides.holding_id ?? "id",
    ticker: "AAA",
    name: "Alpha",
    instrument_type: "stock",
    sector: null,
    structure: "keep",
    value_nok: "1000",
    weight_pct: "10",
    size_class: "medium",
    moat: "wide",
    wall: "granite",
    wall_reason: "net debt / EBITDA 0.8x",
    wall_inputs: {},
    freshness: "fresh",
    analysis_age_days: 10,
    verdict_rating: "Buy",
    land: "fog",
    land_reason: "",
    margin_of_safety_pct: null,
    thesis: "intact",
    tripwires_fired: 0,
    siege_exposure: "unsurveyed",
    siege_shock_pct: null,
    siege_method: null,
    shared_wall_with: [],
    ...overrides,
  };
}

function html(towers: GameTower[], extra: { selectedId?: string | null; realmSelected?: boolean } = {}): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PlainFortress
        layout={layoutTowers(towers)}
        totalValueNok="5000"
        realmLevel="mixed"
        realmSelected={extra.realmSelected ?? false}
        onRealmSelect={() => undefined}
        selectedId={extra.selectedId ?? null}
        onSelect={() => undefined}
      />
    </MemoryRouter>,
  );
}

const towers = [
  tower({ holding_id: "a", name: "Alpha", weight_pct: "30" }),
  tower({ holding_id: "b", name: "Beta", weight_pct: "20", wall: "rotted", thesis: "breached", tripwires_fired: 1 }),
  tower({ holding_id: "c", name: "Gamma", weight_pct: "10", land: "bargain", margin_of_safety_pct: "35" }),
];

describe("PlainFortress", () => {
  it("shows the Great Keep and one block per holding with its facts as words", () => {
    const out = html(towers);
    expect(out).toContain(">Great Keep<");
    for (const name of ["Alpha", "Beta", "Gamma"]) expect(out).toContain(`>${name}</h3>`);
    expect(out.match(/Wide moat/g)).toHaveLength(3);
    expect(out).toContain("Rotted walls");
    expect(out).toContain("1 tripwire fired");
    expect(out).toContain("For sale");
    expect(out).toContain("35.0% margin of safety");
    expect(out).toContain("Mixed");
  });

  it("puts the keep between the towers of the first row, in the scene's order", () => {
    const out = html(towers);
    const positions = ["Alpha", "Beta", "Gamma", "Great Keep"].map((n) => out.indexOf(`>${n}</h3>`));
    expect(positions.every((p) => p > -1)).toBe(true);
    const layout = layoutTowers(towers);
    const left = layout.items.filter((i) => i.row === 0 && i.x < layout.keep.x).length;
    const keepIdx = out.indexOf(">Great Keep</h3>");
    const before = layout.items.filter((i) => i.row === 0).sort((a, b) => a.x - b.x).slice(0, left);
    for (const b of before) expect(out.indexOf(`>${b.tower.name}</h3>`)).toBeLessThan(keepIdx);
  });

  it("marks only the block that needs a look, in words", () => {
    const out = html(towers);
    expect(out.match(/Needs a look/g)).toHaveLength(1);
  });

  it("says which block is selected in words, not only by its border", () => {
    const out = html(towers, { selectedId: "a" });
    expect(out.match(/Selected: survey below/g)).toHaveLength(1);
    expect(out).toContain("Open the survey");
    expect(html(towers, { realmSelected: true })).toContain("Selected: verdict below");
  });

  it("links each block to its holding page and hides its buttons when printed", () => {
    const out = html(towers);
    for (const id of ["a", "b", "c"]) expect(out).toContain(`href="/holdings/${id}"`);
    expect(out).toContain("print:hidden");
  });

  it("draws no picture: no svg, canvas or image", () => {
    const out = html(towers);
    expect(out).not.toMatch(/<svg|<canvas|<img/);
  });
});
