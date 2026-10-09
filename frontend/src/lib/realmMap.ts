import { SURVEY_CHECKS } from "./survey";
import type { Commission, SurveyCheck, SurveyCheckId, SurveyState, TowerFog } from "./survey";

/**
 * The Cartographer's table, wins 1 to 4 (game mode G34 / G35, identity pass). Pure mapping from the
 * stored survey (`lib/survey.ts`, survey-v1, untouched) to what the page draws: five fixed fog patches
 * per tower, the keyboard step between towers, and the flags a pressed commission plants. Nothing here
 * reads a verdict, a wall or a weight to decide a look: a patch depends only on the state of its check.
 *
 * Truth rules kept here, each under test:
 *  - A state is told apart by shape, pattern and glyph together (and a printed word in the slate),
 *    never by colour alone.
 *  - Fog is never fainter or smaller than clear. An unreadable fact arrives as fog and stays fog.
 *  - Fog returns only because the input changed (the map is recomputed from stored state every load;
 *    nothing remembers a past clear state).
 *  - Nothing is neutral-good: no green, no count of how much is surveyed, no percentage.
 */

// --- Colours (neutral parchment map; gilt is ornament and carries no state) --------------------------

export const MAP_COLORS = {
  ink: "#2b2118",
  paper: "#efe2c0",
  mist: "#8f98a8",
  hatchInk: "#3a3f4a",
  wax: "#5a3d12",
  gilt: "#d9a93e",
  cream: "#fbe9c2",
  stone: "#e3d3a8",
} as const;

/** WCAG contrast ratio of two #rrggbb colours (used to pin the fog's legibility in a test). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- The tower picture and its five slots --------------------------------------------------------------

/** Drawing space of one tower card (1 unit = 1 CSS px at the card's natural size). */
export const VIEW = { w: 120, h: 112 } as const;
/** The fixed silhouette's box inside the view. Surveying never changes it. */
export const TOWER_BOX = { x: 28, y: 22, w: 64, h: 84 } as const;

/** Fog is never fainter than this (asserted in a test). */
export const FOG_OPACITY = 0.9;
/** A fog patch's radius is this fraction of the tower width, but never under MIN_PATCH_R. */
export const FOG_PATCH_K = 0.3;
export const MIN_PATCH_R = 16;
/** The clear and not-judged marks are small sockets, always smaller than the fog that covers them. */
export const CLEAR_RING_R = 7;

/** Slot positions are a tunable table, not a design truth: distinct, symmetric and stable. The ids
 * follow SURVEY_CHECKS exactly, so a slot never changes meaning and never moves when a state changes. */
export const SLOT_AT: ReadonlyArray<{ id: SurveyCheckId; fx: number; fy: number; name: string }> = [
  { id: "report", fx: 0.5, fy: 0.0, name: "roof" },
  { id: "analysis", fx: 0.12, fy: 0.3, name: "left shoulder" },
  { id: "thesis", fx: 0.88, fy: 0.3, name: "right shoulder" },
  { id: "circle", fx: 0.12, fy: 0.78, name: "left base" },
  { id: "valuation", fx: 0.88, fy: 0.78, name: "right base" },
];

export type PatchShape = "cloud" | "ring" | "dashed-ring";
export type PatchPattern = "hatch" | "none" | "dashed";

export interface PatchLook {
  state: SurveyState;
  shape: PatchShape;
  pattern: PatchPattern;
  /** The mark inside the patch: "?" in fog, a dot when clear, a dash when not judged. */
  glyph: string;
  /** The printed word in the slate and the legend. */
  word: string;
  /** Does it hide the tower line-work underneath? Only fog does. */
  covers: boolean;
}

export const PATCH_LOOK: Record<SurveyState, PatchLook> = {
  fog: { state: "fog", shape: "cloud", pattern: "hatch", glyph: "?", word: "In fog", covers: true },
  clear: { state: "clear", shape: "ring", pattern: "none", glyph: "●", word: "Clear", covers: false },
  not_judged: { state: "not_judged", shape: "dashed-ring", pattern: "dashed", glyph: "–", word: "Not judged", covers: false },
};

/** What makes two looks different; no two states may share all three. */
export function patchSignature(state: SurveyState): string {
  const l = PATCH_LOOK[state];
  return `${l.shape}|${l.pattern}|${l.glyph}`;
}

export interface FogSlot {
  index: number;
  id: SurveyCheckId;
  label: string;
  state: SurveyState;
  look: PatchLook;
  reason: string;
  cx: number;
  cy: number;
  /** Radius of the cloud (fog) or of the ring (clear, not judged). */
  r: number;
}

export function patchRadius(state: SurveyState, towerW: number = TOWER_BOX.w): number {
  return state === "fog" ? Math.max(MIN_PATCH_R, FOG_PATCH_K * towerW) : CLEAR_RING_R;
}

const UNREAD = "This fact could not be read, so it stays unknown.";

/** The five patch slots of a tower, always five and always in SURVEY_CHECKS order. A check that is
 * missing from the input is unknown, and unknown is fog. */
