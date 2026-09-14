import { useEffect, useState } from "react";
import Analysis from "./pages/Analysis";
import Dashboard from "./pages/Dashboard";
import DocumentUpload from "./pages/DocumentUpload";
import PortfolioUpload from "./pages/PortfolioUpload";

type Tab = "dashboard" | "portfolio" | "documents" | "analysis";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "portfolio", label: "Portfolio" },
  { id: "documents", label: "Documents" },
  { id: "analysis", label: "Analysis" },
];

function BackendStatusBadge() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/health")
      .then((res) => setOk(res.ok))
      .catch(() => setOk(false));
  }, []);

  const label = ok === null ? "checking backend…" : ok ? "backend ok" : "backend unreachable";
  const badgeClass =
    ok === null
      ? "terminal-badge terminal-badge-neutral"
      : ok
        ? "terminal-badge terminal-badge-positive"
        : "terminal-badge terminal-badge-negative";

  return <span className={badgeClass}>{label}</span>;
}

/**
 * Phases 1-6 — portfolio/document ingestion (§26 Phase 1), AI analysis
 * (§26 Phase 3), and the visualization dashboard (§26 Phase 6). No router
 * dependency yet (§2.9: avoid premature complexity) — plain tab state is
 * enough for four pages.
 *
 * Visual design: the finance-terminal design system shared with the CWO app
 * (src/styles/finance-terminal-design-system.css) — same tokens, same
 * terminal-nav/terminal-card/terminal-table component classes.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen">
      <nav className="terminal-nav">
        <div className="terminal-nav-container">
          <div className="flex items-center gap-4">
            <span
              className="font-mono font-bold text-[15px]"
              style={{
                letterSpacing: "2.5px",
                background: "linear-gradient(135deg, #00D4FF 0%, #A78BFA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ALADDIN
            </span>
            <BackendStatusBadge />
          </div>

          <div className="terminal-nav-links">
            {TABS.map((t) => (
              <a
                key={t.id}
                onClick={() => setTab(t.id)}
                className={tab === t.id ? "active" : ""}
                style={{ cursor: "pointer" }}
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="terminal-page">
        <div className="terminal-container">
          <div className="terminal-page-header">
            <p className="terminal-page-subtitle">
              Portfolio ingestion, document analysis, and AI-driven holding analysis.
            </p>
          </div>

          {tab === "dashboard" && <Dashboard />}
          {tab === "portfolio" && <PortfolioUpload />}
          {tab === "documents" && <DocumentUpload />}
          {tab === "analysis" && <Analysis />}
        </div>
      </div>
    </div>
  );
}
