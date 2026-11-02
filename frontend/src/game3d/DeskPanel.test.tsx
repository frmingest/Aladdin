import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GameState, GameTower } from "../lib/types";
import DeskPanel from "./DeskPanel";
import { stateToWorld } from "./stateToWorld";

function tower(o: Partial<GameTower>): GameTower {
  return {
    holding_id: "id", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: "10", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...o,
  };
}
const world = stateToWorld({
  mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null,
  towers: [tower({ holding_id: "a", name: "Alpha", weight_pct: "40" }), tower({ holding_id: "b", name: "Beta", weight_pct: "30" })],
} as unknown as GameState);

const noop = async () => {};
function html(block: Parameters<typeof DeskPanel>[0]["block"], missing = world.plain) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <DeskPanel holdings={world.plain} missing={missing} written={world.plain.length - missing.length} block={block} onSave={noop} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("DeskPanel (writing desk)", () => {
  it("shows the two lines, the holdings and the count in plain words", () => {
    const h = html(null);
    expect(h).toContain("Writing desk");
    expect(h).toContain("Why I own it");
    expect(h).toContain("What proves me wrong");
    expect(h).toContain("Write it down");
    expect(h).toContain("0 of 2 holdings have both lines.");
    expect(h).toContain("Alpha");
    expect(h).toContain("Beta");
  });

  it("starts with the biggest unwritten holding chosen", () => {
    expect(html(null)).toMatch(/<option value="a" selected/);
    expect(html(null, world.plain.slice(1))).toMatch(/<option value="b" selected/);
  });

  it("cannot save at first: the button is off until both lines are written", () => {
    expect(html(null)).toMatch(/<button[^>]*disabled=""[^>]*>Write it down/);
  });

  it("says why it cannot save and turns every field off (sample, unreadable)", () => {
    const sample = html("sample");
    expect(sample).toContain("Sample fortress, not yours. Nothing is saved here.");
    expect(sample).toMatch(/<textarea[^>]*disabled/);
    expect(sample).toMatch(/<select[^>]*disabled/);
    expect(html("unreadable")).toContain("Can&#x27;t read your journal right now. Nothing is saved.");
  });

  it("keeps a way to the Journal page for old entries and real buys or sells", () => {
    expect(html(null)).toContain('href="/journal"');
  });

  it("offers the old books when the journal can be read, with the count and the due look-backs", () => {
    const h = renderToStaticMarkup(
      <MemoryRouter>
        <DeskPanel holdings={world.plain} missing={world.plain} written={0} block={null} onSave={noop} onClose={() => {}} entries={3} due={2} onReadBooks={() => {}} />
      </MemoryRouter>,
    );
    expect(h).toContain("Read the old books (3)");
    expect(h).toContain("2 look-backs are due. Open the old books.");
  });

  it("says one look-back, not one look-backs", () => {
    const h = renderToStaticMarkup(
      <MemoryRouter>
        <DeskPanel holdings={world.plain} missing={world.plain} written={0} block={null} onSave={noop} onClose={() => {}} entries={1} due={1} onReadBooks={() => {}} />
      </MemoryRouter>,
    );
    expect(h).toContain("1 look-back is due.");
  });

  it("has no old-books button when the journal could not be read (no way to open nothing)", () => {
    expect(html(null)).not.toContain("Read the old books");
  });
});
