import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GameState, GameTower, NightWatch, Ravens, Raven, Standing, WatchlistRow } from "../lib/types";
import { HOLDING_SPOTS, HOLDING_SPOT_COUNT, doorPointOf } from "./outdoorPlan";
import { stateToWorld } from "./stateToWorld";
import {
  BELL_CLEAR,
  MARK_SPECS,
  PRICE_FRESH_DAYS,
  anyUnread,
  archLit,
  holdingMarks,
  litStalls,
  markAnchor,
  noticeSheets,
  placeMarks,
  plainMarkLines,
  recentRavenIds,
  stallsRead,
  unseenWireIds,
} from "./marks";
import type { MarkFacts } from "./marks";
import { MARK_WORDS } from "./marksWordsV1";

function tower(o: Partial<GameTower>): GameTower {
  return {
    holding_id: "id", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: "10", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...o,
  };
}
const world = (towers: GameTower[]) =>
  stateToWorld({ mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", towers, notes: [], siege: null } as unknown as GameState);
const many = (n: number, o: (i: number) => Partial<GameTower> = () => ({})) =>
  world(Array.from({ length: n }, (_, i) => tower({ holding_id: `h${String(i).padStart(2, "0")}`, weight_pct: String(50 - i), ...o(i) }))).plain;

const NONE: MarkFacts = { recentRavenHoldingIds: new Set(), unseenWireHoldingIds: new Set(), watchState: "ok", stallsRead: true };
const NOW = Date.parse("2026-11-15T09:00:00Z");

function row(o: Partial<WatchlistRow>): WatchlistRow {
  return { id: "r", holding_id: "w1", ticker: "W", name: "W", status: "buy_zone", price: "10", price_as_of: "2026-11-14", ...o } as WatchlistRow;
}

describe("raven mark", () => {
  const towers = many(3);
  it("stands on that holding only", () => {
    const m = holdingMarks(towers, { ...NONE, recentRavenHoldingIds: new Set(["h01"]) });
    expect(towers.map((t) => m.byHolding.get(t.holdingId)!.raven)).toEqual([false, true, false]);
  });
  it("seen or older than 48 hours gives none", () => {
    const rv = (id: string, captured_at: string): Raven => ({ id, holding_id: "h01", captured_at, name: "A", in_portfolio: true, age_days: 0 }) as unknown as Raven;
    const src = (rs: Raven[]): Ravens => ({ as_of: "2026-11-15T09:00:00Z", ravens: rs }) as unknown as Ravens;
    expect(recentRavenIds(src([rv("a", "2026-11-14T12:00:00Z")]), new Set())).toEqual(new Set(["h01"]));
    expect(recentRavenIds(src([rv("a", "2026-11-14T12:00:00Z")]), new Set(["a"]))).toEqual(new Set());
    expect(recentRavenIds(src([rv("a", "2026-11-10T12:00:00Z")]), new Set())).toEqual(new Set());
  });
  it("a raven for a holding with no building is listed off-yard, not drawn", () => {
    const m = holdingMarks(towers, { ...NONE, recentRavenHoldingIds: new Set(["stray"]) });
    expect(m.offYard).toEqual([{ holdingId: "stray", kinds: ["raven"] }]);
    expect(placeMarks(towers, m).ravens).toEqual([]);
  });
  it("beyond the yard spots: words, no 3D mark", () => {
    const big = many(HOLDING_SPOT_COUNT + 2);
    const last = big[big.length - 1].holdingId;
    const m = holdingMarks(big, { ...NONE, recentRavenHoldingIds: new Set([last]) });
    expect(m.offYard).toEqual([{ holdingId: last, kinds: ["raven"] }]);
    expect(placeMarks(big, m).ravens).toEqual([]);
    expect(plainMarkLines(big[big.length - 1], m)).toEqual([MARK_WORDS.raven]);
  });
  it("null source: no mark, unread", () => {
    const m = holdingMarks(towers, { ...NONE, recentRavenHoldingIds: null });
    expect(placeMarks(towers, m).ravens).toEqual([]);
    expect(m.sources.ravens).toBe("unread");
    expect(holdingMarks(towers, NONE).sources.ravens).toBe("read");
  });
});

describe("smoke mark", () => {
  const towers = many(2);
  const standing = (wires: unknown): Standing => ({ wires }) as unknown as Standing;
  it("an unseen wire puts smoke on its holding", () => {
    const { ids } = unseenWireIds(standing([{ tripwire_id: "t", ticker: "A", name: "A", label: null, holding_id: "h00" }]), false);
    const m = holdingMarks(towers, { ...NONE, unseenWireHoldingIds: ids });
    expect(placeMarks(towers, m).smoke.map((s) => s.id)).toEqual(["h00"]);
  });
  it("a wire without holding_id gives no smoke and leaves the source unread", () => {
    const r = unseenWireIds(standing([{ tripwire_id: "t", ticker: "A", name: "A", label: null }]), false);
    expect(r.unmatched).toBe(1);
    const m = holdingMarks(towers, { ...NONE, unseenWireHoldingIds: r.ids, wiresUnmatched: r.unmatched });
    expect(placeMarks(towers, m).smoke).toEqual([]);
    expect(m.sources.wires).toBe("unread");
  });
  it("standing not read (null, failed, or no wires field) gives none and unread", () => {
    expect(unseenWireIds(null, false).ids).toBeNull();
    expect(unseenWireIds(standing([]), true).ids).toBeNull();
    expect(unseenWireIds({} as Standing, false).ids).toBeNull();
    const m = holdingMarks(towers, { ...NONE, unseenWireHoldingIds: null });
    expect(m.sources.wires).toBe("unread");
    expect(placeMarks(towers, m).smoke).toEqual([]);
  });
  it("a watch that never ran marks wires unread, not calm", () => {
    expect(holdingMarks(towers, { ...NONE, watchState: "never" }).sources.wires).toBe("unread");
    expect(holdingMarks(towers, { ...NONE, watchState: "ok" }).sources.wires).toBe("read");
  });
});

describe("bell mark", () => {
  it("only thesis review rings; a breached holding never gets a bell", () => {
    const states = ["intact", "review", "breached", "not_analyzed", "not_applicable"] as const;
    const towers = world(states.map((thesis, i) => tower({ holding_id: `h${i}`, weight_pct: String(50 - i), thesis }))).plain;
    const m = holdingMarks(towers, NONE);
    const bells = towers.filter((t) => m.byHolding.get(t.holdingId)!.bell).map((t) => t.facts.thesis);
    expect(bells).toEqual(["review"]);
  });
  it("not analysed means the thesis source is unread; the panel says so once, a card stays empty", () => {
    const towers = many(1, () => ({ thesis: "not_analyzed" }));
    const m = holdingMarks(towers, NONE);
    expect(m.sources.thesis).toBe("unread");
    expect(anyUnread(m)).toBe(true);
    expect(plainMarkLines(towers[0], m)).toEqual([]);
  });
  it("a raven never implies the rest is quiet: Not reported follows it while any source is unread", () => {
    const towers = many(1);
    const m = holdingMarks(towers, { ...NONE, recentRavenHoldingIds: new Set(["h00"]), unseenWireHoldingIds: null });
    expect(plainMarkLines(towers[0], m)).toEqual([MARK_WORDS.raven, MARK_WORDS.unread]);
    const all = holdingMarks(towers, { ...NONE, recentRavenHoldingIds: new Set(["h00"]) });
    expect(plainMarkLines(towers[0], all)).toEqual([MARK_WORDS.raven]);
  });
  it("a lit stall is in the Plain lines", () => {
    const towers = many(1);
    expect(plainMarkLines(towers[0], holdingMarks(towers, NONE), new Set(["h00"]))).toEqual([MARK_WORDS.lamp]);
  });
});

describe("lit stall", () => {
  it("lights on buy_zone with a price 1 day old, not 9", () => {
    expect(litStalls([row({ price_as_of: "2026-11-14" })], NOW).has("w1")).toBe(true);
    expect(litStalls([row({ price_as_of: "2026-11-06" })], NOW).size).toBe(0);
    expect(PRICE_FRESH_DAYS).toBe(5);
    expect(litStalls([row({ price_as_of: "2026-11-10" })], NOW).size).toBe(1);
    expect(litStalls([row({ price_as_of: "2026-11-09" })], NOW).size).toBe(0);
  });
  it("other statuses, missing and junk dates do not light", () => {
    for (const status of ["near", "above", "no_price", "currency_mismatch", "no_target"] as const) {
      expect(litStalls([row({ status })], NOW).size).toBe(0);
    }
    expect(litStalls([row({ price_as_of: null })], NOW).size).toBe(0);
    expect(litStalls([row({ price_as_of: "yesterday-ish" })], NOW).size).toBe(0);
    expect(litStalls(null, NOW).size).toBe(0);
  });
  it("arch lamp lights only when a stall does; order does not matter", () => {
    const a = row({ holding_id: "a" });
    const b = row({ holding_id: "b", status: "near" });
    const c = row({ holding_id: "c" });
    expect(archLit(litStalls([b], NOW))).toBe(false);
    expect([...litStalls([a, b, c], NOW)].sort()).toEqual([...litStalls([c, b, a], NOW)].sort());
    expect(archLit(litStalls([a, b], NOW))).toBe(true);
  });
  it("the stalls source is read only when every price is sure and fresh", () => {
    expect(stallsRead(null, NOW)).toBe(false);
    expect(stallsRead([], NOW)).toBe(true);
    expect(stallsRead([row({})], NOW)).toBe(true);
    expect(stallsRead([row({ price_as_of: "2026-10-01" })], NOW)).toBe(false);
    expect(stallsRead([row({ status: "no_price" })], NOW)).toBe(false);
  });
});

describe("notice", () => {
  const watch = (o: Partial<NightWatch>): NightWatch =>
    ({ watch_state: "ok", last_frame_day: "2026-11-14", changes_since_last_frame: [{}, {}, {}, {}], ...o }) as unknown as NightWatch;
  it("is capped at three sheets", () => expect(noticeSheets(watch({}), NOW)).toBe(3));
  it("old frame, old or never watch, no changes: none", () => {
    expect(noticeSheets(watch({ last_frame_day: "2026-11-10" }), NOW)).toBe(0);
    expect(noticeSheets(watch({ watch_state: "old" }), NOW)).toBe(0);
    expect(noticeSheets(watch({ watch_state: "never" }), NOW)).toBe(0);
    expect(noticeSheets(watch({ changes_since_last_frame: [] }), NOW)).toBe(0);
    expect(noticeSheets(null, NOW)).toBe(0);
  });
  it("one change is one sheet", () => expect(noticeSheets(watch({ changes_since_last_frame: [{} as never] }), NOW)).toBe(1));
});

describe("anchors", () => {
  it("all yard spots: the bell stands clear of every door point", () => {
    const doors = HOLDING_SPOTS.map(doorPointOf);
    const towers = many(HOLDING_SPOT_COUNT);
    for (const t of towers) {
      const a = markAnchor(t)!;
      for (const d of doors) expect(Math.hypot(a.bell.x - d.x, a.bell.z - d.z)).toBeGreaterThanOrEqual(BELL_CLEAR);
    }
  });
  it("depends on the plot only, never on wall, moat or verdict", () => {
    const a = many(1, () => ({ wall: "basalt", moat: "wide", thesis: "intact" }))[0];
    const b = many(1, () => ({ wall: "rotted", moat: "none", thesis: "breached" }))[0];
    expect(markAnchor(a)).toEqual(markAnchor(b));
  });
  it("an off-yard tower has no anchor", () => {
    const big = many(HOLDING_SPOT_COUNT + 1);
    expect(markAnchor(big[big.length - 1])).toBeNull();
  });
});

describe("shape, not colour", () => {
  it("five marks, five distinct shapes", () => {
    expect(new Set(Object.values(MARK_SPECS).map((s) => s.shape)).size).toBe(5);
  });
  it("the new files use no state tokens and no red or green hex", () => {
    for (const f of ["marks.ts", "marksWordsV1.ts", "MarkLayer.tsx", "markRig.ts"]) {
      let src = "";
      try {
        src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
      } catch {
        continue;
      }
      expect(src).not.toMatch(/\b(positive|negative)\b/);
      for (const hex of src.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const red = r > 150 && g < 100 && b < 100;
        const green = g > 150 && r < 120 && b < 120;
        expect(red || green, `${f} ${hex}`).toBe(false);
      }
    }
  });
});

describe("words", () => {
  const lines = Object.values(MARK_WORDS);
  it("no buy, sell, add, trim or zone; no digits; at most six words", () => {
    for (const l of lines) {
      expect(l).not.toMatch(/\b(buy|sell|add|trim|zone|quiet|clear)\b/i);
      expect(l).not.toMatch(/\d/);
      expect(l.split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });
});
