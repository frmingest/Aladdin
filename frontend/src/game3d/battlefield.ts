/**
 * The old battlefield on the Siege Field (S29, 2026-11-06). Pure data and maths, no three.js and no React.
 *
 * A strip of scorched ground on the west flank of the field. It replays ONE stored fall, the flat Siege page's
 * back-test (C1): per holding, a dark scorch bar for what really happened and a pale chalk bar for what the page's
 * method said. A miss is as plain as a hit: the two bars simply differ. Next to it, on the east flank, a war table
 * pins up to three of the player's own past Storm Drill notes, read-only.
 *
 * What carries a fact, and what never does:
 * - A bar's length is the backend's own back-test number for that holding (`actual`, `predicted`), scaled by the flat
 *   page's `barScale` so the longest bar fills the strip. Nothing else sets a length. A gain draws no bar.
 * - A holding the method could not be tested on draws no bar and no number: a "?" and nothing more (fog stays fog).
 * - The ground, the board and the war table are fixed. No theme, wall, moat or verdict colours anything; the verdict
 *   word is the flat page's own classification, printed, never coloured.
 * - Drill notes are the player's own words, shown back to the player. Nothing here sends them anywhere.
 * No red or green. Colour is never the only signal: length and words carry it.
 */
import { barScale, episodeLine, pct, shortDate } from "../lib/siegeBacktest";
import type { SiegeBacktest, SiegeBacktestHolding, SiegeBacktestVerdict, StormDrill } from "../lib/types";
import { BATTLE_WORDS, battleMore, battleTested } from "./battlefieldWordsV1";

// --- The strip of ground ---------------------------------------------------------------------------------------
/** Left edge of the bars; every bar grows east from here. */
export const BATTLE_X0 = -37;
/** The first row (the heaviest holding); rows run south. */
export const BATTLE_Z0 = -33;
export const BATTLE_ROW_STEP = 2.4;
export const BATTLE_MAX_ROWS = 12;
/** The longest a bar can be, in world units. */
export const BAR_MAX = 9;
/** A bar that is not zero is never thinner than this, so a small fall still shows. */
export const BAR_MIN = 0.2;
export const SCORCH_DEPTH = 0.9;
export const CHALK_DEPTH = 0.4;
/** Chalk lies this far south of the scorch in the same row. */
export const CHALK_OFFSET = 0.85;

/** The board at the head of the strip, and the ground under the bars. */
export const BATTLE_BOARD = { x: -32.5, z: BATTLE_Z0 - 3.2 } as const;
export const BATTLE_GROUND = {
  x: BATTLE_X0 + 5.6,
  z: BATTLE_Z0 + ((BATTLE_MAX_ROWS - 1) * BATTLE_ROW_STEP) / 2,
  width: 12,
  depth: BATTLE_MAX_ROWS * BATTLE_ROW_STEP + 1.4,
} as const;

// --- The war table ---------------------------------------------------------------------------------------------
export const WAR_TABLE = { x: 31, z: -8, width: 4.4, depth: 2.2, height: 1.1 } as const;
export const WAR_TABLE_MAX_NOTES = 3;
export const NOTE_MAX_CHARS = 90;

/** Colours: earth, slate, chalk and parchment only. No red and no green, so no colour here reads as a verdict. */
export const BATTLE_COLORS = {
  ground: "#8a7a62",
  scorch: "#2f2e3a",
  chalk: "#ece6d6",
  fog: "#e8eef2",
  table: "#7a5c40",
  parchment: "#eee4d3",
} as const;

export interface BattleRow {
  id: string;
  name: string;
  tested: boolean;
  z: number;
  /** Length of the scorch bar (what happened). 0 for a gain or a fog row. */
  scorch: number;
  /** Length of the chalk bar (what the page said). 0 for a gain or a fog row. */
  chalk: number;
  verdict: SiegeBacktestVerdict;
  /** The plate text: name, what happened, what the page said, the flat page's word. Fog rows carry only a "?". */
  plate: string;
}

export interface Battlefield {
  rows: BattleRow[];
  /** Holdings past the twelve rows, counted and left to Plain view. */
  more: number;
}

/** A fraction of a fall (negative) as a bar length on the shared scale. Gains, nulls and junk draw nothing. */
export function barLength(v: string | null, scale: number): number {
  if (v === null) return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n >= 0) return 0;
  const len = Math.min(1, -n / scale) * BAR_MAX;
  return Math.round(Math.max(BAR_MIN, len) * 100) / 100;
}

