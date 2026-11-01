/**
 * The page-parity register (3D sprint S13). Pure data and small helpers, no React and no three.js.
 *
 * Faiz's rule (2026-11-01): every page and element of the normal Game mode must be reachable from the
 * 3D game somehow. This file is that rule as data: one row per flat route, saying where in the world
 * it will live, how far it has got, and which sprint finishes it. `parity3d.test.ts` reads the app's
 * own route list (App.tsx) and fails if a route has no row, so a future page cannot be forgotten.
 *
 * Levels: A = reachable (a sign, door or menu in the world opens the page in a panel, two taps or fewer,
 * with a link to the flat page). B = shown (the page's main fact is drawn in the world by code).
 * C = played (the page's job is done by walking and pressing E). "planned" = not built yet anywhere.
 *
 * Nothing here is a fact about the portfolio. The panel shows the flat page itself, so every number
 * comes from the same code that draws it on the flat route.
 */

export type ParityLevel = "A" | "B" | "C" | "planned";

/** The places the world signpost sorts the pages into (some are buildings that arrive in later sprints). */
export type PlaceId = "fortress" | "market" | "town" | "townhall" | "workshop" | "keep" | "mint";

export interface Door {
  /** The route pattern exactly as App.tsx spells it. `null` only for a page that is not built yet. */
  route: string | null;
  /** What to open in the panel. Defaults to `route`; a route with a `:param` opens its parent instead. */
  open?: string;
  /** For a route with a `:param`: the listed page you reach it from. It gets no door of its own. */
  via?: string;
  title: string;
  /** One short, playful line. Words only; no number. */
  blurb: string;
  place: PlaceId;
  /** How far it has got today. */
  level: ParityLevel;
  /** The sprint that finishes it (or built it, for level C). Always set for `planned`. */
  sprint: string;
}

export interface Place {
  id: PlaceId;
  title: string;
  /** What the place will be in the world. */
  will: string;
}

export const PLACES: readonly Place[] = [
  { id: "fortress", title: "The Fortress", will: "your towers, walls and the siege yard" },
  { id: "market", title: "Market Street", will: "one stall per company you are watching" },
  { id: "town", title: "The Town", will: "records, maps and the archive" },
  { id: "townhall", title: "Town Hall", will: "the big picture pages" },
  { id: "workshop", title: "The Workshop", will: "queues, status and settings" },
  { id: "keep", title: "The Keep", will: "your journal and the vault" },
  { id: "mint", title: "The Royal Mint", will: "the Printer (not built yet)" },
];

/** The route the world is itself (never listed as a door). */
export const WORLD_ROUTE = "/game3d";

