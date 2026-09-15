import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoricalColor, CHROME } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type AllocationBar = { name: string; value: number };

/**
 * Horizontal bar breakdown — the bar-chart counterpart to
 * CompositionBreakdown's pie, for a small number of categories that read
 * more clearly as ranked bar lengths than as pie wedges (e.g. "By currency":
 * usually 2-4 currencies, where near-equal wedge angles are hard to compare
 * at a glance but bar lengths and the axis scale make the gap obvious).
 * Same categorical coloring-by-sorted-position convention as
 * CompositionBreakdown — color follows identity/rank, not value magnitude.
 */
export default function AllocationBarChart({ data, unit = "%" }: { data: AllocationBar[]; unit?: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-tertiary">No data.</p>;
  }
  return (
    <div style={{ height: Math.max(160, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={CHROME.grid} horizontal={false} />
          <XAxis type="number" unit={unit} stroke={CHROME.axis} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" stroke={CHROME.axis} tick={{ fontSize: 11 }} width={90} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number) => `${value.toFixed(1)}${unit}`}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={categoricalColor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
