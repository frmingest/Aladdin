import { useEffect, useState } from "react";
import { useDemoMode } from "../lib/demoMode";

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
import { AnalystModeToggle } from "./AnalystModeToggle";

/**
 * Left nav + content area — Design & UX direction's "left-nav information
 * architecture" principle (claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).
 * Fixed sidebar on lg+ screens; below that it collapses behind a hamburger
 * into a slide-in drawer (2026-09-26 mobile pass) so the 13-item nav never
 * eats the viewport on a phone. "Thesis" (Sprint 11's tracking-over-time
 * page) went live 2026-09-26 — previously a visible-but-disabled
 * placeholder. Sector research is reached from within Macro / a holding's
 * sector link rather than getting its own top-level nav item.
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

type NavItem = { label: string; to: string; disabled?: boolean };
type NavSection = { title: string; items: NavItem[] };

/** Grouped 2026-09-27 (13 flat links had become a wall of text). Order
 * inside each group is the old flat order, so nothing muscle-memory
 * depended on moved further than a section up or down. */
const NAV_SECTIONS: NavSection[] = [
  { title: "Overview", items: [{ label: "Dashboard", to: "/" }] },
  {
    title: "Portfolio",
    items: [
      { label: "Holdings", to: "/holdings" },
      { label: "Portfolio", to: "/portfolio" },
      { label: "Performance", to: "/performance" },
      { label: "Portfolio risk", to: "/risk" },
      { label: "Margin of safety", to: "/margin-of-safety" },
      { label: "Precious metals", to: "/precious-metals" },
    ],
  },
  {
    title: "Research",
    items: [
      { label: "Analysis queue", to: "/analysis-queue" },
      { label: "Watchlist", to: "/watchlist" },
      { label: "Macro", to: "/macro" },
    ],
  },
  {
    title: "Tracking",
    items: [
      { label: "Journal", to: "/journal" },
      { label: "Thesis", to: "/thesis" },
    ],
  },
  { title: "System", items: [{ label: "Settings", to: "/settings" }] },
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

/** Persistent, unmissable strip shown at the top of every page whenever
 * demo mode is on — a load-bearing safety cue (per the feature spec), not
 * decoration, so anyone screen-sharing sees it immediately. */
function DemoModeBanner() {
  const { demoMode } = useDemoMode();
  if (demoMode !== true) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-caution px-4 py-2 text-center text-xs font-semibold text-onfill sm:gap-3 sm:text-sm">
      <span aria-hidden>●</span>
      <span>
        DEMO MODE — every page shows fabricated data. Real portfolio data, documents and research
        are never read while this is on.
      </span>
      <NavLink to="/settings" className="underline underline-offset-2 hover:opacity-80">
        Turn off
      </NavLink>
    </div>
  );
}

/** Genie-bottle mark (2026-09-27, replacing the plain "A" monogram) —
 * reused by the desktop sidebar, the mobile top bar and the mobile drawer
 * header. Two shapes only (stopper + body) so it still reads at 16px. */
function BrandMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="10.2" y="1" width="3.6" height="1.7" rx="0.75" fill="currentColor" />
      <path
        d="M10.4 2.7h3.2v2.3c0 .5.2 1 .6 1.3 1.9 1.7 3 4.1 3 6.7v3.9c0 2-1.6 3.6-3.6 3.6h-3.2c-2 0-3.6-1.6-3.6-3.6v-3.9c0-2.6 1.1-5 3-6.7.4-.4.6-.8.6-1.3V2.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-positive text-onfill"
      >
        <BrandMark />
      </span>
      <span className="font-display text-sm font-bold tracking-[0.2em] text-ink">ALADDIN</span>
    </div>
  );
}

/** The nav list + footer (theme toggle, status link) shared by the fixed
 * desktop sidebar and the mobile drawer. `onNavigate` closes the drawer
 * when a link is tapped on mobile; it's a no-op on desktop. */
function NavContents({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {section.title}
            </p>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) =>
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
                      onClick={onNavigate}
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
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-1 pt-6">
        <ThemeToggle />
        <NavLink
          to="/status"
          title="System status"
          onClick={onNavigate}
          className={({ isActive }) =>
            `block rounded-md px-2 py-1.5 transition-colors ${isActive ? "bg-accent-subtle" : "hover:bg-border-subtle"}`
          }
        >
          <HealthBadge />
          <span className="mt-0.5 block text-[11px] text-ink-faint">System status →</span>
        </NavLink>
      </div>
    </>
  );
}

/** Hamburger / close icon button for the mobile top bar. */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-border-subtle hover:text-ink"
    >
      {children}
    </button>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Lock background scroll while the mobile drawer is open, and always
  // close it if the viewport grows past the mobile breakpoint (e.g.
  // rotating a tablet to landscape).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mql = window.matchMedia("(min-width: 1024px)");
    const closeIfWide = () => {
      if (mql.matches) setMobileNavOpen(false);
    };
    mql.addEventListener("change", closeIfWide);
    return () => {
      document.body.style.overflow = previousOverflow;
      mql.removeEventListener("change", closeIfWide);
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <DemoModeBanner />

      {/* Mobile top bar (< lg): hamburger + logo, replaces the fixed sidebar. */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2.5 lg:hidden">
        <IconButton label="Open navigation" onClick={() => setMobileNavOpen(true)}>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </IconButton>
        <Brand />
        <span className="w-9" aria-hidden />
      </div>
      {/* Mobile analyst-mode row (F22): the toggle stays one tap away. */}
      <div className="flex items-center justify-center border-b border-border bg-surface px-3 py-2 lg:hidden">
        <AnalystModeToggle compact />
      </div>

      {/* Mobile drawer + backdrop (< lg), only mounted while open. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface px-4 py-4 shadow-card">
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <IconButton label="Close navigation" onClick={() => setMobileNavOpen(false)}>
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="h-5 w-5"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </IconButton>
            </div>
            <NavContents onNavigate={() => setMobileNavOpen(false)} />
          </nav>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Desktop fixed sidebar (lg+). */}
        <nav className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
          <div className="mb-8">
            <Brand />
          </div>
          <NavContents />
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* Desktop top bar (F22 story 22.1): the whole-app analyst mode. */}
          <div className="sticky top-0 z-30 hidden items-center justify-end border-b border-border bg-surface/95 px-6 py-2 backdrop-blur lg:flex">
            <AnalystModeToggle />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
