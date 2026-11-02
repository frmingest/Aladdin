import { describe, expect, it } from "vitest";
import { CLIP, chooseClip, resolveClip, wantedClip } from "./animClips";

describe("clip mapping", () => {
  it("stands, walks and runs", () => {
    expect(wantedClip({ moving: false, running: false }, false)).toBe("Idle");
    expect(wantedClip({ moving: true, running: false }, false)).toBe("Walking_A");
    expect(wantedClip({ moving: true, running: true }, false)).toBe("Running_A");
  });

  it("holds Idle for reduced motion, even while moving", () => {
    expect(wantedClip({ moving: true, running: true }, true)).toBe(CLIP.idle);
  });

  it("running with no direction held is still Idle", () => {
    expect(wantedClip({ moving: false, running: true }, false)).toBe("Idle");
  });

  it("falls back to Idle, then the first clip, then nothing", () => {
    expect(resolveClip("Walking_A", ["Idle", "Walking_A"])).toBe("Walking_A");
    expect(resolveClip("Walking_A", ["Idle", "Cheer"])).toBe("Idle");
    expect(resolveClip("Walking_A", ["Cheer"])).toBe("Cheer");
    expect(resolveClip("Walking_A", [])).toBeNull();
  });

  it("a seated person stays seated with reduced motion, but other poses and cheers still give way to Idle", () => {
    const still = { moving: false, running: false };
    expect(chooseClip(still, true, CLIP.sit, false)).toBe(CLIP.sit);
    expect(chooseClip(still, true, CLIP.useItem, false)).toBe(CLIP.idle);
    expect(chooseClip(still, true, CLIP.cast, true)).toBe(CLIP.idle);
    expect(chooseClip(still, false, CLIP.sit, false)).toBe(CLIP.sit);
    expect(chooseClip(still, true, null, false)).toBe(CLIP.idle);
  });
});
