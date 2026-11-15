import { describe, expect, it } from "vitest";
import type { GameState, GameTower, Ravens, Standing, WatchlistRow } from "../lib/types";
import { holdingMarks, litStalls } from "./marks";
import type { MarkFacts } from "./marks";
import {
  MAX_STOPS,
  ROUND_STORAGE_KEY,
  buildRound,
  loadRound,
  pruneDone,
  ravenFactIds,
  saveRound,
  stopId,
  wireFactIds,
} from "./round";
import type { RoundFacts } from "./round";
import { ROUND_MAX_WORDS } from "./roundWordsV1";
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
const many = (n: number, o: (i: number) => Partial<GameTower> = () => ({})) =>
  stateToWorld({
    mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null,
    towers: Array.from({ length: n }, (_, i) =>
      tower({ holding_id: `h${String(i).padStart(2, "0")}`, ticker: `T${i}`, name: `Firm${i}`, weight_pct: String(50 - i), ...o(i) }),
    ),
  } as unknown as GameState).plain;

const NOW = Date.parse("2026-11-15T12:00:00Z"); // a Sunday
const TUE = Date.parse("2026-11-10T12:00:00Z");
const READ: MarkFacts = { recentRavenHoldingIds: new Set(), unseenWireHoldingIds: new Set(), watchState: "ok", stallsRead: true };

function facts(towers: ReturnType<typeof many>, mf: Partial<MarkFacts> = {}, o: Partial<RoundFacts> = {}): RoundFacts {
  return {
    towers,
    marks: holdingMarks(towers, { ...READ, ...mf }),
    ravenFacts: new Map(), wireFacts: new Map(), lit: [], names: new Map(), noticeSheets: 0, noticeDay: null,
    ...o,
  };
}
const mem = (o: Partial<{ done: string[]; since: number | null; carry: never[] }> = {}) => ({
  done: new Set(o.done ?? []), since: "since" in o ? o.since! : TUE, nowMs: NOW,
});
const words = (s: string) => s.trim().split(/\s+/).length;
const allRead = (towers: ReturnType<typeof many>) => towers; // every holding thesis "intact" in `many`

describe("the round", () => {
  it("orders stops smoke, bell, raven, stall, notice", () => {
    const t = many(5, (i) => (i === 2 ? { thesis: "review" } : {}));
    const f = facts(t, { recentRavenHoldingIds: new Set(["h01"]), unseenWireHoldingIds: new Set(["h00"]) }, {
      ravenFacts: new Map([["h01", "r1"]]), wireFacts: new Map([["h00", "w1"]]),
      lit: [{ holdingId: "h04", ticker: "NVDA" }], noticeSheets: 2, noticeDay: "2026-11-14",
    });
    const r = buildRound(f, mem());
    expect(r.stops.map((s) => s.kind)).toEqual(["smoke", "bell", "raven", "stall", "notice"]);
    expect(r.stops.map((s) => s.text)).toEqual([
      "Smoke at Firm0", "Bell: Firm2 is due a look", "A raven for Firm1", "Lamp lit at the NVDA stall", "A notice at the watch post",
    ]);
  });

  it("every line is six words or fewer, even with long names", () => {
    const t = many(2, (i) => ({ name: i === 0 ? "Very Long Company Name Holdings Group" : "Vår Energi", thesis: "review" }));
    const r = buildRound(facts(t), mem());
    expect(r.stops.length).toBe(2);
    for (const s of r.stops) expect(words(s.text)).toBeLessThanOrEqual(ROUND_MAX_WORDS);
  });

  it("caps at 7 and says 'and N more'", () => {
    const t = many(10, () => ({ thesis: "review" }));
    const r = buildRound(facts(t), mem());
    expect(MAX_STOPS).toBe(7);
    expect(r.stops).toHaveLength(7);
    expect(r.more).toBe(3);
    expect(r.moreLine).toBe("and 3 more");
  });

  it("uses no buy or sell words, no points, no streaks", () => {
    const t = many(3, () => ({ thesis: "review" }));
    const r = buildRound(facts(t, { recentRavenHoldingIds: new Set(["h00"]) }, { ravenFacts: new Map([["h00", "r"]]), lit: [{ holdingId: "h01", ticker: "X" }], noticeSheets: 1, noticeDay: "d" }), mem());
    const all = [...r.stops.map((s) => s.text), r.line ?? "", r.moreLine ?? ""].join(" ").toLowerCase();
    expect(all).not.toMatch(/\b(buy|sell|point|streak|score|xp)\b/);
  });

  it("an off-yard holding is still a stop, marked, with no walk target", () => {
    const t = many(20, (i) => (i === 19 ? { thesis: "review" } : {}));
    const r = buildRound(facts(t), mem());
    const s = r.stops.find((x) => x.kind === "bell")!;
    expect(s.holdingId).toBe("h19");
    expect(s.offYard).toBe(true);
    expect(r.stops.every((x) => x.kind !== "bell" || x.offYard)).toBe(true);
  });

  it("a raven for a company with no building is a stop, named from the names map", () => {
    const t = many(2);
    const r = buildRound(facts(t, { recentRavenHoldingIds: new Set(["stray"]) }, { ravenFacts: new Map([["stray", "r9"]]), names: new Map([["stray", "Kongsberg"]]) }), mem());
    expect(r.stops[0].text).toBe("A raven for Kongsberg");
    expect(r.stops[0].offYard).toBe(true);
  });
});

