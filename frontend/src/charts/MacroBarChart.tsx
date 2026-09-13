import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoricalColor, CHROME } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type MacroBarPoint = { series: string; value: number; unit: string };

/**
 * Macro dashboard (architecture §19 "Macro dashboard — rates, inflation,
 * yield curves"). `GET /research/macro/snapshot` (§26 Phase 4) returns only
 * the latest observation per series — no history — so this is a snapshot
 * bar chart of current levels rather than a time series; a line chart here
 * would fabricate trend data that doesn't exist (§21).
 */
export default function MacroBarChart({ data }: { data: MacroBarPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No macro data on record yet.</p>;
  }
  return (
    <div style={{ height: Math.max(180, data.length * 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHROME.grid} horizontal={false} />
          <XAxis type="number" stroke={CHROME.axis} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="series" stroke={CHROME.axis} tick={{ fontSize: 11 }} width={140} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number, _name, item) => `${value} ${item.payload.unit}`}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={entry.series} fill={categoricalColor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
