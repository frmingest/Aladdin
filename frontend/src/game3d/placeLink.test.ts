import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import type { AreaId, AreaRef } from "./areas";
import { parsePlace, placeFromSearch, placeToken, searchFor } from "./placeLink";

describe("place links", () => {
  it("every place round-trips through its token", () => {
    for (const id of Object.keys(AREAS) as AreaId[]) {
      const ref: AreaRef = id === "library" ? { id, holdingId: "h-1" } : ({ id } as AreaRef);
      expect(parsePlace(placeToken(ref))).toEqual(ref);
    }
  });

  it("a broken link opens the courtyard", () => {
    for (const bad of [null, undefined, "", "nowhere", "library", "library:", "siege", "TOWN"]) {
      expect(parsePlace(bad)).toEqual({ id: "courtyard" });
    }
  });

  it("reads and writes the query string, keeping other parameters", () => {
    expect(placeFromSearch("?at=records")).toEqual({ id: "records" });
    expect(placeFromSearch("")).toEqual({ id: "courtyard" });
    expect(searchFor({ id: "town" })).toBe("?at=town");
    expect(searchFor({ id: "courtyard" }, "?at=town")).toBe("");
    expect(searchFor({ id: "townhall" }, "?demo=1&at=town")).toBe("?demo=1&at=townhall");
    expect(searchFor({ id: "courtyard" }, "?demo=1&at=town")).toBe("?demo=1");
  });
});
