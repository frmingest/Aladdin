/** The app's navigation as data (UX noise audit, Wave 3). Four primary pages
 * stay on screen; everything else sits one click away under "More". Game mode
 * adds exactly one sidebar entry (the Fortress); its other rooms are a tab strip
 * on the Fortress pages, not seven more links. Kept free of React so a test can
 * hold the line on how many words the default sidebar shows. */

export type NavItem = { label: string; to: string };
export type NavSection = { title: string; items: NavItem[] };

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", to: "/" },
  { label: "Holdings", to: "/holdings" },
  { label: "Margin of safety", to: "/margin-of-safety" },
  { label: "Thesis", to: "/thesis" },
];

/** Same pages as before Wave 3, regrouped. Precious metals stays reachable
 * here (Faiz 2026-10-06: it was kept visible until this wave). */
export const MORE_NAV: NavSection[] = [
  {
    title: "Portfolio",
    items: [
      { label: "Portfolio", to: "/portfolio" },
      { label: "Performance", to: "/performance" },
      { label: "Portfolio risk", to: "/risk" },
      { label: "Precious metals", to: "/precious-metals" },
    ],
  },
  {
    title: "Research",
    items: [
      { label: "Watchlist", to: "/watchlist" },
      { label: "Analysis queue", to: "/analysis-queue" },
      { label: "Macro", to: "/macro" },
    ],
  },
  { title: "Tracking", items: [{ label: "Journal", to: "/journal" }] },
  {
    title: "System",
    items: [
      { label: "Settings", to: "/settings" },
      { label: "Tag review", to: "/tag-review" },
      { label: "Glossary", to: "/glossary" },
    ],
  },
];

/** The Fortress rooms, shown as a tab strip on every /fortress page. */
export const FORTRESS_NAV: NavItem[] = [
  { label: "Fortress", to: "/fortress" },
  { label: "Marketplace", to: "/fortress/marketplace" },
  { label: "Siege Simulator", to: "/fortress/siege" },
  { label: "Chronicle", to: "/fortress/chronicle" },
  { label: "Council", to: "/fortress/council" },
  { label: "Records", to: "/fortress/records" },
  { label: "Circle", to: "/fortress/circle" },
  { label: "Map", to: "/fortress/map" },
];

/** What the sidebar lists without opening "More". */
export function primaryNavFor(gameMode: boolean): NavItem[] {
  return gameMode ? [FORTRESS_NAV[0], ...PRIMARY_NAV] : PRIMARY_NAV;
}

/** Every page reachable from the sidebar, for quick search and tab titles. */
export function allNavSections(gameMode: boolean): NavSection[] {
  const sections: NavSection[] = [{ title: "Main", items: primaryNavFor(gameMode) }, ...MORE_NAV];
  return gameMode
    ? [...sections, { title: "Fortress", items: FORTRESS_NAV.slice(1) }]
    : sections;
}

export function isFortressPath(pathname: string): boolean {
  return pathname === "/fortress" || pathname.startsWith("/fortress/");
}

/** True when the current page lives under "More", so the group opens by itself. */
export function moreContainsPath(pathname: string): boolean {
  return MORE_NAV.some((s) =>
    s.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)),
  ) || pathname.startsWith("/sectors") || pathname === "/status";
}