describe("ticks", () => {
  const t = many(3, (i) => (i === 1 ? { thesis: "review" } : {}));
  const f = facts(t, { recentRavenHoldingIds: new Set(["h00"]) }, { ravenFacts: new Map([["h00", "r1"]]) });
  it("a stop in the done set is ticked, others stay open", () => {
    const r = buildRound(f, mem({ done: [stopId("raven", "h00", "r1")] }));
    expect(r.stops.find((s) => s.kind === "raven")!.done).toBe(true);
    expect(r.stops.find((s) => s.kind === "bell")!.done).toBe(false);
    expect(r.open).toBe(1);
  });
  it("open stops come before ticked ones", () => {
    const r = buildRound(f, mem({ done: [stopId("bell", "h01", null)] }));
    expect(r.stops.map((s) => s.done)).toEqual([false, true]);
  });
  it("walking past ticks nothing: no done ids, nothing ticked", () => {
    expect(buildRound(f, mem()).stops.every((s) => !s.done)).toBe(true);
  });
  it("a new raven id on the same holding is a new stop and shows open again", () => {
    const f2 = { ...f, ravenFacts: new Map([["h00", "r2"]]) };
    const r = buildRound(f2, mem({ done: [stopId("raven", "h00", "r1")] }));
    expect(r.stops.find((s) => s.kind === "raven")!.done).toBe(false);
  });
  it("a bell still true tomorrow stays done", () => {
    expect(buildRound(f, mem({ done: [stopId("bell", "h01", null)] })).stops.find((s) => s.kind === "bell")!.done).toBe(true);
  });
  it("a looked-at wire that left the facts stays shown, ticked, when carried", () => {
    const gone = buildRound(facts(t), mem({ done: [stopId("smoke", "h00", "w1")] }), [
      { id: stopId("smoke", "h00", "w1"), kind: "smoke", holdingId: "h00", factId: "w1", text: "Smoke at Firm0", offYard: false, done: true },
    ]);
    expect(gone.stops.find((s) => s.kind === "smoke")!.done).toBe(true);
  });
  it("a carried stop that is not done is dropped", () => {
    const r = buildRound(facts(t), mem(), [
      { id: "smoke:h00:w1", kind: "smoke", holdingId: "h00", factId: "w1", text: "Smoke at Firm0", offYard: false, done: false },
    ]);
    expect(r.stops.some((s) => s.kind === "smoke")).toBe(false);
  });
});

