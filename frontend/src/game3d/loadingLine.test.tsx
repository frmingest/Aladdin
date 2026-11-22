import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import LoadingLine from "./LoadingLine";
import { LOADING_SLOW, loadingLine } from "./loadingWordsV1";
import { getSceneLoad, setSceneBusy, setSceneReady, showLoading, subscribeSceneLoad } from "./sceneLoadStore";
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

afterEach(() => {
  setSceneReady(false);
  setSceneBusy(false);
});

describe("loading words v1 (#479)", () => {
  it("has one short line for every place, and never promises a time or a number", () => {
    for (const ref of PLACES) {
      const line = loadingLine(ref);
      expect(line.endsWith("…")).toBe(true);
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(6);
      expect(line).not.toMatch(/\d|second|minute|almost|nearly|%/i);
    }
    expect(LOADING_SLOW).not.toMatch(/\d|%/);
  });
  it("names the place you are going to", () => {
    expect(loadingLine({ id: "courtyard" })).toBe("Raising the walls…");
    expect(loadingLine({ id: "weather" })).toMatch(/Weather Tower/);
    expect(loadingLine({ id: "mint" })).toMatch(/Royal Mint/);
  });
  it("a holding's land uses the holding's own name without a clumsy possessive, and invents none when unknown", () => {
    expect(loadingLine({ id: "holding", holdingId: "h1" }, "Apple Inc.")).toBe("Walking to the land of Apple Inc.…");
    expect(loadingLine({ id: "holding", holdingId: "h1" }, null)).toBe("Walking to the land…");
  });
});

describe("when the line shows", () => {
  it("always while the world is not up", () => {
    expect(showLoading({ ready: false, busy: false }, true)).toBe(true);
    expect(showLoading({ ready: false, busy: true }, false)).toBe(true);
  });
  it("while models are still arriving on the first draw of a place", () => {
    expect(showLoading({ ready: true, busy: true }, false)).toBe(true);
  });
  it("never for a late small load after the place was fully drawn once", () => {
    expect(showLoading({ ready: true, busy: true }, true)).toBe(false);
    expect(showLoading({ ready: true, busy: false }, false)).toBe(false);
  });
  it("the store tells its readers only when something changed", () => {
    let calls = 0;
    const off = subscribeSceneLoad(() => (calls += 1));
    setSceneReady(true);
    setSceneReady(true);
    setSceneBusy(true);
    off();
    setSceneBusy(false);
    expect(calls).toBe(2);
    expect(getSceneLoad()).toEqual({ ready: true, busy: false });
  });
});

describe("LoadingLine", () => {
  it("is a polite status line, mounted even when idle, that never takes a click", () => {
    setSceneReady(true);
    const idle = renderToStaticMarkup(<LoadingLine area={{ id: "courtyard" }} />);
    expect(idle).toContain('role="status"');
    expect(idle).toContain("sr-only");
    expect(idle).not.toContain("Raising the walls");
  });
  it("says the place's line while the world is not up, with no bar and no number", () => {
    const html = renderToStaticMarkup(<LoadingLine area={{ id: "weather" }} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("Climbing the Weather Tower…");
    expect(html).not.toContain("progressbar");
    expect(html).not.toMatch(/animate|transition|spin|pulse/);
  });
  it("steps aside during a door's fade, where the fade's plate already names the place", () => {
    const html = renderToStaticMarkup(<LoadingLine area={{ id: "weather" }} hidden />);
    expect(html).not.toContain("Climbing");
  });
});
