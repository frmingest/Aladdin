import type { FortressSiegeLevel, SiegeSim, SiegeSimExposure, SiegeSimHolding } from "./types";

/**
 * Siege Simulator wording and helpers (game mode, G13). Pure. Every number is
 * computed by the backend (backend/app/services/game/siege.py); this file only
 * words it and keeps the slider honest. It is a what-if, never a forecast, and
 * it never says what to do with money.
 */

export const SIEGE_SIM_RULES = "siege-v1";

export const SIM_LEVEL_LABEL: Record<FortressSiegeLevel, string> = {
  calm: "The walls hold",
  gathering: "Storm clouds gather",
  besieged: "Under siege",
  unsurveyed: "Cannot judge yet",
};

export const SIM_LEVEL_TEXT: Record<FortressSiegeLevel, string> = {
  calm: "At this fall the modelled book stays inside the game's storm line.",
  gathering: "At this fall the modelled book crosses the storm line.",
  besieged: "At this fall the modelled book crosses the siege line.",
  unsurveyed: "Too little of the book has a stored beta to give a portfolio result.",
};

export const SIM_EXPOSURE_LABEL: Record<SiegeSimExposure, string> = {
  sheltered: "Sheltered",
  exposed: "Exposed",
  breach_risk: "Wall at risk of breach",
  unmodelled: "Not modelled",
};

export const SIM_LIMITS =
  "This is a what-if, not a forecast. It scales each holding by its stored beta, a historical, linear, single-factor estimate. A real fall hits holdings unevenly, and betas move.";

/** Slider position as a whole percent (0.3 -> 30). */
export const dropToPercent = (drop: number): number => Math.round(drop * 100);

export function formatDrop(drop: number | string | null): string {
  if (drop === null) return "—";
  const n = Number(drop);
  return Number.isFinite(n) ? `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 1)}%` : "—";
}

/** Keep a requested fall inside the slider's range. */
export function clampDrop(drop: number, min: number, max: number): number {
  if (!Number.isFinite(drop)) return min;
  return Math.min(max, Math.max(min, drop));
}

/** The smallest whole-percent fall at or past the one that reaches a line, so a preset button really does
 * reach it. Null when the line is never reached or the result would fall outside the slider. */
export function presetDrop(reaching: string | null, min: number, max: number): number | null {
  if (reaching === null) return null;
  const n = Number(reaching);
  if (!Number.isFinite(n)) return null;
  const whole = Math.ceil(n * 100 - 1e-9) / 100;
  return whole >= min && whole <= max ? whole : null;
}

/** Width (0-100) of a holding's damage bar, from its fractional shock. Gains draw no bar. */
export function damageWidth(shock: string | null): number {
  if (shock === null) return 0;
  const n = Number(shock);
  if (!Number.isFinite(n) || n >= 0) return 0;
  return Math.min(100, Math.round(-n * 100));
}

export function holdingLine(h: SiegeSimHolding): string {
  if (!h.modelled) return h.reason ?? "Not modelled.";
  const shock = Number(h.shock_pct);
  const pct = `${(Math.abs(shock) * 100).toFixed(1)}%`;
  return shock < 0 ? `Falls ${pct} in this what-if (${SIM_EXPOSURE_LABEL[h.exposure].toLowerCase()}).` : `Gains ${pct} in this what-if.`;
}

/** One plain sentence about the whole book at the chosen fall. */
export function headline(sim: SiegeSim): string {
  const fall = formatDrop(sim.market_drop);
  if (sim.level === "unsurveyed" || sim.portfolio_shock_pct === null) return `A ${fall} market fall: ${SIM_LEVEL_TEXT.unsurveyed.toLowerCase()}`;
  const book = (Math.abs(Number(sim.portfolio_shock_pct)) * 100).toFixed(1);
  const dir = Number(sim.portfolio_shock_pct) < 0 ? "costs" : "adds to";
  return `A ${fall} market fall ${dir} the modelled book ${book}%. ${SIM_LEVEL_TEXT[sim.level]}`;
}

export function coverageLine(sim: SiegeSim): string {
  const total = sim.holdings.length;
  const modelled = sim.holdings.filter((h) => h.modelled).length;
  const pct = sim.coverage === null ? "none" : `${(Number(sim.coverage) * 100).toFixed(0)}%`;
  return `${modelled} of ${total} holdings modelled, ${pct} of the portfolio value.`;
}

/** Every fixed sentence in this file, so a test can check the wording rules. */
export function allSiegeLines(): string[] {
  return [...Object.values(SIM_LEVEL_LABEL), ...Object.values(SIM_LEVEL_TEXT), ...Object.values(SIM_EXPOSURE_LABEL), SIM_LIMITS];
}
