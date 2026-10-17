import { describe, expect, it } from "vitest";
import { districtOf, FILLER_PROPS, fillerFor, gapLabel, jitterPx, lanePlots, openReducer, priceLine, animatedMarks, staggerDelays, topMark, topMarkText, topMarkTitle, MARK_ANIMATION_CAP, TOP_MARK_WORD, streetDistricts, stallLabel, TONE_FLAG, type Slot } from "./marketStreet";
import { orderStreet, shopFront } from "./marketplace";
import { OBJECT_ART } from "./stitchArt";
import type { WatchlistRow } from "./types";

function row(over: Partial<WatchlistRow>): WatchlistRow {
  return {
    id: "r1",
    holding_id: "h1",
    name: "Equinor",
    ticker: "EQNR.OL",
    sector: "Energy",
    status: "above",
    distance_to_buy_pct: null,
    price: null,
    price_currency: null,
    buy_below_price: null,
    buy_below_currency: null,
    owned: false,
    verdict_rating: null,
    moat_rating: null,
    analyzed_at: null,
    ...over,
  } as unknown as WatchlistRow;
}

describe("districtOf", () => {
  it("reads the stored status, and sends every unpriced status to the fog lane", () => {
    expect(districtOf(row({ status: "buy_zone" }))).toBe("range");
    expect(districtOf(row({ status: "near" }))).toBe("near");
    expect(districtOf(row({ status: "above" }))).toBe("above");
    for (const s of ["no_target", "no_price", "currency_mismatch"] as const) expect(districtOf(row({ status: s }))).toBe("fog");
  });
});

describe("streetDistricts", () => {
  it("keeps street order and the place numbers of the whole street, and drops empty districts", () => {
    const rows = orderStreet([
      row({ id: "a", name: "Aker", status: "above", distance_to_buy_pct: "12" }),
      row({ id: "b", name: "Bouvet", status: "no_target" }),
      row({ id: "c", name: "Cavendish", status: "buy_zone", distance_to_buy_pct: "-3" }),
    ]);
    const ds = streetDistricts(rows);
    expect(ds.map((d) => d.id)).toEqual(["range", "above", "fog"]);
    expect(ds.flatMap((d) => d.rows.map((r) => `${r.place}:${r.row.name}`))).toEqual(["1:Cavendish", "2:Aker", "3:Bouvet"]);
  });

  it("is empty for an empty street", () => {
    expect(streetDistricts([])).toEqual([]);
  });
});

describe("tone flags", () => {
  it("gives every tone its own shape and its own word (colour is never the only signal)", () => {
    const tones = ["gold", "amber", "plain", "mist"] as const;
    expect(new Set(tones.map((t) => TONE_FLAG[t].shape)).size).toBe(4);
    expect(new Set(tones.map((t) => TONE_FLAG[t].word)).size).toBe(4);
  });
});

describe("gapLabel", () => {
  it("signs a gap above your price and leaves a gap below it plain", () => {
    expect(gapLabel(row({ distance_to_buy_pct: "4" }))).toBe("+4%");
    expect(gapLabel(row({ distance_to_buy_pct: "-3" }))).toBe("-3%");
  });
  it("is null when there is nothing to compare: unknown stays unknown", () => {
    expect(gapLabel(row({ distance_to_buy_pct: null }))).toBeNull();
  });
});

describe("stallLabel", () => {
  it("says the whole fact in one sentence", () => {
    const r = row({ status: "buy_zone", distance_to_buy_pct: "-3", owned: true });
    const s = stallLabel(r);
    expect(s).toContain("Equinor, EQNR.OL.");
    expect(s).toContain(shopFront(r).tag);
    expect(s).toContain("-3% versus yours");
    expect(s).toContain("In your fortress.");
    expect(s).not.toContain("Step inside");
  });
  it("admits a missing price instead of leaving it out", () => {
    expect(stallLabel(row({ status: "no_price" }))).toContain("No price on file.");
  });
});

function street(specs: { id: string; status: WatchlistRow["status"]; gap?: string }[]) {
  return streetDistricts(
    orderStreet(specs.map((x) => row({ id: x.id, holding_id: x.id, name: x.id.toUpperCase(), status: x.status, distance_to_buy_pct: x.gap ?? null }))),
  );
}
const stallsOf = (slots: Slot[]) => slots.flatMap((s) => (s.kind === "stall" ? [s.row.id] : []));

describe("filler props", () => {
  it("cycles through four props that all have a picture and none is a stall", () => {
    for (let i = 0; i < FILLER_PROPS.length * 2; i++) expect(OBJECT_ART[fillerFor(i)]).toBeDefined();
    expect(fillerFor(FILLER_PROPS.length)).toBe(fillerFor(0));
    expect(FILLER_PROPS.some((p) => /stall|booth|hall/.test(p))).toBe(false);
  });
});

