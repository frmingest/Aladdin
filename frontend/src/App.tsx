import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  environment: string;
  application_version: string;
  active_prompt_version: string;
  active_scoring_version: string;
  active_extraction_schema_version: string;
  active_macro_regime_profile: string;
};

/**
 * Phase 0 placeholder. Portfolio/Research/Memos pages (architecture §3) are
 * added starting Phase 1. This component's only job right now is to prove
 * the frontend can reach the backend.
 */
export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setError("Could not reach backend at /api/health"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-semibold mb-4">Aladdin</h1>
      <p className="text-slate-400 mb-6">Phase 0 — foundation. Dashboard arrives in Phase 6.</p>
      {error && <p className="text-red-400">{error}</p>}
      {health && (
        <pre className="bg-slate-900 rounded p-4 text-sm">{JSON.stringify(health, null, 2)}</pre>
      )}
    </div>
  );
}
