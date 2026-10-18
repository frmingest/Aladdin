import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import WallRiseGauge from "./WallRiseGauge";
import WallsOnTheRise from "../WallsOnTheRise";
import { wallRise } from "../../../lib/wallRise";
import type { GameMargin, GameTower } from "../../../lib/types";

const up: GameMargin = {
  metric: "net_debt_to_ebitda", label: "Net debt / EBITDA", value: "2.0", boundary: "1.5", direction: "stronger",
  to_tier: "granite", distance: "0.5", near: false, text: "Net debt / EBITDA is 2.0x; granite needs 1.5x or less (0.5x away).",
};
const down: GameMargin = { ...up, boundary: "2.5", direction: "weaker", to_tier: "timber", text: "x" };
const tower = (wall: GameTower["wall"], margins: GameMargin[]): GameTower => ({
  holding_id: "h1", ticker: "TST", name: "Test AS", instrument_type: "stock", sector: null, structure: "keep",
  value_nok: null, weight_pct: null, size_class: "medium", moat: "wide", wall, wall_reason: "", wall_inputs: {},
  wall_margins: margins, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
  margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed", siege_shock_pct: null,
  siege_method: null, shared_wall_with: [],
});

const html = (el: JSX.Element) => renderToStaticMarkup(el);

describe("WallRiseGauge", () => {
  it("is named in words, with the rung and the gap", () => {
    const out = html(<WallRiseGauge rise={wallRise(tower("brick", [up, down]))!} />);
    expect(out).toContain("Brick walls, rung 3 of 5");
    expect(out).toContain("next is Granite");
    expect(out).toContain("0.5x away");
  });

  it("draws no built courses when the distance is unknown", () => {
    const out = html(<WallRiseGauge rise={wallRise(tower("brick", []))!} />);
    expect(out).toContain("not known");
    expect(out).not.toContain("motion-reduce:transition-none");
  });
});

describe("WallsOnTheRise", () => {
  it("lists keeps as pressable rows", () => {
    const out = html(
      <MemoryRouter>
        <WallsOnTheRise towers={[tower("brick", [up, down])]} selectedId={null} onSelect={() => {}} />
      </MemoryRouter>,
    );
    expect(out).toContain("Walls on the rise");
    expect(out).toContain("Granite is next");
    expect(out).toContain("Test AS");
    expect(out).toContain("<button");
  });

  it("renders nothing when no keep has a rung", () => {
    const out = html(
      <MemoryRouter>
        <WallsOnTheRise towers={[tower("unsurveyed", [])]} selectedId={null} onSelect={() => {}} />
      </MemoryRouter>,
    );
    expect(out).toBe("");
  });
});
