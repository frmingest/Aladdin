/**
 * The tower library (game3d, 2026-11-01). Pure data and words, no three.js and no React.
 *
 * Walk into a holding's tower and you stand in a library with seven shelves: six financial aspects and the Council's words.
 * Nothing here decides a fact: every line is read from the stored GameTower (the same row the flat
 * Fortress and the side panel use), with the same labels. The shelf only adds two things:
 *  - `books`: how many of the eight slots hold a book, a fixed table per stored tier (below);
 *  - `state`: "unknown" (not surveyed: mist over an empty shelf) or "na" (does not apply: bare shelf).
 * Unknown never becomes a nice-looking shelf, and a weak tier never gets more books than a strong one.
 * No buy or sell wording. Colour is never the only signal: the plaque also carries a mark.
 */
import type { GameAdvisorTone, GameTower, HoldingAdvisors } from "../lib/types";
import {
  ADVISOR_NAME,
  MOAT_LABEL,
  SIZE_LABEL,
  STRUCTURE_LABEL,
  WALL_LABEL,
  formatShock,
  formatWallInput,
  knifeEdgeSummary,
} from "../lib/fortress";
import {
  COUNCIL_WORDS,
  FOG_LINE,
  FRESH_WORDS,
  LAND_WORDS,
  NA_LINE,
  SHELF_SIGN,
  STORM_WORDS,
  WHY_WORDS,
  describeShelfWords,
  wallInputLine,
} from "./shelfSignsV2";
import { WALL_LOOK } from "./towerLook";
import { gameAdvisorDisclaimer, gameAdvisorFact, gameAdvisorLine } from "./advisorLinesWordsV1";

export const MAX_SHELF_BOOKS = 8;

export type ShelfId = "walls" | "moat" | "land" | "oath" | "storm" | "treasury" | "council";
export type ShelfTone = "good" | "warn" | "bad" | "fog" | "";
export type ShelfState = "known" | "unknown" | "na";

/** Colour is never the only signal: each tone has its own mark in front of the words. */
export const SHELF_MARK: Record<ShelfTone, string> = { good: "✓", warn: "!", bad: "✕", fog: "?", "": "•" };

/** The mark on a shelf's plaque: a shelf that does not apply gets a dash, so it is not mistaken for plain "size" info. */
export function shelfMark(s: Pick<Shelf, "state" | "tone">): string {
  return s.state === "na" ? "–" : SHELF_MARK[s.tone];
}

export interface ShelfLine {
  /** Short label ("Walls"); empty for a plain sentence. */
  label: string;
  text: string;
  tone?: ShelfTone;
}

export interface Shelf {
  id: ShelfId;
  /** Short name on the plaque. */
  title: string;
  /** The question this shelf answers, in game voice. */
  asks: string;
  state: ShelfState;
  tone: ShelfTone;
  /** Books standing on the shelf, 0 to 8. Always 0 unless state is "known". */
  books: number;
  lines: ShelfLine[];
}

/** Order the shelves stand in the room, and the order of the plain list. */
export const SHELF_ORDER: readonly ShelfId[] = ["walls", "moat", "land", "oath", "treasury", "storm", "council"];

const WALL_TONE: Record<string, ShelfTone> = { basalt: "good", granite: "good", brick: "warn", timber: "warn", rotted: "bad" };
const MOAT_TONE: Record<string, ShelfTone> = { wide: "good", narrow: "warn", none: "bad" };
const LAND_TONE: Record<string, ShelfTone> = { bargain: "good", discount: "good", full_price: "warn", overpriced: "bad" };
const THESIS_TONE: Record<string, ShelfTone> = { intact: "good", review: "warn", breached: "bad" };
const SIEGE_TONE: Record<string, ShelfTone> = { sheltered: "good", exposed: "warn", breach_risk: "bad" };

const MOAT_BOOKS: Record<string, number> = { wide: 8, narrow: 4, none: 1 };
const LAND_BOOKS: Record<string, number> = { bargain: 8, discount: 6, full_price: 4, overpriced: 2 };
const THESIS_BOOKS: Record<string, number> = { intact: 8, review: 4, breached: 1 };
const SIEGE_BOOKS: Record<string, number> = { sheltered: 8, exposed: 4, breach_risk: 1 };
const SIZE_BOOKS: Record<string, number> = { great: 8, medium: 6, small: 4, tiny: 2 };

function known(partial: Omit<Shelf, "state">): Shelf {
  return { ...partial, state: "known" };
}

function unknown(id: ShelfId, title: string, asks: string, lines: ShelfLine[]): Shelf {
  return { id, title, asks, state: "unknown", tone: "fog", books: 0, lines };
}

function notApplicable(id: ShelfId, title: string, asks: string, lines: ShelfLine[]): Shelf {
  return { id, title, asks, state: "na", tone: "", books: 0, lines };
}

