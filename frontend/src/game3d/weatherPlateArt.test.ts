import { describe, expect, it } from "vitest";
import { drawBanner, drawPlate, drawPost, fitTwoLines, plateText, wrapWords } from "./weatherPlateArt";
import type { DialPlan } from "./weatherTowerRoomLogic";
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

  /** A recording 2D context whose text width grows with the font size the code actually set (0.55 em per character). */
  function sizedCtx() {
    const texts: Array<{ text: string; size: number }> = [];
    const state: Record<string, unknown> = { font: "" };
    const sizeOf = () => Number(/(\d+)px/.exec(String(state.font))?.[1] ?? 0);
    const ctx = new Proxy(state, {
      get(target, prop: string) {
        if (prop === "measureText") return (t: string) => ({ width: t.length * sizeOf() * 0.55 });
        if (prop === "fillText") return (t: string) => void texts.push({ text: t, size: sizeOf() });
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

  it("never clips a key sentence: two balanced lines that each fit, words unchanged (#440)", () => {
    for (const key of [WEATHER_WORDS.railKey, WEATHER_WORDS.dotKey]) {
      const { ctx, texts } = sizedCtx();
      drawBanner(ctx, key, null);
      expect(texts.map((t) => t.text).join(" ")).toBe(key);
      expect(texts.length).toBe(2);
      for (const t of texts) expect(t.text.length * t.size * 0.55).toBeLessThanOrEqual(1024 - 80);
      // balanced: no one-word widow on the second line
      expect(texts[1].text.split(" ").length).toBeGreaterThan(1);
    }
  });

  it("keeps a short banner on one line and splits at the most balanced break", () => {
    const short = sizedCtx();
    drawBanner(short.ctx, "Short key", null);
    expect(short.texts.map((t) => t.text)).toEqual(["Short key"]);
    const { ctx } = sizedCtx();
    ctx.font = "700 50px x";
    const two = fitTwoLines(ctx, "aaaa bbbb cc dd", 10000, [50]);
    expect(two?.lines).toEqual(["aaaa bbbb", "cc dd"]);
    expect(fitTwoLines(ctx, "unbreakable", 10, [50])).toBeNull();
  });
});

describe("Mint lever boards (#480)", () => {
  it("draw the lever's name much bigger than the old banner did, and its setting under it", async () => {
    const { drawLeverBoard, LEVER_BOARD_PX } = await import("./mintPlateArt");
    const { ctx, texts } = fakeCtx();
    const sizes = drawLeverBoard(ctx, "Harbour Guard", "At rest");
    expect(texts).toEqual(["Harbour Guard", "At rest"]);
    // The old banner drew the name at 64 px on a 160 px tall board of the same width: 0.4 of its height, as text 2.5 x smaller.
    expect(sizes.nameSize).toBeGreaterThanOrEqual(64 * 2);
    expect(sizes.nameSize + sizes.readoutSize).toBeLessThan(LEVER_BOARD_PX.h);
  });
  it("a long name shrinks to fit one line instead of running off the board", async () => {
    const { drawLeverBoard } = await import("./mintPlateArt");
    // Here text is as wide as its font is big (about half the size per letter), so a smaller font really is narrower.
    const texts: string[] = [];
    const state: Record<string, unknown> = { font: "" };
    const ctx = new Proxy(state, {
      get(target, prop: string) {
        if (prop === "measureText") return (t: string) => ({ width: t.length * 0.55 * Number(/(\d+)px/.exec(String(target.font))?.[1] ?? 10) });
        if (prop === "fillText") return (t: string) => void texts.push(t);
        if (prop in target) return target[prop];
        return () => undefined;
      },
      set(target, prop: string, value) {
        target[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const sizes = drawLeverBoard(ctx, "Harbour Guard and Friends", "At rest");
    expect(texts[0]).toBe("Harbour Guard and Friends");
    expect(sizes.nameSize).toBeLessThan(150);
  });
});
