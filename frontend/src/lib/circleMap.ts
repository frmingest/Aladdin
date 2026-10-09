import { STATUS_LABEL, weightText } from "./rituals";
import type { Competence, CompetenceLevel, CompetenceSector } from "./types";

/** The Circle of Competence as a ring map (game mode, identity pass). Pure layout, unit-tested; the
 * component only draws what this returns. The map says where you stand, it never scores it:
 *
 *  - position carries the level: inside the circle (know), ON the line (partly), in open ground beyond
 *    it (outside, strictly short of the fog), in the fog band at the rim (unmarked, strictly inside the
 *    rim). Pattern and printed words repeat it; the palette is neutral, nothing green, red or amber;
 *  - the angle of a marker is fixed by the sector's place in the full name-sorted list of sectors, so a
 *    mark only slides a marker along its spoke; a spoke length changes only to avoid covering a neighbour;
 *  - the size of a marker is the sector's real share only (area proportional, bounded), the same for
 *    every level, so an unmarked sector is never drawn smaller or larger than a known one of equal share;
 *  - no two markers overlap. A sector that does not fit goes into one "N smaller sectors" tag that counts
 *    every level and weight, so nothing (least of all outside or unmarked) is hidden; the list under the
 *    map has every sector;
 *  - holdings with no sector are one dashed "?" marker at the rim sized by their weight; funds and gold
 *    are "not judged" and are never placed in any zone. */

export type CircleBand = "inside" | "edge" | "outside" | "fog";

/** Layout is done in pixels on a map this wide (the narrowest the page draws on a phone). A wider map
 * only adds room: markers keep their pixel size, positions are percentages of the width. */
export const LAYOUT_PX = 330;
const R = LAYOUT_PX / 2;
/** Radius of the drawn circle line and the start of the fog band, as fractions of the half-width. */
export const CIRCLE_R = 0.38;
export const FOG_FROM = 0.66;
/** Drawn size of a marker, from the sector's real share only (area proportional, bounded). The tap
 * area is a separate, invisible 44 px box, so a small sector is drawn small but is still easy to hit. */
export const DRAW_MIN_PX = 24;
export const DRAW_MAX_PX = 42;
export const HIT_PX = 44;
export const WEIGHT_CAP_PCT = 40;
/** Keep-out gap between two drawn markers, px. */
export const MARKER_GAP_PX = 4;
/** The bottom of the map is kept free for the zone names and the "no sector set" marker. */
export const FREE_WEDGE_DEG = 64;
export const FOG_MIN_OPACITY = 0.85;
/** The heaviest markers carry their name on a wide map; on a phone only the numbers print. */
export const NAMED_MAX = 4;
/** Where the "no sector set" marker sits: bottom of the rim, in the free wedge. */
export const NO_SECTOR_ANGLE = 172;

/** The caption inside the map, said once. */
export const INSIDE_CAPTION = "Inside means you know the sector, not that the holding is sound.";
/** One name per state, the same on the map, the strip, the control, the stones and the list. */
export const RING_LABEL: Record<CircleBand, string> = {
  inside: "Inside",
  edge: "On the edge",
  outside: "Outside",
  fog: "Unmarked",
};
export const SEGMENT_WORD: Record<CompetenceLevel, string> = { know: "Inside", partly: "On the edge", outside: "Outside" };
export const CLEAR_WORD = "Clear mark";
export const NO_SECTOR_TITLE = "No sector set";
export const NOT_JUDGED_TITLE = "Not judged";

/** Fixed words the map prints besides data (sector names, figures). Counted against its own budget. */
export const CIRCLE_MAP_CHROME: string[] = [
  ...Object.values(RING_LABEL),
  INSIDE_CAPTION,
  NO_SECTOR_TITLE,
  NOT_JUDGED_TITLE,
  "smaller sectors",
];
/** Words of fixed chrome the map may add to the page (the old bar legend and headings are gone). */
export const CIRCLE_MAP_CHROME_BUDGET = 40;
/** Whole map block (chrome plus the data it prints for a typical portfolio), words, default view. */
export const CIRCLE_MAP_WORD_BUDGET = 130;

