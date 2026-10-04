import { useEffect, useState } from "react";
import { useDemoMode } from "../lib/demoMode";
import LampLogo from "./LampLogo";

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
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useGameMode } from "../lib/gameMode";
import CommandPalette from "./CommandPalette";

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

/** Game mode (F33, G2) adds one entry, the Fortress home, to the top of the
 * Overview group; with game mode off the nav is exactly the old one. */
function navSectionsFor(gameMode: boolean): NavSection[] {
  if (!gameMode) return NAV_SECTIONS;
  return NAV_SECTIONS.map((section) =>
    section.title === "Overview"
      ? { ...section, items: [{ label: "Fortress", to: "/fortress" }, { label: "Marketplace", to: "/fortress/marketplace" }, { label: "Siege Simulator", to: "/fortress/siege" }, { label: "Chronicle", to: "/fortress/chronicle" }, ...section.items] }
      : section,
  );
}

/** The top-bar switch. A view preference only: it changes how the app is
 * shown, never an analysis or a stored value. Switching on lands on the
 * Fortress; switching off from the Fortress returns to the Dashboard. */
function GameModeToggle() {
  const { gameMode, setGameMode } = useGameMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const flip = () => {
    const next = !gameMode;
    setGameMode(next);
    if (next) navigate("/fortress");
    else if (pathname.startsWith("/fortress")) navigate("/");
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={gameMode}
      onClick={flip}
      title="Show your portfolio as a value investor's fortress. Same data, a different view."
      className="flex items-center gap-2 rounded-full border border-border bg-raised py-1 pl-3 pr-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <span>Game mode</span>
      <span
        aria-hidden
        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
          gameMode ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-onfill shadow transition-transform ${
            gameMode ? "translate-x-4" : "translate-x-0"
          } ${gameMode ? "" : "bg-ink-faint"}`}
        />
      </span>
    </button>
  );
}

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

/** Brand: the golden magic lamp (2026-10-01, replacing the genie-bottle
 * silhouette) beside the wordmark. Reused by the desktop sidebar, the mobile
 * top bar and the mobile drawer header. */
function Brand() {
  return (
    <div className="flex items-center gap-2 px-1">
      <LampLogo className="h-9 w-9 shrink-0 drop-shadow-[0_1px_6px_rgba(242,193,78,0.35)]" />
      <span className="font-display text-sm font-bold tracking-[0.2em] text-ink">ALADDIN</span>
    </div>
  );
}

/** The nav list + footer (theme toggle, status link) shared by the fixed
 * desktop sidebar and the mobile drawer. `onNavigate` closes the drawer
 * when a link is tapped on mobile; it's a no-op on desktop. */
function NavContents({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
  const { gameMode } = useGameMode();
  const sections = navSectionsFor(gameMode);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onSearch();
        }}
        className="mb-4 flex w-full items-center justify-between rounded-md border border-border bg-raised px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <span>Search…</span>
        <kbd className="rounded border border-border px-1.5 text-[10px] text-ink-faint">Ctrl K</kbd>
      </button>
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
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
                      end={item.to === "/" || item.to === "/fortress"}
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

const PAGE_TITLES: Record<string, string> = {
  "/status": "System status",
  "/sectors": "Sector research",
};

/** Browser-tab titles: every page used to be just "Aladdin", so a dozen open
 * tabs were indistinguishable. Holding pages set their own title (they know
 * the company name), so they're skipped here. */
function useRouteTitle() {
  const { pathname } = useLocation();
  const { gameMode } = useGameMode();
  useEffect(() => {
    if (/^\/(holdings|fortress\/marketplace)\/[^/]+/.test(pathname)) return;
    const item = navSectionsFor(gameMode).flatMap((s) => s.items).find((i) => i.to === pathname);
    const base = "/" + pathname.split("/")[1];
    const label = item?.label ?? PAGE_TITLES[pathname] ?? PAGE_TITLES[base];
    document.title = label && pathname !== "/" ? `${label} · Aladdin` : "Aladdin";
  }, [pathname, gameMode]);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useRouteTitle();
  const { gameMode } = useGameMode();

  const paletteRoutes = navSectionsFor(gameMode).flatMap((s) =>
    s.items.filter((i) => !i.disabled).map((i) => ({ label: i.label, to: i.to, group: s.title })),
  );

  // Ctrl/⌘+K opens quick search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-onfill"
      >
        Skip to content
      </a>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} routes={paletteRoutes} />
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
        <GameModeToggle />
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
            <NavContents onNavigate={() => setMobileNavOpen(false)} onSearch={() => setSearchOpen(true)} />
          </nav>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Desktop fixed sidebar (lg+). */}
        <nav className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
          <div className="mb-8">
            <Brand />
          </div>
          <NavContents onSearch={() => setSearchOpen(true)} />
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Slim top bar (lg+): the game-mode switch. Below lg the switch sits in the mobile bar. */}
          <div className="hidden items-center justify-end border-b border-border bg-surface px-6 py-2 lg:flex">
            <GameModeToggle />
          </div>
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
