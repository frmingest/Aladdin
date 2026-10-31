import { describe, expect, it } from "vitest";
import type { GameState, GameTower, JournalEntry } from "../lib/types";
import { LEVEL_NAMES, chipWords, hintWords, isNamedGap, standing } from "./standing";
import { STANDING_GAPS_V1 } from "./standingGapsV1";
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

function world(towers: GameTower[], demo = false) {
  return stateToWorld({
    mapping_version: "v1", as_of: null, demo, total_value_nok: "0", notes: [], siege: null, towers,
  } as unknown as GameState);
}

const entry = (holding_id: string | null, thesis = "because", invalidation: string | null = "if X"): JournalEntry =>
  ({ holding_id, thesis, invalidation } as JournalEntry);

const A = tower({ holding_id: "a", name: "Alpha", ticker: "AAA", weight_pct: "40" });
const B = tower({ holding_id: "b", name: "Beta", ticker: "BBB", weight_pct: "30" });
const full = [entry("a"), entry("b")];

describe("Standing", () => {
  it("is unknown, not zero, until the fortress is read", () => {
    const s = standing(null, null, false);
    expect(s.level).toBe(0);
    expect(s.unknown).toBe("state");
    expect(chipWords(s)).toBe("Standing unknown");
  });

  it("sits at 0 with no holdings, and sample data never lifts a level", () => {
    expect(standing(world([]), [], false).level).toBe(0);
    const s = standing(world([A, B], true), full, false);
    expect(s.level).toBe(0);
    expect(s.sample).toBe(true);
    expect(chipWords(s)).toBe("Sample data, no standing");
  });

  it("level 1: one real holding stands", () => {
    const s = standing(world([tower({ holding_id: "a", wall: "unsurveyed" })]), full, false);
    expect(s.level).toBe(1);
    expect(s.name).toBe("Bare Ground");
  });

  it("level 2 needs every tower surveyed: unknown wall or size stays fog and holds the level at 1", () => {
    const fogWall = tower({ holding_id: "b", name: "Beta", ticker: "BBB", wall: "unsurveyed" });
    const fogSize = tower({ holding_id: "b", name: "Beta", ticker: "BBB", size_class: "unknown" });
    for (const t of [fogWall, fogSize]) {
      const s = standing(world([A, t]), full, false);
      expect(s.level).toBe(1);
      expect(s.blockers).toEqual(["Beta"]);
    }
  });

  it("a named gap counts as surveyed, and only a listed ticker does", () => {
    const gapTicker = STANDING_GAPS_V1[0].ticker;
    const gap = tower({ holding_id: "j", name: "Jæren", ticker: gapTicker.toLowerCase(), wall: "unsurveyed" });
    expect(isNamedGap(gap)).toBe(true);
    expect(standing(world([A, gap]), null, false).level).toBe(2);
    const notListed = tower({ holding_id: "j", name: "Jæren", ticker: "ZZZ.OL", wall: "unsurveyed" });
    expect(isNamedGap(notListed)).toBe(false);
    expect(standing(world([A, notListed]), null, false).level).toBe(1);
  });

  it("level 3 needs a thesis AND an invalidation line on every holding", () => {
    const w = world([A, B]);
    expect(standing(w, full, false).level).toBe(3);
    const noLine = standing(w, [entry("a"), entry("b", "because", null)], false);
    expect(noLine.level).toBe(2);
    expect(noLine.blockers).toEqual(["Beta"]);
    expect(standing(w, [entry("a"), entry("b", "because", "   ")], false).level).toBe(2);
    expect(standing(w, [entry("a"), entry("b", "  ")], false).level).toBe(2);
  });

  it("does not count an entry for another holding or with no holding", () => {
    const w = world([A, B]);
    expect(standing(w, [entry("a"), entry("zzz"), entry(null)], false).level).toBe(2);
  });

  it("an unread or unreadable journal is unknown: level 3 is never guessed", () => {
    const w = world([A, B]);
    for (const s of [standing(w, null, false), standing(w, full, true)]) {
      expect(s.level).toBe(2);
      expect(s.unknown).toBe("journal");
    }
  });

  it("level 3 needs levels 1 and 2: every reason written does not help a fogged tower", () => {
    const fog = tower({ holding_id: "b", name: "Beta", ticker: "BBB", wall: "unsurveyed" });
    expect(standing(world([A, fog]), full, false).level).toBe(1);
    expect(standing(world([A, B], true), full, false).level).toBe(0);
  });

  it("never rises on weaker data: each step down gives a level that is the same or lower", () => {
    const fog = tower({ holding_id: "b", name: "Beta", ticker: "BBB", wall: "unsurveyed" });
    const steps = [
      standing(world([A, B]), full, false),
      standing(world([A, B]), [entry("a"), entry("b", "because", null)], false),
      standing(world([A, B]), null, false),
      standing(world([A, fog]), full, false),
      standing(world([A, B], true), full, false),
      standing(null, null, false),
    ].map((s) => s.level);
    expect(steps).toEqual([3, 2, 2, 1, 0, 0]);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
  });

  it("can go down: the same holdings lose a level when a reason goes missing", () => {
    const w = world([A, B]);
    expect(standing(w, full, false).level).toBe(3);
    expect(standing(w, [entry("a")], false).level).toBe(2);
  });

  it("keeps the chip to five words or fewer and the hint free of buy and sell words", () => {
    const w = world([A, B]);
    const all = [
      standing(null, null, false),
      standing(world([]), [], false),
      standing(world([A], true), null, false),
      standing(world([A, tower({ holding_id: "b", name: "Beta", wall: "unsurveyed" })]), full, false),
      standing(w, null, false),
      standing(w, [entry("a")], false),
      standing(w, full, false),
    ];
    for (const s of all) {
      expect(chipWords(s).split(/\s+/).filter((x) => x !== "·").length, chipWords(s)).toBeLessThanOrEqual(5);
      expect(hintWords(s)).not.toMatch(/\b(buy|sell|hold|trade)\b/i);
    }
    expect(Object.values(LEVEL_NAMES)).toEqual(["Nothing stands", "Bare Ground", "The Survey", "Reasons"]);
  });
});
