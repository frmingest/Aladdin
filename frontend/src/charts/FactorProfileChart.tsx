import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORICAL, CHROME } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type FactorProfilePoint = {
  name: string;
  business_quality: number | null;
  financial_strength: number | null;
  valuation: number | null;
};

const FACTORS: { key: keyof Omit<FactorProfilePoint, "name">; label: string; color: string }[] = [
  { key: "business_quality", label: "Business quality", color: CATEGORICAL[0] },
  { key: "financial_strength", label: "Financial strength", color: CATEGORICAL[1] },
  { key: "valuation", label: "Valuation", color: CATEGORICAL[2] },
];

/**
 * Factor profile (architecture §19 "Factor profile — business/financial/
 * valuation/macro assessment"). One grouped bar per holding, scores on the
 * fixed 1-10 scale from HoldingAnalysisOutput's factor assessments (§12).
 * The three factors always take the same three categorical slots regardless
 * of which holdings are shown — color follows the factor's identity, not
 * its position in this particular chart.
 */
export default function FactorProfileChart({ data }: { data: FactorProfilePoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-tertiary">No completed holding analyses yet.</p>;
  }
  return (
    <div style={{ height: Math.max(220, data.length * 44) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHROME.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 10]} stroke={CHROME.axis} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" stroke={CHROME.axis} tick={{ fontSize: 11 }} width={120} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHROME.legend }} />
          {FACTORS.map((f) => (
            <Bar key={f.key} dataKey={f.key} name={f.label} fill={f.color} radius={[0, 3, 3, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
