import { LEVEL_LABEL, STATUS_LABEL, weightText } from "./rituals";
import type { Competence, CompetenceLevel, CompetenceSector } from "./types";

/** The Circle of Competence as a ring map (game mode, identity pass). Pure layout, unit-tested; the
 * component only draws what this returns. The map says where you stand, it never scores it:
 *
 *  - position carries the level: inside the circle (know), ON the line (partly), in open ground beyond
 *    it (outside), in the fog band at the rim (unmarked). Pattern and printed words repeat it, so no
 *    level relies on colour; the palette is neutral parchment and ink, nothing green, red or amber;
 *  - the angle of a marker is fixed by the sector's name (alphabetical slots), so a mark only slides a
 *    marker along its spoke, it never reshuffles the ring;
 *  - the size of a marker is the sector's real share of the portfolio (area proportional, bounded),
 *    the same function for every level, and an unmarked sector is never drawn smaller than a known one
 *    of the same weight, nor fainter than FOG_MIN_OPACITY;
 *  - more than MAX_MARKERS sectors collapse the smallest into one "N smaller sectors" tag; the list
 *    under the map still has every one of them;
 *  - funds and gold are "not judged" and are never placed in any zone; a holding with no sector is
 *    "no sector set" and stays in the fog tag, not on the ring. */

export type CircleBand = "inside" | "edge" | "outside" | "fog";

/** Most markers drawn on the ring; the rest collapse into one tag. */
export const MAX_MARKERS = 12;
/** Radius of the drawn circle line, as a fraction of the half-width of the map. */
export const CIRCLE_R = 0.5;
/** Three spoke lengths per band (cycling by slot) so neighbouring markers do not sit on each other.
 * The edge band is a single radius: a "partly" marker straddles the line itself. */
export const BAND_RADII: Record<CircleBand, readonly [number, number, number]> = {
  inside: [0.18, 0.27, 0.36],
  edge: [CIRCLE_R, CIRCLE_R, CIRCLE_R],
  outside: [0.6, 0.67, 0.74],
  fog: [0.79, 0.84, 0.89],
};
/** Where the fog band starts (fraction of the half-width). */
export const FOG_FROM = 0.74;
/** The bottom of the map is kept free for the zone names; markers fill the rest of the ring. */
export const FREE_WEDGE_DEG = 56;
/** Map width at which markers are drawn at their nominal size; a narrower map scales them down (never below 44 px). */
export const MAP_REF_PX = 400;
export const MARKER_MIN_PX = 44;
export const MARKER_MAX_PX = 68;
/** An unmarked marker is at least this big (full size, never a shrunk or faded version of a known one). */
export const FOG_MIN_PX = 52;
/** A sector at or above this share of the portfolio is drawn at the largest size. */
export const WEIGHT_CAP_PCT = 30;
export const FOG_MIN_OPACITY = 0.85;
/** The largest markers carry their name on the map; the others carry a number that the list repeats. */
export const NAMED_MAX = 6;

/** The caption inside the map, said once. */
export const INSIDE_CAPTION = "Inside means you know the sector, not that the holding is sound.";
/** The zone names printed on the map, one per band. */
export const RING_LABEL: Record<CircleBand, string> = {
  inside: "Inside",
  edge: "On the line",
  outside: "Outside",
  fog: "Unmarked",
};
/** Short words on the three-state control; "Clear" removes the mark. */
export const SEGMENT_WORD: Record<CompetenceLevel, string> = { know: "Know", partly: "Edge", outside: "Outside" };
export const CLEAR_WORD = "Clear mark";
export const NO_SECTOR_TITLE = "No sector set";
export const NOT_JUDGED_TITLE = "Not judged";

/** Fixed words the map prints besides data (sector names, figures). Counted against its own budget. */
export const CIRCLE_MAP_CHROME: string[] = [
  ...Object.values(RING_LABEL),
  INSIDE_CAPTION,
  STATUS_LABEL.inside,
  STATUS_LABEL.edge,
  STATUS_LABEL.outside,
  STATUS_LABEL.unmarked,
  NO_SECTOR_TITLE,
  NOT_JUDGED_TITLE,
  "smaller sectors",
];
/** Words of fixed chrome the map may add to the page (the old bar legend and headings are gone). */
export const CIRCLE_MAP_CHROME_BUDGET = 40;
/** Whole map block (chrome plus the data it prints for a typical portfolio), words, default view. */
export const CIRCLE_MAP_WORD_BUDGET = 110;

export function bandForLevel(level: CompetenceLevel | null): CircleBand {
  return level === "know" ? "inside" : level === "partly" ? "edge" : level === "outside" ? "outside" : "fog";
}

