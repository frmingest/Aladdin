import { describe, expect, it } from "vitest";
import type { GameState, GameTower, JournalEntry } from "../lib/types";
import { nameList, unwrittenThesis } from "./quest";
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
const holdings = stateToWorld({
  mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null,
  towers: [
    tower({ holding_id: "a", name: "Alpha", weight_pct: "40" }),
    tower({ holding_id: "b", name: "Beta", weight_pct: "30" }),
    tower({ holding_id: "c", name: "Gamma", weight_pct: "5" }),
  ],
} as unknown as GameState).plain;
const entry = (holding_id: string | null, thesis = "because"): JournalEntry => ({ holding_id, thesis } as JournalEntry);

describe("Unwritten Thesis", () => {
  it("is loading until the journal arrives, and unreadable if it fails: never a guessed status", () => {
    expect(unwrittenThesis(holdings, null, false).status).toBe("loading");
    expect(unwrittenThesis(holdings, null, true).status).toBe("unreadable");
    expect(unwrittenThesis(holdings, [entry("a")], true).status).toBe("unreadable");
  });

  it("lists exactly the holdings with no written reason, biggest first", () => {
    const q = unwrittenThesis(holdings, [entry("c")], false);
    expect(q.status).toBe("open");
    expect(q.missing.map((m) => m.name)).toEqual(["Alpha", "Beta"]);
    expect(q.written).toBe(1);
    expect(q.total).toBe(3);
  });

  it("does not count a blank reason or an entry whose holding is gone", () => {
    const q = unwrittenThesis(holdings, [entry("a", "   "), entry(null), entry("zzz")], false);
    expect(q.missing).toHaveLength(3);
  });

  it("is done only when every holding has a reason", () => {
    expect(unwrittenThesis(holdings, [entry("a"), entry("b"), entry("c")], false).status).toBe("done");
    expect(unwrittenThesis(holdings, [entry("a"), entry("b")], false).status).toBe("open");
  });

  it("says empty, not done, when there are no holdings", () => {
    expect(unwrittenThesis([], [], false).status).toBe("empty");
  });

  it("joins names readably", () => {
    expect(nameList(["A"])).toBe("A");
    expect(nameList(["A", "B", "C"])).toBe("A, B and C");
    expect(nameList(["A", "B", "C", "D", "E", "F"], 4)).toBe("A, B, C, D and 2 more");
  });
});
