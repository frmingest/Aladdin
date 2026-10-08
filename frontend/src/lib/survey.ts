import { scrollDate } from "./scrolls";
import type { Competence, DecisionRecord, DocumentSummary, GameState, GameTower } from "./types";

/**
 * Fog of war (game mode G34 / G35, Sprint 28). Progress is a map, not a score: for each tower five
 * plain facts are either clear or still in fog. Nothing is granted for buying, selling, opening the
 * app, speed or consecutive days, and fog can come BACK when an analysis goes stale. A fully clear
 * tower is only a well-understood tower, never a good one: this file never reads a verdict.
 *
 * Pure and view-only: it reads values the app already stored (the game state, the decision journal,
 * the competence marks, the document list) plus the per-browser "opened" flags of the Scrolls
 * library (decision D4). It writes nothing, calls no provider or model, and never says to buy, sell,
 * add or trim. Unknown stays unknown: a missing list is fog with a reason, never clear.
 *
 * The five checks are version 1. A change to them is a new version, not an in-place edit.
 */

export const SURVEY_VERSION = "survey-v1";

export type SurveyCheckId = "report" | "analysis" | "thesis" | "circle" | "valuation";
export type SurveyState = "clear" | "fog" | "not_judged";

export const SURVEY_CHECKS: ReadonlyArray<{ id: SurveyCheckId; label: string }> = [
  { id: "report", label: "Latest report opened" },
  { id: "analysis", label: "Analysis fresh" },
  { id: "thesis", label: "Invalidation written" },
  { id: "circle", label: "Circle marked" },
  { id: "valuation", label: "Valuation available" },
];

export interface SurveyCheck {
  id: SurveyCheckId;
  label: string;
  state: SurveyState;
  /** One plain line: why it is clear, in fog, or not judged. */
  reason: string;
}

export interface TowerFog {
  holdingId: string;
  name: string;
  ticker: string;
  /** Share of the portfolio in percent, or null when unknown. */
  weightPct: number | null;
  checks: SurveyCheck[];
  /** Checks that are clear / checks that are judged (not-judged ones are left out of both). */
  clear: number;
  judged: number;
}

export interface SurveyInputs {
  state: GameState;
  competence: Competence | null;
  records: DecisionRecord[] | null;
  /** Documents per holding id; a missing key (or null) means the list could not be read. */
  documents: Record<string, DocumentSummary[] | null>;
  opened: ReadonlySet<string>;
}

const REPORT_TYPES = new Set(["annual_report", "quarterly_report"]);

/** The newest annual, quarterly or half-year report, by its publish date. */
export function latestReport(documents: DocumentSummary[]): DocumentSummary | null {
  const reports = documents.filter((d) => REPORT_TYPES.has(d.type));
  if (reports.length === 0) return null;
  return [...reports].sort((a, b) => scrollDate(b).localeCompare(scrollDate(a)))[0];
}

function weightOf(t: GameTower): number | null {
  if (t.weight_pct === null) return null;
  const n = Number(t.weight_pct);
  return Number.isFinite(n) ? n : null;
}

function reportCheck(tower: GameTower, inputs: SurveyInputs): SurveyCheck {
  const base = { id: "report" as const, label: "Latest report opened" };
  if (inputs.state.demo) return { ...base, state: "not_judged", reason: "Demo data has no stored reports." };
  const docs = inputs.documents[tower.holding_id];
  if (!docs) return { ...base, state: "fog", reason: "The report list could not be read, so this stays unknown." };
  const latest = latestReport(docs);
  if (!latest) return { ...base, state: "fog", reason: "No annual or quarterly report is stored." };
  if (inputs.opened.has(latest.id)) {
    return { ...base, state: "clear", reason: "The newest report was opened on this browser (opened, not understood)." };
  }
  return { ...base, state: "fog", reason: "The newest report has not been opened on this browser." };
}

function analysisCheck(tower: GameTower): SurveyCheck {
  const base = { id: "analysis" as const, label: "Analysis fresh" };
  switch (tower.freshness) {
    case "fresh":
      return { ...base, state: "clear", reason: "The analysis is recent." };
    case "weathered":
      return { ...base, state: "fog", reason: "The analysis is weathered and is due a fresh run." };
    case "overgrown":
      return { ...base, state: "fog", reason: "The analysis is old." };
    case "not_applicable":
      return { ...base, state: "not_judged", reason: "This kind of holding is not analysed." };
    default:
      return { ...base, state: "fog", reason: "No analysis has been run." };
  }
}

function thesisCheck(tower: GameTower, inputs: SurveyInputs): SurveyCheck {
  const base = { id: "thesis" as const, label: "Invalidation written" };
  if (!inputs.records) return { ...base, state: "fog", reason: "The journal could not be read, so this stays unknown." };
  const written = inputs.records.some(
    (r) => r.holding_id === tower.holding_id && (r.invalidation ?? "").trim().length > 0,
  );
  return written
    ? { ...base, state: "clear", reason: "A decision here says what would prove it wrong." }
    : { ...base, state: "fog", reason: "No decision here says what would prove it wrong." };
}

