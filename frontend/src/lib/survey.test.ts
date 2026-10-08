import { describe, expect, it } from "vitest";
import { commissionsFor, fogLevel, latestReport, surveyText, surveyTower } from "./survey";
import type { SurveyInputs } from "./survey";
import type { Competence, DecisionRecord, DocumentSummary, GameState, GameTower } from "./types";

function tower(over: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: "h1", ticker: "AAA", name: "Alpha", instrument_type: "equity", sector: "Energy",
    structure: "tower", value_nok: "1000", weight_pct: "40", size_class: "large", moat: "wide", wall: "basalt",
    wall_reason: "", wall_inputs: {}, freshness: "fresh", analysis_age_days: 10, verdict_rating: "hold",
    land: "full_price", land_reason: "", margin_of_safety_pct: "5", thesis: "intact", tripwires_fired: 0,
    siege_exposure: "sheltered", siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...over,
  } as GameTower;
}
function doc(id: string, type: string, published: string): DocumentSummary {
  return {
    id, holding_id: "h1", type, original_filename: `${id}.pdf`, mime_type: "application/pdf", size_bytes: 1,
    uploaded_at: published, reporting_period: null, sha256: id, status: "ok",
    quality_flags: {}, page_count: 1, fact_count: 0,
  };
}
function state(towers: GameTower[], over: Partial<GameState> = {}): GameState {
  return {
    mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", towers,
    diworsification: {} as GameState["diworsification"],
    vault: { accounts_total: 1, accounts_with_cash: 1, cash_stale: false } as GameState["vault"],
    siege: null, notes: [], ...over,
  };
}
function comp(status: Competence["towers"][number]["status"]): Competence {
  return { towers: [{ holding_id: "h1", name: "Alpha", sector: "Energy", weight_pct: "40", status }] } as Competence;
}
const rec = (inv: string | null): DecisionRecord => ({ holding_id: "h1", invalidation: inv }) as DecisionRecord;
function inputs(t: GameTower, over: Partial<SurveyInputs> = {}): SurveyInputs {
  return {
    state: state([t]), competence: comp("inside"), records: [rec("Margins fall below 10%")],
    documents: { h1: [doc("d1", "annual_report", "2026-03-01")] }, opened: new Set(["d1"]), ...over,
  };
}
const byId = (t: ReturnType<typeof surveyTower>, id: string) => t.checks.find((c) => c.id === id)!;

