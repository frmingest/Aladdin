import { describe, expect, it } from "vitest";
import { MAX_MASTER_GAIN, cappedGain, soundProfile } from "./fortressSound";

describe("fortress ambience profiles (G7b)", () => {
  it("is quiet by design: no profile may exceed the master cap", () => {
    for (const level of ["calm", "gathering", "besieged", "unsurveyed", null, undefined] as const) {
      expect(cappedGain(soundProfile(level).gain)).toBeLessThanOrEqual(MAX_MASTER_GAIN);
      expect(soundProfile(level).gain).toBeGreaterThan(0);
    }
  });

  it("gets louder and deeper as the weather turns, and never makes unknown weather loud", () => {
    const calm = soundProfile("calm");
    const gathering = soundProfile("gathering");
    const besieged = soundProfile("besieged");
    expect(gathering.gain).toBeGreaterThan(calm.gain);
    expect(besieged.gain).toBeGreaterThan(gathering.gain);
    expect(besieged.freq).toBeLessThan(calm.freq);
    expect(soundProfile("unsurveyed").gain).toBeLessThan(calm.gain);
    expect(soundProfile(null)).toEqual(soundProfile("unsurveyed"));
  });

  it("clamps nonsense gain values instead of passing them to the speakers", () => {
    expect(cappedGain(5)).toBe(MAX_MASTER_GAIN);
    expect(cappedGain(-1)).toBe(0);
    expect(cappedGain(Number.NaN)).toBe(0);
    expect(cappedGain(Number.POSITIVE_INFINITY)).toBe(0);
    expect(cappedGain(0.05)).toBe(0.05);
  });
});
