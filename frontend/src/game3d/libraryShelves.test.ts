import { describe, expect, it } from "vitest";
import type { GameAdvisorLine, GameTower, HoldingAdvisors } from "../lib/types";
import { MAX_SHELF_BOOKS, SHELF_MARK, SHELF_ORDER, councilShelf, describeShelf, shelfMark, shelvesFor } from "./libraryShelves";
import type { Shelf, ShelfId } from "./libraryShelves";

function tower(o: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: "h1", ticker: "AAA", name: "Alpha", instrument_type: "equity", sector: "Energy", structure: "keep",
    value_nok: "125000.4", weight_pct: "12.34", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "Low debt, steady cash.",
    wall_inputs: { net_debt_to_ebitda: "1.4" }, freshness: "fresh", analysis_age_days: 3, verdict_rating: "Hold", land: "discount",
    land_reason: "Below the base case.", margin_of_safety_pct: "18.3", thesis: "intact", tripwires_fired: 0, siege_exposure: "sheltered",
    siege_shock_pct: "-0.12", siege_method: "volatility", shared_wall_with: [], ...o,
  } as GameTower;
}

const by = (shelves: Shelf[], id: ShelfId) => shelves.find((s) => s.id === id)!;

describe("tower library shelves", () => {
  it("gives seven shelves in room order, each with words", () => {
    const shelves = shelvesFor(tower());
    expect(shelves.map((s) => s.id)).toEqual([...SHELF_ORDER]);
    expect(shelves).toHaveLength(7);
    for (const s of shelves) {
      expect(s.lines.length).toBeGreaterThan(0);
      expect(s.books).toBeGreaterThanOrEqual(0);
      expect(s.books).toBeLessThanOrEqual(MAX_SHELF_BOOKS);
    }
  });

  it("shows the stored facts in the stored words, with exact numbers", () => {
    const s = shelvesFor(tower());
    const text = (id: ShelfId) => by(s, id).lines.map((l) => l.text).join(" | ");
    expect(text("walls")).toContain("Granite walls");
    expect(text("walls")).toContain("net debt / EBITDA: 1.40×");
    expect(text("walls")).toContain("Low debt, steady cash.");
    expect(text("land")).toContain("18.3%");
    expect(text("land")).toContain("Hold");
    expect(text("treasury")).toContain("12.3%");
    expect(text("treasury")).toContain("125");
    expect(text("storm")).toContain("−12.0%");
    expect(text("oath")).toContain("3 days old");
  });

  it("never lets a weaker tier hold more books than a stronger one", () => {
    const order = <K extends keyof GameTower>(key: K, tiers: GameTower[K][], id: ShelfId) =>
      tiers.map((v) => by(shelvesFor(tower({ [key]: v } as Partial<GameTower>)), id).books);
    const strictlyDown = (xs: number[]) => xs.every((x, i) => i === 0 || x < xs[i - 1]);
    expect(strictlyDown(order("wall", ["basalt", "granite", "brick", "timber", "rotted"], "walls"))).toBe(true);
    expect(strictlyDown(order("moat", ["wide", "narrow", "none"], "moat"))).toBe(true);
    expect(strictlyDown(order("land", ["bargain", "discount", "full_price", "overpriced"], "land"))).toBe(true);
    expect(strictlyDown(order("thesis", ["intact", "review", "breached"], "oath"))).toBe(true);
    expect(strictlyDown(order("siege_exposure", ["sheltered", "exposed", "breach_risk"], "storm"))).toBe(true);
    expect(strictlyDown(order("size_class", ["great", "medium", "small", "tiny"], "treasury"))).toBe(true);
  });

  it("keeps unknown as fog: an empty shelf, never a nice-looking one", () => {
    const fog = shelvesFor(
      tower({ wall: "unsurveyed", moat: "unsurveyed", land: "fog", thesis: "not_analyzed", siege_exposure: "unsurveyed", siege_shock_pct: null, size_class: "unknown" }),
    );
    for (const s of fog) {
      expect(s.state).toBe("unknown");
      expect(s.books).toBe(0);
      expect(s.tone).toBe("fog");
      expect(describeShelf(s)).toContain("not surveyed");
    }
    expect(SHELF_MARK.fog).toBe("?");
  });

  it("marks a shelf that does not apply as bare, not as fog or as good", () => {
    const na = shelvesFor(tower({ wall: "not_applicable", moat: "not_applicable", thesis: "not_applicable", structure: "bullion" }));
    for (const id of ["walls", "moat", "oath"] as const) {
      const s = by(na, id);
      expect(s.state).toBe("na");
      expect(s.books).toBe(0);
      expect(s.tone).toBe("");
      expect(shelfMark(s)).toBe("–");
    }
    // A plain known shelf with no verdict keeps the neutral bullet.
    expect(shelfMark(by(na, "treasury"))).toBe(SHELF_MARK[""]);
  });

  it("gives every state a mark besides colour, and a bad tier is never marked good", () => {
    const bad = shelvesFor(tower({ wall: "rotted", moat: "none", land: "overpriced", thesis: "breached", tripwires_fired: 2, siege_exposure: "breach_risk" }));
    for (const id of ["walls", "moat", "land", "oath", "storm"] as const) expect(by(bad, id).tone).toBe("bad");
    expect(by(bad, "walls").books).toBeGreaterThan(0); // a rotted wall is a weak shelf, not an empty one
    expect(by(bad, "oath").lines.map((l) => l.text)).toContain("2 fired");
    expect(new Set(Object.values(SHELF_MARK)).size).toBe(Object.keys(SHELF_MARK).length);
  });

  it("flags a wall close to a weaker tier line and names shared weak walls", () => {
    const s = shelvesFor(
      tower({
        wall_margins: [{ metric: "m", label: "L", value: "1", boundary: "2", direction: "weaker", to_tier: "brick", distance: "1", near: true, text: "Close to brick." }],
        shared_wall_with: ["BBB", "CCC"],
      }),
    );
    expect(by(s, "walls").lines.some((l) => l.tone === "warn" && l.text.includes("Close to brick."))).toBe(true);
    expect(by(s, "storm").lines.some((l) => l.text.includes("BBB, CCC"))).toBe(true);
  });

  it("uses no buy or sell wording anywhere", () => {
    const all = [tower(), tower({ wall: "rotted", land: "bargain", thesis: "breached" }), tower({ wall: "unsurveyed", land: "fog" })]
      .flatMap((t) => shelvesFor(t))
      .flatMap((s) => [s.title, s.asks, ...s.lines.map((l) => `${l.label} ${l.text}`)])
      .join(" ")
      .toLowerCase();
    expect(all).not.toMatch(/\b(buy|sell|accumulate|trim|recommend)\b/);
  });
});

