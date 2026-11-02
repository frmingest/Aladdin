import { describe, expect, it } from "vitest";
import { SIGN_ARM_FRONT, SIGN_ARM_LENGTH, SIGN_ARM_SINK, SIGN_HANG_X, SIGN_WALL_BEHIND, signWords, wrapName } from "./signText";
import { SIZE_RADIUS } from "./stateToWorld";

describe("tower sign words", () => {
  it("keeps a short name on one line", () => {
    expect(wrapName("Equinor")).toEqual(["Equinor"]);
  });

  it("wraps a long name on spaces into two lines", () => {
    expect(wrapName("Kongsberg Gruppen ASA")).toEqual(["Kongsberg", "Gruppen ASA"]);
  });

  it("never gives more than two lines and ends a cut name with an ellipsis", () => {
    const lines = wrapName("Very Long Holding Name With Many Many Words In It");
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines.every((l) => l.length <= 16)).toBe(true);
  });

  it("cuts one huge word", () => {
    const [l] = wrapName("Supercalifragilisticexpialidocious");
    expect(l.length).toBeLessThanOrEqual(16);
    expect(l.endsWith("…")).toBe(true);
  });

  it("handles an empty name", () => {
    expect(wrapName("   ")).toEqual([""]);
  });

  it("adds a note only for an unsurveyed tower, with the named gap", () => {
    expect(signWords("Equinor", false).note).toBe("");
    expect(signWords("Jæren", true).note).toBe("not surveyed");
    expect(signWords("Jæren", true, "no tagged filing").note).toBe("not surveyed: no tagged filing");
  });
});

describe("tower sign bracket (nothing hangs in the air)", () => {
  it("the arm starts at the beam and ends inside the wall of every tower size", () => {
    const backEnd = SIGN_ARM_FRONT - SIGN_ARM_LENGTH; // z of the arm's far end, in the sign's own space
    expect(backEnd).toBeCloseTo(-(SIGN_WALL_BEHIND + SIGN_ARM_SINK));
    expect(backEnd).toBeLessThan(-SIGN_WALL_BEHIND); // past the wall face at the middle of the door
    for (const r of Object.values(SIZE_RADIUS)) expect(SIGN_ARM_SINK, `radius ${r}`).toBeLessThan(2 * r); // still inside the tower
  });

  it("the arm is at the middle, because a plank wider than the tower can only touch the wall there", () => {
    expect(SIGN_HANG_X * 2).toBeGreaterThan(2 * Math.min(...Object.values(SIZE_RADIUS)));
  });
});
