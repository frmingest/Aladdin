import { describe, expect, it } from "vitest";
import {
  CLEAR_RING_R,
  COMMISSION_SHAPE,
  FOG_OPACITY,
  KEEP_ID,
  MISSING_PHRASE,
  MAP_COLORS,
  MAP_COPY,
  MIN_PATCH_R,
  PATCH_LOOK,
  SLOT_AT,
  TOWER_BOX,
  VIEW,
  checksInFog,
  cloudPath,
  commissionShape,
  contrastRatio,
  flagsFor,
  fogSlots,
  gridMove,
  isGridKey,
  patchRadius,
  patchSignature,
  towerAriaLabel,
} from "./realmMap";
import { SURVEY_CHECKS, commissionsFor, surveyTower } from "./survey";
import type { SurveyInputs, SurveyState } from "./survey";
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

const STATES: SurveyState[] = ["clear", "fog", "not_judged"];

describe("fogSlots", () => {
  it("is always five slots in SURVEY_CHECKS order, each with a fixed place", () => {
    const s = surveyTower(tower(), inputs(tower()));
    const slots = fogSlots(s);
    expect(slots).toHaveLength(5);
    expect(slots.map((x) => x.id)).toEqual(SURVEY_CHECKS.map((c) => c.id));
    expect(SLOT_AT.map((x) => x.id)).toEqual(SURVEY_CHECKS.map((c) => c.id));
    const places = slots.map((x) => `${x.cx},${x.cy}`);
    expect(new Set(places).size).toBe(5);
  });

  it("a slot never moves when its state changes", () => {
    const all = (state: SurveyState) =>
      fogSlots(SURVEY_CHECKS.map((c) => ({ id: c.id, state, reason: "r" }))).map((s) => [s.cx, s.cy]);
    expect(all("clear")).toEqual(all("fog"));
    expect(all("fog")).toEqual(all("not_judged"));
  });

  it("every slot sits inside the drawing", () => {
    const slots = fogSlots(SURVEY_CHECKS.map((c) => ({ id: c.id, state: "fog" as const, reason: "r" })));
    for (const s of slots) {
      expect(s.cx - s.r).toBeGreaterThanOrEqual(0);
      expect(s.cx + s.r).toBeLessThanOrEqual(VIEW.w);
      expect(s.cy - s.r).toBeGreaterThanOrEqual(0);
      expect(s.cy + s.r).toBeLessThanOrEqual(VIEW.h);
      expect(s.cx).toBeGreaterThanOrEqual(TOWER_BOX.x);
    }
  });

  it("is exhaustive over the survey states, with the look the design lists", () => {
    for (const st of STATES) {
      const slots = fogSlots(SURVEY_CHECKS.map((c) => ({ id: c.id, state: st, reason: "r" })));
      expect(slots.every((s) => s.state === st && s.look === PATCH_LOOK[st])).toBe(true);
    }
    expect(PATCH_LOOK.clear).toMatchObject({ shape: "ring", glyph: "●", covers: false });
    expect(PATCH_LOOK.fog).toMatchObject({ shape: "cloud", pattern: "hatch", glyph: "?", covers: true });
    expect(PATCH_LOOK.not_judged).toMatchObject({ shape: "dashed-ring", glyph: "–", covers: false });
  });

  it("the three looks differ pairwise on shape, pattern and glyph, not only on colour", () => {
    for (const a of STATES) {
      for (const b of STATES) {
        if (a === b) continue;
        expect(PATCH_LOOK[a].shape).not.toBe(PATCH_LOOK[b].shape);
        expect(PATCH_LOOK[a].pattern).not.toBe(PATCH_LOOK[b].pattern);
        expect(PATCH_LOOK[a].glyph).not.toBe(PATCH_LOOK[b].glyph);
        expect(patchSignature(a)).not.toBe(patchSignature(b));
        expect(PATCH_LOOK[a].word).not.toBe(PATCH_LOOK[b].word);
      }
    }
  });

  it("unknown stays fog: unreadable documents, journal and circle are cloud, never a ring", () => {
    const t = tower();
    const slots = fogSlots(surveyTower(t, inputs(t, { documents: {}, records: null, competence: null })));
    const by = (id: string) => slots.find((s) => s.id === id)!;
    expect(by("report").look.shape).toBe("cloud");
    expect(by("thesis").look.shape).toBe("cloud");
    expect(by("circle").look.shape).toBe("cloud");
  });

  it("a check missing from the input is fog, not clear", () => {
    const slots = fogSlots([{ id: "report", state: "clear", reason: "r" }]);
    expect(slots).toHaveLength(5);
    expect(slots[0].state).toBe("clear");
    expect(slots.slice(1).every((s) => s.state === "fog")).toBe(true);
    expect(slots[1].reason).toMatch(/stays unknown/);
  });

  it("fog returns because the input changed: a fresh analysis re-surveyed as weathered clouds only that slot", () => {
    const fresh = fogSlots(surveyTower(tower({ freshness: "fresh" }), inputs(tower())));
    const aged = fogSlots(surveyTower(tower({ freshness: "weathered" }), inputs(tower({ freshness: "weathered" }))));
    expect(fresh[1].look.shape).toBe("ring");
    expect(aged[1].look.shape).toBe("cloud");
    for (const i of [0, 2, 3, 4]) expect(aged[i].state).toBe(fresh[i].state);
    expect(aged[1].reason).toMatch(/weathered/);
  });

  it("funds and gold: checks that are not judged are dashed sockets, not rings", () => {
    const t = tower({ freshness: "not_applicable" });
    const slots = fogSlots(surveyTower(t, inputs(t, { competence: { towers: [{ holding_id: "h1", name: "A", sector: null, weight_pct: null, status: "not_applicable" }] } as Competence })));
    expect(slots[1].look.shape).toBe("dashed-ring");
    expect(slots[3].look.shape).toBe("dashed-ring");
    expect(slots[4].look.shape).toBe("dashed-ring");
  });
});

