import { useEffect, useState } from "react";
import {
  getHoldingAnalysis,
  getInvalidationCheck,
  listHoldingAnalyses,
  listHoldingTheses,
  listHoldingValuationCases,
  listHoldings,
} from "../../services/api";
import type { Holding } from "../../types/portfolio";
import type { HoldingAnalysisDetail, HoldingAnalysisSummary } from "../../types/analysis";
import type { InvalidationSignalOut, ThesisOut } from "../../types/thesis";
import type { ValuationCaseOut } from "../../types/dcf";
import { num } from "../../lib/num";
import ValuationScenarioChart from "../../charts/ValuationScenarioChart";

const THESIS_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-emerald-400",
  UNDER_REVIEW: "text-amber-400",
  CLOSED: "text-slate-500",
};

function ScoreTrend({ analyses }: { analyses: HoldingAnalysisSummary[] }) {
  // Oldest -> newest for a left-to-right reading of the trend.
  const ordered = [...analyses].reverse();
  return (
    <div className="flex items-end gap-1 h-16">
      {ordered.map((a) => {
        const score = num(a.overall_score) ?? 0;
        const height = Math.max(4, (score / 10) * 100);
        const color = score >= 7 ? "bg-emerald-600" : score >= 5 ? "bg-amber-600" : "bg-red-600";
        return (
          <div key={a.id} className="flex flex-col items-center gap-1" title={`${a.thesis_status} — ${a.overall_score ?? "n/a"}/10`}>
            <div className={`w-4 rounded-t ${color}`} style={{ height: `${height}%` }} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Per-holding drill-down: analysis comparison (§19 "Analysis comparison —
 * why today's analysis differs from prior runs"), evidence panel (§19
 * "Evidence panel — sources behind material conclusions"), thesis timeline
 * (§19 "Thesis timeline — how thesis/confidence changes", §16), and
 * valuation scenarios (§19 "Valuation scenarios — bear/base/bull
 * valuation", §17). All read-only — no new analysis/thesis/valuation case
 * is created here, only what's already on record for the selected holding.
 */
export default function HoldingDetailSection() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingId, setHoldingId] = useState<string>("");

  const [analyses, setAnalyses] = useState<HoldingAnalysisSummary[]>([]);
  const [latest, setLatest] = useState<HoldingAnalysisDetail | null>(null);
  const [previous, setPrevious] = useState<HoldingAnalysisDetail | null>(null);

  const [theses, setTheses] = useState<ThesisOut[]>([]);
  const [invalidation, setInvalidation] = useState<Record<string, InvalidationSignalOut>>({});

  const [cases, setCases] = useState<ValuationCaseOut[]>([]);

  useEffect(() => {
    listHoldings()
      .then((list) => {
        setHoldings(list);
        if (list.length > 0) setHoldingId(list[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!holdingId) return;
    setLatest(null);
    setPrevious(null);
    listHoldingAnalyses(holdingId)
      .then(async (list) => {
        setAnalyses(list);
        if (list[0]) setLatest(await getHoldingAnalysis(list[0].id));
        if (list[1]) setPrevious(await getHoldingAnalysis(list[1].id));
      })
      .catch(() => undefined);
    listHoldingTheses(holdingId)
      .then(setTheses)
      .catch(() => undefined);
    listHoldingValuationCases(holdingId)
      .then(setCases)
      .catch(() => undefined);
  }, [holdingId]);

  async function checkInvalidation(thesisId: string) {
    const result = await getInvalidationCheck(thesisId);
    setInvalidation((prev) => ({ ...prev, [thesisId]: result }));
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Holding detail</h2>
        <select
          value={holdingId}
          onChange={(e) => setHoldingId(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
        >
          {holdings.length === 0 && <option value="">No holdings</option>}
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.ticker})
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Analysis comparison</h3>
        {analyses.length === 0 && <p className="text-sm text-slate-500">No analyses on record for this holding.</p>}
        {analyses.length > 0 && (
          <div className="flex items-center gap-4">
            <ScoreTrend analyses={analyses} />
            <span className="text-xs text-slate-500">{analyses.length} run(s), oldest to newest</span>
          </div>
        )}
        {latest && previous && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-900 rounded p-3">
              <p className="text-xs uppercase text-slate-500 mb-1">
                Previous ({new Date(previous.created_at).toLocaleDateString()})
              </p>
              <p>Overall: {previous.overall_score ?? "n/a"}/10 — {previous.structured_output.thesis_status}</p>
            </div>
            <div className="bg-slate-900 rounded p-3">
              <p className="text-xs uppercase text-slate-500 mb-1">
                Latest ({new Date(latest.created_at).toLocaleDateString()})
              </p>
              <p>Overall: {latest.overall_score ?? "n/a"}/10 — {latest.structured_output.thesis_status}</p>
            </div>
            {latest.structured_output.new_information.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase text-slate-500 mb-1">New information since previous run</p>
                <ul className="list-disc list-inside text-slate-300">
                  {latest.structured_output.new_information.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {latest && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">Evidence panel</h3>
          {latest.evidence_references.length === 0 ? (
            <p className="text-sm text-slate-500">No evidence references on the latest analysis.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {latest.evidence_references.map((ref, i) => (
                <li key={i} className="text-slate-300">
                  <span className="text-slate-500">[{ref.source_type}]</span> {ref.source_id}
                  {ref.section && ` — ${ref.section}`}
                  {ref.page_start && ` (p.${ref.page_start}${ref.page_end && ref.page_end !== ref.page_start ? `-${ref.page_end}` : ""})`}
                  <span className="text-xs text-slate-600"> · {ref.relevance}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Thesis timeline</h3>
        {theses.length === 0 && <p className="text-sm text-slate-500">No thesis recorded for this holding.</p>}
        <ul className="space-y-2">
          {theses.map((t) => (
            <li key={t.id} className="border-l-2 border-slate-800 pl-3">
              <div className="flex items-center gap-2 text-sm">
                <span className={`font-medium ${THESIS_STATUS_COLOR[t.status] ?? "text-slate-300"}`}>{t.status}</span>
                <span className="text-xs text-slate-500">{t.confidence} confidence</span>
                <span className="text-xs text-slate-600">{new Date(t.updated_at).toLocaleDateString()}</span>
                <button onClick={() => checkInvalidation(t.id)} className="text-xs text-emerald-400 hover:underline ml-auto">
                  Check invalidation signal
                </button>
              </div>
              <p className="text-sm text-slate-300 mt-1">{t.thesis}</p>
              {invalidation[t.id] && (
                <p className={`text-xs mt-1 ${invalidation[t.id].has_signal ? "text-amber-400" : "text-slate-500"}`}>
                  {invalidation[t.id].has_signal
                    ? `Invalidation signal: ${invalidation[t.id].reasons.join("; ")}`
                    : "No invalidation signal against the latest analysis."}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Valuation scenarios</h3>
        <ValuationScenarioChart
          data={cases
            .map((c) => ({ case_type: c.case_type, calculated_value: num(c.calculated_value), currency: c.currency }))
            .filter((c): c is { case_type: string; calculated_value: number; currency: string } => c.calculated_value !== null)}
        />
      </div>
    </section>
  );
}
