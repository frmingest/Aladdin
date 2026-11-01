/**
 * The tower library (game3d, 2026-11-01). Pure data and words, no three.js and no React.
 *
 * Walk into a holding's tower and you stand in a library with six shelves, one per financial aspect.
 * Nothing here decides a fact: every line is read from the stored GameTower (the same row the flat
 * Fortress and the side panel use), with the same labels. The shelf only adds two things:
 *  - `books`: how many of the eight slots hold a book, a fixed table per stored tier (below);
 *  - `state`: "unknown" (not surveyed: mist over an empty shelf) or "na" (does not apply: bare shelf).
 * Unknown never becomes a nice-looking shelf, and a weak tier never gets more books than a strong one.
 * No buy or sell wording. Colour is never the only signal: the plaque also carries a mark.
 */
import type { GameTower } from "../lib/types";
import {
  EXPOSURE_LABEL,
  FRESHNESS_LABEL,
  LAND_LABEL,
  MOAT_LABEL,
  SIZE_LABEL,
  STRUCTURE_LABEL,
  THESIS_LABEL,
  WALL_LABEL,
  describeSiegeExposure,
  formatWallInput,
  knifeEdgeSummary,
} from "../lib/fortress";
import { WALL_LOOK } from "./stateToWorld";

export const MAX_SHELF_BOOKS = 8;

export type ShelfId = "walls" | "moat" | "land" | "oath" | "storm" | "treasury";
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
export const SHELF_ORDER: readonly ShelfId[] = ["walls", "moat", "land", "oath", "treasury", "storm"];

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
  return `${Math.round(n).toLocaleString("nb-NO")} NOK`;
}

function pct1(value: string | null): string | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : null;
}

function walls(t: GameTower): Shelf {
  const asks = "Can it take a hit?";
  if (t.wall === "unsurveyed") return unknown("walls", "The Walls", asks, [{ label: "", text: WALL_LABEL.unsurveyed, tone: "fog" }]);
  if (t.wall === "not_applicable") return notApplicable("walls", "The Walls", asks, [{ label: "", text: WALL_LABEL.not_applicable }]);
  const integrity = WALL_LOOK[t.wall].integrity ?? 0;
  const lines: ShelfLine[] = [{ label: "Walls", text: WALL_LABEL[t.wall], tone: WALL_TONE[t.wall] }];
  if (t.wall_reason) lines.push({ label: "Why", text: t.wall_reason });
  for (const [k, v] of Object.entries(t.wall_inputs ?? {})) lines.push({ label: "", text: formatWallInput(k, v) });
  const edge = knifeEdgeSummary(t);
  if (edge) lines.push({ label: "Close to the line", text: edge, tone: "warn" });
  return known({ id: "walls", title: "The Walls", asks, tone: WALL_TONE[t.wall] ?? "", books: Math.max(1, Math.round(integrity * MAX_SHELF_BOOKS)), lines });
}

function moat(t: GameTower): Shelf {
  const asks = "Can rivals cross it?";
  if (t.moat === "unsurveyed") return unknown("moat", "The Moat", asks, [{ label: "", text: MOAT_LABEL.unsurveyed, tone: "fog" }]);
  if (t.moat === "not_applicable") return notApplicable("moat", "The Moat", asks, [{ label: "", text: MOAT_LABEL.not_applicable }]);
  return known({
    id: "moat",
    title: "The Moat",
    asks,
    tone: MOAT_TONE[t.moat] ?? "",
    books: MOAT_BOOKS[t.moat] ?? 0,
    lines: [{ label: "Moat", text: MOAT_LABEL[t.moat], tone: MOAT_TONE[t.moat] }],
  });
}

