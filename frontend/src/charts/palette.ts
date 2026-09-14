/**
 * Chart color palette (architecture §19 Visualizations, §26 Phase 6).
 *
 * Categorical hues are the validated defaults from the dataviz skill's
 * reference palette (CVD-safe ordering, dark-surface steps) — unchanged by
 * the CWO visual-design adoption below, since CVD-safety is an independent
 * accessibility property, not a design-system choice.
 *
 * Chrome (grid lines, axis text, tooltip surface) and status colors
 * (good/warning/serious/critical) now reuse the finance-terminal design
 * system's own tokens (src/styles/finance-terminal-design-system.css) —
 * the same tokens the CWO app uses — instead of the old Tailwind slate
 * scale, so charts read as part of the same visual system as every
 * terminal-card/stat-panel around them.
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

// Finance-terminal semantic tokens (--color-positive/warning/negative and a
// serious/amber-orange midpoint for the risk heatmap's MODERATE-HIGH band).
export const STATUS = {
  good: "#00E5A0", // --color-positive
  warning: "#FBBF24", // --color-warning
  serious: "#FF8A3D", // between warning and negative, for MODERATE-HIGH
  critical: "#FF4D6A", // --color-negative
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
export const BAND_FALLBACK_COLOR = "#3D6A96"; // --text-tertiary — insufficient data

export const CHROME = {
  grid: "#0D2845", // --border-primary
  axis: "#3D6A96", // --text-tertiary
  tooltipBg: "#071828", // --bg-secondary
  tooltipBorder: "#0D2845", // --border-primary
  text: "#E2EDFF", // --text-primary
  legend: "#7FA8D4", // --text-secondary
  cellStroke: "#030D1C", // --bg-primary — separates adjacent pie slices
} as const;

export function categoricalColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

export function bandColor(band: string | null | undefined): string {
  if (!band) return BAND_FALLBACK_COLOR;
  return BAND_COLOR[band] ?? BAND_FALLBACK_COLOR;
}
