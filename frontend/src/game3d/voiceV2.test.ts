import { describe, expect, it } from "vitest";
import { SAVE_FAILED, readFailed, withStop } from "./voiceV2";

describe("voiceV2", () => {
  it("adds one closing full stop, never two", () => {
    expect(withStop("Nothing is known")).toBe("Nothing is known.");
    expect(withStop("Nothing is known.")).toBe("Nothing is known.");
    expect(withStop("Really?")).toBe("Really?");
    expect(withStop("A raven landed. ")).toBe("A raven landed.");
  });

  it("says a failed save and a failed read in one plain way", () => {
    expect(SAVE_FAILED).toBe("Couldn't save that.");
    expect(readFailed("your journal")).toBe("Can't read your journal right now.");
  });
});
