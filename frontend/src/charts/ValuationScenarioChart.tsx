import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHROME, STATUS } from "./palette";
import { tooltipContentStyle, tooltipLabelStyle } from "./tooltip";

export type ValuationScenarioPoint = { case_type: string; calculated_value: number; currency: string };

const CASE_COLOR: Record<string, string> = { bear: STATUS.critical, base: STATUS.warning, bull: STATUS.good };
const CASE_ORDER = ["bear", "base", "bull"];

/**
 * Valuation scenarios (architecture §19 "Valuation scenarios — bear/base/
 * bull valuation", §17). Bear/base/bull is a fixed ordinal set with an
 * intuitive real-world color convention (bearish=red, bullish=green), so
 * this uses the status pair keyed by case_type rather than the categorical
 * palette — the same "polarity, not identity" reasoning as
 * ScenarioImpactChart.
 */
export default function ValuationScenarioChart({ data }: { data: ValuationScenarioPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No valuation cases on record for this holding yet.</p>;
  }
  const sorted = [...data].sort((a, b) => CASE_ORDER.indexOf(a.case_type) - CASE_ORDER.indexOf(b.case_type));
  const currency = sorted[0]?.currency ?? "";
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHROME.grid} vertical={false} />
          <XAxis dataKey="case_type" stroke={CHROME.axis} tick={{ fontSize: 11 }} />
          <YAxis stroke={CHROME.axis} tick={{ fontSize: 11 }} unit={` ${currency}`} width={70} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          <Bar dataKey="calculated_value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {sorted.map((entry) => (
              <Cell key={entry.case_type} fill={CASE_COLOR[entry.case_type] ?? "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
