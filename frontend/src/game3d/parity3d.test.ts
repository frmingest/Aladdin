import appSource from "../App.tsx?raw";
import { describe, expect, it } from "vitest";
import {
  PLACES,
  REGISTER,
  WORLD_ROUTE,
  doors,
  doorsAt,
  embedUrl,
  flatUrl,
  missingRoutes,
  placesWithDoors,
  routesIn,
  staleRows,
} from "./parity3d";

const APP_ROUTES = routesIn(appSource);

describe("page parity register", () => {
  it("reads the app's real route list", () => {
    expect(APP_ROUTES.length).toBeGreaterThan(20);
    expect(APP_ROUTES).toContain(WORLD_ROUTE);
    expect(APP_ROUTES).toContain("/fortress");
  });

  it("has a row for every route of the app (a new page cannot be forgotten)", () => {
    expect(missingRoutes(APP_ROUTES)).toEqual([]);
  });

  it("fails when a row is removed", () => {
    const without = REGISTER.filter((d) => d.route !== "/journal");
    expect(missingRoutes(APP_ROUTES, without)).toEqual(["/journal"]);
  });

  it("fails when a new route has no row", () => {
    expect(missingRoutes([...APP_ROUTES, "/brand-new"])).toEqual(["/brand-new"]);
  });

  it("has no row for a route the app no longer has", () => {
    expect(staleRows(APP_ROUTES)).toEqual([]);
    expect(staleRows(APP_ROUTES.filter((r) => r !== "/glossary")).map((d) => d.route)).toEqual(["/glossary"]);
  });

  it("gives every planned row a sprint and no route", () => {
    for (const d of REGISTER.filter((r) => r.level === "planned")) {
      expect(d.route, d.title).toBeNull();
      expect(d.sprint, d.title).toMatch(/^S\d+$/);
    }
    // A row with no route is either not built yet, or a place that exists only in the world.
    expect(REGISTER.filter((r) => r.route === null).every((r) => r.level === "planned" || r.world !== undefined)).toBe(true);
  });

  it("gives the world-only Royal Mint a real door that is played, not planned", () => {
    const mint = REGISTER.find((d) => d.world === "mint");
    expect(mint).toBeDefined();
    expect(mint?.route).toBeNull();
    expect(mint?.level).toBe("C");
    expect(doorsAt("mint").map((d) => d.title)).toContain("The Printer");
    expect(placesWithDoors().map((p) => p.id)).toContain("mint");
  });

  it("gives every row a sprint, a known place, a title and a short playful line", () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const d of REGISTER) {
      expect(d.sprint, d.title).toMatch(/^S\d+$/);
      expect(ids.has(d.place), d.title).toBe(true);
      expect(d.title.length, d.title).toBeGreaterThan(0);
      expect(d.blurb.split(/\s+/).length, d.title).toBeLessThanOrEqual(12);
      expect(d.blurb, d.title).not.toMatch(/\d/);
    }
  });

  it("keeps finance words off the menu face (the flat name lives in plainName, a hover)", () => {
    const jargon = /\b(thesis|margin of safety|macro|tripwire|beta|ebitda|analysis queue|tag review|dashboard)\b/i;
    for (const d of REGISTER) {
      expect(`${d.title} ${d.blurb}`, d.title).not.toMatch(jargon);
    }
  });

  it("has unique routes and titles", () => {
    expect(new Set(REGISTER.map((d) => d.route ?? d.title)).size).toBe(REGISTER.length);
    expect(new Set(REGISTER.map((d) => d.title)).size).toBe(REGISTER.length);
  });

  it("reaches every route with a :param through a listed page that has a door", () => {
    const listed = new Set(doors().map((d) => d.route));
    for (const d of REGISTER.filter((r) => r.route?.includes(":"))) {
      expect(d.via, d.title).toBeDefined();
      expect(listed.has(d.via ?? ""), d.title).toBe(true);
    }
    for (const d of doors()) expect(d.route?.includes(":") ?? false, d.title).toBe(false);
  });

  it("opens every door in two taps or fewer: each built page has a door or a parent door", () => {
    const built = REGISTER.filter((d) => d.route !== null && d.route !== WORLD_ROUTE);
    const listed = new Set(doors().map((d) => d.route));
    for (const d of built) expect(listed.has(d.route) || listed.has(d.via ?? ""), d.title).toBe(true);
  });

  it("does not rebuild the pages removed from game mode", () => {
    for (const gone of ["council", "chronicle", "circle", "blindfold", "rehearsal", "hearth"]) {
      expect(REGISTER.some((d) => (d.route ?? "").includes(gone)), gone).toBe(false);
    }
  });

  it("lists doors by place, and only places that have one", () => {
    const placed = placesWithDoors();
    expect(placed.length).toBeGreaterThan(3);
    for (const p of placed) expect(doorsAt(p.id).length).toBeGreaterThan(0);
  });

  it("loads the page itself with the embed flag, and links the flat page without it", () => {
    const holdings = REGISTER.find((d) => d.route === "/holdings")!;
    expect(embedUrl(holdings)).toBe("/holdings?embed=world");
    expect(flatUrl(holdings)).toBe("/holdings");
    expect(embedUrl({ ...holdings, open: "/x?a=1" })).toBe("/x?a=1&embed=world");
  });
});