export const REGISTER: readonly Door[] = [
  // The Fortress
  { route: "/fortress", title: "Plain fortress", blurb: "The flat fortress, same towers in a table.", place: "fortress", level: "C", sprint: "S16" },
  { route: "/fortress/siege", title: "Siege Simulator", blurb: "What a big fall does to every holding.", place: "fortress", level: "A", sprint: "S17" },
  { route: "/holdings/:id", via: "/holdings", title: "A holding's page", blurb: "Pick a holding in Holdings to read its page.", place: "fortress", level: "B", sprint: "S16" },
  // Market Street
  { route: "/fortress/marketplace", title: "Marketplace", blurb: "Which companies are near the price you named.", place: "market", level: "A", sprint: "S14" },
  { route: "/fortress/marketplace/:holdingId", via: "/fortress/marketplace", title: "A store", blurb: "Step into a store from the Marketplace.", place: "market", level: "A", sprint: "S14" },
  // The Town
  { route: "/fortress/records", title: "Hall of Records", blurb: "Look-backs, calibration and time capsules.", place: "town", level: "A", sprint: "S15" },
  { route: "/fortress/map", title: "Cartographer", blurb: "The map, with fog where nobody has looked.", place: "town", level: "A", sprint: "S15" },
  { route: "/glossary", title: "Archive", blurb: "Words and ideas, in plain language.", place: "town", level: "A", sprint: "S15" },
  // Town Hall
  { route: "/", title: "Dashboard", blurb: "The whole portfolio at a glance.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/holdings", title: "Holdings", blurb: "Every company you own.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/portfolio", title: "Portfolio", blurb: "Accounts, imports and snapshots.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/performance", title: "Performance", blurb: "How the portfolio has done.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/risk", title: "Risk", blurb: "How the portfolio behaves when things get rough.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/margin-of-safety", title: "Margin of safety", blurb: "How far price sits from value.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/macro", title: "Macro", blurb: "The wide weather: rates, growth, prices.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/sectors/:sector", via: "/macro", title: "A sector", blurb: "Pick a sector in Macro to read about it.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/thesis", title: "Thesis monitor", blurb: "Is each reason still standing?", place: "townhall", level: "A", sprint: "S18" },
  { route: "/precious-metals", title: "Precious metals", blurb: "Gold, silver and friends.", place: "townhall", level: "A", sprint: "S18" },
  { route: "/watchlist", title: "Watchlist", blurb: "Companies you are keeping an eye on.", place: "townhall", level: "A", sprint: "S18" },
  // The Workshop
  { route: "/analysis-queue", title: "Analysis queue", blurb: "Reports waiting their turn.", place: "workshop", level: "A", sprint: "S15" },
  { route: "/status", title: "System status", blurb: "Are the machines humming?", place: "workshop", level: "A", sprint: "S15" },
  { route: "/settings", title: "Settings", blurb: "Switches and keys.", place: "workshop", level: "A", sprint: "S15" },
  { route: "/tag-review", title: "Tag review", blurb: "Check the labels on the numbers.", place: "workshop", level: "A", sprint: "S15" },
  // The Keep
  { route: "/journal", title: "Journal", blurb: "Your reasons, written down.", place: "keep", level: "A", sprint: "S16" },
  // Planned: no route yet. The row keeps the place reserved and the rule honest.
  { route: null, title: "The Printer", blurb: "Not built yet.", place: "mint", level: "planned", sprint: "S19" },
];

/** Every route App.tsx declares (its `<Route path="...">` lines), in order. */
export function routesIn(appSource: string): string[] {
  return [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
}

/** Routes of the app that have no row in the register (the world itself is not a page to visit from the world). */
export function missingRoutes(appRoutes: readonly string[], register: readonly Door[] = REGISTER): string[] {
  const known = new Set(register.map((d) => d.route));
  return appRoutes.filter((r) => r !== WORLD_ROUTE && !known.has(r));
}

/** Rows that name a route the app no longer has (a built page that was removed). */
export function staleRows(appRoutes: readonly string[], register: readonly Door[] = REGISTER): Door[] {
  const have = new Set(appRoutes);
  return register.filter((d) => d.route !== null && !have.has(d.route));
}

/** The rows that get a door in the signpost menu: built pages, except those reached through another page. */
export function doors(register: readonly Door[] = REGISTER): Door[] {
  return register.filter((d) => d.route !== null && d.via === undefined);
}

/** The doors of one place, in register order. */
export function doorsAt(place: PlaceId, register: readonly Door[] = REGISTER): Door[] {
  return doors(register).filter((d) => d.place === place);
}

/** The places that have at least one door, in menu order. */
export function placesWithDoors(register: readonly Door[] = REGISTER): Place[] {
  return PLACES.filter((p) => doorsAt(p.id, register).length > 0);
}

/** What the panel loads: the page itself, with the flag that hides the sidebar and top bar (Layout.tsx). */
export function embedUrl(door: Door): string {
  const path = door.open ?? door.route ?? "/";
  return `${path}${path.includes("?") ? "&" : "?"}embed=world`;
}

/** Where the "Open the flat page" link goes: the same page, with the full app around it. */
export function flatUrl(door: Door): string {
  return door.open ?? door.route ?? "/";
}
