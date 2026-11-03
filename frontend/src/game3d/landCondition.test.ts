import { describe, expect, it } from "vitest";
import { DAMAGE_FIELDS, GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import type { FortressWall } from "../lib/types";

const LADDER: FortressWall[] = ["basalt", "granite", "brick", "timber", "rotted"];

describe("the condition ladder (S26 PR 1)", () => {
  it("has five rungs, one per wall tier, best to worst", () => {
    expect(RUNGS).toHaveLength(5);
    LADDER.forEach((w, i) => {
      const c = landCondition(w);
      expect(c.state).toBe("rung");
      expect(c.rung).toBe(i);
      expect(c).toBe(RUNGS[i]);
    });
    expect(RUNGS.map((r) => r.name)).toEqual(["sound", "solid", "worn", "patched", "failing"]);
  });

  it("never gives a worse wall less damage, and never a prouder finish", () => {
    for (let i = 1; i < RUNGS.length; i++) {
      for (const f of DAMAGE_FIELDS) expect(RUNGS[i]![f], `${f} at rung ${i}`).toBeGreaterThanOrEqual(RUNGS[i - 1]![f]);
      expect(RUNGS[i]!.trim).toBeLessThanOrEqual(RUNGS[i - 1]!.trim);
    }
  });

  it("makes every rung look different from the next", () => {
    for (let i = 1; i < RUNGS.length; i++) expect(RUNGS[i]).not.toEqual(RUNGS[i - 1]);
    expect(new Set(RUNGS.map((r) => JSON.stringify(r))).size).toBe(5);
  });

  it("makes the failing rung clearly worse: a crack, broken props and fallen pieces; sound has none", () => {
    const sound = RUNGS[0]!;
    const failing = RUNGS[4]!;
    expect(sound.crack + sound.rubble + sound.props + sound.gaps + sound.lean).toBe(0);
    expect(failing.crack).toBe(1);
    expect(failing.brokenProps).toBeGreaterThan(0);
    expect(failing.rubble).toBeGreaterThan(0);
  });

  it("treats not surveyed (and an unread wall) as the ghost, which is not a rung", () => {
    for (const w of ["unsurveyed", null, undefined] as const) {
      const c = landCondition(w);
      expect(c).toBe(GHOST);
      expect(c.rung).toBeNull();
      expect(c.pale).toBe(true);
      expect(RUNGS).not.toContain(c);
    }
    expect(RUNGS.some((r) => r.pale)).toBe(false);
  });

  it("treats no walls as neutral: not a rung, and not the same as Sound", () => {
    const n = landCondition("not_applicable");
    expect(n).toBe(NEUTRAL);
    expect(n.rung).toBeNull();
    expect(RUNGS).not.toContain(n);
    expect(n).not.toEqual(RUNGS[0]);
    expect(n.trim).toBeLessThan(RUNGS[0]!.trim);
    expect(n).not.toEqual(GHOST);
    expect(n.pale).toBe(false);
  });

  it("depends on the wall tier alone", () => {
    expect(landCondition.length).toBe(1);
    for (const w of [...LADDER, "unsurveyed", "not_applicable"] as FortressWall[]) expect(landCondition(w)).toEqual(landCondition(w));
  });

  it("is shape and count only: no colour field, so nothing red or green", () => {
    for (const c of [...RUNGS, GHOST, NEUTRAL]) expect(JSON.stringify(c)).not.toMatch(/#|red|green|colou?r/i);
  });
});
