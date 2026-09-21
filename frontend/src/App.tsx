import { useEffect, useState } from "react";

/**
 * Sprint 0 skeleton (see
 * claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md): just enough
 * frontend to boot, talk to the backend healthcheck, and be deployable
 * through the existing Dockerfile/Railway/nginx setup. Real pages
 * (portfolio, documents, analysis, dashboard) are rebuilt per-sprint against
 * the new equity-only Brain schema — the pre-rebuild multi-asset UI was
 * removed rather than adapted (2026-09-21 clean-slate decision).
 */

type HealthState = "checking" | "ok" | "unreachable";

function useBackendHealth(): HealthState {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/health")
      .then((res) => {
        if (!cancelled) setState(res.ok ? "ok" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setState("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default function App() {
  const health = useBackendHealth();

  const badgeColor =
    health === "checking" ? "#9CA3AF" : health === "ok" ? "#16A34A" : "#DC2626";
  const badgeLabel =
    health === "checking"
      ? "checking backend…"
      : health === "ok"
        ? "backend ok"
        : "backend unreachable";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontWeight: 700, letterSpacing: "2px" }}>ALADDIN</span>
        <span
          style={{
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "9999px",
            color: "white",
            backgroundColor: badgeColor,
          }}
        >
          {badgeLabel}
        </span>
      </header>
      <main style={{ padding: "24px" }}>
        <p>Buffett/Munger equity advisor — rebuild in progress (Sprint 0).</p>
      </main>
    </div>
  );
}
