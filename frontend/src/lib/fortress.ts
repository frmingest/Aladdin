import type {
  FortressFreshness,
  FortressLand,
  FortressMoat,
  FortressSiegeExposure,
  FortressSiegeLevel,
  FortressSize,
  FortressStructure,
  FortressTemperamentLevel,
  FortressThesis,
  FortressVaultLevel,
  FortressWall,
  GameSharedWall,
  GameTower,
} from "./types";

/**
 * Pure layout + wording for the Fortress scene (F33, G2). No React, so it is
 * unit-tested. Nothing here decides how strong anything is: every material,
 * moat width, size and freshness arrives already decided by the backend's
 * versioned mapping (backend/app/domain/game_mapping). This file only turns
 * those categories into positions and plain-language labels.
 */

export const SCENE_WIDTH = 1000;
export const ROW_HEIGHT = 250;
export const SCENE_TOP = 70;
const SIDE_MARGIN = 36;
const TOWER_GAP = 26;

const SIZE_DIMENSIONS: Record<FortressSize, { w: number; h: number }> = {
  great: { w: 118, h: 156 },
  medium: { w: 90, h: 120 },
  small: { w: 66, h: 88 },
  tiny: { w: 48, h: 62 },
  unknown: { w: 58, h: 74 },
};

/** Funds, bullion and granaries are drawn lower than a keep of the same size. */
const STRUCTURE_HEIGHT: Record<FortressStructure, number> = {
  keep: 1,
  outpost: 0.72,
  bullion: 0.6,
  granary: 0.85,
};

export interface PlacedTower {
  tower: GameTower;
  /** Left edge. */
  x: number;
  /** Ground line the tower stands on. */
  y: number;
  w: number;
  h: number;
  row: number;
  /** Position in draw order, used to stagger the rise-in animation. */
  index: number;
}

export interface FortressLayout {
  items: PlacedTower[];
  rows: number;
  height: number;
}

function weightOf(t: GameTower): number {
  if (t.weight_pct === null) return -1;
  const n = Number(t.weight_pct);
  return Number.isFinite(n) ? n : -1;
}

/** Biggest holding first; unweighted ones last; ties broken by name so the
 * picture is stable between loads. */
export function sortTowers(towers: GameTower[]): GameTower[] {
  return [...towers].sort((a, b) => weightOf(b) - weightOf(a) || a.name.localeCompare(b.name));
}

export function towerDimensions(t: GameTower): { w: number; h: number } {
  const base = SIZE_DIMENSIONS[t.size_class];
  return { w: base.w, h: Math.round(base.h * STRUCTURE_HEIGHT[t.structure]) };
}

/** Flow towers left to right, wrapping to a new row when the next one would
 * pass the scene's right margin; each row is centred. */
export function layoutTowers(towers: GameTower[], width = SCENE_WIDTH): FortressLayout {
  const usable = width - SIDE_MARGIN * 2;
  const rows: GameTower[][] = [[]];
  let rowWidth = 0;
  for (const tower of sortTowers(towers)) {
    const { w } = towerDimensions(tower);
    const needed = rows[rows.length - 1].length === 0 ? w : rowWidth + TOWER_GAP + w;
    if (needed > usable && rows[rows.length - 1].length > 0) {
      rows.push([]);
      rowWidth = 0;
    }
    const current = rows[rows.length - 1];
    rowWidth = current.length === 0 ? w : rowWidth + TOWER_GAP + w;
    current.push(tower);
  }

  const items: PlacedTower[] = [];
  let index = 0;
  rows.forEach((rowTowers, row) => {
    const dims = rowTowers.map(towerDimensions);
    const total = dims.reduce((sum, d) => sum + d.w, 0) + TOWER_GAP * Math.max(0, rowTowers.length - 1);
    let x = Math.round((width - total) / 2);
    rowTowers.forEach((tower, i) => {
      items.push({
        tower,
        x,
        y: SCENE_TOP + row * ROW_HEIGHT + 170,
        w: dims[i].w,
        h: dims[i].h,
        row,
        index: index++,
      });
      x += dims[i].w + TOWER_GAP;
    });
  });

  const rowCount = towers.length === 0 ? 0 : rows.length;
  return { items, rows: rowCount, height: SCENE_TOP + Math.max(1, rowCount) * ROW_HEIGHT + 20 };
}

