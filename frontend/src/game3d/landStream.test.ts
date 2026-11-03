import { describe, expect, it } from "vitest";
import { ALL_STREAMS, STREAM_INNER, landStream } from "./landStream";
import { LAND_TOWER_REACH } from "./holdingLand";
import type { FortressMoat } from "../lib/types";

describe("the stream (S26 PR 1)", () => {
  it("gives each moat tier its own look", () => {
    const tiers: FortressMoat[] = ["wide", "narrow", "none", "unsurveyed", "not_applicable"];
    const looks = tiers.map((m) => JSON.stringify(landStream(m)));
    // unsurveyed and an unread moat share one mist look; the five tiers give four distinct looks plus mist = five in all.
    expect(new Set(looks).size).toBe(5);
    expect(landStream("wide").width).toBeGreaterThan(landStream("narrow").width);
  });

  it("draws water only for wide and narrow; none is a dry bed with no water", () => {
    expect(landStream("wide").water).toBe(true);
    expect(landStream("narrow").water).toBe(true);
    const none = landStream("none");
    expect(none.water).toBe(false);
    expect(none.bed).toBe(true);
    expect(none.width).toBeGreaterThan(0);
  });

  it("draws unsurveyed (or unread) as mist with a ?, never clear water", () => {
    for (const m of ["unsurveyed", null, undefined] as const) {
      const s = landStream(m);
      expect(s.mist).toBe(true);
      expect(s.water).toBe(false);
      expect(s.mark).toBe("?");
    }
  });

  it("draws no band for a holding with no moat to judge", () => {
    const s = landStream("not_applicable");
    expect(s.look).toBe("absent");
    expect(s.width).toBe(0);
    expect(s.water || s.bed || s.mist).toBe(false);
  });

  it("keeps the band inside the tower's reach so it stays clear of the lanterns", () => {
    for (const s of ALL_STREAMS) expect(STREAM_INNER + s.width).toBeLessThanOrEqual(LAND_TOWER_REACH + 1e-9);
  });

  it("uses no red or green tint", () => {
    for (const s of ALL_STREAMS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(s.tint.slice(i, i + 2), 16)) as [number, number, number];
      const redish = r > g + 40 && r > b + 40;
      const greenish = g > r + 40 && g > b + 40;
      expect(redish || greenish, s.tint).toBe(false);
    }
  });

  it("depends on the moat tier alone", () => {
    expect(landStream.length).toBe(1);
  });
});
