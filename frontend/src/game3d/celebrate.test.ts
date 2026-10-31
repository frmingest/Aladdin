import { describe, expect, it } from "vitest";
import { CHEER_SECONDS, chooseClip } from "./animClips";
import { celebrationDue } from "./celebrate";
import type { QuestStatus } from "./quest";

describe("quest-done celebration", () => {
  it("fires only for done, on real data, the first time", () => {
    expect(celebrationDue("done", false, false)).toBe(true);
    const others: QuestStatus[] = ["loading", "unreadable", "empty", "open"];
    for (const s of others) expect(celebrationDue(s, false, false), s).toBe(false);
  });
  it("never cheers for the sample journal, and never twice", () => {
    expect(celebrationDue("done", true, false)).toBe(false);
    expect(celebrationDue("done", false, true)).toBe(false);
  });
});

describe("clip choice with cheer and cast", () => {
  const still = { moving: false, running: false };
  it("cheer beats a held pose, which beats walking", () => {
    expect(chooseClip({ moving: true, running: true }, false, "Spellcasting", true)).toBe("Cheer");
    expect(chooseClip(still, false, "Spellcasting", false)).toBe("Spellcasting");
    expect(chooseClip({ moving: true, running: false }, false, null, false)).toBe("Walking_A");
  });
  it("reduced motion holds Idle: no cheer, no casting", () => {
    expect(chooseClip({ moving: true, running: false }, true, "Spellcasting", true)).toBe("Idle");
  });
  it("the cheer is short", () => {
    expect(CHEER_SECONDS).toBeLessThanOrEqual(3);
  });
});