export function rowZ(i: number): number {
  return BATTLE_Z0 + i * BATTLE_ROW_STEP;
}

function plateFor(h: SiegeBacktestHolding): string {
  if (!h.tested) return `${h.name} ${BATTLE_WORDS.fogMark}`;
  return `${h.name} ${BATTLE_WORDS.did} ${pct(h.actual)}, ${BATTLE_WORDS.said} ${pct(h.predicted)}. ${BATTLE_WORDS.verdict[h.verdict]}`;
}

/** One row per holding in the flat page's own order, up to twelve. Takes only the back-test answer. */
export function battlefieldFor(bt: SiegeBacktest | null): Battlefield {
  if (!bt || !bt.episode) return { rows: [], more: 0 };
  const shown = bt.holdings.slice(0, BATTLE_MAX_ROWS);
  const scale = barScale(shown);
  const rows = shown.map((h, i) => ({
    id: h.holding_id,
    name: h.name,
    tested: h.tested,
    z: rowZ(i),
    scorch: h.tested ? barLength(h.actual, scale) : 0,
    chalk: h.tested ? barLength(h.predicted, scale) : 0,
    verdict: h.verdict,
    plate: plateFor(h),
  }));
  return { rows, more: Math.max(0, bt.holdings.length - shown.length) };
}

export type Loadable<T> = { status: "reading" } | { status: "failed" } | { status: "ready"; value: T };

/** The board's lines, from the flat page's own sentence about the fall. */
export function boardLines(state: Loadable<SiegeBacktest>, more: number): string[] {
  if (state.status === "reading") return [BATTLE_WORDS.reading];
  if (state.status === "failed") return [BATTLE_WORDS.failed];
  const bt = state.value;
  if (!bt.episode) return [BATTLE_WORDS.board, BATTLE_WORDS.quiet];
  const lines = [
    BATTLE_WORDS.board,
    episodeLine(bt.episode, bt.benchmark_ticker),
    BATTLE_WORDS.legend,
    battleTested(bt.tested_count, bt.total_count),
    BATTLE_WORDS.notForecast,
  ];
  if (more > 0) lines.push(battleMore(more));
  return lines;
}

export interface Note {
  id: string;
  /** "30%" and the date it was written. */
  head: string;
  text: string;
}

/** The player's note, one line: whitespace collapsed, cut at a word boundary. */
export function shortNote(plan: string): string {
  const flat = plan.replace(/\s+/g, " ").trim();
  if (flat.length <= NOTE_MAX_CHARS) return flat;
  const cut = flat.slice(0, NOTE_MAX_CHARS - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > NOTE_MAX_CHARS * 0.5 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/** The newest three drills, newest first. The sample fortress has none of its own, so none are pinned. */
export function notesFor(drills: { drills: StormDrill[]; demo: boolean } | null): Note[] {
  if (!drills || drills.demo) return [];
  return [...drills.drills]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, WAR_TABLE_MAX_NOTES)
    .map((d) => ({
      id: d.id,
      head: `${Math.round(Number(d.market_drop) * 100)}% fall, ${shortDate(d.created_at.slice(0, 10))}`,
      text: shortNote(d.plan),
    }));
}

export function tableLines(state: Loadable<{ drills: StormDrill[]; demo: boolean }>): string[] {
  if (state.status === "reading") return [BATTLE_WORDS.table];
  if (state.status === "failed") return [BATTLE_WORDS.table, BATTLE_WORDS.tableFailed];
  const notes = notesFor(state.value);
  if (notes.length === 0) return [BATTLE_WORDS.table, BATTLE_WORDS.tableEmpty];
  return [BATTLE_WORDS.table, ...notes.flatMap((n) => [n.head, n.text])];
}

/** Everything solid or drawn on the strip, for the clearance test: [x, z, radius]. */
export function battleExtent(): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: BATTLE_GROUND.x - BATTLE_GROUND.width / 2,
    maxX: BATTLE_GROUND.x + BATTLE_GROUND.width / 2,
    minZ: BATTLE_BOARD.z,
    maxZ: BATTLE_GROUND.z + BATTLE_GROUND.depth / 2,
  };
}