function advisors(lines: Partial<GameAdvisorLine>[]): HoldingAdvisors {
  return {
    holding_id: "h1",
    lines_version: "v1",
    disclaimer: "Hand-written lines chosen by fixed rules. Not advice.",
    lines: lines.map((l, i) => ({
      advisor: "oracle", rule: `rule_${i}`, tone: "note", text: `Line ${i}`, holding_id: "h1", holding_name: "Alpha", facts: [], ...l,
    })) as GameAdvisorLine[],
  };
}

describe("the Council's words shelf (the seventh)", () => {
  it("stands last, and shelvesFor puts the answer on it", () => {
    const shelves = shelvesFor(tower(), advisors([{}]));
    expect(shelves[6].id).toBe("council");
    expect(shelves[6].state).toBe("known");
  });

  it("shows each advisor line in the advisor's name and the stored words, then the disclaimer", () => {
    const s = councilShelf(advisors([{ advisor: "partner", tone: "warning", text: "A tripwire is lit.", facts: ["1 tripwire fired", "Alpha"] }]));
    expect(s.title).toBe("The Council's words");
    expect(s.lines[0]).toEqual({ label: "The Partner", text: "A tripwire is lit.", tone: "warn" });
    expect(s.lines[1]).toEqual({ label: "Why", text: "1 tripwire fired · Alpha" });
    expect(s.lines[s.lines.length - 1].text).toBe("Hand-written lines chosen by fixed rules. Not advice.");
  });

  it("counts books by lines written, one each up to the shelf, and keeps the plaque tone plain", () => {
    expect(councilShelf(advisors([{}])).books).toBe(1);
    expect(councilShelf(advisors([{}, {}, {}])).books).toBe(3);
    expect(councilShelf(advisors(Array.from({ length: 20 }, () => ({})))).books).toBe(MAX_SHELF_BOOKS);
    expect(councilShelf(advisors([{ tone: "warning" }, { tone: "calm" }])).tone).toBe("");
  });

  it("never reads silence as praise: no rule is a bare shelf that says so, not a full one", () => {
    const s = councilShelf(advisors([]));
    expect(s.state).toBe("na");
    expect(s.books).toBe(0);
    expect(s.lines[0].text).toContain("Silence is not");
  });

  it("is fog, not a bare shelf, while asking, when the answer failed, and for the sample fortress", () => {
    for (const input of [null, undefined, "failed", "sample"] as const) {
      const s = councilShelf(input);
      expect(s.state, String(input)).toBe("unknown");
      expect(s.tone).toBe("fog");
      expect(s.books).toBe(0);
    }
    expect(councilShelf(null).lines[0].text).toContain("not answered yet");
    expect(councilShelf("failed").lines[0].text).toContain("could not be reached");
    expect(councilShelf("sample").lines[0].text).toContain("sample fortress");
  });

  it("uses no buy or sell words in its own sentences", () => {
    const own = [null, "failed", "sample"].flatMap((i) => councilShelf(i as null).lines.map((l) => l.text)).concat(councilShelf(advisors([])).lines.map((l) => l.text));
    for (const t of own) expect(t).not.toMatch(/\b(buy|sell|trade)\b/i);
  });
});
