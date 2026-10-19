import { describe, expect, it } from "vitest";
import { crestForPath } from "./crest";

describe("crestForPath", () => {
  it("gives each fortress room its own crest and the fortress crest elsewhere", () => {
    expect(crestForPath("/fortress/circle")).toBe("fortress"); // a removed room gets the fortress crest
    expect(crestForPath("/fortress/map")).toBe("map");
    expect(crestForPath("/fortress/records")).toBe("records");
    expect(crestForPath("/fortress/siege")).toBe("siege");
    expect(crestForPath("/fortress/marketplace/abc")).toBe("market");
    expect(crestForPath("/fortress")).toBe("fortress");
  });
});
