import { describe, expect, it } from "vitest";
import { DESK_ACTION, deskBlock, deskInput, deskReady, todayIso } from "./deskForm";

describe("desk entry", () => {
  it("dates an entry with the player's own calendar day, padded", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 10, 1, 0, 1))).toBe("2026-11-01");
  });

  it("needs a holding and both lines, and trims them", () => {
    expect(deskReady({ holdingId: "a", why: "x", wrongIf: "y" })).toBe(true);
    expect(deskReady({ holdingId: "", why: "x", wrongIf: "y" })).toBe(false);
    expect(deskReady({ holdingId: "a", why: "  ", wrongIf: "y" })).toBe(false);
    expect(deskReady({ holdingId: "a", why: "x", wrongIf: "" })).toBe(false);
  });

  it("records a hold with today's date, never a buy or a sell, and never a price", () => {
    const i = deskInput({ holdingId: "a", why: " why ", wrongIf: " wrong " }, new Date(2026, 9, 31));
    expect(i).toEqual({ holding_id: "a", action: "hold", decided_on: "2026-10-31", thesis: "why", invalidation: "wrong" });
    expect(DESK_ACTION).toBe("hold");
  });

  it("blocks saving on the sample fortress, an unreadable or loading journal and an empty fortress", () => {
    expect(deskBlock(true, "open")).toBe("sample");
    expect(deskBlock(true, "done")).toBe("sample");
    expect(deskBlock(false, "unreadable")).toBe("unreadable");
    expect(deskBlock(false, "loading")).toBe("loading");
    expect(deskBlock(false, "empty")).toBe("empty");
    expect(deskBlock(false, "open")).toBeNull();
    expect(deskBlock(false, "done")).toBeNull();
  });
});