function nok(value: string | null): string | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function pct1(value: string | null): string | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : null;
}

function walls(t: GameTower): Shelf {
  const asks = "Can it take a hit?";
  if (t.wall === "unsurveyed") return unknown("walls", SHELF_SIGN.walls, asks, [{ label: "", text: FOG_LINE.walls, tone: "fog" }]);
  if (t.wall === "not_applicable") return notApplicable("walls", SHELF_SIGN.walls, asks, [{ label: "", text: NA_LINE.walls }]);
  const integrity = WALL_LOOK[t.wall].integrity ?? 0;
  const lines: ShelfLine[] = [{ label: "Walls", text: WALL_LABEL[t.wall], tone: WALL_TONE[t.wall] }];
  if (t.wall_reason) lines.push({ label: "Why", text: t.wall_reason });
  for (const [k, v] of Object.entries(t.wall_inputs ?? {})) lines.push({ label: "", text: wallInputLine(k, v, formatWallInput(k, v)) });
  const edge = knifeEdgeSummary(t);
  if (edge) lines.push({ label: "Close to the line", text: edge, tone: "warn" });
  return known({ id: "walls", title: SHELF_SIGN.walls, asks, tone: WALL_TONE[t.wall] ?? "", books: Math.max(1, Math.round(integrity * MAX_SHELF_BOOKS)), lines });
}

function moat(t: GameTower): Shelf {
  const asks = "Can rivals cross it?";
  if (t.moat === "unsurveyed") return unknown("moat", SHELF_SIGN.moat, asks, [{ label: "", text: FOG_LINE.moat, tone: "fog" }]);
  if (t.moat === "not_applicable") return notApplicable("moat", SHELF_SIGN.moat, asks, [{ label: "", text: NA_LINE.moat }]);
  return known({
    id: "moat",
    title: SHELF_SIGN.moat,
    asks,
    tone: MOAT_TONE[t.moat] ?? "",
    books: MOAT_BOOKS[t.moat] ?? 0,
    lines: [{ label: "Moat", text: MOAT_LABEL[t.moat], tone: MOAT_TONE[t.moat] }],
  });
}

function land(t: GameTower): Shelf {
  const asks = "Is the price fair?";
  if (t.land === "fog") return unknown("land", SHELF_SIGN.land, asks, [{ label: "", text: LAND_WORDS.fog, tone: "fog" }]);
  const lines: ShelfLine[] = [{ label: "Price", text: LAND_WORDS[t.land], tone: LAND_TONE[t.land] }];
  if (t.land_reason) lines.push({ label: "Why", text: t.land_reason });
  const mos = pct1(t.margin_of_safety_pct);
  if (mos) lines.push({ label: "Cushion", text: mos });
  // The stored analyst rating (it can read Buy, Sell or Avoid) is not shown in 3D: the game never says buy or sell. It stays on the flat page.
  return known({ id: "land", title: SHELF_SIGN.land, asks, tone: LAND_TONE[t.land] ?? "", books: LAND_BOOKS[t.land] ?? 0, lines });
}

function oath(t: GameTower): Shelf {
  const asks = "Is the story still true?";
  const lines: ShelfLine[] = [];
  if (t.freshness !== "not_applicable") {
    const age = t.analysis_age_days;
    lines.push({
      label: "Reading",
      text: `${FRESH_WORDS[t.freshness]}${age !== null && t.freshness !== "unsurveyed" ? ` (${age} day${age === 1 ? "" : "s"} old)` : ""}`,
      tone: t.freshness === "fresh" ? "good" : t.freshness === "unsurveyed" ? "fog" : "warn",
    });
  }
  if (t.thesis === "not_analyzed") return unknown("oath", SHELF_SIGN.oath, asks, [{ label: "", text: WHY_WORDS.not_analyzed, tone: "fog" }, ...lines]);
  if (t.thesis === "not_applicable") return notApplicable("oath", SHELF_SIGN.oath, asks, [{ label: "", text: WHY_WORDS.not_applicable }, ...lines]);
  const fired = t.tripwires_fired;
  return known({
    id: "oath",
    title: SHELF_SIGN.oath,
    asks,
    tone: THESIS_TONE[t.thesis] ?? "",
    books: THESIS_BOOKS[t.thesis] ?? 0,
    lines: [
      { label: "Your why", text: WHY_WORDS[t.thesis], tone: THESIS_TONE[t.thesis] },
      { label: "Wires", text: fired === 0 ? "None rang" : `${fired} rang`, tone: fired === 0 ? "good" : "bad" },
      ...lines,
    ],
  });
}

