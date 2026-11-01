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

const shelf = (id: string, o: Partial<GameTower> = {}) => shelvesFor(tower(o)).find((s) => s.id === id)!;

describe("ShelfPanel (plain view of one shelf)", () => {
  it("shows only the shelf you stand at", () => {
    const html = renderToStaticMarkup(<ShelfPanel name="Alpha" shelf={shelf("walls")} demo={false} onClose={noop} />);
    expect(html).toContain("The Walls");
    expect(html).toContain("Granite walls");
    expect(html).toContain("Low debt.");
    for (const other of ["The Moat", "The Land", "The Oath", "The Treasury", "The Storm Test"]) expect(html).not.toContain(other);
    expect(html).not.toContain("<details");
  });

  it("says unknown is not surveyed, and does not apply is not applicable, with their own marks", () => {
    const fog = renderToStaticMarkup(<ShelfPanel name="Alpha" shelf={shelf("moat", { moat: "unsurveyed" })} demo={false} onClose={noop} />);
    expect(fog).toContain("Not surveyed");
    expect(fog).toContain("? </span>");
    const na = renderToStaticMarkup(<ShelfPanel name="Alpha" shelf={shelf("oath", { thesis: "not_applicable" })} demo={false} onClose={noop} />);
    expect(na).toContain("Doesn&#x27;t apply");
    expect(na).toContain("– </span>");
  });

  it("flags the sample fortress", () => {
    const html = renderToStaticMarkup(<ShelfPanel name="Alpha" shelf={shelf("walls")} demo onClose={noop} />);
    expect(html).toContain("Sample fortress, not your holdings.");
  });
});
