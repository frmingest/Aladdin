import { describe, expect, it } from "vitest";
import { signWords, wrapName } from "./signText";

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