describe("lanePlots", () => {
  it("gives no rows for an empty street", () => {
    expect(lanePlots([], "wide")).toEqual({ perSide: 1, rows: [] });
  });

  it("zigzags 1-stall districts and fills the empty inner plot with the district's fixed prop", () => {
    const { perSide, rows } = lanePlots(street([{ id: "a", status: "buy_zone", gap: "-2" }, { id: "b", status: "above", gap: "9" }]), "wide");
    expect(perSide).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.left[0]).toMatchObject({ kind: "stall", place: 1 });
    expect(rows[0]!.right[0]).toEqual({ kind: "prop", id: fillerFor(0) });
    expect(rows[1]!.left[0]).toEqual({ kind: "prop", id: fillerFor(1) });
    expect(rows[1]!.right[0]).toMatchObject({ kind: "stall", place: 2 });
    expect(rows.map((r) => r.first)).toEqual([true, true]);
  });

  it("keeps a small street at one plot per side, even on wide screens", () => {
    const ds = street(Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, status: "above" as const, gap: String(i) })));
    expect(lanePlots(ds, "wide").perSide).toBe(1);
  });

  it("widens a long street to five plots per side on wide screens, three on medium, one on narrow, with every stall once and places unchanged", () => {
    const specs = [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, status: "buy_zone" as const, gap: String(-i - 1) })),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, status: i < 2 ? ("near" as const) : ("above" as const), gap: String(i + 3) })),
      ...Array.from({ length: 18 }, (_, i) => ({ id: `f${String(i).padStart(2, "0")}`, status: "no_price" as const })),
    ];
    const ds = street(specs);
    const wide = lanePlots(ds, "wide");
    const medium = lanePlots(ds, "medium");
    const narrow = lanePlots(ds, "narrow");
    expect(wide.perSide).toBe(5);
    expect(medium.perSide).toBe(3);
    expect(narrow.perSide).toBe(1);
    for (const plan of [wide, medium, narrow]) {
      const placed = plan.rows.flatMap((r) => [...r.left, ...r.right]).flatMap((s) => (s.kind === "stall" ? [s] : []));
      expect(placed).toHaveLength(30);
      expect(new Set(placed.map((s) => s.row.id)).size).toBe(30);
      for (const s of placed) expect(s.place).toBe(orderStreet(ds.flatMap((d) => d.rows.map((x) => x.row))).findIndex((r) => r.id === s.row.id) + 1);
      expect([...new Set(plan.rows.map((r) => r.districtId))]).toEqual(["range", "near", "above", "fog"]);
    }
  });

  it("fills left-inner, right-inner, left-outer, right-outer so place numbers rise in that order", () => {
    const ds = street(Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, status: "above" as const, gap: String(i) })));
    const { rows } = lanePlots(ds, "medium");
    expect(rows).toHaveLength(2);
    const [r0, r1] = rows;
    expect([r0!.left[0], r0!.right[0], r0!.left[1], r0!.right[1]].map((s) => (s!.kind === "stall" ? s.place : 0))).toEqual([1, 2, 3, 4]);
    expect(r1!.first).toBe(false);
    expect(stallsOf(r1!.left).length + stallsOf(r1!.right).length).toBe(1);
    // the one empty plot is an outer plot: it stays bare ground, the inner plots are stalls
    expect(r1!.right[1]).toEqual({ kind: "ground" });
  });

  it("is the same for the same input and never reorders", () => {
    const ds = street([{ id: "a", status: "near", gap: "4" }, { id: "b", status: "near", gap: "5" }, { id: "c", status: "no_target" }]);
    expect(lanePlots(ds, "narrow")).toEqual(lanePlots(ds, "narrow"));
  });

  it("starts the fog stretch after the other districts, and props are never stall pictures", () => {
    const { rows } = lanePlots(street([{ id: "x", status: "no_price" }, { id: "y", status: "buy_zone", gap: "-1" }]), "narrow");
    expect(rows.map((r) => r.districtId)).toEqual(["range", "fog"]);
    for (const r of rows) for (const s of [...r.left, ...r.right]) if (s.kind === "prop") expect(FILLER_PROPS).toContain(s.id);
  });
});

describe("priceLine", () => {
  it("prints the price and yours, and admits a missing one", () => {
    expect(priceLine(row({ price: null, buy_below_price: null }))).toBe("No price · yours not named");
    expect(priceLine(row({ price: "930", price_currency: "USD", buy_below_price: "850", buy_below_currency: "USD" }))).toContain("yours");
  });
});