function land(t: GameTower): Shelf {
  const asks = "Is the price fair?";
  if (t.land === "fog") return unknown("land", "The Land", asks, [{ label: "", text: LAND_LABEL.fog, tone: "fog" }]);
  const lines: ShelfLine[] = [{ label: "Price", text: LAND_LABEL[t.land], tone: LAND_TONE[t.land] }];
  if (t.land_reason) lines.push({ label: "Why", text: t.land_reason });
  const mos = pct1(t.margin_of_safety_pct);
  if (mos) lines.push({ label: "Margin of safety", text: mos });
  if (t.verdict_rating) lines.push({ label: "Last verdict", text: t.verdict_rating });
  return known({ id: "land", title: "The Land", asks, tone: LAND_TONE[t.land] ?? "", books: LAND_BOOKS[t.land] ?? 0, lines });
}

function oath(t: GameTower): Shelf {
  const asks = "Is the story still true?";
  const lines: ShelfLine[] = [];
  if (t.freshness !== "not_applicable") {
    const age = t.analysis_age_days;
    lines.push({
      label: "Reading",
      text: `${FRESHNESS_LABEL[t.freshness]}${age !== null && t.freshness !== "unsurveyed" ? ` (${age} day${age === 1 ? "" : "s"} old)` : ""}`,
      tone: t.freshness === "fresh" ? "good" : t.freshness === "unsurveyed" ? "fog" : "warn",
    });
  }
  if (t.thesis === "not_analyzed") return unknown("oath", "The Oath", asks, [{ label: "", text: THESIS_LABEL.not_analyzed, tone: "fog" }, ...lines]);
  if (t.thesis === "not_applicable") return notApplicable("oath", "The Oath", asks, [{ label: "", text: THESIS_LABEL.not_applicable }, ...lines]);
  const fired = t.tripwires_fired;
  return known({
    id: "oath",
    title: "The Oath",
    asks,
    tone: THESIS_TONE[t.thesis] ?? "",
    books: THESIS_BOOKS[t.thesis] ?? 0,
    lines: [
      { label: "Thesis", text: THESIS_LABEL[t.thesis], tone: THESIS_TONE[t.thesis] },
      { label: "Tripwires", text: fired === 0 ? "None fired" : `${fired} fired`, tone: fired === 0 ? "good" : "bad" },
      ...lines,
    ],
  });
}

function storm(t: GameTower): Shelf {
  const asks = "What if the sky falls?";
  const neighbours: ShelfLine[] =
    t.shared_wall_with.length > 0 ? [{ label: "Shares a weak wall with", text: t.shared_wall_with.join(", "), tone: "warn" }] : [];
  if (t.siege_exposure === "unsurveyed" || t.siege_shock_pct === null) {
    return unknown("storm", "The Storm Test", asks, [{ label: "", text: EXPOSURE_LABEL.unsurveyed, tone: "fog" }, ...neighbours]);
  }
  return known({
    id: "storm",
    title: "The Storm Test",
    asks,
    tone: SIEGE_TONE[t.siege_exposure] ?? "",
    books: SIEGE_BOOKS[t.siege_exposure] ?? 0,
    lines: [{ label: "Stress", text: describeSiegeExposure(t), tone: SIEGE_TONE[t.siege_exposure] }, ...neighbours],
  });
}

function treasury(t: GameTower): Shelf {
  const asks = "How big a slice?";
  const lines: ShelfLine[] = [{ label: "Size", text: SIZE_LABEL[t.size_class] }];
  const w = pct1(t.weight_pct);
  if (w) lines.push({ label: "Share of the fortress", text: w });
  const v = nok(t.value_nok);
  if (v) lines.push({ label: "Worth", text: v });
  if (t.sector) lines.push({ label: "Sector", text: t.sector });
  lines.push({ label: "Kind", text: STRUCTURE_LABEL[t.structure] });
  if (t.size_class === "unknown") return unknown("treasury", "The Treasury", asks, lines);
  return known({ id: "treasury", title: "The Treasury", asks, tone: "", books: SIZE_BOOKS[t.size_class] ?? 0, lines });
}

/** The six shelves of one tower's library, in room order. */
export function shelvesFor(t: GameTower): Shelf[] {
  const all: Record<ShelfId, Shelf> = {
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
  if (s.state === "unknown") return `${s.title}: not surveyed`;
  if (s.state === "na") return `${s.title}: does not apply`;
  return `${s.title}: ${s.lines[0]?.text ?? ""}`;
}
