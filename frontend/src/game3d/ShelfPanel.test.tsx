import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameTower } from "../lib/types";
import ShelfPanel from "./ShelfPanel";
import { shelvesFor } from "./libraryShelves";

function tower(o: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: "h1", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: "10", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "Low debt.",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...o,
  };
}
const noop = () => {};

describe("ShelfPanel (plain view of the library)", () => {
  it("lists every shelf in words and opens the one you are reading", () => {
    const html = renderToStaticMarkup(<ShelfPanel name="Alpha" open="walls" shelves={shelvesFor(tower())} demo={false} onClose={noop} />);
    for (const title of ["The Walls", "The Moat", "The Land", "The Oath", "The Treasury", "The Storm Test"]) expect(html).toContain(title);
    expect(html).toContain("Granite walls");
    expect(html).toContain("Low debt.");
    // Only the shelf being read is open.
    expect(html.match(/<details[^>]* open/g)).toHaveLength(1);
  });

  it("says unknown is not surveyed, and does not apply is not applicable, with their own marks", () => {
    const shelves = shelvesFor(tower({ moat: "unsurveyed", thesis: "not_applicable" }));
    const html = renderToStaticMarkup(<ShelfPanel name="Alpha" open={null} shelves={shelves} demo={false} onClose={noop} />);
    expect(html).toContain("Not surveyed");
    expect(html).toContain("Doesn&#x27;t apply");
    expect(html).toContain("? </span>The Moat");
    expect(html).toContain("– </span>The Oath");
    expect(html).not.toContain(" open");
  });

  it("flags the sample fortress", () => {
    const html = renderToStaticMarkup(<ShelfPanel name="Alpha" open={null} shelves={shelvesFor(tower())} demo onClose={noop} />);
    expect(html).toContain("Sample fortress, not your holdings.");
  });
});
