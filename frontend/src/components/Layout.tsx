import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/** Dark by default (2026-09-25). The choice is a per-browser convenience:
 * storage can be unavailable, so every access is guarded. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  useEffect(() => {
    if (theme === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("aladdin-theme", theme);
    } catch {
      /* private window / blocked storage: the theme just isn't remembered */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-ink-muted transition-colors hover:bg-border-subtle hover:text-ink"
      title="Switch between the dark and light theme"
    >
      <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span>
      <span aria-hidden className="text-sm">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
import { NavLink } from "react-router-dom";

/**
 * Fixed left nav + content area — Design & UX direction's "left-nav
 * information architecture" principle
 * (claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md). "Thesis"
 * (Sprint 11's tracking-over-time page) went live 2026-09-26 — previously
 * a visible-but-disabled placeholder. Sector research is reached from
 * within Macro / a holding's sector link rather than getting its own
 * top-level nav item.
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
  { label: "Thesis", to: "/thesis" },
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
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-positive font-display text-sm font-bold text-onfill"
          >
            A
          </span>
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
                    `block rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-accent bg-accent-subtle text-ink"
                        : "border-transparent text-ink-muted hover:bg-border-subtle hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ),
          )}
        </ul>
        <div className="mt-auto space-y-1 pt-6">
          <ThemeToggle />
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