describe("fog is never fainter or smaller than clear", () => {
  it("opacity, size and contrast constants", () => {
    expect(FOG_OPACITY).toBeGreaterThanOrEqual(0.85);
    expect(MIN_PATCH_R).toBeGreaterThanOrEqual(16);
    expect(patchRadius("fog")).toBeGreaterThanOrEqual(CLEAR_RING_R);
    expect(patchRadius("fog")).toBeGreaterThan(patchRadius("clear"));
    expect(patchRadius("fog", 10)).toBe(MIN_PATCH_R);
    for (const s of fogSlots(SURVEY_CHECKS.map((c) => ({ id: c.id, state: "fog" as const, reason: "r" })))) {
      expect(s.r).toBeGreaterThanOrEqual(CLEAR_RING_R);
    }
  });

  it("the ink outline and the ? badge stay legible on the paper, and the hatch on the mist", () => {
    expect(contrastRatio(MAP_COLORS.ink, MAP_COLORS.paper)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(MAP_COLORS.hatchInk, MAP_COLORS.mist)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(MAP_COLORS.cream, MAP_COLORS.wax)).toBeGreaterThanOrEqual(4.5);
  });

  it("no map colour is a green", () => {
    for (const hex of Object.values(MAP_COLORS)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(g > r + 15 && g > b + 15).toBe(false);
    }
  });
});

describe("cloudPath", () => {
  it("is a closed scalloped outline of eight arcs and no filter-like extras", () => {
    const d = cloudPath(60, 40, 19);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect((d.match(/A/g) ?? []).length).toBe(8);
    expect(d).not.toMatch(/NaN/);
  });
});

describe("tower button label", () => {
  it("names the checks in fog and carries no count of how many are surveyed", () => {
    const t = tower({ freshness: "weathered" });
    const s = surveyTower(t, inputs(t, { records: [rec(null)] }));
    const label = towerAriaLabel(s, "40.0%");
    expect(label).toBe("Alpha, 40.0% of the book, in fog: analysis not fresh, invalidation not written");
    expect(checksInFog(s).map((c) => c.id)).toEqual(["analysis", "thesis"]);
    const clearLabel = towerAriaLabel(surveyTower(tower(), inputs(tower())), "40.0%");
    expect(clearLabel).toBe("Alpha, 40.0% of the book, no checks in fog");
    expect(`${label} ${clearLabel}`).not.toMatch(/\bof \d\b|surveyed|%\s*(clear|surveyed|revealed)/i);
  });
});

describe("fog is spoken as what is missing", () => {
  it("no fog check's phrase reads as the positive fact", () => {
    for (const c of SURVEY_CHECKS) {
      const phrase = MISSING_PHRASE[c.id];
      expect(phrase).toMatch(/\bnot\b/);
      expect(phrase.toLowerCase()).not.toBe(c.label.toLowerCase());
    }
    const label = towerAriaLabel({ name: "A", checks: SURVEY_CHECKS.map((c) => ({ ...c, state: "fog" as const, reason: "r" })) }, "1.0%");
    for (const c of SURVEY_CHECKS) expect(label).not.toContain(c.label);
  });
});