export function fogSlots(checks: ReadonlyArray<Pick<SurveyCheck, "id" | "state" | "reason">> | Pick<TowerFog, "checks">): FogSlot[] {
  const list = Array.isArray(checks) ? checks : (checks as Pick<TowerFog, "checks">).checks;
  return SURVEY_CHECKS.map((def, index) => {
    const found = (list as ReadonlyArray<Pick<SurveyCheck, "id" | "state" | "reason">>).find((c) => c.id === def.id);
    const state: SurveyState = found ? found.state : "fog";
    const at = SLOT_AT[index];
    return {
      index,
      id: def.id,
      label: def.label,
      state,
      look: PATCH_LOOK[state],
      reason: found ? found.reason : UNREAD,
      cx: round(TOWER_BOX.x + at.fx * TOWER_BOX.w),
      cy: round(TOWER_BOX.y + at.fy * TOWER_BOX.h),
      r: patchRadius(state),
    };
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A scalloped cloud outline (eight lobes) around (cx, cy), about `r` wide. No filter, no blur. */
export function cloudPath(cx: number, cy: number, r: number, lobes = 8): string {
  const pts = Array.from({ length: lobes }, (_, k) => {
    const a = (2 * Math.PI * k) / lobes - Math.PI / 2;
    return [round(cx + 0.86 * r * Math.cos(a)), round(cy + 0.86 * r * Math.sin(a))] as const;
  });
  const arc = round(0.36 * r);
  const parts = pts.map((p, k) => {
    const next = pts[(k + 1) % lobes];
    return `${k === 0 ? `M${p[0]} ${p[1]} ` : ""}A${arc} ${arc} 0 0 1 ${next[0]} ${next[1]}`;
  });
  return `${parts.join(" ")} Z`;
}

/** The checks of a tower that are in fog, in survey order. */
export function checksInFog(t: Pick<TowerFog, "checks">): SurveyCheck[] {
  return t.checks.filter((c) => c.state === "fog");
}

/** Accessible name of a tower button. Built only from the checks and the weight text; no new fact, and
 * no "n of 5" count. */
export function towerAriaLabel(t: Pick<TowerFog, "name" | "checks">, weight: string): string {
  const fog = checksInFog(t);
  const tail = fog.length === 0 ? "no checks in fog" : `in fog: ${fog.map((c) => c.label).join(", ")}`;
  return `${t.name}, weight ${weight}, ${tail}`;
}

// --- Keyboard: one tab stop for the whole map, arrows move between towers ---------------------------

export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";
export const GRID_KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

export function isGridKey(key: string): key is GridKey {
  return GRID_KEYS.includes(key);
}

/** Where an arrow key goes in a grid of `count` towers laid out `cols` per row. Stops at the edges
 * (no wrap), and a short last row is not skipped over by Up/Down: it clamps to the last tower. */
export function gridMove(index: number, key: GridKey, count: number, cols: number): number {
  if (count <= 0) return 0;
  const c = Math.max(1, cols);
  const last = count - 1;
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return last;
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowRight":
      return Math.min(last, index + 1);
    case "ArrowUp":
      return index - c >= 0 ? index - c : index;
    case "ArrowDown":
      if (index + c <= last) return index + c;
      return Math.floor(index / c) < Math.floor(last / c) ? last : index;
  }
}

// --- Win 4: commission seals and flags --------------------------------------------------------------

export type CommissionShape = "square" | "hexagon" | "diamond" | "ring" | "triangle-down" | "coin";

/** One shape per kind of commission. Shape + number + the title beside it; colour is ornament. */
export const COMMISSION_SHAPE: Record<string, CommissionShape> = {
  report: "square",
  analysis: "hexagon",
  thesis: "diamond",
  circle: "ring",
  valuation: "triangle-down",
  vault: "coin",
};

export function commissionShape(id: string): CommissionShape {
  return COMMISSION_SHAPE[id] ?? "square";
}

/** The id a flag carries when it stands on the Keep (the cash commission). */
export const KEEP_ID = "keep";

export interface MapFlag {
  /** A holding id, or KEEP_ID. */
  target: string;
  commissionId: string;
  /** Its position in the commission list, from 1. */
  number: number;
  shape: CommissionShape;
}

/**
 * The flags a pressed commission plants. `plotIds` are the holdings drawn on the map. One flag per
 * covered holding that is drawn, none for any other; the cash commission (no holdings) plants one on
 * the Keep. Nothing selected means no flags: a commission is never flagged until it is pressed.
 */
export function flagsFor(commissions: ReadonlyArray<Pick<Commission, "id" | "holdings">>, selectedId: string | null, plotIds: readonly string[]): MapFlag[] {
  if (selectedId === null) return [];
  const at = commissions.findIndex((c) => c.id === selectedId);
  if (at < 0) return [];
  const c = commissions[at];
  const base = { commissionId: c.id, number: at + 1, shape: commissionShape(c.id) };
  if (c.id === "vault") return [{ ...base, target: KEEP_ID }];
  const drawn = new Set(plotIds);
  const seen = new Set<string>();
  const out: MapFlag[] = [];
  for (const h of c.holdings) {
    if (!h.holdingId || !drawn.has(h.holdingId) || seen.has(h.holdingId)) continue;
    seen.add(h.holdingId);
    out.push({ ...base, target: h.holdingId });
  }
  return out;
}

// --- Words ---------------------------------------------------------------------------------------------

export const MAP_COPY = {
  subtitle: "Which parts of the realm are surveyed, and which are still in fog.",
  intro: "Five facts per tower. Clear means looked at, not sound; fog comes back when an analysis ages.",
  hint: "Press a tower for its five checks.",
  demo: "Demo data",
  /** Plain view and normal mode only: the browser-only note the short intro leaves out. */
  browserNote: "Opened reports are remembered on this browser only.",
  empty: "No towers yet.",
  commissionsEmpty: "Nothing is in fog by these five facts. That says what you have looked at, not that all is well.",
} as const;

/** Words of the default view's chrome: subtitle, intro, key, hint and the demo pill. Budget 45. */
export const CARTOGRAPHER_CHROME_BUDGET = 45;
/** Words of the whole default body (measured 153 with three towers, five commissions, names excluded): the chrome,
 * the commission titles, their one-line reasons and their links (the per-tower text list is closed). */
export const CARTOGRAPHER_BODY_BUDGET = 160;