export function bandForLevel(level: CompetenceLevel | null): CircleBand {
  return level === "know" ? "inside" : level === "partly" ? "edge" : level === "outside" ? "outside" : "fog";
}

export function sectorWeight(s: Pick<CompetenceSector, "weight_pct">): number {
  const n = Number(s.weight_pct);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Drawn diameter in px. Weight only: the same function for every level, so an unmarked sector is never
 * drawn smaller or larger than a known one of the same share. */
export function markerSize(weightPct: number): number {
  const share = Math.sqrt(Math.min(Math.max(weightPct, 0), WEIGHT_CAP_PCT) / WEIGHT_CAP_PCT);
  return Math.round(DRAW_MIN_PX + (DRAW_MAX_PX - DRAW_MIN_PX) * share);
}

/** A sector row belongs on the map when something is held in it or you have marked it. A sector with
 * nothing held and no mark is only a row behind a disclosure. */
export function isActiveSector(s: CompetenceSector): boolean {
  return s.holdings.length > 0 || s.level !== null;
}

export function nameOrder(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" }) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Radii (px from the centre) a marker of this size may take in a band, nearest-first order. Outside
 * markers stay strictly below the fog start, fog markers strictly inside the rim, inside markers
 * strictly inside the line; "on the edge" markers sit on the line itself. */
export function bandRadii(band: CircleBand, diameter: number): number[] {
  const m = diameter / 2;
  const line = CIRCLE_R * R;
  const fog = FOG_FROM * R;
  if (band === "edge") return [line];
  const [lo, hi] =
    band === "inside"
      ? [0, line - 3 - m]
      : band === "outside"
        ? [line + 3 + m, fog - 2 - m]
        : [fog + 2 + m, R - 2 - m];
  if (hi < lo) return [(lo + hi) / 2];
  if (band === "inside") return [hi, hi * 0.5].filter((v, i, a) => a.indexOf(v) === i);
  return [lo, (lo + hi) / 2, hi].filter((v, i, a) => a.indexOf(v) === i);
}

export interface CircleMarker {
  key: string;
  /** "sector" for a sector, "nosector" for the holdings that have none. */
  kind: "sector" | "nosector";
  sector: string;
  level: CompetenceLevel | null;
  band: CircleBand;
  /** 1-based number printed on the marker and on the list row (0 for the no-sector marker). */
  pin: number;
  /** Degrees clockwise from the top. Fixed by the sector's name among all sectors. */
  angleDeg: number;
  /** Spoke length as a fraction of the half-width. */
  radius: number;
  /** Offset from the centre of the map, percent of its width. */
  dx: number;
  dy: number;
  /** Drawn diameter, px (weight only). */
  sizePx: number;
  /** Always 1; unknown is never fainter (see FOG_MIN_OPACITY). */
  opacity: number;
  weightPct: number;
  heldCount: number;
  showName: boolean;
  nameRank: number | null;
  /** Accessible name: the sector, the level in words, its share. */
  label: string;
}

export interface CollapsedLevel {
  band: CircleBand;
  count: number;
  weightPct: number;
}

export interface CircleMapModel {
  markers: CircleMarker[];
  /** Sectors that did not fit on the ring without covering another; none is hidden, each level counted. */
  collapsed: { count: number; levels: CollapsedLevel[]; sectors: string[] } | null;
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
  return level === null ? RING_LABEL.fog : RING_LABEL[bandForLevel(level)];
}

export function markerLabel(s: CompetenceSector): string {
  const held = s.holdings.length === 0 ? "nothing held" : `${weightText(s.weight_pct)} of the portfolio`;
  return `${s.sector}: ${levelWord(s.level)}, ${held}`;
}

/** DOM id of a sector's row, so a marker can focus its mark control. */
export function sectorDomId(sector: string): string {
  return `circle-sector-${sector.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x"}`;
}

const BAND_PRIORITY: Record<CircleBand, number> = { fog: 0, outside: 1, edge: 2, inside: 3 };

export function collapsedText(c: NonNullable<CircleMapModel["collapsed"]>): { title: string; detail: string } {
  return {
    title: `${c.count} smaller ${c.count === 1 ? "sector" : "sectors"}`,
    detail: c.levels.map((l) => `${l.count} ${RING_LABEL[l.band].toLowerCase()} (${l.weightPct.toFixed(1)}%)`).join(", "),
  };
}

interface Placed {
  x: number;
  y: number;
  r: number;
}

export function overlaps(a: Placed, b: Placed): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + MARKER_GAP_PX;
}

export function buildCircleMap(c: Competence): CircleMapModel {
  const all = [...c.sectors].sort((a, b) => nameOrder(a.sector, b.sector));
  const slot = new Map(all.map((s, i) => [s.sector, i]));
  const active = all.filter(isActiveSector);
  const quiet = all.filter((s) => !isActiveSector(s));

  const placed: Placed[] = [];
  const noSectorTowers = c.towers.filter((t) => t.status === "unclassified");
  const markers: CircleMarker[] = [];
  const toPlace = (angle: number, diameter: number, band: CircleBand, pick: number): { radiusPx: number; x: number; y: number } | null => {
    const rad = (angle * Math.PI) / 180;
    const options = bandRadii(band, diameter);
    for (let k = 0; k < options.length; k++) {
      const rp = options[(pick + k) % options.length];
      const x = rp * Math.sin(rad);
      const y = -rp * Math.cos(rad);
      if (!placed.some((p) => overlaps(p, { x, y, r: diameter / 2 }))) return { radiusPx: rp, x, y };
    }
    return null;
  };

  const ns = Number(c.unclassified_weight_pct);
  if (noSectorTowers.length > 0) {
    const d = markerSize(Number.isFinite(ns) ? ns : 0);
    const spot = toPlace(NO_SECTOR_ANGLE, d, "fog", 1);
    if (spot) {
      placed.push({ x: spot.x, y: spot.y, r: d / 2 });
      markers.push({
        key: "__nosector",
        kind: "nosector",
        sector: NO_SECTOR_TITLE,
        level: null,
        band: "fog",
        pin: 0,
        angleDeg: NO_SECTOR_ANGLE,
        radius: round1((spot.radiusPx / R) * 1000) / 1000,
        dx: round1((spot.x / (2 * R)) * 100),
        dy: round1((spot.y / (2 * R)) * 100),
        sizePx: d,
        opacity: 1,
        weightPct: Number.isFinite(ns) ? ns : 0,
        heldCount: noSectorTowers.length,
        showName: false,
        nameRank: null,
        label: `${NO_SECTOR_TITLE}: ${noSectorTowers.length} ${noSectorTowers.length === 1 ? "holding" : "holdings"}, ${weightText(c.unclassified_weight_pct)} of the portfolio`,
      });
    }
  }

  const order = [...active].sort(
    (a, b) => BAND_PRIORITY[bandForLevel(a.level)] - BAND_PRIORITY[bandForLevel(b.level)] || sectorWeight(b) - sectorWeight(a) || nameOrder(a.sector, b.sector),
  );
  const rest: CompetenceSector[] = [];
  const onRing: CircleMarker[] = [];
  for (const s of order) {
    const i = slot.get(s.sector)!;
    const band = bandForLevel(s.level);
    const w = sectorWeight(s);
    const d = markerSize(w);
    const angle = slotAngle(i, all.length);
    const spot = toPlace(angle, d, band, i);
    if (!spot) {
      rest.push(s);
      continue;
    }
    placed.push({ x: spot.x, y: spot.y, r: d / 2 });
    onRing.push({
      key: s.sector,
      kind: "sector",
      sector: s.sector,
      level: s.level,
      band,
      pin: 0,
      angleDeg: round1(angle),
      radius: Math.round((spot.radiusPx / R) * 1000) / 1000,
      dx: round1((spot.x / (2 * R)) * 100),
      dy: round1((spot.y / (2 * R)) * 100),
      sizePx: d,
      opacity: 1,
      weightPct: w,
      heldCount: s.holdings.length,
      showName: false,
      nameRank: null,
      label: markerLabel(s),
    });
  }
  const byName = onRing.sort((a, b) => nameOrder(a.sector, b.sector));
  const heaviest = [...byName].sort((a, b) => b.weightPct - a.weightPct || nameOrder(a.sector, b.sector)).slice(0, NAMED_MAX);
  byName.forEach((m, i) => {
    m.pin = i + 1;
    const rank = heaviest.indexOf(m);
    m.showName = rank >= 0;
    m.nameRank = rank >= 0 ? rank : null;
  });
  markers.push(...byName);

  // Rows: pinned sectors first (by their number), then the ones that did not fit, by name.
  const restByName = rest.sort((a, b) => nameOrder(a.sector, b.sector));
  const levels: CollapsedLevel[] = (["fog", "outside", "edge", "inside"] as CircleBand[])
    .map((band) => {
      const group = restByName.filter((s) => bandForLevel(s.level) === band);
      return { band, count: group.length, weightPct: group.reduce((n, s) => n + sectorWeight(s), 0) };
    })
    .filter((l) => l.count > 0);

  return {
    markers,
    collapsed: restByName.length > 0 ? { count: restByName.length, levels, sectors: restByName.map((s) => s.sector) } : null,
    rows: [...byName.map((m) => all.find((s) => s.sector === m.sector)!), ...restByName],
    quiet,
    noSector: { count: noSectorTowers.length, weightText: weightText(c.unclassified_weight_pct), names: noSectorTowers.map((t) => t.name) },
    notJudged: { count: c.towers.filter((t) => t.status === "not_applicable").length },
  };
}

/** Pressing a marker: scroll to the sector's row and focus its mark control (the checked radio, else the
 * first enabled one; the row itself where the control is read-only, as in demo). Null goes to the list. */
export function focusSectorControl(doc: Pick<Document, "getElementById">, sector: string | null, reduce?: boolean): HTMLElement | null {
  const el = doc.getElementById(sector ? sectorDomId(sector) : "circle-marks");
  if (!el) return null;
  const calm = reduce ?? (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
  const control =
    el.querySelector<HTMLElement>('input[type="radio"]:checked:not(:disabled)') ?? el.querySelector<HTMLElement>('input[type="radio"]:not(:disabled)');
  const target = control ?? el;
  target.focus({ preventScroll: true });
  return target;
}

/** Which body the Circle page shows: the ring map only in game mode and not in Plain view. */
export function circleView(gameMode: boolean, plain: boolean): "ring" | "plain" {
  return gameMode && !plain ? "ring" : "plain";
}

/** The page's one write, unchanged: a mark is PUT, clearing it is DELETE. */
export async function saveMark<T>(
  client: { putCompetence: (s: string, l: CompetenceLevel, n: string | null) => Promise<T>; deleteCompetence: (s: string) => Promise<T> },
  sector: string,
  level: CompetenceLevel | "",
  note: string,
): Promise<T> {
  return level === "" ? client.deleteCompetence(sector) : client.putCompetence(sector, level, note.trim() || null);
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

/** Where a zone name sits, percent of the map. The first three share the free bottom spoke; the fog
 * name sits to the left of the "no sector set" marker, in the fog band. */
export function ringLabelPos(band: CircleBand): { left: number; top: number } {
  if (band === "fog") return { left: 34, top: 93 };
  const r = band === "inside" ? 0.26 : band === "edge" ? CIRCLE_R : (CIRCLE_R + FOG_FROM) / 2;
  return { left: 50, top: round1(50 + 50 * r) };
}
