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
    expect(REGISTER.filter((r) => r.route === null).every((r) => r.level === "planned")).toBe(true);
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
    for (const d of doors()) expect(d.route?.includes(":"), d.title).toBe(false);
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
    expect(placed.map((p) => p.id)).not.toContain("mint");
  });

  it("loads the page itself with the embed flag, and links the flat page without it", () => {
    const holdings = REGISTER.find((d) => d.route === "/holdings")!;
    expect(embedUrl(holdings)).toBe("/holdings?embed=world");
    expect(flatUrl(holdings)).toBe("/holdings");
    expect(embedUrl({ ...holdings, open: "/x?a=1" })).toBe("/x?a=1&embed=world");
  });
});
