import { describe, expect, it } from "vitest";
import { FENCE_SEGMENTS, FIELD_SLOTS, FISH_COLORS, FISH_PER_TANK, FISH_TANKS, TANK_AT, TANK_WATER, farmLook, isFishFarm } from "./farmDressing";
import { GHOST, NEUTRAL, RUNGS } from "./landCondition";

const KEYS = ["lean", "fenceGaps", "emptyFields", "props", "brokenProps", "looseBoards", "lumber", "patches"] as const;

describe("the farmhouse dressing (S26 PR 3)", () => {
  it("never wears less damage on a worse rung", () => {
    for (let r = 1; r < RUNGS.length; r++) {
      const a = farmLook(RUNGS[r - 1]!);
      const b = farmLook(RUNGS[r]!);
      for (const k of KEYS) expect(b[k], k).toBeGreaterThanOrEqual(a[k]);
      expect(Number(b.crack)).toBeGreaterThanOrEqual(Number(a.crack));
    }
  });

  it("keeps Sound clean and Failing broken, with the crack only at the bottom", () => {
    const sound = farmLook(RUNGS[0]!);
    expect(KEYS.every((k) => sound[k] === 0)).toBe(true);
    expect(sound.crack).toBe(false);
    expect(sound.hedge).toBe("large");
    const failing = farmLook(RUNGS[4]!);
    expect(failing.crack).toBe(true);
    expect(failing.hedge).toBe("none");
    expect(failing.fenceGaps).toBeGreaterThan(5);
    expect(farmLook(RUNGS[1]!).hedge).toBe("hedge");
  });

  it("stays inside the slots it has", () => {
    for (const r of RUNGS) {
      const l = farmLook(r);
      expect(l.fenceGaps).toBeLessThanOrEqual(FENCE_SEGMENTS);
      expect(l.emptyFields).toBeLessThanOrEqual(FIELD_SLOTS);
    }
  });

  it("reads the wall tier alone: the ghost and the neutral are not rungs and look like no rung", () => {
    const rungLooks = RUNGS.map((r) => JSON.stringify(farmLook(r)));
    expect(rungLooks).not.toContain(JSON.stringify(farmLook(NEUTRAL)));
    // Neutral has no trim, like Worn: it must differ from Sound (the proud rung) so a fund-like land never reads as Sound.
    expect(farmLook(NEUTRAL).hedge).not.toBe(farmLook(RUNGS[0]!).hedge);
    expect(farmLook(GHOST).crack).toBe(false);
  });

  describe("the fish test", () => {
    it("matches fish, salmon, seafood and aquaculture in the sector or the name", () => {
      expect(isFishFarm({ sector: "Consumer Staples", name: "Salmon Evolution" })).toBe(true);
      expect(isFishFarm({ sector: "Aquaculture", name: "X" })).toBe(true);
      expect(isFishFarm({ sector: "Food: Seafood", name: "X" })).toBe(true);
      expect(isFishFarm({ sector: "Fish farming", name: null })).toBe(true);
    });
    it("leaves other food holdings on the plain farmhouse", () => {
      expect(isFishFarm({ sector: "Consumer Staples", name: "Coca-Cola Co." })).toBe(false);
      expect(isFishFarm({ sector: "Agriculture", name: "Grain Corp" })).toBe(false);
      expect(isFishFarm({ sector: null, name: null })).toBe(false);
      expect(isFishFarm({})).toBe(false);
    });
  });

  it("has a fixed number of tanks and fish: nothing grows with a value", () => {
    expect(FISH_TANKS).toBe(TANK_AT.length);
    expect(FISH_TANKS * FISH_PER_TANK).toBe(12);
    expect(farmLook.length).toBe(1); // the look takes the condition alone: no weight, gain or verdict goes in
  });

  it("keeps fish and water off red, orange and green", () => {
    for (const hex of [...FISH_COLORS, TANK_WATER]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
      expect(r > g + 40 && r > b + 40, hex).toBe(false);
      expect(g > r + 40 && g > b + 40, hex).toBe(false);
      expect(b, hex).toBeGreaterThanOrEqual(r);
    }
  });
});