function storm(t: GameTower): Shelf {
  const asks = "What if the sky falls?";
  const neighbours: ShelfLine[] =
    t.shared_wall_with.length > 0 ? [{ label: "Shares a weak wall with", text: t.shared_wall_with.join(", "), tone: "warn" }] : [];
  if (t.siege_exposure === "unsurveyed" || t.siege_shock_pct === null) {
    return unknown("storm", SHELF_SIGN.storm, asks, [{ label: "", text: STORM_WORDS.unsurveyed, tone: "fog" }, ...neighbours]);
  }
  return known({
    id: "storm",
    title: SHELF_SIGN.storm,
    asks,
    tone: SIEGE_TONE[t.siege_exposure] ?? "",
    books: SIEGE_BOOKS[t.siege_exposure] ?? 0,
    lines: [{ label: "In the storm", text: `${STORM_WORDS[t.siege_exposure]}: ${formatShock(t.siege_shock_pct)}`, tone: SIEGE_TONE[t.siege_exposure] }, ...neighbours],
  });
}

function treasury(t: GameTower): Shelf {
  const asks = "How big a slice?";
  const lines: ShelfLine[] = [{ label: "Size", text: SIZE_LABEL[t.size_class] }];
  const w = pct1(t.weight_pct);
  if (w) lines.push({ label: "Share of the fortress", text: w });
  const v = nok(t.value_nok);
  if (v) lines.push({ label: "Worth", text: v });
  if (t.sector) lines.push({ label: "Line of business", text: t.sector });
  lines.push({ label: "Kind", text: STRUCTURE_LABEL[t.structure] });
  if (t.size_class === "unknown") return unknown("treasury", SHELF_SIGN.treasury, asks, lines);
  return known({ id: "treasury", title: SHELF_SIGN.treasury, asks, tone: "", books: SIZE_BOOKS[t.size_class] ?? 0, lines });
}

/**
 * What the Council shelf is given. The advisor lines are read from the backend per holding (the same hand-written,
 * rule-chosen lines the flat holding page lists), so they arrive after the room opens:
 *  - `null`: asked, no answer yet; "failed": the answer could not be read; "sample": the sample fortress, which has no
 *    advisors of its own to ask; otherwise the answer.
 * None of these four ever looks like "all is well": silence from the council is not praise.
 */
export type CouncilInput = HoldingAdvisors | "failed" | "sample" | null | undefined;

const COUNCIL_TITLE = SHELF_SIGN.council;
const COUNCIL_ASKS = COUNCIL_WORDS.asks;
/** Tone marks only; the shelf's own tone stays empty because the lines can differ. */
const ADVISOR_SHELF_TONE: Record<GameAdvisorTone, ShelfTone> = { warning: "warn", note: "", calm: "good" };

/** The seventh shelf. Books count the lines the advisors wrote, not how good they are: the plaque tone stays plain. */
export function councilShelf(input: CouncilInput): Shelf {
  if (input === "sample") {
    return unknown("council", COUNCIL_TITLE, COUNCIL_ASKS, [{ label: "", text: COUNCIL_WORDS.sample, tone: "fog" }]);
  }
  if (input === "failed") {
    return unknown("council", COUNCIL_TITLE, COUNCIL_ASKS, [{ label: "", text: COUNCIL_WORDS.failed, tone: "fog" }]);
  }
  if (!input) {
    return unknown("council", COUNCIL_TITLE, COUNCIL_ASKS, [{ label: "", text: COUNCIL_WORDS.waiting, tone: "fog" }]);
  }
  if (input.lines.length === 0) {
    return notApplicable("council", COUNCIL_TITLE, COUNCIL_ASKS, [
      { label: "", text: COUNCIL_WORDS.silent },
      { label: "", text: gameAdvisorDisclaimer(input.disclaimer) },
    ]);
  }
  const lines: ShelfLine[] = [];
  for (const l of input.lines) {
    lines.push({ label: ADVISOR_NAME[l.advisor], text: gameAdvisorLine(l.text), tone: ADVISOR_SHELF_TONE[l.tone] });
    if (l.facts.length > 0) lines.push({ label: "Why", text: l.facts.map(gameAdvisorFact).join(" · ") });
  }
  lines.push({ label: "", text: gameAdvisorDisclaimer(input.disclaimer) });
  return known({ id: "council", title: COUNCIL_TITLE, asks: COUNCIL_ASKS, tone: "", books: Math.min(MAX_SHELF_BOOKS, input.lines.length), lines });
}

/** The seven shelves of one tower's library, in room order. */
export function shelvesFor(t: GameTower, council?: CouncilInput): Shelf[] {
  const all: Record<ShelfId, Shelf> = {
    council: councilShelf(council),
    walls: walls(t),
    moat: moat(t),
    land: land(t),
    oath: oath(t),
    treasury: treasury(t),
    storm: storm(t),
  };
  return SHELF_ORDER.map((id) => all[id]);
}

/** One sentence for screen readers and the plaque tooltip. */
export function describeShelf(s: Shelf): string {
  return describeShelfWords(s.title, s.state, s.lines[0]?.text ?? "");
}