/** Huts drawn in the shantytown strip: one per tiny position, capped so a
 * very scattered portfolio still draws a readable picture. */
export const MAX_DRAWN_SHACKS = 16;
export function drawnShacks(shackCount: number): number {
  return Math.max(0, Math.min(MAX_DRAWN_SHACKS, Math.floor(shackCount)));
}

export const WALL_LABEL: Record<FortressWall, string> = {
  basalt: "Basalt walls",
  granite: "Granite walls",
  brick: "Brick walls",
  timber: "Timber walls",
  rotted: "Rotted walls",
  unsurveyed: "Walls not surveyed",
  not_applicable: "No walls (no balance sheet to judge)",
};

export const MOAT_LABEL: Record<FortressMoat, string> = {
  wide: "Wide moat",
  narrow: "Narrow moat",
  none: "No moat",
  unsurveyed: "Moat not surveyed",
  not_applicable: "No moat (not a business)",
};

export const SIZE_LABEL: Record<FortressSize, string> = {
  great: "Great tower",
  medium: "Medium tower",
  small: "Small tower",
  tiny: "Tiny tower",
  unknown: "Size unknown",
};

export const STRUCTURE_LABEL: Record<FortressStructure, string> = {
  keep: "Keep",
  outpost: "Allied outpost (fund)",
  bullion: "Gold store",
  granary: "Granary (cash-like fund)",
};

export const FRESHNESS_LABEL: Record<FortressFreshness, string> = {
  fresh: "Analysis is fresh",
  weathered: "Analysis is ageing (ivy on the walls)",
  overgrown: "Analysis is stale (overgrown)",
  unsurveyed: "Not analysed yet (shrouded in fog)",
  not_applicable: "No analysis applies",
};

export const VAULT_LABEL: Record<FortressVaultLevel, string> = {
  deep: "Deep vault",
  stocked: "Stocked vault",
  thin: "Thin vault",
  empty: "Empty vault",
  unsurveyed: "Cash not entered",
};

/** One plain sentence for screen readers and the details panel. */
export function describeTower(t: GameTower): string {
  const parts = [t.name, SIZE_LABEL[t.size_class].toLowerCase()];
  if (t.structure !== "keep") parts.push(STRUCTURE_LABEL[t.structure].toLowerCase());
  if (t.moat !== "not_applicable") parts.push(MOAT_LABEL[t.moat].toLowerCase());
  if (t.wall !== "not_applicable") parts.push(WALL_LABEL[t.wall].toLowerCase());
  if (t.thesis === "breached") parts.push("a tripwire has fired");
  else if (t.thesis === "review") parts.push("thesis flagged for review");
  if (t.land === "bargain" || t.land === "discount") parts.push(LAND_SHORT[t.land].toLowerCase());
  return parts.join(", ");
}

// --- G4: sieges, land for sale, breaches --------------------------------------
// Wording and drawing helpers over categories the backend already decided
// (backend/app/services/game/rules.py). Nothing here scores anything.

export const SIEGE_LABEL: Record<FortressSiegeLevel, string> = {
  calm: "Calm skies",
  gathering: "Storm clouds gathering",
  besieged: "Under siege",
  unsurveyed: "Weather not surveyed",
};

export const EXPOSURE_LABEL: Record<FortressSiegeExposure, string> = {
  sheltered: "Sheltered in the stored stress scenario",
  exposed: "Exposed in the stored stress scenario",
  breach_risk: "Wall at risk of breach in the stored stress scenario",
  unsurveyed: "No stress result stored",
};

export const LAND_LABEL: Record<FortressLand, string> = {
  bargain: "Land for sale: below even the bear case",
  discount: "On offer: priced below the base case",
  full_price: "Fully priced: above the base case",
  overpriced: "Dear: above the bull case",
  fog: "Price not surveyed (fog)",
};

