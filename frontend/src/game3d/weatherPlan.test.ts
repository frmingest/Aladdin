import { describe, expect, it } from "vitest";
import { MAX_CLOUDS, SKY_CALM, WEATHER_LOOKS, cloudSlots, weatherLook } from "./weatherPlan";

describe("weather look", () => {
  it("calm is exactly the sky the courtyard always had, with no clouds and no mist", () => {
    const l = weatherLook("calm");
    expect(l.sky).toBe(SKY_CALM);
    expect([l.fogNear, l.fogFar]).toEqual([100, 230]);
    expect(l.clouds).toBe(0);
    expect(l.mist).toBe(false);
  });

  it("unknown stays fog: a missing or unsurveyed level is a mist, never a clear sky", () => {
    for (const lv of [null, undefined, "unsurveyed" as const]) {
      const l = weatherLook(lv);
      expect(l.mist).toBe(true);
      expect(l.fogFar).toBeLessThan(WEATHER_LOOKS.calm.fogFar);
      expect(l.clouds).toBe(0);
    }
  });

  it("gets darker and closer from calm to gathering to besieged", () => {
    const [c, g, b] = [weatherLook("calm"), weatherLook("gathering"), weatherLook("besieged")];
    expect(c.clouds).toBeLessThan(g.clouds);
    expect(g.clouds).toBeLessThan(b.clouds);
    expect(c.fogFar).toBeGreaterThan(g.fogFar);
    expect(g.fogFar).toBeGreaterThan(b.fogFar);
  });

  it("uses no red and no green in any sky or cloud colour", () => {
    for (const l of Object.values(WEATHER_LOOKS)) {
      for (const hex of [l.sky, l.cloudColor]) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect(r > g + 24 && r > b + 24, `${hex} reads red`).toBe(false);
        expect(g > r + 24 && g > b + 24, `${hex} reads green`).toBe(false);
      }
    }
  });
});

describe("cloud slots", () => {
  it("never more than twelve, never negative, and a darker level only adds clouds", () => {
    expect(cloudSlots(-2)).toEqual([]);
    expect(cloudSlots(Number.NaN)).toEqual([]);
    expect(cloudSlots(99)).toHaveLength(MAX_CLOUDS);
    expect(cloudSlots(6)).toEqual(cloudSlots(12).slice(0, 6));
  });

  it("hangs every cloud high and inside the backdrop ring", () => {
    for (const s of cloudSlots(MAX_CLOUDS)) {
      expect(s.y).toBeGreaterThan(60);
      expect(Math.hypot(s.x, s.z)).toBeLessThan(155);
    }
  });
});
