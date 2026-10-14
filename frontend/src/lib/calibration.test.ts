import { describe, expect, it } from "vitest";
import { bandLine, bandSeals, callsLine, oracleLine } from "./calibration";
import type { Calibration } from "./types";

const closedCalls: Calibration["calls"] = { n: 3, is_open: false, as_expected: null, against: null, flat: null, bands: [], waiting: 1, left_out: 0 };
const openCalls: Calibration["calls"] = { n: 8, is_open: true, as_expected: 5, against: 2, flat: 1, bands: [], waiting: 0, left_out: 0 };

describe("calibration wording (C2)", () => {
  it("before the gate says too few, gives the count and the opening number, and no ratio", () => {
    const line = callsLine(closedCalls, 8);
    expect(line).toBe("Too few so far: 3 decisions have a 6- or 12-month outcome. This opens at 8.");
    expect(line).not.toMatch(/%| of 3/);
  });

  it("singular count reads correctly", () => {
    expect(callsLine({ ...closedCalls, n: 1 }, 8)).toContain("1 decision has");
  });

  it("an open ratio always carries its count and never a percentage or a grade", () => {
    const line = callsLine(openCalls, 8);
    expect(line).toBe("5 of 8 went the way you expected. 2 went against, 1 stayed flat.");
    expect(line).not.toMatch(/%|score|streak|improv/i);
  });

  it("the analyst half words below, inside and above with the count", () => {
    expect(oracleLine({ n: 8, is_open: true, inside: 6, below: 1, above: 1, waiting: 0 }, 8)).toBe(
      "6 of 8 later prices landed inside the analyst's range. 1 below it, 1 above it.",
    );
    expect(oracleLine({ n: 0, is_open: false, inside: null, below: null, above: null, waiting: 4 }, 8)).toContain("Too few so far: 0");
  });

  it("a thin confidence band says so; a shown band gives shaped seals that add up to its count", () => {
    expect(bandLine({ confidence: 2, n: 2, shown: false, as_expected: null, against: null, flat: null })).toBe("Confidence 2: too few so far (2)");
    const b = { confidence: 4, n: 5, shown: true, as_expected: 3, against: 1, flat: 1 };
    expect(bandLine(b)).toBe("Confidence 4: 3 of 5 as expected");
    expect(bandSeals(b)).toEqual(["filled", "filled", "filled", "ring", "dashed"]);
  });
});