describe("gridMove", () => {
  it("moves by one, by a row, and stops at the edges", () => {
    expect(gridMove(0, "ArrowRight", 7, 3)).toBe(1);
    expect(gridMove(0, "ArrowLeft", 7, 3)).toBe(0);
    expect(gridMove(6, "ArrowRight", 7, 3)).toBe(6);
    expect(gridMove(1, "ArrowDown", 7, 3)).toBe(4);
    expect(gridMove(4, "ArrowUp", 7, 3)).toBe(1);
    expect(gridMove(1, "ArrowUp", 7, 3)).toBe(1);
    expect(gridMove(3, "Home", 7, 3)).toBe(0);
    expect(gridMove(3, "End", 7, 3)).toBe(6);
  });
  it("down into a short last row clamps to the last tower; on the last row it stays", () => {
    expect(gridMove(5, "ArrowDown", 7, 3)).toBe(6);
    expect(gridMove(6, "ArrowDown", 7, 3)).toBe(6);
    expect(gridMove(0, "ArrowDown", 0, 3)).toBe(0);
  });
  it("recognises only navigation keys", () => {
    expect(isGridKey("ArrowDown")).toBe(true);
    expect(isGridKey("Enter")).toBe(false);
  });
});

describe("commission flags", () => {
  const towers = [
    tower({ holding_id: "a", name: "A", weight_pct: "50", freshness: "weathered" }),
    tower({ holding_id: "b", name: "B", weight_pct: "30", freshness: "overgrown" }),
    tower({ holding_id: "c", name: "C", weight_pct: "20", freshness: "fresh" }),
  ];
  const st = state(towers, { vault: { accounts_total: 2, accounts_with_cash: 1, cash_stale: false } as GameState["vault"] });
  const surveyed = towers.map((t) =>
    surveyTower(t, { state: st, competence: { towers: towers.map((x) => ({ holding_id: x.holding_id, name: x.name, sector: "S", weight_pct: null, status: "inside" })) } as Competence, records: towers.map((x) => ({ holding_id: x.holding_id, invalidation: "x" }) as DecisionRecord), documents: {}, opened: new Set() }),
  );
  const commissions = commissionsFor(surveyed, st);
  const ids = towers.map((t) => t.holding_id);

  it("nothing is flagged until a commission is pressed", () => {
    expect(flagsFor(commissions, null, ids)).toEqual([]);
    expect(flagsFor(commissions, "no-such", ids)).toEqual([]);
  });

  it("plants one flag per covered tower that is drawn, numbered by list position", () => {
    const i = commissions.findIndex((c) => c.id === "analysis");
    expect(i).toBeGreaterThanOrEqual(0);
    const flags = flagsFor(commissions, "analysis", ids);
    expect(flags.map((f) => f.target).sort()).toEqual(["a", "b"]);
    expect(flags.every((f) => f.number === i + 1 && f.shape === "hexagon" && f.commissionId === "analysis")).toBe(true);
    expect(flagsFor(commissions, "analysis", ["a"]).map((f) => f.target)).toEqual(["a"]);
    expect(flagsFor(commissions, "analysis", [])).toEqual([]);
  });

  it("the cash commission has no holdings and plants one flag on the Keep", () => {
    const i = commissions.findIndex((c) => c.id === "vault");
    expect(i).toBeGreaterThanOrEqual(0);
    const flags = flagsFor(commissions, "vault", ids);
    expect(flags).toEqual([{ target: KEEP_ID, commissionId: "vault", number: i + 1, shape: "coin" }]);
  });

  it("each kind of commission has its own shape", () => {
    const shapes = Object.values(COMMISSION_SHAPE);
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(Object.keys(COMMISSION_SHAPE).sort()).toEqual([...SURVEY_CHECKS.map((c) => c.id), "vault"].sort());
    expect(commissionShape("unknown-kind")).toBe("square");
  });
});

describe("wording", () => {
  const BANNED = /\b(buy|sell|trim|add to|invest|purchase|points?|score|streak|reward|level up|unlock|well done|complete(d)?)\b/i;
  const strings = [
    ...Object.values(MAP_COPY),
    ...Object.values(PATCH_LOOK).map((l) => l.word),
    ...Object.values(COMMISSION_SHAPE),
    towerAriaLabel({ name: "Alpha", checks: [{ id: "report", label: "Latest report opened", state: "fog", reason: "r" }] }, "4.0%"),
    "Show on the map: Refresh the analysis",
    "Survey of Alpha",
  ];
  it("no new string trades, scores or rewards", () => {
    for (const s of strings) expect(s).not.toMatch(BANNED);
  });
  it("no progress count or percentage appears next to clear, surveyed or revealed", () => {
    for (const s of strings) {
      expect(s).not.toMatch(/\bof \d+\b/i);
      expect(s).not.toMatch(/\d\s*%\s*(clear|surveyed|revealed)/i);
    }
  });
});