describe("quiet day and the unknown state", () => {
  const t = many(3);
  it("says All quiet since the weekday only when every source is read and nothing is open", () => {
    const r = buildRound(facts(allRead(t), {}, {}), mem());
    expect(r.line).toBe("All quiet since Tuesday. Nothing to do.");
    expect(r.quiet).toBe(true);
  });
  it("a first visit never says 'since'", () => {
    const r = buildRound(facts(t), mem({ since: null }));
    expect(r.line).toBe("All quiet. Nothing to do.");
    expect(r.line).not.toMatch(/since/);
  });
  it("same day says today, not a weekday", () => {
    expect(buildRound(facts(t), { ...mem(), since: NOW - 3_600_000 }).line).toBe("All quiet today. Nothing to do.");
  });
  it("a long gap says for a while, not an ambiguous weekday or last week", () => {
    expect(buildRound(facts(t), { ...mem(), since: NOW - 20 * 86_400_000 }).line).toBe("All quiet for a while. Nothing to do.");
  });
  it.each([
    ["ravens", { recentRavenHoldingIds: null }, "The ravens did not report in"],
    ["wires", { unseenWireHoldingIds: null }, "The wires were not read"],
    ["stalls", { stallsRead: false }, "Some stalls have no fresh price"],
    ["watch", { watchState: "never" as const }, "The watch did not report in"],
  ])("an unread %s source never says quiet", (_n, mf, line) => {
    const r = buildRound(facts(t, mf as Partial<MarkFacts>), mem());
    expect(r.quiet).toBe(false);
    expect(r.line).toBe(line);
    expect(r.line).not.toMatch(/quiet|clear|nothing to do/i);
  });
  it("an unanalysed holding (thesis unread) never says quiet", () => {
    const r = buildRound(facts(many(3, (i) => (i === 0 ? { thesis: "not_analyzed" } : {}))), mem());
    expect(r.quiet).toBe(false);
    expect(r.line).toBe("Some holdings are not read yet");
  });
  it("no holdings at all is not quiet", () => {
    const r = buildRound(facts([]), mem());
    expect(r.quiet).toBe(false);
  });
  it("open stops with an unread source still say the source line, never quiet", () => {
    const r = buildRound(facts(many(2, () => ({ thesis: "review" })), { stallsRead: false }), mem());
    expect(r.open).toBe(2);
    expect(r.quiet).toBe(false);
    expect(r.line).toBe("Some stalls have no fresh price");
  });
  it("open stops with every source read have no line", () => {
    const r = buildRound(facts(many(2, () => ({ thesis: "review" }))), mem());
    expect(r.line).toBeNull();
  });
  it("everything done and every source read says the round is done, not quiet", () => {
    const t2 = many(2, (i) => (i === 0 ? { thesis: "review" } : {}));
    const r = buildRound(facts(t2), mem({ done: [stopId("bell", "h00", null)] }));
    expect(r.open).toBe(0);
    expect(r.quiet).toBe(false);
    expect(r.line).toBe("Round done. Nothing left.");
  });
});

describe("sources still loading", () => {
  const t = many(3);
  it("says nothing and never quiet while any source is pending", () => {
    const r = buildRound(facts(t, { recentRavenHoldingIds: null }), { ...mem(), pending: new Set(["ravens"] as const) });
    expect(r.line).toBeNull();
    expect(r.quiet).toBe(false);
  });
  it("pending beats an open stop's unread line too, but stops still show", () => {
    const r = buildRound(facts(many(2, () => ({ thesis: "review" })), { stallsRead: false }), { ...mem(), pending: new Set(["watch"] as const) });
    expect(r.line).toBeNull();
    expect(r.stops).toHaveLength(2);
  });
  it("once nothing is pending, a source that failed says 'did not report in'", () => {
    const r = buildRound(facts(t, { recentRavenHoldingIds: null }), { ...mem(), pending: new Set() });
    expect(r.line).toBe("The ravens did not report in");
  });
});

