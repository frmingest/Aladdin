import { useEffect, useState } from "react";
import DocumentUpload from "./pages/DocumentUpload";
import PortfolioUpload from "./pages/PortfolioUpload";

type Tab = "portfolio" | "documents";

const TABS: { id: Tab; label: string }[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "documents", label: "Documents" },
];

function BackendStatusBadge() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/health")
      .then((res) => setOk(res.ok))
      .catch(() => setOk(false));
  }, []);

  const label = ok === null ? "checking backend…" : ok ? "backend ok" : "backend unreachable";
  const color = ok === null ? "bg-slate-700" : ok ? "bg-emerald-700" : "bg-red-700";

  return <span className={`text-xs px-2 py-0.5 rounded ${color}`}>{label}</span>;
}

/**
 * Phase 1 — portfolio and document ingestion (docs/architecture.md §26).
 * No router dependency yet (§2.9: avoid premature complexity) — plain tab
 * state is enough for two pages. Revisit once Phase 6's dashboard lands.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>("portfolio");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-semibold">Aladdin</h1>
        <BackendStatusBadge />
      </div>
      <p className="text-slate-400 mb-6">Phase 1 — portfolio and document ingestion.</p>

      <nav className="flex gap-2 mb-6 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? "border-emerald-500 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "portfolio" && <PortfolioUpload />}
      {tab === "documents" && <DocumentUpload />}
    </div>
  );
}