export const THESIS_LABEL: Record<FortressThesis, string> = {
  intact: "Thesis intact",
  review: "Something changed: review the thesis",
  breached: "Wall breached: a tripwire has fired",
  not_analyzed: "No thesis analysed yet",
  not_applicable: "No thesis applies",
};

/** Short tags for the Ledger and the signposts. */
export const LAND_SHORT: Record<FortressLand, string> = {
  bargain: "For sale",
  discount: "On offer",
  full_price: "Full price",
  overpriced: "Dear",
  fog: "Fog",
};

export const THESIS_SHORT: Record<FortressThesis, string> = {
  intact: "Intact",
  review: "Review",
  breached: "Breached",
  not_analyzed: "Not analysed",
  not_applicable: "n/a",
};

export const EXPOSURE_SHORT: Record<FortressSiegeExposure, string> = {
  sheltered: "Sheltered",
  exposed: "Exposed",
  breach_risk: "Breach risk",
  unsurveyed: "Unknown",
};

/** The sky follows the backend's siege level. The scene is a painting in a
 * frame, so these are fixed colours (like the rest of the scene). */
export interface SiegeSky {
  top: string;
  bottom: string;
  /** 0–1 opacity of the storm clouds. */
  clouds: number;
  /** Distant campfires on the horizon. */
  fires: number;
  /** A pale mist drawn when the weather itself was not surveyed. */
  mist: boolean;
}

export function siegeSky(level: FortressSiegeLevel | null | undefined): SiegeSky {
  switch (level) {
    case "gathering":
      return { top: "#171b27", bottom: "#3a3f52", clouds: 0.75, fires: 0, mist: false };
    case "besieged":
      return { top: "#1d1318", bottom: "#5a2a2a", clouds: 0.95, fires: 5, mist: false };
    case "unsurveyed":
    case null:
    case undefined:
      return { top: "#141b29", bottom: "#2a3850", clouds: 0, fires: 0, mist: true };
    default:
      return { top: "#141b29", bottom: "#2a3850", clouds: 0, fires: 0, mist: false };
  }
}

/** Ladders against a wall only while the enemy is at the gate: in calm
 * weather a hypothetical scenario loss is shown in the survey and Ledger, not
 * drawn as an attack. 0 = none. */
export function ladderCount(exposure: FortressSiegeExposure, level: FortressSiegeLevel | null | undefined): number {
  if (level !== "gathering" && level !== "besieged") return 0;
  if (exposure === "breach_risk") return 2;
  if (exposure === "exposed") return 1;
  return 0;
}

/** The text on a land signpost, or null when there is no sign. */
export function landSignText(land: FortressLand): string | null {
  switch (land) {
    case "bargain":
      return "SALE";
    case "discount":
      return "OFFER";
    case "overpriced":
      return "DEAR";
    default:
      return null;
  }
}

/** A stored scenario shock (fraction, negative = loss) as "−25.0%". */
export function formatShock(shock: string | null): string {
  if (shock === null) return "—";
  const n = Number(shock);
  if (!Number.isFinite(n)) return shock;
  const pct = (n * 100).toFixed(1);
  return n < 0 ? `−${pct.slice(1)}%` : `${pct}%`;
}

const METHOD_LABEL: Record<string, string> = {
  dcf_bear: "price falling to the bear-case value",
  volatility: "a two-standard-deviation price move",
};

export function describeSiegeExposure(t: GameTower): string {
  if (t.siege_exposure === "unsurveyed" || t.siege_shock_pct === null) return EXPOSURE_LABEL.unsurveyed;
  const how = t.siege_method ? METHOD_LABEL[t.siege_method] : undefined;
  return `${EXPOSURE_LABEL[t.siege_exposure]}: ${formatShock(t.siege_shock_pct)}${how ? ` (${how})` : ""}`;
}

/** Towers that share a weak wall, in the scene's left-to-right order, grouped
 * into connectable pairs. Only same-row neighbours get a wall segment drawn
 * between them; a pair on different rows is listed in the survey instead. */
export interface WallLink {
  fromId: string;
  toId: string;
  correlation: string;
}