describe("edge cases", () => {
  it("a lamp with an empty ticker falls back to the name, then to 'A lamp is lit'", () => {
    const t = many(1);
    const a = buildRound(facts(t, {}, { lit: [{ holdingId: "h00", ticker: "" }], names: new Map([["h00", "Nvidia"]]) }), mem());
    expect(a.stops[0].text).toBe("Lamp lit at the Nvidia stall");
    const b = buildRound(facts(t, {}, { lit: [{ holdingId: "zz", ticker: " " }] }), mem());
    expect(b.stops[0].text).toBe("A lamp is lit");
    expect(b.stops[0].text).not.toMatch(/ {2}/);
  });
  it("a smoke stop with no fact id is handled and its id never matches a wire id", () => {
    const t = many(2);
    const r = buildRound(facts(t, { unseenWireHoldingIds: new Set(["h00"]) }), mem());
    const s = r.stops.find((x) => x.kind === "smoke")!;
    expect(s.factId).toBeNull();
    expect(s.id).toBe("smoke:h00:");
    expect(s.done).toBe(false);
  });
});

describe("fact ids", () => {
  it("ravenFactIds keeps the newest unseen recent raven per holding; null when not read", () => {
    const rv = (id: string, at: string) => ({ id, holding_id: "h1", captured_at: at, name: "A", in_portfolio: true, age_days: 0 });
    const src = { as_of: "2026-11-15T09:00:00Z", ravens: [rv("a", "2026-11-14T10:00:00Z"), rv("b", "2026-11-14T12:00:00Z")] } as unknown as Ravens;
    expect(ravenFactIds(src, new Set()).get("h1")).toBe("b");
    expect(ravenFactIds(src, new Set(["b"])).get("h1")).toBe("a");
    expect(ravenFactIds(null, new Set()).size).toBe(0);
  });
  it("wireFactIds keeps the lowest wire id per holding and skips wires with no holding", () => {
    const st = { wires: [{ tripwire_id: "w2", holding_id: "h1" }, { tripwire_id: "w1", holding_id: "h1" }, { tripwire_id: "w3" }] } as unknown as Standing;
    expect([...wireFactIds(st, false)]).toEqual([["h1", "w1"]]);
    expect(wireFactIds(st, true).size).toBe(0);
  });
  it("litStalls feeds the stall stops", () => {
    const rows = [{ id: "r", holding_id: "w1", ticker: "W", name: "W", status: "buy_zone", price_as_of: "2026-11-14" }] as unknown as WatchlistRow[];
    expect(litStalls(rows, NOW).has("w1")).toBe(true);
  });
});

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("remembering in this browser", () => {
  it("starts empty with no last visit", () => {
    expect(loadRound(memory())).toEqual({ lastVisit: null, done: [] });
    expect(loadRound(null)).toEqual({ lastVisit: null, done: [] });
  });
  it("round-trips last visit and done ids", () => {
    const s = memory();
    saveRound(s, { lastVisit: 123, done: ["a", "b"] });
    expect(loadRound(s)).toEqual({ lastVisit: 123, done: ["a", "b"] });
    expect(s.m.has(ROUND_STORAGE_KEY)).toBe(true);
  });
  it("damaged or foreign data is a fresh start", () => {
    const s = memory();
    s.m.set(ROUND_STORAGE_KEY, "{nope");
    expect(loadRound(s)).toEqual({ lastVisit: null, done: [] });
    s.m.set(ROUND_STORAGE_KEY, JSON.stringify({ lastVisit: "x", done: [1, "ok"] }));
    expect(loadRound(s)).toEqual({ lastVisit: null, done: ["ok"] });
  });
  it("a blocked or full storage never throws", () => {
    const bad = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
    expect(loadRound(bad)).toEqual({ lastVisit: null, done: [] });
    expect(() => saveRound(bad, { lastVisit: 1, done: [] })).not.toThrow();
  });
  it("pruneDone drops a bell that cleared (source read), keeps unread-source ones and raven/wire ids, and caps the list", () => {
    const t = many(2);
    const m = holdingMarks(t, READ).sources;
    const bell = stopId("bell", "h00", null);
    const raven = stopId("raven", "h00", "r1");
    expect(pruneDone([bell, raven], [], m)).toEqual([raven]);
    expect(pruneDone([bell], [], { ...m, thesis: "unread" })).toEqual([bell]);
    const big = Array.from({ length: 500 }, (_, i) => `raven:h:${i}`);
    expect(pruneDone(big, [], m)).toHaveLength(200);
    expect(pruneDone(big, [], m)[199]).toBe("raven:h:499");
  });
});
