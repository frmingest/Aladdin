import { describe, expect, it } from "vitest";
import type { GameState, GameTower } from "../lib/types";
import { ROUND_STORAGE_KEY, buildRound, loadRound, persistRound, stopId } from "./round";
import { SAMPLE_DAY, SAMPLE_RAVEN, SAMPLE_WIRE, sampleMarks, sampleRound, sampleRoundFacts } from "./sampleRound";
import { stateToWorld } from "./stateToWorld";

function tower(i: number, o: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: `h${i}`, ticker: `T${i}`, name: `Firm${i}`, instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: String(50 - i), size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...o,
  };
}
const world = (n: number, o: (i: number) => Partial<GameTower> = () => ({})) =>
  stateToWorld({
    mapping_version: "v1", as_of: null, demo: true, total_value_nok: "0", notes: [], siege: null,
    towers: Array.from({ length: n }, (_, i) => tower(i, o(i))),
  } as unknown as GameState).plain;
const NOW = Date.parse("2026-11-15T12:00:00Z");
const STALLS = [{ holdingId: "h1", ticker: "T1" }];

describe("the sample round", () => {
  it("gives every kind of stop: smoke, bell, raven, lamp and notice", () => {
    const r = sampleRound(world(5), STALLS, new Set(), NOW);
    expect(r.stops.map((s) => s.kind).sort()).toEqual(["bell", "notice", "raven", "smoke", "stall"]);
    expect(r.quiet).toBe(false);
  });
  it("marks stand on the sample holdings in the yard, one of each", () => {
    const m = sampleMarks(world(5));
    const on = (k: "raven" | "smoke" | "bell") => [...m.byHolding.values()].filter((v) => v[k]).length;
    expect([on("raven"), on("smoke"), on("bell")]).toEqual([1, 1, 1]);
  });
  it("is the same every time (fixed, not random)", () => {
    expect(sampleRound(world(5), STALLS, new Set(), NOW)).toEqual(sampleRound(world(5), STALLS, new Set(), NOW));
  });
  it("ignores a real thesis 'review' flag: the bell is the sample's own", () => {
    const m = sampleMarks(world(5, () => ({ thesis: "review" })));
    expect([...m.byHolding.values()].filter((v) => v.bell)).toHaveLength(1);
  });
  it("has no lamp when the sample has no stall, and never invents one", () => {
    const r = sampleRound(world(5), [], new Set(), NOW);
    expect(r.stops.some((s) => s.kind === "stall")).toBe(false);
  });
  it("with no towers there is no holding mark, only the notice, and never 'All quiet'", () => {
    const r = sampleRound([], [], new Set(), NOW);
    expect(r.stops.map((s) => s.kind)).toEqual(["notice"]);
    expect(r.line ?? "").not.toMatch(/All quiet/);
  });
  it("ticking every stop says the round is done, not 'All quiet' (the sample has things to do)", () => {
    const open = sampleRound(world(5), STALLS, new Set(), NOW);
    const r = sampleRound(world(5), STALLS, new Set(open.stops.map((s) => s.id)), NOW);
    expect(r.open).toBe(0);
    expect(r.line).toBe("Round done. Nothing left.");
    expect(r.line).not.toMatch(/quiet/i);
  });
  it("says fog, not calm, when a sample source is not read (a tower not analysed)", () => {
    const r = sampleRound(world(5, (i) => (i === 3 ? { thesis: "unknown" as never } : {})), STALLS, new Set(), NOW);
    expect(r.line).toBe("Some holdings are not read yet");
  });
  it("uses sample fact ids, so a real raven, wire or frame day can never tick or fill a stop", () => {
    const f = sampleRoundFacts(world(5), STALLS);
    expect([...f.ravenFacts.values()]).toEqual([SAMPLE_RAVEN]);
    expect([...f.wireFacts.values()]).toEqual([SAMPLE_WIRE]);
    expect(f.noticeDay).toBe(SAMPLE_DAY);
    const smoke = sampleRound(world(5), STALLS, new Set(), NOW).stops.find((s) => s.kind === "smoke")!;
    expect(smoke.id).toBe(stopId("smoke", smoke.holdingId, SAMPLE_WIRE));
  });
  it("takes no real facts at all: its inputs are towers and stall names only", () => {
    expect(sampleRound.length).toBe(4);
    expect(sampleRoundFacts.length).toBe(2);
    expect(buildRound).toBeTypeOf("function");
  });
  it("sample ticks and last visit never reach the real storage key", () => {
    const calls: string[] = [];
    const storage = { getItem: () => null, setItem: (k: string) => void calls.push(k) };
    expect(persistRound(storage, true, { lastVisit: 1, done: ["smoke:h0:sample-wire"] })).toBe(false);
    expect(calls).toEqual([]);
    expect(persistRound(storage, false, { lastVisit: 1, done: [] })).toBe(true);
    expect(calls).toEqual([ROUND_STORAGE_KEY]);
  });
  it("the real saved round does not change what the sample shows", () => {
    const storage = { getItem: () => JSON.stringify({ lastVisit: 5, done: ["smoke:h0:sample-wire"] }), setItem: () => {} };
    expect(loadRound(storage).done).toHaveLength(1);
    const r = sampleRound(world(5), STALLS, new Set(), NOW);
    expect(r.open).toBe(5);
  });
});
