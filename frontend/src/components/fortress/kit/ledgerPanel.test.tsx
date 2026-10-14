import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "../../../lib/artManifest";
import { countWords } from "../../../lib/wordBudget";
import type { Calibration } from "../../../lib/types";
import LedgerPanel from "./LedgerPanel";

const base: Calibration = {
  version: "calibration-v1",
  demo: false,
  min_n: 8,
  min_band_n: 3,
  calls: { n: 3, is_open: false, as_expected: null, against: null, flat: null, bands: [], waiting: 0, left_out: 0 },
  oracle: { n: 0, is_open: false, inside: null, below: null, above: null, waiting: 2 },
  caption: "A count of how past calls and analyst ranges turned out, not a grade. It changes no verdict and no tower.",
};

describe("Ledger panel (C2)", () => {
  it("has its four pictures packed", () => {
    expect(Object.keys(ART_MANIFEST)).toEqual(
      expect.arrayContaining(["ledger-book", "ledger-scale", "ledger-lantern", "ledger-staff"]),
    );
  });

  it("draws no picture with Object art off (the default) and still tells the facts in words", () => {
    const html = renderToStaticMarkup(<LedgerPanel data={base} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("Too few so far: 3 decisions");
    expect(html).toContain("opens at 8");
    expect(html).not.toMatch(/\d+ of 3 went/);
  });

  it("an open ledger prints the count with every ratio, seals as shapes, and no percent sign", () => {
    const data: Calibration = {
      ...base,
      calls: {
        n: 8,
        is_open: true,
        as_expected: 5,
        against: 2,
        flat: 1,
        waiting: 0,
        left_out: 0,
        bands: [
          { confidence: 4, n: 5, shown: true, as_expected: 4, against: 1, flat: 0 },
          { confidence: 2, n: 3, shown: true, as_expected: 1, against: 1, flat: 1 },
        ],
      },
    };
    const html = renderToStaticMarkup(<LedgerPanel data={data} />);
    expect(html).toContain("5 of 8 went the way you expected");
    expect(html).toContain("Confidence 4: 4 of 5 as expected");
    expect(html).toContain("<circle");
    expect(html).not.toContain("%");
  });

  it("stays inside the word budget for its closed (default) view", () => {
    expect(countWords(renderToStaticMarkup(<LedgerPanel data={base} />))).toBeLessThanOrEqual(75);
  });
});
