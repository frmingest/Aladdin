/**
 * Chart color palette (architecture §19 Visualizations, §26 Phase 6).
 *
 * Categorical hues are the validated defaults from the dataviz skill's
 * reference palette (CVD-safe ordering, dark-surface steps) — unchanged by
 * the CWO visual-design adoption below, since CVD-safety is an independent
 * accessibility property, not a design-system choice.
 *
 * Chrome (grid lines, axis text, tooltip surface) and status colors
 * (good/warning/serious/critical) reuse Aladdin's own Bloomberg-terminal
 * design system tokens (src/styles/bloomberg-terminal-design-system.css)
 * instead of the old Tailwind slate scale, so charts read as part of the
 * same visual system as every terminal-card/stat-panel around them.
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
  good: "#22C55E", // --color-positive
  warning: "#FFCB47", // --color-warning
  serious: "#FF8C00", // --accent-primary, between warning and negative, for MODERATE-HIGH
  critical: "#EF4444", // --color-negative
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
export const BAND_FALLBACK_COLOR = "#786D58"; // --text-tertiary — insufficient data

export const CHROME = {
  grid: "#2A2620", // --border-primary
  axis: "#786D58", // --text-tertiary
  tooltipBg: "#16140F", // --bg-secondary
  tooltipBorder: "#2A2620", // --border-primary
  text: "#F5F1E8", // --text-primary
  legend: "#B8AD98", // --text-secondary
  cellStroke: "#0B0A08", // --bg-primary — separates adjacent pie slices
} as const;

export function categoricalColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

export function bandColor(band: string | null | undefined): string {
  if (!band) return BAND_FALLBACK_COLOR;
  return BAND_COLOR[band] ?? BAND_FALLBACK_COLOR;
}
