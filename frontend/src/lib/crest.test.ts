import { describe, expect, it } from "vitest";
import { crestForPath } from "./crest";

describe("crestForPath", () => {
  it("gives each fortress room its own crest and the fortress crest elsewhere", () => {
    expect(crestForPath("/fortress/council")).toBe("council");
    expect(crestForPath("/fortress/circle")).toBe("circle");
    expect(crestForPath("/fortress/map")).toBe("map");
    expect(crestForPath("/fortress/records")).toBe("records");
    expect(crestForPath("/fortress/chronicle")).toBe("chronicle");
    expect(crestForPath("/fortress/siege")).toBe("siege");
    expect(crestForPath("/fortress/marketplace/abc")).toBe("market");
    expect(crestForPath("/fortress")).toBe("fortress");
  });
});