export function sharedWallLinks(
  items: PlacedTower[],
  walls: GameSharedWall[],
): WallLink[] {
  const byTicker = new Map(items.map((i) => [i.tower.ticker, i]));
  const links: WallLink[] = [];
  for (const wall of walls) {
    const members = wall.tickers
      .map((tk) => byTicker.get(tk))
      .filter((m): m is PlacedTower => m !== undefined)
      .sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < members.length; i++) {
      if (members[i].row !== members[i + 1].row) continue;
      links.push({
        fromId: members[i].tower.holding_id,
        toId: members[i + 1].tower.holding_id,
        correlation: wall.correlation,
      });
    }
  }
  return links;
}

/** Ledger sorting, filtering and totals (G3). Pure, so unit-tested. The Ledger
 * only reorders and subsets what the backend decided; it never recomputes a
 * wall, moat or size. */
export type LedgerSortKey = "weight" | "name" | "wall" | "moat" | "freshness" | "land" | "thesis" | "siege";
export type LedgerSortDir = "asc" | "desc";

/** Strongest first. Unknown / not-applicable sort after every real rating. */
const WALL_RANK: Record<FortressWall, number> = {
  basalt: 0,
  granite: 1,
  brick: 2,
  timber: 3,
  rotted: 4,
  unsurveyed: 5,
  not_applicable: 6,
};
const MOAT_RANK: Record<FortressMoat, number> = {
  wide: 0,
  narrow: 1,
  none: 2,
  unsurveyed: 3,
  not_applicable: 4,
};
const FRESHNESS_RANK: Record<FortressFreshness, number> = {
  fresh: 0,
  weathered: 1,
  overgrown: 2,
  unsurveyed: 3,
  not_applicable: 4,
};

/** G4 ranks. Land: cheapest first. Thesis and siege: the most urgent first
 * (a breach, then a review; the most exposed first). Unknown sorts last. */
const LAND_RANK: Record<FortressLand, number> = { bargain: 0, discount: 1, full_price: 2, overpriced: 3, fog: 4 };
const THESIS_RANK: Record<FortressThesis, number> = {
  breached: 0,
  review: 1,
  intact: 2,
  not_analyzed: 3,
  not_applicable: 4,
};
const EXPOSURE_RANK: Record<FortressSiegeExposure, number> = {
  breach_risk: 0,
  exposed: 1,
  sheltered: 2,
  unsurveyed: 3,
};

export function sortLedger(
  towers: GameTower[],
  key: LedgerSortKey,
  dir: LedgerSortDir = key === "weight" ? "desc" : "asc",
): GameTower[] {
  const sign = dir === "asc" ? 1 : -1;
  const cmp = (a: GameTower, b: GameTower): number => {
    switch (key) {
      case "weight":
        return weightOf(a) - weightOf(b);
      case "name":
        return a.name.localeCompare(b.name);
      case "wall":
        return WALL_RANK[a.wall] - WALL_RANK[b.wall];
      case "moat":
        return MOAT_RANK[a.moat] - MOAT_RANK[b.moat];
      case "freshness":
        return FRESHNESS_RANK[a.freshness] - FRESHNESS_RANK[b.freshness];
      case "land":
        return LAND_RANK[a.land] - LAND_RANK[b.land];
      case "thesis":
        return THESIS_RANK[a.thesis] - THESIS_RANK[b.thesis];
      case "siege":
        return EXPOSURE_RANK[a.siege_exposure] - EXPOSURE_RANK[b.siege_exposure];
    }
  };
  // Ties fall back to the scene's order so the table is stable.
  return [...towers].sort((a, b) => sign * cmp(a, b) || weightOf(b) - weightOf(a) || a.name.localeCompare(b.name));
}

export type LedgerFilter = "all" | "attention";

/** "Needs attention" = a wall at timber or worse, no moat, an analysis that
 * is stale or missing, or (G4) a fired tripwire: the places a value investor
 * should look first. A fired tripwire counts because it is the one signal the
 * owner set up in advance to say "look again". Being cheap ("land for sale")
 * or exposed in a hypothetical scenario does not: those are not problems with
 * the business. A reading aid over backend categories, not a new score. */
