import { describe, expect, it } from "vitest";
import { END_KEY_GUARD_MS, endKeyBlocked } from "./practiceYardLogic";

describe("endKeyBlocked (#496 end panel)", () => {
  it("ignores Enter and Space within 400 ms of the panel taking focus, and any repeat", () => {
    expect(END_KEY_GUARD_MS).toBe(400);
    expect(endKeyBlocked("Enter", false, 0)).toBe(true);
    expect(endKeyBlocked(" ", false, END_KEY_GUARD_MS - 1)).toBe(true);
    expect(endKeyBlocked("Enter", true, 5_000)).toBe(true);
  });
  it("lets a fresh press through after the guard, and never blocks other keys", () => {
    expect(endKeyBlocked("Enter", false, END_KEY_GUARD_MS)).toBe(false);
    expect(endKeyBlocked(" ", false, 2_000)).toBe(false);
    expect(endKeyBlocked("Tab", false, 0)).toBe(false);
    expect(endKeyBlocked("b", true, 0)).toBe(false);
  });
});
