import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

/**
 * Fixed left nav + content area — Design & UX direction's "left-nav
 * information architecture" principle
 * (claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md), sized to grow
 * as later sprints add portfolio/thesis/macro sections. Only "Holdings" is
 * live today; the rest are visible-but-disabled so the intended shape of
 * the app is legible even before those sprints land.
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
  { label: "Holdings", to: "/" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Thesis", to: "/thesis", disabled: true },
  { label: "Macro", to: "/macro", disabled: true },
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
        <div className="mt-auto px-2 pt-6">
          <HealthBadge />
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
