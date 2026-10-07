import { describe, expect, it } from "vitest";
import { allNavSections, FORTRESS_NAV, isFortressPath, MORE_NAV, moreContainsPath, primaryNavFor, PRIMARY_NAV } from "./nav";

describe("sidebar navigation", () => {
  it("shows four primary pages by default", () => {
    expect(primaryNavFor(false).map((i) => i.label)).toEqual(["Dashboard", "Holdings", "Margin of safety", "Thesis"]);
    expect(PRIMARY_NAV).toHaveLength(4);
  });

  it("adds exactly one entry in game mode, the Fortress, first", () => {
    const on = primaryNavFor(true);
    expect(on).toHaveLength(PRIMARY_NAV.length + 1);
    expect(on[0]).toEqual({ label: "Fortress", to: "/fortress" });
  });

  it("keeps every old page reachable and lists no page twice", () => {
    const old = [
      "/", "/holdings", "/portfolio", "/performance", "/risk", "/margin-of-safety", "/precious-metals",
      "/analysis-queue", "/watchlist", "/macro", "/journal", "/thesis", "/settings",
    ];
    const tos = allNavSections(false).flatMap((s) => s.items.map((i) => i.to));
    for (const to of old) expect(tos).toContain(to);
    expect(new Set(tos).size).toBe(tos.length);
  });

  it("puts the other Fortress rooms in the tab strip and the quick search, not the sidebar", () => {
    const rooms = FORTRESS_NAV.slice(1).map((i) => i.to);
    const sidebarTos = primaryNavFor(true).map((i) => i.to);
    for (const to of rooms) expect(sidebarTos).not.toContain(to);
    const searchTos = allNavSections(true).flatMap((s) => s.items.map((i) => i.to));
    for (const to of rooms) expect(searchTos).toContain(to);
    expect(allNavSections(false).flatMap((s) => s.items.map((i) => i.to))).not.toContain("/fortress/siege");
  });

  it("recognises Fortress and More pages", () => {
    expect(isFortressPath("/fortress")).toBe(true);
    expect(isFortressPath("/fortress/marketplace/abc")).toBe(true);
    expect(isFortressPath("/fortresses")).toBe(false);
    expect(moreContainsPath("/watchlist")).toBe(true);
    expect(moreContainsPath("/sectors/Energy")).toBe(true);
    expect(moreContainsPath("/")).toBe(false);
    expect(moreContainsPath("/holdings/123")).toBe(false);
    // Tag review (2026-10-07) is the 11th page under More; the sidebar itself stays at four.
    expect(MORE_NAV.flatMap((s) => s.items).length).toBe(11);
    expect(moreContainsPath("/tag-review")).toBe(true);
    expect(primaryNavFor(false).map((i) => i.to)).not.toContain("/tag-review");
  });
});
