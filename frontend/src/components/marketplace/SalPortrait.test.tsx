import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SalPortrait from "./SalPortrait";

describe("SalPortrait stays behind the Settings switch", () => {
  it("draws the SVG Sal for every mood by default (art off), with no picture", () => {
    for (const mood of ["pitch", "oops", "think", "cheer"] as const) {
      const html = renderToStaticMarkup(<SalPortrait mood={mood} size={120} />);
      expect(html).toContain("<svg");
      expect(html).not.toContain("<img");
    }
  });
});
