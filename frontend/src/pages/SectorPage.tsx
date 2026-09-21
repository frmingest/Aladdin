import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { SectorResearch } from "../lib/types";
import { PageHeader } from "../components/ui";
import { ResearchPanel } from "../components/ResearchPanel";

/** Per-sector research (Sprint 2), reached from the Macro page's sector
 * chips or a holding's own sector link. GET /research/sectors/{sector}
 * serves cache-or-refresh-if-stale, same pattern as Macro. */
export default function SectorPage() {
  const { sector: sectorParam } = useParams<{ sector: string }>();
  const sector = sectorParam ? decodeURIComponent(sectorParam) : "";
  const [snapshot, setSnapshot] = useState<SectorResearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!sector) return;
    setSnapshot(null);
    setError(null);
    api
      .getSectorResearch(sector)
      .then(setSnapshot)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load sector research."));
  }, [sector]);

  async function handleRefresh() {
    if (!sector) return;
    setError(null);
    setRefreshing(true);
    try {
      setSnapshot(await api.refreshSectorResearch(sector));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!sector) return null;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link to="/macro" className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">
        ← Macro
      </Link>
      <PageHeader title={sector} subtitle="Sector research — Gemini + Google Search grounding." />
      <ResearchPanel
        title={`${sector} sector`}
        snapshot={snapshot}
        error={error}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        emptyHint="Needs a real GOOGLE_AI_STUDIO_API_KEY set on the backend."
      />
    </div>
  );
}