function circleCheck(tower: GameTower, inputs: SurveyInputs): SurveyCheck {
  const base = { id: "circle" as const, label: "Circle marked" };
  const row = inputs.competence?.towers.find((c) => c.holding_id === tower.holding_id);
  if (!row) return { ...base, state: "fog", reason: "The circle could not be read, so this stays unknown." };
  switch (row.status) {
    case "inside":
    case "edge":
    case "outside":
      return { ...base, state: "clear", reason: "You have marked this sector." };
    case "not_applicable":
      return { ...base, state: "not_judged", reason: "Funds and gold are not placed in the circle." };
    case "unclassified":
      return { ...base, state: "fog", reason: "No sector is set for this holding." };
    default:
      return { ...base, state: "fog", reason: "You have not marked this sector." };
  }
}

function valuationCheck(tower: GameTower): SurveyCheck {
  const base = { id: "valuation" as const, label: "Valuation available" };
  if (tower.freshness === "not_applicable") {
    return { ...base, state: "not_judged", reason: "This kind of holding has no company valuation." };
  }
  return tower.land === "fog"
    ? { ...base, state: "fog", reason: tower.land_reason || "No valuation could be read." }
    : { ...base, state: "clear", reason: "A stored valuation exists." };
}

/** The survey of one tower. */
export function surveyTower(tower: GameTower, inputs: SurveyInputs): TowerFog {
  const checks = [
    reportCheck(tower, inputs),
    analysisCheck(tower),
    thesisCheck(tower, inputs),
    circleCheck(tower, inputs),
    valuationCheck(tower),
  ];
  const judged = checks.filter((c) => c.state !== "not_judged").length;
  const clear = checks.filter((c) => c.state === "clear").length;
  return {
    holdingId: tower.holding_id,
    name: tower.name,
    ticker: tower.ticker,
    weightPct: weightOf(tower),
    checks,
    clear,
    judged,
  };
}

export function surveyRealm(inputs: SurveyInputs): TowerFog[] {
  return inputs.state.towers.map((t) => surveyTower(t, inputs));
}

/** How foggy a tower is, 0 (all clear) to 1 (all fog); towers with nothing judged are 0. */
export function fogLevel(t: Pick<TowerFog, "clear" | "judged">): number {
  return t.judged === 0 ? 0 : 1 - t.clear / t.judged;
}

/** "3 of 5 surveyed" */
export function surveyText(t: Pick<TowerFog, "clear" | "judged">): string {
  return `${t.clear} of ${t.judged} surveyed`;
}

// --- G35: the Cartographer's table ------------------------------------------------------------

export interface Commission {
  id: string;
  title: string;
  text: string;
  holdings: { holdingId: string | null; name: string; weightPct: number | null }[];
  /** An existing page that ends the commission, or null when each holding links to its own page. */
  to: string | null;
  linkLabel: string;
}

const COMMISSION_TEXT: Record<SurveyCheckId, { title: string; text: string; to: string | null; linkLabel: string }> = {
  report: {
    title: "Open the latest report",
    text: "These holdings have a newest report you have not opened here, or none stored.",
    to: null,
    linkLabel: "Open the holding",
  },
  analysis: {
    title: "Refresh the analysis",
    text: "These analyses are missing, weathered or old.",
    to: "/analysis-queue",
    linkLabel: "Open the analysis queue",
  },
  thesis: {
    title: "Write what would prove it wrong",
    text: "No decision for these holdings says what would prove it wrong.",
    to: "/journal",
    linkLabel: "Open the Journal",
  },
  circle: {
    title: "Mark the sector",
    text: "You have not marked how well you know these sectors, or no sector is set.",
    to: "/fortress/circle",
    linkLabel: "Open the Circle of Competence",
  },
  valuation: {
    title: "Find the missing valuation",
    text: "No stored valuation could be read for these holdings.",
    to: null,
    linkLabel: "Open the holding",
  },
};

/** Commissions are the survey's fog, grouped by check, the one covering the most portfolio weight first. */
export function commissionsFor(towers: TowerFog[], state: GameState): Commission[] {
  const out: { commission: Commission; weight: number }[] = [];
  for (const check of SURVEY_CHECKS) {
    const foggy = towers.filter((t) => t.checks.find((c) => c.id === check.id)?.state === "fog");
    if (foggy.length === 0) continue;
    const meta = COMMISSION_TEXT[check.id];
    out.push({
      commission: {
        id: check.id,
        ...meta,
        holdings: foggy.map((t) => ({ holdingId: t.holdingId, name: t.name, weightPct: t.weightPct })),
      },
      weight: foggy.reduce((sum, t) => sum + (t.weightPct ?? 0), 0),
    });
  }
  out.sort((a, b) => b.weight - a.weight);
  const commissions: Commission[] = out.map((o) => o.commission);
  const v = state.vault;
  if (v.accounts_total > 0 && (v.accounts_with_cash < v.accounts_total || v.cash_stale)) {
    commissions.push({
      id: "vault",
      title: "Enter or update the cash figure",
      text:
        v.accounts_with_cash < v.accounts_total
          ? `${v.accounts_total - v.accounts_with_cash} of ${v.accounts_total} accounts have no hand-entered cash.`
          : "The hand-entered cash figure is old.",
      holdings: [],
      to: "/fortress",
      linkLabel: "Enter cash on the Fortress",
    });
  }
  return commissions;
}
