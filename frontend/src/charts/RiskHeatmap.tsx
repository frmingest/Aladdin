import { bandColor } from "./palette";

export type RiskCell = { dimension: string; band: string | null; detail?: string; label?: string };

/**
 * Portfolio risk heatmap (architecture §19 "Portfolio risk heatmap — risk
 * dimensions at a glance"; §15: "prioritize a risk profile over a single
 * number"). Plain colored-cell grid rather than a recharts chart — there's
 * no continuous scale here, just one qualitative LOW/MODERATE/
 * MODERATE-HIGH/HIGH/INSUFFICIENT-DATA band per dimension
 * (app.domain.portfolio_risk.score_dimension), so a grid of labeled cells
 * communicates it more directly than forcing it into an XY chart type.
 * Status colors (never categorical hues) carry the band, always paired
 * with a text label so meaning never rides on color alone.
 */
export default function RiskHeatmap({ cells, footnote }: { cells: RiskCell[]; footnote?: string }) {
  if (cells.length === 0) {
    return <p className="text-sm text-tertiary">No risk dimensions scored yet.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.dimension}
            className="rounded-lg p-3 border border-primary"
            style={{ backgroundColor: `${bandColor(cell.band)}1F` }}
          >
            <p className="stat-label mb-1">{cell.label ?? cell.dimension.replace(/_/g, " ")}</p>
            <p className="text-sm font-semibold font-mono" style={{ color: bandColor(cell.band) }}>
              {cell.band ?? "INSUFFICIENT DATA"}
            </p>
            {cell.detail && <p className="text-xs text-tertiary mt-1 font-mono">{cell.detail}</p>}
          </div>
        ))}
      </div>
      {footnote && <p className="text-xs text-disabled mt-2">{footnote}</p>}
    </div>
  );
}
