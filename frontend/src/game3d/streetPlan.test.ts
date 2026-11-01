import { describe, expect, it } from "vitest";
import { orderStreet } from "../lib/marketplace";
import { TONE_FLAG, gapLabel } from "../lib/marketStreet";
import type { WatchlistRow } from "../lib/types";
import { COBBLE_RADIUS, towerSpots } from "./layout";
import { DESK } from "./desk";
import { MARKET } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { SIGN } from "./signpost";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";
import { SPAWN } from "./layout";
import {
  MAX_STALLS, PLATE_NAME_CHARS, PENNANT_COLOUR, PENNANT_SHAPE, STALL_MODELS, STALL_SOLID, STREET_PLOTS, buildStreet, plateWords, stableIndex, streetOverflowLine,
} from "./streetPlan";

const row = (n: number, over: Partial<WatchlistRow> = {}): WatchlistRow =>
  ({
    id: `w${n}`, holding_id: `h${n}`, ticker: `T${n}`, name: `Company ${String(n).padStart(2, "0")}`, sector: null, instrument_type: "equity",
    owned: false, buy_below_price: "100", buy_below_currency: "NOK", notes: null, added_at: "2026-01-01", price: "90", price_currency: "NOK",
    price_as_of: null, distance_to_buy_pct: "-10", status: "buy_zone", dcf_base: null, margin_of_safety_base: null, ...over,
  }) as unknown as WatchlistRow;

describe("Market Street plots", () => {
  it("stand on the cobbles, clear of towers, props, people, scenery, the corner, the sign and the spawn point", () => {
    const things = [
      ...towerSpots().map((s, i) => ({ id: `tower-${i}`, x: s.x, z: s.z, r: 3.4 })),
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, r: 0.8 })),
      ...TOWNSFOLK.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.8 })),
      ...SCENERY.filter((s) => s.y === 0).map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.solid })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      { id: "desk", ...DESK, r: 1.2 },
      { id: "sign", ...SIGN, r: 1 },
      { id: "spawn", x: SPAWN.x, z: SPAWN.z, r: 2 },
    ];
    const half = Math.hypot(STALL_SOLID.hx, STALL_SOLID.hz);
    for (const [i, p] of STREET_PLOTS.entries()) {
      expect(Math.hypot(p.x, p.z), `plot ${i} on cobbles`).toBeLessThan(COBBLE_RADIUS + 0.6);
      for (const t of things) expect(Math.hypot(p.x - t.x, p.z - t.z), `plot ${i} vs ${t.id}`).toBeGreaterThan(half + t.r + 0.8);
    }
  });

  it("keep the stalls apart so you can walk between them", () => {
    for (let i = 0; i < STREET_PLOTS.length; i++)
      for (let j = i + 1; j < STREET_PLOTS.length; j++)
        expect(Math.hypot(STREET_PLOTS[i].x - STREET_PLOTS[j].x, STREET_PLOTS[i].z - STREET_PLOTS[j].z), `${i}-${j}`).toBeGreaterThan(3.9);
  });
});