export function sectorWeight(s: Pick<CompetenceSector, "weight_pct">): number {
  const n = Number(s.weight_pct);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Diameter in px. Area is proportional to the real share, bounded by the min and max; the same for
 * every level, except that fog never goes below FOG_MIN_PX so unknown is never the smaller picture. */
export function markerSize(weightPct: number, band: CircleBand): number {
  const share = Math.sqrt(Math.min(Math.max(weightPct, 0), WEIGHT_CAP_PCT) / WEIGHT_CAP_PCT);
  const base = Math.round(MARKER_MIN_PX + (MARKER_MAX_PX - MARKER_MIN_PX) * share);
  return band === "fog" ? Math.max(base, FOG_MIN_PX) : base;
}

/** A sector row belongs on the map when something is held in it or you have marked it. A sector with
 * nothing held and no mark is only a row behind a disclosure. */
export function isActiveSector(s: CompetenceSector): boolean {
  return s.holdings.length > 0 || s.level !== null;
}

export function nameOrder(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" }) || (a < b ? -1 : a > b ? 1 : 0);
}

export interface CircleMarker {
  key: string;
  sector: string;
  level: CompetenceLevel | null;
  band: CircleBand;
  /** 1-based number printed on the marker and on the list row. */
  pin: number;
  /** Degrees clockwise from the top. Fixed by the sector's name. */
  angleDeg: number;
  /** Spoke length as a fraction of the half-width. */
  radius: number;
  /** Offset from the centre of the map, percent of its width. */
  dx: number;
  dy: number;
  sizePx: number;
  /** Always 1; unknown is never fainter (see FOG_MIN_OPACITY). */
  opacity: number;
  weightPct: number;
  heldCount: number;
  showName: boolean;
  /** 0 for the heaviest named marker, 1 for the next, ...; null when only a number is printed. */
  nameRank: number | null;
  /** Accessible name: the sector, the level in words, its share. */
  label: string;
}

export interface CircleMapModel {
  markers: CircleMarker[];
  collapsed: { count: number; unmarked: number; sectors: string[] } | null;
  /** Sectors that have a row in the main list (held or marked), pinned ones first in name order. */
  rows: CompetenceSector[];
  /** Nothing held, no mark: behind a disclosure. */
  quiet: CompetenceSector[];
  noSector: { count: number; weightText: string; names: string[] };
  notJudged: { count: number };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Angle of slot i of n, clockwise from the top; the free wedge at the bottom is skipped. */
export function slotAngle(i: number, n: number): number {
  const start = 180 + FREE_WEDGE_DEG / 2;
  return ((start + ((360 - FREE_WEDGE_DEG) * (i + 0.5)) / n) % 360 + 360) % 360;
}

export function levelWord(level: CompetenceLevel | null): string {
  return level === null ? STATUS_LABEL.unmarked : LEVEL_LABEL[level];
}

export function markerLabel(s: CompetenceSector): string {
  const held = s.holdings.length === 0 ? "nothing held" : `${weightText(s.weight_pct)} of the portfolio`;
  return `${s.sector}: ${levelWord(s.level)}, ${held}`;
}

/** DOM id of a sector's row, so a marker can focus its mark control. */
export function sectorDomId(sector: string): string {
  return `circle-sector-${sector.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x"}`;
}

export function buildCircleMap(c: Competence): CircleMapModel {
  const active = c.sectors.filter(isActiveSector);
  const quiet = c.sectors.filter((s) => !isActiveSector(s)).sort((a, b) => nameOrder(a.sector, b.sector));

  const bySize = [...active].sort((a, b) => sectorWeight(b) - sectorWeight(a) || nameOrder(a.sector, b.sector));
  const kept = bySize.slice(0, MAX_MARKERS);
  const rest = bySize.slice(MAX_MARKERS).sort((a, b) => nameOrder(a.sector, b.sector));
  const named = new Map(kept.slice(0, NAMED_MAX).map((s, i) => [s.sector, i] as const));

  const ordered = [...kept].sort((a, b) => nameOrder(a.sector, b.sector));
  const markers: CircleMarker[] = ordered.map((s, i) => {
    const band = bandForLevel(s.level);
    const radius = BAND_RADII[band][i % 3];
    const angle = slotAngle(i, ordered.length);
    const rad = (angle * Math.PI) / 180;
    const w = sectorWeight(s);
    return {
      key: s.sector,
      sector: s.sector,
      level: s.level,
      band,
      pin: i + 1,
      angleDeg: round1(angle),
      radius,
      dx: round1(50 * radius * Math.sin(rad)),
      dy: round1(-50 * radius * Math.cos(rad)),
      sizePx: markerSize(w, band),
      opacity: 1,
      weightPct: w,
      heldCount: s.holdings.length,
      showName: named.has(s.sector),
      nameRank: named.get(s.sector) ?? null,
      label: markerLabel(s),
    };
  });

  const noSectorTowers = c.towers.filter((t) => t.status === "unclassified");
  return {
    markers,
    collapsed:
      rest.length > 0
        ? { count: rest.length, unmarked: rest.filter((s) => s.level === null).length, sectors: rest.map((s) => s.sector) }
        : null,
    rows: [...ordered, ...rest],
    quiet,
    noSector: { count: noSectorTowers.length, weightText: weightText(c.unclassified_weight_pct), names: noSectorTowers.map((t) => t.name) },
    notJudged: { count: c.towers.filter((t) => t.status === "not_applicable").length },
  };
}

export interface HudFact {
  key: "inside" | "edge" | "outside" | "unmarked";
  label: string;
  value: string;
}

/** The four facts of the strip, each exactly as the backend returned it. No sum, no coverage figure. */
export function hudFacts(c: Pick<Competence, "inside_weight_pct" | "edge_weight_pct" | "outside_weight_pct" | "unmarked_weight_pct">): HudFact[] {
  return [
    { key: "inside", label: STATUS_LABEL.inside, value: weightText(c.inside_weight_pct) },
    { key: "edge", label: STATUS_LABEL.edge, value: weightText(c.edge_weight_pct) },
    { key: "outside", label: STATUS_LABEL.outside, value: weightText(c.outside_weight_pct) },
    { key: "unmarked", label: STATUS_LABEL.unmarked, value: weightText(c.unmarked_weight_pct) },
  ];
}

/** Position of a zone name on the free bottom spoke, percent from the top of the map. */
export function ringLabelTop(band: CircleBand): number {
  const r = band === "inside" ? 0.26 : band === "edge" ? CIRCLE_R : band === "outside" ? 0.67 : 0.9;
  return round1(50 + 50 * r);
}
