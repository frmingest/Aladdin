import { bandColor } from "./palette";

export type RiskCell = { dimension: string; band: string | null; detail?: string };

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
    return <p className="text-sm text-slate-500">No risk dimensions scored yet.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.dimension}
            className="rounded p-3 border border-slate-800"
            style={{ backgroundColor: `${bandColor(cell.band)}26` }}
          >
            <p className="text-xs uppercase text-slate-400 mb-1">{cell.dimension.replace(/_/g, " ")}</p>
            <p className="text-sm font-semibold" style={{ color: bandColor(cell.band) }}>
              {cell.band ?? "INSUFFICIENT DATA"}
            </p>
            {cell.detail && <p className="text-xs text-slate-500 mt-1">{cell.detail}</p>}
          </div>
        ))}
      </div>
      {footnote && <p className="text-xs text-slate-600 mt-2">{footnote}</p>}
    </div>
  );
}
