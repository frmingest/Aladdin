import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { REALM_LEVEL_LABEL, summarizeRealm } from "../lib/realmVerdict";
import type { GameState, GameTower } from "../lib/types";
import RealmPanel from "./RealmPanel";
import { pennantLook } from "./realmPlan";
import { REALM_PLATE } from "./realmWordsV1";

function tower(o: Partial<GameTower>): GameTower {
  return {
    holding_id: "id", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: "50", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "full_price", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "sheltered",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...o,
  };
}

function stateOf(towers: GameTower[], siege: "calm" | "besieged" | null = "calm"): GameState {
  return {
    mapping_version: "v1", as_of: null, demo: false, total_value_nok: "2000", notes: [],
    siege: siege ? { level: siege, reasons: [] } : null,
    vault: { level: "stocked", cash_share_pct: "10" },
    diworsification: { position_count: towers.length, top1_pct: "50", top5_pct: "100", shantytown: "none" },
    temperament: null,
    towers,
  } as unknown as GameState;
}

function html(state: GameState) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RealmPanel state={state} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("RealmPanel (the realm post's panel)", () => {
  it("shows the flat verdict card's own level and headline, with a link to the flat page and a labelled close button", () => {
    const state = stateOf([tower({ holding_id: "a" }), tower({ holding_id: "b", name: "Beta" })]);
    const v = summarizeRealm(state);
    const h = html(state);
    expect(h).toContain("The whole fortress");
    expect(h).toContain(REALM_LEVEL_LABEL[v.level]);
    expect(h).toContain('href="/fortress"');
    expect(h).toContain("Open the flat page");
    expect(h).toContain('aria-label="Close"');
  });

  it("agrees with the pennant: the level on the post is the level the card shows", () => {
    for (const state of [
      stateOf([tower({ wall: "rotted", weight_pct: "60" }), tower({ holding_id: "b", name: "Beta", weight_pct: "40" })]),
      stateOf([tower({ holding_id: "a", thesis: "breached" })]),
      stateOf([]),
    ]) {
      const level = summarizeRealm(state).level;
      expect(pennantLook(level).level).toBe(level);
      expect(html(state)).toContain(REALM_LEVEL_LABEL[level]);
      expect(REALM_PLATE[level]).toBeTruthy();
    }
  });

  it("says a tower that was never surveyed is unknown, not sound (the card's rule, kept)", () => {
    const state = stateOf([tower({ holding_id: "a", freshness: "unsurveyed", wall: "unsurveyed", weight_pct: "100" })]);
    expect(summarizeRealm(state).level).toBe("unknown");
    expect(html(state)).toContain(REALM_LEVEL_LABEL.unknown);
  });
});
