import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoadingLine from "./LoadingLine";
import { LOADING_BAR_LABEL, loadingLine } from "./loadingWordsV1";
import type { AreaRef } from "./areas";

const PLACES: AreaRef[] = [
  { id: "courtyard" },
  { id: "townhall" },
  { id: "records" },
  { id: "weather" },
  { id: "mint" },
  { id: "quarter" },
  { id: "holding", holdingId: "h1" },
];

describe("loading words v1 (#479)", () => {
  it("has one short line for every place, and never promises a time or a number", () => {
    for (const ref of PLACES) {
      const line = loadingLine(ref);
      expect(line.endsWith("…")).toBe(true);
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(6);
      expect(line).not.toMatch(/\d|second|minute|almost|nearly/i);
    }
  });
  it("names the place you are going to", () => {
    expect(loadingLine({ id: "courtyard" })).toBe("Raising the walls…");
    expect(loadingLine({ id: "weather" })).toMatch(/Weather Tower/);
    expect(loadingLine({ id: "mint" })).toMatch(/Royal Mint/);
  });
  it("a holding's land uses the holding's own name, and invents none when it is unknown", () => {
    expect(loadingLine({ id: "holding", holdingId: "h1" }, "Equinor")).toBe("Walking to Equinor's land…");
    expect(loadingLine({ id: "holding", holdingId: "h1" }, null)).toBe("Walking to the land…");
  });
});

describe("LoadingLine", () => {
  it("is a polite status line that never takes a click", () => {
    const html = renderToStaticMarkup(<LoadingLine text="Raising the walls…" percent={null} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("Raising the walls…");
  });
  it("shows a bar only when the loader gives a percent, with its value for screen readers", () => {
    expect(renderToStaticMarkup(<LoadingLine text="x" percent={null} />)).not.toContain("progressbar");
    const html = renderToStaticMarkup(<LoadingLine text="x" percent={42} />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain(`aria-label="${LOADING_BAR_LABEL}"`);
    expect(html).toContain("width:42%");
  });
  it("has no animation of its own (reduced motion needs nothing)", () => {
    const html = renderToStaticMarkup(<LoadingLine text="x" percent={10} />);
    expect(html).not.toMatch(/animate|transition|spin|pulse/);
  });
});
