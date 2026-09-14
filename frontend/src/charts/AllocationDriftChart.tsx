import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoricalColor, CHROME } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type DriftPoint = { label: string; [ticker: string]: string | number };

/**
 * Allocation drift (architecture §19 "Allocation drift — historical weight
 * changes"). One point per uploaded portfolio snapshot, using each
 * snapshot's own uploaded `weight_pct` (§20 PortfolioPosition) rather than a
 * live market-data re-valuation — so this chart never depends on network
 * access to a market-data provider, unlike the current-composition pie
 * (which reads a valuation refresh).
 */
export default function AllocationDriftChart({ data, tickers }: { data: DriftPoint[]; tickers: string[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-tertiary">Need at least two portfolio snapshots to show drift.</p>;
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHROME.grid} vertical={false} />
          <XAxis dataKey="label" stroke={CHROME.axis} tick={{ fontSize: 11 }} />
          <YAxis stroke={CHROME.axis} tick={{ fontSize: 11 }} unit="%" width={40} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHROME.legend }} />
          {tickers.map((ticker, i) => (
            <Line
              key={ticker}
              type="monotone"
              dataKey={ticker}
              stroke={categoricalColor(i)}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
