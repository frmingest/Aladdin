import type {
  FortressFreshness,
  FortressMoat,
  FortressSize,
  FortressStructure,
  FortressVaultLevel,
  FortressWall,
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
  return parts.join(", ");
}

/** Ledger sorting, filtering and totals (G3). Pure, so unit-tested. The Ledger
 * only reorders and subsets what the backend decided; it never recomputes a
 * wall, moat or size. */
export type LedgerSortKey = "weight" | "name" | "wall" | "moat" | "freshness";
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
    }
  };
  // Ties fall back to the scene's order so the table is stable.
  return [...towers].sort((a, b) => sign * cmp(a, b) || weightOf(b) - weightOf(a) || a.name.localeCompare(b.name));
}

export type LedgerFilter = "all" | "attention";

/** "Needs attention" = a wall at timber or worse, no moat, or an analysis that
 * is stale or missing: the places a value investor should look first. It is a
 * reading aid over backend categories, not a new score. */
export function needsAttention(t: GameTower): boolean {
  return (
    t.wall === "timber" ||
    t.wall === "rotted" ||
    t.moat === "none" ||
    t.freshness === "overgrown" ||
    t.freshness === "unsurveyed"
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
