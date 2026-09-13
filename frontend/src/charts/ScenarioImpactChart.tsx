import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHROME, STATUS } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type ScenarioImpactPoint = { label: string; impact_pct: number };

/**
 * Scenario impact (architecture §19 "Scenario impact — estimated portfolio
 * response", §18). Impact is a polarity, not an identity — a stress
 * scenario's estimated effect is a gain or a loss — so bars use the status
 * pair (good/critical) keyed on sign, not the categorical palette.
 */
export default function ScenarioImpactChart({ data }: { data: ScenarioImpactPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No scenario impacts computed yet.</p>;
  }
  return (
    <div style={{ height: Math.max(220, data.length * 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHROME.grid} horizontal={false} />
          <XAxis type="number" unit="%" stroke={CHROME.axis} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" stroke={CHROME.axis} tick={{ fontSize: 11 }} width={160} />
          <ReferenceLine x={0} stroke={CHROME.axis} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number) => `${value.toFixed(1)}%`}
          />
          <Bar dataKey="impact_pct" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.impact_pct < 0 ? STATUS.critical : STATUS.good} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