export function needsAttention(t: GameTower): boolean {
  return (
    t.wall === "timber" ||
    t.wall === "rotted" ||
    t.moat === "none" ||
    t.freshness === "overgrown" ||
    t.freshness === "unsurveyed" ||
    t.thesis === "breached"
  );
}

export function filterLedger(towers: GameTower[], filter: LedgerFilter): GameTower[] {
  return filter === "all" ? towers : towers.filter(needsAttention);
}

export interface LedgerTotals {
  count: number;
  /** Combined portfolio share of the rows shown, 0–100. */
  weightPct: number;
  attention: number;
}

export function ledgerTotals(towers: GameTower[]): LedgerTotals {
  let weightPct = 0;
  let attention = 0;
  for (const t of towers) {
    if (t.weight_pct !== null && Number.isFinite(Number(t.weight_pct))) weightPct += Number(t.weight_pct);
    if (needsAttention(t)) attention += 1;
  }
  return { count: towers.length, weightPct, attention };
}

// --- G6: temperament meter ----------------------------------------------------
// Wording and dial geometry only. The level, needle and every event line are
// decided by the backend's rules (backend/app/services/game/temperament.py).

export const TEMPERAMENT_LABEL: Record<FortressTemperamentLevel, string> = {
  composed: "Composed",
  steady: "Steady",
  restless: "Restless",
  rash: "Rash",
  unsurveyed: "Not enough to read",
};

export const TEMPERAMENT_TEXT: Record<FortressTemperamentLevel, string> = {
  composed: "Most of what the journal and snapshots show is patient, documented decision-making.",
  steady: "A mix: more discipline than haste, with some lines worth a look.",
  restless: "More haste than discipline in what was logged.",
  rash: "Almost everything the rules could judge drained the meter.",
  unsurveyed: "Nothing in the window met a rule, so there is no reading (not the same as a good one).",
};

/** Short names for each rule id the backend can emit. Unknown ids fall back
 * to the id itself, so a new backend rule never breaks the card. */
export const TEMPERAMENT_RULE_LABEL: Record<string, string> = {
  bought_against_verdict: "Bought against the verdict",
  no_invalidation: "No invalidation written",
  sold_intact_thesis: "Sold an intact thesis",
  churn: "Churn",
  acted_on_tripwire: "Acted on a tripwire",
  held_through_drop: "Held through a drop",
  review_6m_done: "6-month review done",
  review_12m_done: "12-month review done",
};

export function temperamentRuleLabel(rule: string): string {
  return TEMPERAMENT_RULE_LABEL[rule] ?? rule.replace(/_/g, " ");
}

/** The dial's bands, 0–100, matching the mapping's v1 edges (20 / 40 / 70).
 * Drawing only: the backend decides the level. */
export const TEMPERAMENT_BANDS: ReadonlyArray<{ from: number; to: number; level: FortressTemperamentLevel }> = [
  { from: 0, to: 20, level: "rash" },
  { from: 20, to: 40, level: "restless" },
  { from: 40, to: 70, level: "steady" },
  { from: 70, to: 100, level: "composed" },
];

/** A point on a half-dial: 0 is the far left, 100 the far right, centre (cx, cy). */
export function dialPoint(pct: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const clamped = Math.min(100, Math.max(0, pct));
  const angle = Math.PI * (1 - clamped / 100);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

/** SVG arc path for one band of the half-dial. */
export function dialArc(from: number, to: number, cx: number, cy: number, r: number): string {
  const a = dialPoint(from, cx, cy, r);
  const b = dialPoint(to, cx, cy, r);
  const f = (n: number) => n.toFixed(2);
  return `M${f(a.x)} ${f(a.y)} A${r} ${r} 0 0 1 ${f(b.x)} ${f(b.y)}`;
}

/** The needle position, or null when there is no reading (never a default 50). */
export function needlePct(needle: string | null): number | null {
  if (needle === null) return null;
  const n = Number(needle);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}
