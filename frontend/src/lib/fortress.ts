import type {
  FortressFreshness,
  FortressLand,
  FortressMoat,
  FortressSiegeExposure,
  FortressSiegeLevel,
  FortressSize,
  FortressStructure,
  FortressTemperamentLevel,
  GameAdvisorName,
  GameMargin,
  GameAdvisorTone,
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
export const ROW_HEIGHT = 290;
export const SCENE_TOP = 130;
const SIDE_MARGIN = 36;
export const TOWER_GAP = 26;

/** The fortress is one structure (2026-10-01): a Great Keep in the middle of
 * the top terrace stands for the whole portfolio, every holding is a tower in
 * its curtain wall, and the moat runs in one channel in front of the walls. */
export const KEEP_WIDTH = 190;
export const KEEP_HEIGHT = 190;
/** Height of the curtain wall that joins the towers of a row. */
export const CURTAIN_HEIGHT = 54;
/** Outer end of every curtain wall and moat (corner bastions stand here). */
export const WALL_EDGE = 28;

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

/** The Great Keep: stands for the whole fortress, not for one holding. */
export interface PlacedKeep {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FortressLayout {
  items: PlacedTower[];
  rows: number;
  height: number;
  keep: PlacedKeep;
}

/** Ground line of a row of towers. */
export function groundY(row: number): number {
  return SCENE_TOP + row * ROW_HEIGHT + 170;
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

/** How much taller or shorter than its size class a tower is drawn, from its
 * weight in the portfolio (option D, 2026-10-09). Bounded so a heavy holding
 * never outgrows the Great Keep and a light one stays clickable. Height only:
 * widths decide the layout, and an unknown weight draws at the class height. */
export const WEIGHT_SCALE_MIN = 0.9;
export const WEIGHT_SCALE_MAX = 1.15;
export function weightScale(weightPct: string | null): number {
  if (weightPct === null) return 1;
  const w = Number(weightPct);
  if (!Number.isFinite(w)) return 1;
  return Math.min(WEIGHT_SCALE_MAX, Math.max(WEIGHT_SCALE_MIN, 0.9 + 0.0125 * w));
}

export function towerDimensions(t: GameTower): { w: number; h: number } {
  const base = SIZE_DIMENSIONS[t.size_class];
  return { w: base.w, h: Math.round(base.h * STRUCTURE_HEIGHT[t.structure] * weightScale(t.weight_pct)) };
}

/** Lay the towers out as one fortress. The first (top) terrace has the Great
 * Keep in its middle with the biggest holdings on either side of it, each new
 * holding going to the side that is currently shorter; the rest flow left to
 * right on the terraces below, wrapping when the next tower would pass the
 * margin, each row centred. */
export function layoutTowers(towers: GameTower[], width = SCENE_WIDTH): FortressLayout {
  const usable = width - SIDE_MARGIN * 2;
  const keepX = Math.round((width - KEEP_WIDTH) / 2);
  const keep: PlacedKeep = { x: keepX, y: groundY(0), w: KEEP_WIDTH, h: KEEP_HEIGHT };
  const half = (usable - KEEP_WIDTH - TOWER_GAP * 2) / 2;

  const sorted = sortTowers(towers);
  const left: GameTower[] = [];
  const right: GameTower[] = [];
  let lw = 0;
  let rw = 0;
  let consumed = 0;
  for (const tower of sorted) {
    const { w } = towerDimensions(tower);
    const addL = left.length === 0 ? w : lw + TOWER_GAP + w;
    const addR = right.length === 0 ? w : rw + TOWER_GAP + w;
    const preferLeft = addL <= addR;
    if (preferLeft && addL <= half) {
      left.push(tower);
      lw = addL;
    } else if (!preferLeft && addR <= half) {
      right.push(tower);
      rw = addR;
    } else if (addL <= half) {
      left.push(tower);
      lw = addL;
    } else if (addR <= half) {
      right.push(tower);
      rw = addR;
    } else {
      break;
    }
    consumed += 1;
  }

  const items: PlacedTower[] = [];
  let index = 0;
  const place = (tower: GameTower, x: number, row: number) => {
    const d = towerDimensions(tower);
    items.push({ tower, x, y: groundY(row), w: d.w, h: d.h, row, index: index++ });
  };
  // Left side: the biggest stands next to the keep, so place from the keep outwards.
  const leftPlaced: Array<{ tower: GameTower; x: number }> = [];
  let edge = keepX - TOWER_GAP;
  for (const tower of left) {
    const { w } = towerDimensions(tower);
    leftPlaced.push({ tower, x: edge - w });
    edge -= w + TOWER_GAP;
  }
  leftPlaced.reverse().forEach(({ tower, x }) => place(tower, x, 0));
  let rx = keepX + KEEP_WIDTH + TOWER_GAP;
  for (const tower of right) {
    place(tower, rx, 0);
    rx += towerDimensions(tower).w + TOWER_GAP;
  }

  // The remaining holdings fill the terraces below.
  const rows: GameTower[][] = [[]];
  let rowWidth = 0;
  for (const tower of sorted.slice(consumed)) {
    const { w } = towerDimensions(tower);
    const current = rows[rows.length - 1];
    const needed = current.length === 0 ? w : rowWidth + TOWER_GAP + w;
    if (needed > usable && current.length > 0) {
      rows.push([]);
      rowWidth = 0;
    }
    const cur = rows[rows.length - 1];
    rowWidth = cur.length === 0 ? w : rowWidth + TOWER_GAP + w;
    cur.push(tower);
  }
  rows.forEach((rowTowers, i) => {
    if (rowTowers.length === 0) return;
    const row = i + 1;
    const dims = rowTowers.map(towerDimensions);
    const total = dims.reduce((sum, d) => sum + d.w, 0) + TOWER_GAP * Math.max(0, rowTowers.length - 1);
    let x = Math.round((width - total) / 2);
    rowTowers.forEach((tower, k) => {
      place(tower, x, row);
      x += dims[k].w + TOWER_GAP;
    });
  });

  const rowCount = towers.length === 0 ? 0 : items.reduce((m, it) => Math.max(m, it.row), 0) + 1;
  return { items, rows: rowCount, height: SCENE_TOP + Math.max(1, rowCount) * ROW_HEIGHT + 20, keep };
}

/** Moat channel. Each holding's own moat tier is one stretch of one moat that
 * runs in front of the whole row of walls: water for a wide or narrow moat, a
 * dry ditch for none, a dotted outline for unsurveyed. Funds and the like have
 * no moat tier, so that stretch is left as plain ground. */
export type MoatKind = "water" | "dry" | "fog" | "plain";

export interface MoatSeg {
  x0: number;
  x1: number;
  depth: number;
  moat: FortressMoat;
  holdingId: string;
}

export interface MoatRun {
  kind: MoatKind;
  row: number;
  y: number;
  x0: number;
  x1: number;
  segs: MoatSeg[];
}

const MOAT_DEPTH: Record<FortressMoat, number> = {
  wide: 26,
  narrow: 12,
  none: 7,
  unsurveyed: 10,
  not_applicable: 0,
};

export function moatKindOf(m: FortressMoat): MoatKind {
  switch (m) {
    case "wide":
    case "narrow":
      return "water";
    case "none":
      return "dry";
    case "unsurveyed":
      return "fog";
    default:
      return "plain";
  }
}

export function moatRuns(layout: FortressLayout, width = SCENE_WIDTH): MoatRun[] {
  const runs: MoatRun[] = [];
  const byRow = new Map<number, PlacedTower[]>();
  for (const it of layout.items) {
    const list = byRow.get(it.row) ?? [];
    list.push(it);
    byRow.set(it.row, list);
  }
  const half = TOWER_GAP / 2;
  for (const [row, list] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    // Chains: a gap wider than a normal one is the keep's forecourt.
    const chains: PlacedTower[][] = [[]];
    for (const it of sorted) {
      const cur = chains[chains.length - 1];
      const prev = cur[cur.length - 1];
      if (prev && it.x - (prev.x + prev.w) > TOWER_GAP * 1.5) chains.push([it]);
      else cur.push(it);
    }
    chains.forEach((chain, ci) => {
      const segs: MoatSeg[] = chain.map((it, i) => {
        const prev = chain[i - 1];
        const next = chain[i + 1];
        const x0 = prev ? (prev.x + prev.w + it.x) / 2 : it.x - half;
        const x1 = next ? (it.x + it.w + next.x) / 2 : it.x + it.w + half;
        return { x0, x1, depth: MOAT_DEPTH[it.tower.moat], moat: it.tower.moat, holdingId: it.tower.holding_id };
      });
      // The outer ends of the channel run out to the corner bastions.
      const keepOnRight = row === 0 && ci === 0 && chains.length > 1;
      const keepOnLeft = row === 0 && ci > 0;
      if (!keepOnLeft) segs[0].x0 = WALL_EDGE;
      if (!keepOnRight && ci === chains.length - 1) segs[segs.length - 1].x1 = width - WALL_EDGE;
      let run: MoatRun | null = null;
      for (const seg of segs) {
        const kind = moatKindOf(seg.moat);
        if (run && run.kind === kind) {
          run.segs.push(seg);
          run.x1 = seg.x1;
        } else {
          run = { kind, row, y: groundY(row), x0: seg.x0, x1: seg.x1, segs: [seg] };
          runs.push(run);
        }
      }
    });
  }
  return runs;
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
  if (nearMargins(t).length > 0) parts.push("close to the line of a weaker wall");
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

/** The besieging army, from the siege level only (option C). Calm and
 * unsurveyed weather draw no enemy at all. */
export interface SiegeCamp {
  tents: number;
  soldiers: number;
  engines: number;
  arrows: number;
}

export function siegeCamp(level: FortressSiegeLevel | null | undefined): SiegeCamp {
  switch (level) {
    case "gathering":
      return { tents: 3, soldiers: 7, engines: 0, arrows: 0 };
    case "besieged":
      return { tents: 7, soldiers: 20, engines: 3, arrows: 5 };
    default:
      return { tents: 0, soldiers: 0, engines: 0, arrows: 0 };
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

/** A1: the weaker-side margins that are within the band. Drives the hairline
 * crack and the "close to the line" wording. Never a sign of progress. */
export function nearMargins(t: GameTower): GameMargin[] {
  return (t.wall_margins ?? []).filter((m) => m.direction === "weaker" && m.near);
}

export function knifeEdgeSummary(t: GameTower): string | null {
  const near = nearMargins(t);
  if (near.length === 0) return null;
  return near.map((m) => m.text).join(" ");
}

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
  keep?: PlacedKeep,
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
      // The Great Keep stands between the two halves of the top row: no wall runs through it.
      if (keep && members[i].row === 0 && members[i].x + members[i].w <= keep.x && members[i + 1].x >= keep.x + keep.w) continue;
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


// --- G7b: advisors, study lamp and clock --------------------------------------
// Wording and drawing geometry only. Which lines appear, in which order and for
// which holding is decided by the backend (backend/app/services/game/advisors.py);
// nothing here scores, ranks or recommends.

export const ADVISOR_NAME: Record<GameAdvisorName, string> = {
  oracle: "The Oracle",
  partner: "The Partner",
};

export const ADVISOR_ROLE: Record<GameAdvisorName, string> = {
  oracle: "A patient owner. Looks at what you hold the way an owner would.",
  partner: "A blunt sceptic. Asks what could go wrong before anything else.",
};

export const ADVISOR_TONE_LABEL: Record<GameAdvisorTone, string> = {
  warning: "Look at this",
  note: "Worth noting",
  calm: "Steady",
};

/** A line's rule id as short readable words, for the "why this line" fact list. */
export function advisorRuleLabel(rule: string): string {
  return rule.replace(/_/g, " ");
}

/** The portfolio snapshot is "recent" for the lamp for this many days: the same
 * 7-day limit the backend uses for stored snapshots (mapping v1). */
export const LAMP_RECENT_DAYS = 7;

export type LampState = "lit" | "dim" | "out";

export interface LampReading {
  state: LampState;
  ageDays: number | null;
  text: string;
}

/** The study lamp mirrors how old the survey is. Lit = a portfolio snapshot from
 * the last week, dim = older, out = no snapshot at all. It is a reading of the
 * data's age, not a reward: it never "levels up". */
export function lampReading(asOf: string | null, now: Date): LampReading {
  if (asOf === null) {
    return { state: "out", ageDays: null, text: "The lamp is out: there is no portfolio snapshot to read." };
  }
  const t = Date.parse(asOf);
  if (!Number.isFinite(t)) {
    return { state: "out", ageDays: null, text: "The lamp is out: the snapshot date could not be read." };
  }
  const ageDays = Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
  if (ageDays <= LAMP_RECENT_DAYS) {
    const when = ageDays === 0 ? "today" : ageDays === 1 ? "yesterday" : `${ageDays} days ago`;
    return { state: "lit", ageDays, text: `The lamp is lit: the portfolio snapshot is from ${when}.` };
  }
  return {
    state: "dim",
    ageDays,
    text: `The lamp is dim: the portfolio snapshot is ${ageDays} days old. Upload a new one to light it.`,
  };
}

/** Hand angles in degrees clockwise from 12 o'clock for an analog clock face. */
export function clockHands(now: Date): { hour: number; minute: number } {
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  return { minute: m * 6, hour: h * 30 + m * 0.5 };
}

/** A point on a clock face at `deg` clockwise from 12 o'clock. */
export function clockPoint(deg: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}


/** Notes under "What the survey could not see" that only repeat something the Vault card already
 * says on the same page (UX noise audit, game mode). The cash and coin facts stay on the card;
 * every other note is kept as it is. Pure. */
export function notesWithoutRepeats(
  notes: string[],
  vault: { cash_nok: string | null; gold_oz: string; silver_oz: string },
): string[] {
  const coins = Number(vault.gold_oz) > 0 || Number(vault.silver_oz) > 0;
  return notes.filter((n) => {
    if (vault.cash_nok === null && n.startsWith("No cash entered")) return false;
    if (coins && n.startsWith("Physical coins")) return false;
    return true;
  });
}

/** A name a person can read where a raw fund code would otherwise stand (0P0001RFXW.IR, 0P0001VJ4B.IR):
 * stock tickers are kept without their exchange suffix; a fund code becomes the first word of the name. */
export function shortLabel(name: string, ticker: string, max = 8): string {
  const bare = ticker.replace(/\.[A-Z]+$/, "");
  if (/^0P[0-9A-Z]{6,}$/.test(bare)) {
    const first = name.trim().split(/\s+/)[0] ?? bare;
    return first.slice(0, max);
  }
  return bare.slice(0, max);
}

/** True for a fund's data-vendor code (0P0001RFXW.IR) rather than a stock ticker. */
export function isFundCode(ticker: string): boolean {
  return /^0P[0-9A-Z]{6,}(\.[A-Z]+)?$/.test(ticker);
}

const WALL_INPUT_LABEL: Record<string, string> = {
  ebitda: "EBITDA",
  net_debt_to_ebitda: "net debt / EBITDA",
  interest_coverage: "EBIT / interest",
};

/** One wall input as readable text: ratios as "1.40×", large amounts compacted
 * ("6.04 bn", currency unknown so none is shown), anything unparseable left as given. */
export function formatWallInput(key: string, value: string): string {
  const label = WALL_INPUT_LABEL[key] ?? key.replace(/_/g, " ");
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label}: ${value}`;
  const abs = Math.abs(n);
  let text: string;
  if (key.includes("_to_") || key.endsWith("coverage")) {
    text = `${n.toFixed(2)}×`;
  } else if (abs >= 1e9) {
    text = `${(n / 1e9).toFixed(2)} bn`;
  } else if (abs >= 1e6) {
    text = `${(n / 1e6).toFixed(1)} m`;
  } else {
    text = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return `${label}: ${text}`;
}
