import { describe, expect, it } from "vitest";
import { dispatchCountHint, dispatchSealLabel } from "./dispatchSeal";

describe("dispatchSeal wording", () => {
  it("labels the closed and open states differently", () => {
    expect(dispatchSealLabel(false)).toBe("Break the seal: dispatch details");
    expect(dispatchSealLabel(true)).not.toBe(dispatchSealLabel(false));
  });
  it("only shows a count that is real", () => {
    expect(dispatchCountHint(0)).toBeNull();
    expect(dispatchCountHint(-2)).toBeNull();
    expect(dispatchCountHint(Number.NaN)).toBeNull();
    expect(dispatchCountHint(1)).toBe("1 line");
    expect(dispatchCountHint(4)).toBe("4 lines");
  });
});
