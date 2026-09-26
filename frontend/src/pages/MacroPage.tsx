import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { Holding, MacroResearch } from "../lib/types";
import { PageHeader } from "../components/ui";
import { ResearchPanel } from "../components/ResearchPanel";
import { MacroIndicatorsPanel } from "../components/MacroIndicatorsPanel";

/**
 * Portfolio-wide macro/geopolitical research (Sprint 2 — the Brain's
 * "Opening" step: rates, inflation, conflicts, currencies, regulation,
 * sector trends). GET /research/macro serves cache-or-refresh-if-stale;
 * the Refresh button forces a real Gemini call regardless of freshness.
 *
 * Sector research (the same step's Step 3.3 industry input) is reached
 * from here by sector, since there's no portfolio-wide "all sectors" feed
 * — only per-sector research scoped by the sectors actually held.
 */
export default function MacroPage() {
  const [snapshot, setSnapshot] = useState<MacroResearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);

  useEffect(() => {
    api
      .getMacroResearch()
      .then(setSnapshot)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load macro research."));
    api.listHoldings().then(setHoldings).catch(() => setHoldings([]));
  }, []);

  async function handleRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      setSnapshot(await api.refreshMacroResearch());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  const sectors = Array.from(
    new Set((holdings ?? []).map((h) => h.sector).filter((s): s is string => Boolean(s))),
  ).sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Macro"
        subtitle="Official rates, inflation and currency data, plus evidence-first macro & geopolitical research."
      />

      <div className="mb-6">
        <MacroIndicatorsPanel />
      </div>

      <div className="mb-6">
        <ResearchPanel
          title="Macro & geopolitical"
          snapshot={snapshot}
          error={error}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          emptyHint="Needs a real GOOGLE_AI_STUDIO_API_KEY set on the backend."
        />
      </div>

      <div>
        <h2 className="section-title">
          Sector research
        </h2>
        {holdings === null && <p className="text-sm text-ink-muted">Loading…</p>}
        {holdings !== null && sectors.length === 0 && (
          <p className="text-sm text-ink-muted">
            No holdings have a sector set yet — sector research is scoped to sectors you actually hold.
          </p>
        )}
        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sectors.map((sector) => (
              <Link
                key={sector}
                to={`/sectors/${encodeURIComponent(sector)}`}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink hover:border-accent hover:text-accent"
              >
                {sector}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
