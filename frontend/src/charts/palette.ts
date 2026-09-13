/**
 * Chart color palette (architecture §19 Visualizations, §26 Phase 6).
 *
 * Categorical hues and status colors are the validated defaults from the
 * dataviz skill's reference palette (CVD-safe ordering, dark-surface steps —
 * this app is dark-only, matching App.tsx's bg-slate-950). Chrome (grid
 * lines, axis text, tooltip surface) instead reuses this codebase's own
 * Tailwind slate scale for visual consistency with the rest of the app,
 * rather than the skill's neutral gray ramp — the method is
 * design-system-agnostic by design; only the categorical/status hues need
 * the CVD validation, chrome does not.
 *
 * Categorical hues are assigned in this fixed order and never cycled or
 * reassigned by rank — a filter that changes which series are visible must
 * not repaint the survivors, so callers should index into CATEGORICAL by a
 * stable key (e.g. sorted ticker/sector name), not by post-filter position.
 *
 * Every Bar/Pie/Line mark in these chart components sets
 * `isAnimationActive={false}`. Confirmed by hand: with the default entrance
 * animation on, an already-mounted chart lower on the page loses its
 * fill/stroke (axes and reference lines still draw) after a sibling
 * component's state update reflows the page — reproducible in this
 * dashboard by selecting a different holding in HoldingDetailSection while
 * a Portfolio risk chart is visible above it. Disabling the animation
 * sidesteps whatever recharts/ResizeObserver/react-smooth interaction
 * causes it, and a live dashboard that re-fetches data on every manual
 * refresh has little use for entrance animations anyway.
 */

export const CATEGORICAL = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
  "#9085e9", // 7 violet
  "#e66767", // 8 red
] as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Risk/factor band -> status color. Bands come from
 * app.domain.portfolio_risk (LOW/MODERATE/MODERATE-HIGH/HIGH) and
 * app.domain.scenarios; "INSUFFICIENT DATA" is a deliberate non-fabricated
 * absence (§21), never silently mapped to "good". */
export const BAND_COLOR: Record<string, string> = {
  LOW: STATUS.good,
  MODERATE: STATUS.warning,
  "MODERATE-HIGH": STATUS.serious,
  HIGH: STATUS.critical,
};
export const BAND_FALLBACK_COLOR = "#64748b"; // slate-500 — insufficient data

export const CHROME = {
  grid: "#1e293b", // slate-800
  axis: "#64748b", // slate-500
  tooltipBg: "#0f172a", // slate-900
  tooltipBorder: "#1e293b", // slate-800
  text: "#e2e8f0", // slate-200
};

export function categoricalColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

export function bandColor(band: string | null | undefined): string {
  if (!band) return BAND_FALLBACK_COLOR;
  return BAND_COLOR[band] ?? BAND_FALLBACK_COLOR;
}
