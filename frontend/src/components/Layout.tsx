import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

/**
 * Fixed left nav + content area — Design & UX direction's "left-nav
 * information architecture" principle
 * (claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md), sized to grow
 * as later sprints add thesis/valuation sections. "Thesis" is still
 * visible-but-disabled so the intended shape of the app stays legible
 * before Sprint 4 lands; Macro is live as of Sprint 2's research UI
 * (Sector research is reached from within Macro / a holding's sector
 * link rather than getting its own top-level nav item).
 */

type HealthState = "checking" | "ok" | "unreachable";

function useBackendHealth(): HealthState {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
    const url = base ? `${base}/health` : "/health";
    fetch(url)
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

const NAV_ITEMS: { label: string; to: string; disabled?: boolean }[] = [
  { label: "Dashboard", to: "/" },
  { label: "Holdings", to: "/holdings" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Margin of safety", to: "/margin-of-safety" },
  { label: "Analysis queue", to: "/analysis-queue" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Journal", to: "/journal" },
  { label: "Macro", to: "/macro" },
  { label: "Thesis", to: "/thesis", disabled: true },
];

function HealthBadge() {
  const health = useBackendHealth();
  const dotColor =
    health === "checking" ? "bg-ink-faint" : health === "ok" ? "bg-positive" : "bg-negative";
  const label =
    health === "checking" ? "checking…" : health === "ok" ? "backend ok" : "backend unreachable";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="mb-8 px-2">
          <span className="font-display text-sm font-bold tracking-[0.2em] text-ink">
            ALADDIN
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) =>
            item.disabled ? (
              <li
                key={item.to}
                className="cursor-not-allowed rounded-md px-3 py-2 text-sm text-ink-faint"
                title="Not built yet"
              >
                {item.label}
              </li>
            ) : (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent-subtle text-accent"
                        : "text-ink-muted hover:bg-border-subtle hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ),
          )}
        </ul>
        <div className="mt-auto pt-6">
          <NavLink
            to="/status"
            title="System status"
            className={({ isActive }) =>
              `block rounded-md px-2 py-1.5 transition-colors ${isActive ? "bg-accent-subtle" : "hover:bg-border-subtle"}`
            }
          >
            <HealthBadge />
            <span className="mt-0.5 block text-[11px] text-ink-faint">System status →</span>
          </NavLink>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
