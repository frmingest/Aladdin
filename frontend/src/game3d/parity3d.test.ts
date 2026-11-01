import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLACES, REGISTER, WORLD_ROUTE, doors, embedUrl, flatUrl, missingRoutes, placesWithDoors, routesIn, staleRows } from "./parity3d";

const appSource = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
const appRoutes = routesIn(appSource);

describe("page parity register", () => {
  it("reads the app's real route list", () => {
    expect(appRoutes.length).toBeGreaterThan(20);
    expect(appRoutes).toContain(WORLD_ROUTE);
  });

  it("has a row for every route of the app, and no row for a route that is gone", () => {
    expect(missingRoutes(appRoutes)).toEqual([]);
    expect(staleRows(appRoutes)).toEqual([]);
  });

  it("fails when a row is removed (a forgotten page is caught)", () => {
    const without = REGISTER.filter((d) => d.route !== "/journal");
    expect(missingRoutes(appRoutes, without)).toEqual(["/journal"]);
  });

  it("fails when the app gains a route nobody registered", () => {
    expect(missingRoutes([...appRoutes, "/brand-new"])).toEqual(["/brand-new"]);
  });

  it("gives every row a sprint, a known place and unique routes", () => {
    const places = new Set(PLACES.map((p) => p.id));
    for (const d of REGISTER) {
      expect(d.sprint, d.title).toMatch(/^S\d+$/);
      expect(places.has(d.place), d.title).toBe(true);
      if (d.route === null) expect(d.level).toBe("planned");
    }
    const routes = REGISTER.filter((d) => d.route).map((d) => d.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("gives every page without a :param (or via) its own door", () => {
    for (const r of appRoutes.filter((r) => r !== WORLD_ROUTE)) {
      const row = REGISTER.find((d) => d.route === r)!;
      expect(row, r).toBeTruthy();
      if (!r.includes(":")) expect(doors().includes(row), r).toBe(true);
      else expect(row.via, r).toBeTruthy();
    }
  });

  it("lists every door under a place, and a :param page is reached through a listed page", () => {
    const listed = placesWithDoors().flatMap((p) => doors().filter((d) => d.place === p.id));
    expect(listed.length).toBe(doors().length);
    for (const d of REGISTER.filter((r) => r.via)) expect(doors().some((x) => x.route === d.via), d.title).toBe(true);
  });

  it("builds the panel and flat urls", () => {
    const d = REGISTER.find((r) => r.route === "/journal")!;
    expect(embedUrl(d)).toBe("/journal?embed=world");
    expect(flatUrl(d)).toBe("/journal");
  });

  it("uses no number, buy or sell word in any blurb", () => {
    for (const d of REGISTER) expect(d.blurb, d.title).not.toMatch(/\d|\bbuy\b|\bsell\b/i);
  });
});
