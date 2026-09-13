import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { categoricalColor } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type BreakdownSlice = { name: string; value: number };

/**
 * Portfolio composition breakdown (architecture §19 "Portfolio composition —
 * current allocation"). Generic over whichever weight map is passed in
 * (asset class / sector / currency — all §26 Phase 2 concentration output),
 * so one component covers every "current allocation" pie in the dashboard.
 * Slices are pre-sorted by the caller and colored by fixed categorical
 * order (index into the palette), not by value — color follows identity,
 * never rank (dataviz skill).
 */
export default function CompositionBreakdown({
  data,
  unit = "%",
}: {
  data: BreakdownSlice[];
  unit?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No data.</p>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={categoricalColor(i)} stroke="#0f172a" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number) => `${value.toFixed(1)}${unit}`}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
