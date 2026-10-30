import { describe, expect, it } from "vitest";
import type { GameState, GameTower, JournalEntry } from "../lib/types";
import { mostSure, nameList, sixMonthReckoning, unwrittenThesis, whichWords } from "./quest";
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


const je = (id: string, name: string, o: { d6?: boolean; d12?: boolean; days?: number; conf?: number | null }): JournalEntry =>
  ({
    id, holding_id: id, ticker: name.toUpperCase(), company_name: name, thesis: "x", confidence: o.conf ?? null,
    outcome: { days_since: o.days ?? 0, review_6m_due: !!o.d6, review_12m_due: !!o.d12 },
  }) as unknown as JournalEntry;

describe("Six-Month Reckoning", () => {
  it("is loading until the journal arrives and unreadable if it fails: never a guessed status", () => {
    expect(sixMonthReckoning(null, false).status).toBe("loading");
    expect(sixMonthReckoning(null, true).status).toBe("unreadable");
    expect(sixMonthReckoning([je("a", "Alpha", { d6: true })], true).status).toBe("unreadable");
  });

  it("an empty journal is 'empty', not 'clear'", () => {
    expect(sixMonthReckoning([], false).status).toBe("empty");
  });

  it("entries with nothing due are clear, and only the service's own due flags count", () => {
    const r = sixMonthReckoning([je("a", "Alpha", { days: 400 }), je("b", "Beta", { days: 10 })], false);
    expect(r.status).toBe("clear");
    expect(r.entries).toBe(2);
    expect(r.due).toEqual([]);
  });

  it("lists due reviews oldest decision first, with which review is due", () => {
    const r = sixMonthReckoning(
      [je("a", "Alpha", { d6: true, days: 200 }), je("b", "Beta", { d6: true, d12: true, days: 400 }), je("c", "Gamma", { d12: true, days: 380 }), je("d", "Delta", { days: 5 })],
      false,
    );
    expect(r.status).toBe("open");
    expect(r.due.map((d) => [d.name, d.which])).toEqual([["Beta", "both"], ["Gamma", "12m"], ["Alpha", "6m"]]);
    expect(whichWords("both")).toBe("6 and 12 months");
  });

  it("the Partner points at the most confident due entry, else the oldest, and never invents a confidence", () => {
    const r = sixMonthReckoning([je("a", "Alpha", { d6: true, days: 300, conf: 2 }), je("b", "Beta", { d6: true, days: 200, conf: 5 })], false);
    expect(mostSure(r.due)?.name).toBe("Beta");
    const none = sixMonthReckoning([je("a", "Alpha", { d6: true, days: 300 }), je("b", "Beta", { d6: true, days: 200 })], false);
    expect(mostSure(none.due)?.name).toBe("Alpha");
    expect(mostSure([])).toBeNull();
  });
});
