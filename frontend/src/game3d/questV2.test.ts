import { describe, expect, it } from "vitest";
import type { GameState, GameTower, JournalEntry } from "../lib/types";
import { entryIsWritten, unwrittenThesisV2 } from "./questV2";
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
const entry = (holding_id: string | null, thesis: string | null, invalidation: string | null): JournalEntry =>
  ({ holding_id, thesis, invalidation } as JournalEntry);

describe("Unwritten Thesis, version 2", () => {
  it("is loading until the journal arrives, and unreadable if it fails: never a guessed status", () => {
    expect(unwrittenThesisV2(holdings, null, false).status).toBe("loading");
    expect(unwrittenThesisV2(holdings, null, true).status).toBe("unreadable");
    expect(unwrittenThesisV2(holdings, [entry("a", "why", "wrong")], true).status).toBe("unreadable");
  });

  it("is empty with no holdings", () => {
    expect(unwrittenThesisV2([], [], false).status).toBe("empty");
  });

  it("counts a holding only when the same entry has a reason AND a wrong-if line", () => {
    const q = unwrittenThesisV2(holdings, [entry("a", "why", "wrong"), entry("b", "why", null), entry("c", "why", "   ")], false);
    expect(q.status).toBe("open");
    expect(q.written).toBe(1);
    expect(q.missing.map((m) => m.holdingId)).toEqual(["b", "c"]);
  });

  it("does not add a reason from one entry to a wrong-if line from another (same test as Level 3)", () => {
    const q = unwrittenThesisV2(holdings, [entry("a", "why", null), entry("a", "", "wrong")], false);
    expect(q.written).toBe(0);
  });

  it("is done when every holding has both lines, and ignores entries with no holding", () => {
    const all = [entry("a", "1", "x"), entry("b", "2", "y"), entry("c", "3", "z"), entry(null, "g", "g")];
    const q = unwrittenThesisV2(holdings, all, false);
    expect(q.status).toBe("done");
    expect(q.written).toBe(3);
    expect(q.missing).toEqual([]);
  });

  it("entryIsWritten trims blanks", () => {
    expect(entryIsWritten({ holding_id: "a", thesis: " x ", invalidation: " y " })).toBe(true);
    expect(entryIsWritten({ holding_id: "a", thesis: "x", invalidation: "" })).toBe(false);
    expect(entryIsWritten({ holding_id: null, thesis: "x", invalidation: "y" })).toBe(false);
  });
});
