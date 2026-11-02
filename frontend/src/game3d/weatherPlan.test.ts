import { describe, expect, it } from "vitest";
import { siegeSky } from "../lib/fortress";
import type { FortressSiegeLevel } from "../lib/types";
import { MAX_CLOUDS, SKY_CALM, cloudSlots, weatherLook } from "./weatherPlan";

const LEVELS: FortressSiegeLevel[] = ["calm", "gathering", "besieged", "unsurveyed"];

describe("weather look", () => {
  it("keeps the courtyard's own sky in calm weather, with no clouds", () => {
    const w = weatherLook("calm");
    expect(w.sky).toBe(SKY_CALM);
    expect(w.clouds).toBe(0);
    expect(w.mist).toBe(false);
  });

  it("raises more clouds as the weather worsens, in step with the flat sky's cloud strength", () => {
    const g = weatherLook("gathering").clouds;
    const b = weatherLook("besieged").clouds;
    expect(g).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(g);
    expect(b).toBeLessThanOrEqual(MAX_CLOUDS);
    for (const l of LEVELS) expect(weatherLook(l).clouds > 0).toBe(siegeSky(l).clouds > 0);
  });

  it("shows an unreadable or unsurveyed level as mist, never as calm", () => {
    for (const l of ["unsurveyed", null, undefined] as const) {
      const w = weatherLook(l);
      expect(w.mist).toBe(true);
      expect(w.sky).not.toBe(SKY_CALM);
      expect(w.fogFar).toBeLessThan(weatherLook("calm").fogFar);
      expect(w.clouds).toBe(0);
    }
  });

  it("gives every level a different sky, and never a red or green one", () => {
    expect(new Set(LEVELS.map((l) => weatherLook(l).sky)).size).toBe(LEVELS.length);
    for (const l of LEVELS) {
      for (const c of [weatherLook(l).sky, weatherLook(l).cloudColor]) {
        const hex = c.replace("#", "");
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect(b >= r && b >= g, `${l} ${c} must be grey-blue`).toBe(true);
      }
    }
  });

  it("fills cloud slots in a fixed order, so worse weather adds clouds and never moves one", () => {
    expect(cloudSlots(3)).toEqual(cloudSlots(9).slice(0, 3));
    expect(cloudSlots(0)).toEqual([]);
    expect(cloudSlots(99)).toHaveLength(MAX_CLOUDS);
    expect(cloudSlots(Number.NaN)).toEqual([]);
  });
});
