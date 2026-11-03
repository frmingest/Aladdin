/**
 * The siege yard (3D sprint S17). Pure data, no React and no three.js.
 *
 * The Storm Drill panel shows what the chosen fall does to each tower. Nothing is worked out here: the backend
 * already answered (`GET /game/siege`, the same call as the flat Siege Simulator) and every figure and sentence
 * below comes from the flat page's own helpers (`lib/siege.ts`, `formatShock`, `formatNok`), so the 3D panel
 * and the flat page cannot disagree. This file only picks and orders what to show.
 *
 * Rules kept: unknown stays unknown (an unmodelled tower prints "?", never a default number, and is listed in
 * the fog block with the backend's own reason); no red or green; the camp stays a fixed size (this changes a
 * panel, never a model); nothing says buy or sell.
 */
import { formatNok } from "../lib/format";
import { formatShock } from "../lib/fortress";
import { damageWidth, fallSubject, formatDrop, holdingLine, isRoughGuide, parseBenchmarkChoice, stressGapNote } from "../lib/siege";
import type { SiegeBenchmarkKey, SiegeSim, SiegeSimHolding } from "../lib/types";
import {
  YARD_GAP,
  YARD_LEVEL_NAME,
  YARD_STATUS,
  YARD_UNKNOWN,
  yardCoverageLine,
  yardHeadline,
} from "./siegeYardWordsV2";

/** How many modelled towers the panel lists; the rest are counted and left to the flat page. */
export const YARD_MAX_ROWS = 8;

export interface YardRow {
  id: string;
  name: string;
  /** One word, the flat page's: how the tower fares. */
  status: string;
  /** The signed share lost, as the flat page prints it. */
  shock: string;
  /** The what-if loss in kroner, as the flat page prints it. */
  loss: string;
  /** The flat page's sentence for the row ("Falls 12.3% in this what-if (...)"). */
  line: string;
  /** 0 to 100, how much of the wall is lost. */
  bar: number;
  rough: boolean;
  /** The short flag when the fall differs from the saved fortress test, or null. The long note is the hover. */
  gap: string | null;
}

export interface YardFog {
  id: string;
  name: string;
  reason: string;
}

export interface YardBook {
  shock: string;
  loss: string;
  beta: string;
  coverage: string;
  coverageLine: string;
}

export interface YardView {
  level: string;
  headline: string;
  /** Modelled towers, worst hit first, at most YARD_MAX_ROWS. */
  rows: YardRow[];
  /** Modelled towers that did not fit in `rows`. */
  more: number;
  /** Towers with no usable beta. Never given a number. */
  fog: YardFog[];
  /** The whole-book figures, or null when the book could not be modelled at all. */
  book: YardBook | null;
  towers: number;
}

function row(h: SiegeSimHolding): YardRow {
  return {
    id: h.holding_id,
    name: h.name,
    status: !h.modelled ? YARD_STATUS.unmodelled : Number(h.shock_pct) < 0 ? YARD_STATUS[h.exposure as "sheltered" | "exposed" | "breach_risk"] : YARD_STATUS.gains,
    shock: formatShock(h.shock_pct),
    loss: formatNok(h.loss_nok),
    line: holdingLine(h),
    bar: damageWidth(h.shock_pct),
    rough: isRoughGuide(h),
    gap: stressGapNote(h) === null ? null : YARD_GAP,
  };
}

/** Worst hit first; a gaining tower sorts last. A tie keeps the flat page's own order. */
function byDamage(a: SiegeSimHolding, b: SiegeSimHolding): number {
  return Number(a.shock_pct) - Number(b.shock_pct);
}

export function yardView(sim: SiegeSim): YardView {
  const modelled = sim.holdings.filter((h) => h.modelled && h.shock_pct !== null).slice().sort(byDamage);
  const fog = sim.holdings
    .filter((h) => !h.modelled)
    .map((h) => ({ id: h.holding_id, name: h.name, reason: h.reason ?? "Too little price history." }));
  const book: YardBook | null =
    sim.portfolio_shock_pct === null
      ? null
      : {
          shock: formatShock(sim.portfolio_shock_pct),
          loss: formatNok(sim.portfolio_loss_nok),
          beta: sim.weighted_beta ?? YARD_UNKNOWN,
          coverage: sim.coverage === null ? YARD_UNKNOWN : `${(Number(sim.coverage) * 100).toFixed(0)}%`,
          coverageLine: yardCoverageLine(
            sim.holdings.filter((h) => h.modelled).length,
            sim.holdings.length,
            sim.coverage === null ? YARD_UNKNOWN : `${(Number(sim.coverage) * 100).toFixed(0)}%`,
          ),
        };
  return {
    level: YARD_LEVEL_NAME[sim.level],
    headline: yardHeadline(
      formatDrop(sim.market_drop),
      fallSubject(sim).sentence,
      sim.level,
      sim.portfolio_shock_pct === null ? null : (Math.abs(Number(sim.portfolio_shock_pct)) * 100).toFixed(1),
      Number(sim.portfolio_shock_pct) < 0 ? "costs" : "adds to",
    ),
    rows: modelled.slice(0, YARD_MAX_ROWS).map(row),
    more: Math.max(0, modelled.length - YARD_MAX_ROWS),
    fog,
    book,
    towers: sim.holdings.length,
  };
}

/** What a tower with no usable beta prints where a number would go. */
export const YARD_UNKNOWN_SHOCK = YARD_UNKNOWN;

const BENCHMARK_STORAGE_KEY = "aladdin.siege.benchmark";

/** The yardstick the flat Siege Simulator last used in this browser (same storage key), so both pages answer alike. */
export function yardBenchmark(): SiegeBenchmarkKey {
  try {
    return parseBenchmarkChoice(window.localStorage.getItem(BENCHMARK_STORAGE_KEY));
  } catch {
    return "local";
  }
}