describe("buildStreet", () => {
  it("is empty for no watchlist, never invents a stall", () => {
    for (const rows of [null, undefined, []]) {
      const s = buildStreet(rows);
      expect(s.stalls).toEqual([]);
      expect(s.overflow).toEqual([]);
    }
  });

  it("gives one stall per company in the flat page's street order, with a stand each", () => {
    const rows = [
      row(3, { status: "above", distance_to_buy_pct: "20" }),
      row(1, { status: "buy_zone", distance_to_buy_pct: "-5" }),
      row(2, { status: "near", distance_to_buy_pct: "4" }),
      row(4, { status: "no_target", buy_below_price: null, distance_to_buy_pct: null }),
    ];
    const s = buildStreet(rows);
    expect(s.stalls.map((x) => x.holdingId)).toEqual(orderStreet(rows).map((r) => r.holding_id));
    expect(s.stalls.map((x) => x.holdingId)).toEqual(["h1", "h2", "h3", "h4"]);
    s.stalls.forEach((st, i) => expect([st.x, st.z]).toEqual([STREET_PLOTS[i].x, STREET_PLOTS[i].z]));
    expect(s.overflow).toEqual([]);
  });

  it("draws at most as many stalls as there are plots and lists the rest", () => {
    const rows = Array.from({ length: 24 }, (_, i) => row(i + 1, { status: "above", distance_to_buy_pct: String(i + 1) }));
    const s = buildStreet(rows);
    expect(s.stalls).toHaveLength(MAX_STALLS);
    expect(s.overflow).toHaveLength(24 - MAX_STALLS);
    expect(s.stalls.length + s.overflow.length).toBe(24);
    expect(new Set(s.stalls.map((x) => x.holdingId)).size).toBe(MAX_STALLS);
  });

  it("takes the words and tone from the flat page, and the shape follows the tone", () => {
    const s = buildStreet([
      row(1, { status: "buy_zone" }),
      row(2, { status: "near", distance_to_buy_pct: "5" }),
      row(3, { status: "above", distance_to_buy_pct: "30" }),
      row(4, { status: "no_price", price: null, distance_to_buy_pct: null }),
    ]);
    expect(s.stalls.map((x) => x.tag)).toEqual(["In your price range", "Within 10% of your price", "Above your price", "No price on file"]);
    expect(s.stalls.map((x) => x.pennant)).toEqual(["double", "long", "short", "none"]);
    expect(s.stalls.map((x) => x.unpriced)).toEqual([false, false, false, true]);
  });

  it("says the same thing as the flat Marketplace: same flag, word and signed gap, row for row", () => {
    const rows = [
      row(1, { status: "buy_zone", distance_to_buy_pct: "-5" }),
      row(2, { status: "near", distance_to_buy_pct: "4" }),
      row(3, { status: "above", distance_to_buy_pct: "30" }),
      row(4, { status: "no_target", buy_below_price: null, distance_to_buy_pct: null }),
    ];
    const s = buildStreet(rows);
    const flat = orderStreet(rows);
    s.stalls.forEach((st, i) => {
      expect(st.holdingId).toBe(flat[i].holding_id);
      expect(st.flag).toBe(TONE_FLAG[st.tone].shape);
      expect(st.word).toBe(TONE_FLAG[st.tone].word);
      expect(st.gap).toBe(gapLabel(flat[i]));
    });
    expect(s.stalls.map((x) => x.word)).toEqual(["In range", "Near", "Above", "No price"]);
  });

  it("gives every tone its own shape, and no red or green colour", () => {
    expect(new Set(Object.values(PENNANT_SHAPE)).size).toBe(4);
    for (const c of Object.values(PENNANT_COLOUR)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      expect(r > 150 && g < 100 && b < 100, `${c} reads red`).toBe(false);
      expect(g > r + 30 && g > b + 30, `${c} reads green`).toBe(false);
    }
  });

  it("picks the same stall model for the same company every time, and only known models", () => {
    expect(stableIndex("abc", 2)).toBe(stableIndex("abc", 2));
    const s = buildStreet(Array.from({ length: 6 }, (_, i) => row(i + 1)));
    for (const st of s.stalls) expect(STALL_MODELS).toContain(st.model);
    expect(buildStreet([row(1)]).stalls[0].model).toBe(buildStreet([row(1)]).stalls[0].model);
  });

  it("uses no buy or sell word in the overflow line", () => {
    expect(streetOverflowLine(3)).not.toMatch(/\b(buy|sell)\b/i);
    expect(streetOverflowLine(1)).toContain("1 more stall has");
  });
});

describe("plateWords", () => {
  it("prints the name and the flat page's word with the signed gap, and cuts a long name", () => {
    expect(plateWords({ name: "Equinor", word: "Near", gap: "+4%" })).toEqual({ name: "Equinor", line: "Near · +4%" });
    expect(plateWords({ name: "Equinor", word: "No price", gap: null }).line).toBe("No price");
    const long = plateWords({ name: "A very long company name indeed", word: "Above", gap: "30%" });
    expect(long.name.length).toBeLessThanOrEqual(PLATE_NAME_CHARS);
    expect(long.name.endsWith("…")).toBe(true);
  });
});