describe("survey-v1", () => {
  it("clears all five checks when every fact is present", () => {
    const s = surveyTower(tower(), inputs(tower()));
    expect(s.checks.map((c) => c.state)).toEqual(["clear", "clear", "clear", "clear", "clear"]);
    expect(surveyText(s)).toBe("5 of 5 surveyed");
    expect(fogLevel(s)).toBe(0);
  });

  it("keeps unknown as fog: unreadable documents, journal and circle are never clear", () => {
    const s = surveyTower(tower(), inputs(tower(), { documents: {}, records: null, competence: null }));
    expect(byId(s, "report").state).toBe("fog");
    expect(byId(s, "thesis").state).toBe("fog");
    expect(byId(s, "circle").state).toBe("fog");
  });

  it("report: needs the NEWEST report opened; an older opened one does not count", () => {
    const docs = { h1: [doc("old", "annual_report", "2025-03-01"), doc("new", "quarterly_report", "2026-08-01")] };
    expect(latestReport(docs.h1)?.id).toBe("new");
    const s = surveyTower(tower(), inputs(tower(), { documents: docs, opened: new Set(["old"]) }));
    expect(byId(s, "report").state).toBe("fog");
    expect(surveyTower(tower(), inputs(tower(), { documents: docs, opened: new Set(["new"]) })).checks[0].state).toBe("clear");
  });

  it("report: other document types are not reports; demo data is not judged", () => {
    const s = surveyTower(tower(), inputs(tower(), { documents: { h1: [doc("p", "presentation", "2026-01-01")] } }));
    expect(byId(s, "report").reason).toMatch(/No annual or quarterly/);
    const d = surveyTower(tower(), inputs(tower(), { state: state([tower()], { demo: true }) }));
    expect(byId(d, "report").state).toBe("not_judged");
  });

  it("fog can come back: a fresh analysis that ages is fog again", () => {
    expect(byId(surveyTower(tower(), inputs(tower())), "analysis").state).toBe("clear");
    for (const freshness of ["weathered", "overgrown", "unsurveyed"] as const) {
      const t = tower({ freshness });
      expect(byId(surveyTower(t, inputs(t)), "analysis").state).toBe("fog");
    }
  });

  it("thesis: a blank invalidation or another holding's does not count", () => {
    expect(byId(surveyTower(tower(), inputs(tower(), { records: [rec("  ")] })), "thesis").state).toBe("fog");
    expect(byId(surveyTower(tower(), inputs(tower(), { records: [{ holding_id: "x", invalidation: "y" } as DecisionRecord] })), "thesis").state).toBe("fog");
  });

  it("circle: marked counts, unmarked and unclassified are fog, funds are not judged", () => {
    const check = (s: Competence["towers"][number]["status"]) => byId(surveyTower(tower(), inputs(tower(), { competence: comp(s) })), "circle").state;
    expect([check("inside"), check("edge"), check("outside")]).toEqual(["clear", "clear", "clear"]);
    expect([check("unmarked"), check("unclassified"), check("not_applicable")]).toEqual(["fog", "fog", "not_judged"]);
  });

  it("valuation: fog land is fog; funds are not judged and drop out of the count", () => {
    const foggy = tower({ land: "fog", land_reason: "No price." });
    expect(byId(surveyTower(foggy, inputs(foggy)), "valuation").reason).toBe("No price.");
    const fund = tower({ freshness: "not_applicable", land: "fog" });
    const s = surveyTower(fund, inputs(fund));
    expect(s.judged).toBe(3);
    expect(byId(s, "analysis").state).toBe("not_judged");
    expect(byId(s, "valuation").state).toBe("not_judged");
  });

  it("commissions group fog by check, heaviest portfolio weight first, and add the cash figure", () => {
    const a = tower({ holding_id: "h1", weight_pct: "10", freshness: "overgrown" });
    const b = tower({ holding_id: "h2", name: "Beta", weight_pct: "50", freshness: "overgrown", land: "fog" });
    const st = state([a, b], { vault: { accounts_total: 2, accounts_with_cash: 1, cash_stale: false } as GameState["vault"] });
    const i: SurveyInputs = {
      state: st, competence: { towers: [] } as unknown as Competence, records: [], documents: { h1: [], h2: [] }, opened: new Set(),
    };
    const towers = st.towers.map((t) => surveyTower(t, i));
    const c = commissionsFor(towers, st);
    expect(c[c.length - 1].id).toBe("vault");
    const analysis = c.find((x) => x.id === "analysis")!;
    expect(analysis.holdings.map((h) => h.name)).toEqual(["Alpha", "Beta"]);
    expect(c.find((x) => x.id === "valuation")!.holdings).toHaveLength(1);
    // heaviest first: every check except valuation covers 60% of the weight, valuation only 50%
    expect(c.findIndex((x) => x.id === "valuation")).toBeGreaterThan(c.findIndex((x) => x.id === "analysis"));
  });

  it("no commission when everything is clear", () => {
    const t = tower();
    const i = inputs(t);
    expect(commissionsFor([surveyTower(t, i)], i.state)).toEqual([]);
  });

  it("never uses trading or reward wording", () => {
    const t = tower({ freshness: "unsurveyed", land: "fog" });
    const i = inputs(t, { documents: {}, records: [], competence: comp("unmarked") });
    const tf = surveyTower(t, i);
    const all = [...tf.checks.map((c) => c.reason), ...commissionsFor([tf], i.state).flatMap((c) => [c.title, c.text])].join(" ");
    expect(all).not.toMatch(/\b(buy|sell|trim|add to|invest|purchase|points?|streak|reward|level up|unlock)\b/i);
  });
});