describe("jitterPx", () => {
  it("is stable and stays within five pixels", () => {
    for (let i = 0; i < 100; i++) {
      const j = jitterPx(`holding-${i}`);
      expect(j).toBe(jitterPx(`holding-${i}`));
      expect(Math.abs(j)).toBeLessThanOrEqual(5);
    }
  });
});

describe("openReducer", () => {
  it("opens a stall, closes it when pressed again", () => {
    expect(openReducer(null, { type: "toggle", id: "a" })).toBe("a");
    expect(openReducer("a", { type: "toggle", id: "a" })).toBeNull();
  });
  it("keeps one open at a time: opening another closes the first", () => {
    expect(openReducer("a", { type: "toggle", id: "b" })).toBe("b");
  });
  it("closes on Escape (close), and closing nothing stays closed", () => {
    expect(openReducer("a", { type: "close" })).toBeNull();
    expect(openReducer(null, { type: "close" })).toBeNull();
  });
});

describe("topMark", () => {
  const NOW = Date.parse("2026-10-17T12:00:00Z");
  const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
  const strong = (over: Partial<WatchlistRow> = {}) => row({ verdict_rating: "Strong Buy", analyzed_at: daysAgo(10), status: "above", ...over });

  it("only the stored Strong Buy gets a mark", () => {
    for (const r of ["Buy", "Hold", "Sell", "Avoid", null] as const) expect(topMark(row({ verdict_rating: r, analyzed_at: daysAgo(1) }), NOW)).toBeNull();
    expect(topMark(strong(), NOW)).toBe("fresh");
  });
  it("cuts at 90 and 180 days, and an unknown date is old", () => {
    expect(topMark(strong({ analyzed_at: daysAgo(90) }), NOW)).toBe("fresh");
    expect(topMark(strong({ analyzed_at: daysAgo(91) }), NOW)).toBe("ageing");
    expect(topMark(strong({ analyzed_at: daysAgo(180) }), NOW)).toBe("ageing");
    expect(topMark(strong({ analyzed_at: daysAgo(181) }), NOW)).toBe("old");
    expect(topMark(strong({ analyzed_at: null }), NOW)).toBe("old");
  });
  it("puts an unpriced fresh Strong Buy under the fog, but an old one stays old (truth over flattery)", () => {
    expect(topMark(strong({ status: "no_price" }), NOW)).toBe("fogged");
    expect(topMark(strong({ status: "no_target", analyzed_at: daysAgo(30) }), NOW)).toBe("fogged");
    expect(topMark(strong({ status: "no_price", analyzed_at: daysAgo(300) }), NOW)).toBe("old");
  });
  it("prints Top mark or Old mark, never the verdict word", () => {
    expect(TOP_MARK_WORD.fresh).toBe("Top mark");
    expect(TOP_MARK_WORD.old).toBe("Old mark");
    for (const w of Object.values(TOP_MARK_WORD)) expect(w).not.toMatch(/buy|sell/i);
  });
  it("is deterministic for the same row and time", () => {
    expect(topMark(strong(), NOW)).toBe(topMark(strong(), NOW));
  });
  it("animates only the first fresh marks in street order, up to the cap", () => {
    const rows = Array.from({ length: 6 }, (_, i) => strong({ id: `s${i}`, status: "above", distance_to_buy_pct: String(i) }));
    rows.splice(1, 0, strong({ id: "old1", analyzed_at: daysAgo(400) }), row({ id: "plain", verdict_rating: "Buy" }));
    const ids = [...animatedMarks(rows, NOW)];
    expect(ids).toEqual(["s0", "s1", "s2"]);
    expect(ids).toHaveLength(MARK_ANIMATION_CAP);
  });
  it("staggers entrances 400 ms apart by place", () => {
    const m = staggerDelays([7, 2, 5]);
    expect([...m.entries()]).toEqual([[2, 0], [5, 400], [7, 800]]);
  });
  it("gives the screen reader and the tooltip the age, with no buy word", () => {
    expect(topMarkText(strong({ analyzed_at: daysAgo(34) }), NOW)).toBe("Analyst's top mark, 34 days old.");
    expect(topMarkText(strong({ analyzed_at: daysAgo(212) }), NOW)).toBe("Analyst's top mark, 212 days old: old.");
    expect(topMarkText(strong({ analyzed_at: null }), NOW)).toBe("Analyst's top mark, date unknown.");
    expect(topMarkText(row({ verdict_rating: "Hold" }), NOW)).toBe("");
    expect(topMarkTitle(strong({ analyzed_at: daysAgo(34) }), NOW)).toBe("The analyst's top word, 34 days ago.");
    expect(stallLabel(strong({ analyzed_at: daysAgo(34) }), NOW)).toContain("Analyst's top mark, 34 days old.");
    expect(stallLabel(strong({ analyzed_at: daysAgo(34) }), NOW)).not.toMatch(/strong buy/i);
  });
});
