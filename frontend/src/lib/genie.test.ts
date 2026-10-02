import { describe, expect, it } from "vitest";
import {
  CONJURING_LINE,
  DEMO_LINE,
  GENIE_DISCLAIMER,
  WISHES,
  errorOutcome,
  greeting,
  summariseWish,
} from "./genie";
import type { QueueReadyHoldingsResult, QueuedRun } from "./types";

const run = (id: string): QueuedRun => ({ id }) as QueuedRun;
const result = (q: number, a: number, s: number): QueueReadyHoldingsResult => ({
  queued: Array.from({ length: q }, (_, i) => run(`q${i}`)),
  already_queued: Array.from({ length: a }, (_, i) => run(`a${i}`)),
  skipped: Array.from({ length: s }, (_, i) => ({ holding_id: `s${i}`, ticker: null, holding_name: null, reason: "no data" })),
});

describe("wishes", () => {
  it("offers exactly the three queue scopes, in the queue page's order", () => {
    expect(WISHES.map((w) => w.scope)).toEqual(["holdings", "watchlist", "all"]);
  });
  it("has distinct titles and non-empty blurbs", () => {
    expect(new Set(WISHES.map((w) => w.title)).size).toBe(3);
    WISHES.forEach((w) => expect(w.blurb.length).toBeGreaterThan(10));
  });
});

describe("greeting", () => {
  it("is deterministic for a seed and tolerates negative and fractional seeds", () => {
    expect(greeting(3)).toBe(greeting(3));
    expect(greeting(-7.9).length).toBeGreaterThan(0);
  });
});

describe("summariseWish", () => {
  it("granted: counts, and says nothing is analysed yet (status honesty)", () => {
    const o = summariseWish(result(3, 0, 0), "holdings", true);
    expect(o.mood).toBe("granted");
    expect(o.lines[0]).toContain("3 scrolls are now waiting");
    expect(o.lines.join(" ")).toContain("Nothing is analysed yet");
  });
  it("singular wording for one", () => {
    expect(summariseWish(result(1, 1, 1), "all", true).lines.join(" ")).toMatch(/1 scroll is.*1 was already.*1 was not ready/s);
  });
  it("worker offline: says asleep and how to start it", () => {
    expect(summariseWish(result(2, 0, 0), "watchlist", false).lines.join(" ")).toContain("asleep");
  });
  it("worker unknown: admits it does not know, never asleep or awake", () => {
    const text = summariseWish(result(2, 0, 0), "watchlist", null).lines.join(" ");
    expect(text).toContain("could not see");
    expect(text).not.toMatch(/is asleep|is awake and will/);
  });
  it("nothing queued but some already waiting is 'nothing' not 'granted'", () => {
    const o = summariseWish(result(0, 2, 0), "holdings", true);
    expect(o.mood).toBe("nothing");
    expect(o.lines.join(" ")).not.toMatch(/worker/);
  });
  it("empty result says nothing was ready", () => {
    const o = summariseWish(result(0, 0, 0), "all", true);
    expect(o.mood).toBe("nothing");
    expect(o.lines[0]).toContain("nothing ready");
  });
});

describe("errorOutcome", () => {
  it("states that nothing was queued", () => {
    const o = errorOutcome("Network down.");
    expect(o.mood).toBe("error");
    expect(o.lines[0]).toContain("Nothing was queued");
  });
});

describe("wording rules", () => {
  const all = [
    GENIE_DISCLAIMER,
    CONJURING_LINE,
    DEMO_LINE,
    ...WISHES.flatMap((w) => [w.title, w.blurb]),
    ...[0, 1, 2, 3].map(greeting),
    ...[true, false, null].flatMap((w) => summariseWish(result(2, 1, 1), "all", w).lines),
    ...summariseWish(result(0, 0, 0), "all", true).lines,
  ].join(" ");
  it("never says buy, sell, trim, invest or purchase", () => {
    expect(all).not.toMatch(/\b(buy|sell|trim|invest|purchase)\b/i);
  });
  it("makes no promise of gains", () => {
    expect(all).not.toMatch(/\b(profit|guarantee|fortune|riches|get rich)\b/i);
  });
  it("says it is an invented character", () => {
    expect(GENIE_DISCLAIMER).toMatch(/invented/);
  });
});
