import { describe, expect, it } from "vitest";
import { drawBanner, drawPlate, drawPost, plateText, wrapWords } from "./weatherPlateArt";
import type { DialPlan } from "./weatherTowerRoom";
import { WEATHER_WORDS } from "./weatherTowerWordsV2";

/** A recording stand-in for a 2D canvas context: every call is a no-op, every `fillText` is kept. */
function fakeCtx() {
  const texts: string[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop === "measureText") return (t: string) => ({ width: t.length * 14 });
      if (prop === "fillText") return (t: string) => void texts.push(t);
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

const dial = (over: Partial<DialPlan> = {}): DialPlan => ({
  key: "no_10y",
  label: "Norway 10-year government bond yield",
  wall: "west",
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  state: "ok",
  fraction: 0.4,
  needle: 0.2,
  trace: [
    [-0.75, 0],
    [0, 0.3],
    [0.75, 0.2],
  ],
  readout: ["Norway 10-year government bond yield", "4.12%", "3 mo +0.10   12 mo -0.40"],
  ...over,
});

describe("wrapWords", () => {
  const m = (t: string) => t.length * 10;
  it("wraps by whole words and refuses to cut one", () => {
    expect(wrapWords("Norway 10-year government bond yield", 220, 2, m)).toEqual(["Norway 10-year", "government bond yield"]);
    expect(wrapWords("Supercalifragilistic", 100, 2, m)).toBeNull();
  });
  it("returns null when it needs more lines than allowed", () => {
    expect(wrapWords("a bb ccc dddd eeeee", 50, 2, m)).toBeNull();
  });
});

describe("plateText", () => {
  it("splits the readout into name, number and changes, and moves the stale word out of the number", () => {
    const t = plateText(dial({ state: "stale", readout: ["Name", `4.12% (${WEATHER_WORDS.stale})`, "3 mo +0.10"] }));
    expect(t).toMatchObject({ name: "Name", value: "4.12%", stale: true, empty: false });
  });
  it("says No reading for a series with no value and shows no changes", () => {
    const t = plateText(dial({ state: "empty", readout: ["Name", WEATHER_WORDS.noReading] }));
    expect(t).toMatchObject({ value: WEATHER_WORDS.noReading, changes: "", empty: true });
  });
});

describe("the plates draw their words", () => {
  it("draws name, number, changes and the low and high ends for a normal series", () => {
    const { ctx, texts } = fakeCtx();
    drawPlate(ctx, dial(), false);
    expect(texts.join("|")).toContain("4.12%");
    expect(texts).toContain(WEATHER_WORDS.low);
    expect(texts).toContain(WEATHER_WORDS.high);
    expect(texts.some((t) => t.startsWith("3 mo"))).toBe(true);
  });
  it("draws the word stale for a stale series, in words and not only in colour", () => {
    const { ctx, texts } = fakeCtx();
    drawPlate(ctx, dial({ state: "stale", readout: ["Name", `4.12% (${WEATHER_WORDS.stale})`, ""] }), false);
    expect(texts).toContain(WEATHER_WORDS.stale);
    expect(texts).toContain("4.12%");
  });
  it("draws No reading and no range bar when there is no value", () => {
    const { ctx, texts } = fakeCtx();
    drawPlate(ctx, dial({ state: "empty", fraction: null, trace: [], readout: ["Name", WEATHER_WORDS.noReading] }), false);
    expect(texts).toContain(WEATHER_WORDS.noReading);
    expect(texts).not.toContain(WEATHER_WORDS.low);
  });
  it("draws a post tag and a banner", () => {
    const post = fakeCtx();
    drawPost(post.ctx, "10Y", "4.12%", true);
    expect(post.texts).toEqual(expect.arrayContaining(["10Y", "4.12%", WEATHER_WORDS.stale]));
    const banner = fakeCtx();
    drawBanner(banner.ctx, WEATHER_WORDS.title, "3 of 22 plates reading");
    expect(banner.texts).toEqual([WEATHER_WORDS.title, "3 of 22 plates reading"]);
  });
});
