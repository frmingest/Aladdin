import { describe, expect, it } from "vitest";
import { CONFETTI_COLOURS, CONFETTI_COUNT, CONFETTI_SECONDS, burstActive, heightAt, makePieces } from "./confetti";

describe("confetti", () => {
  it("is the same burst every time, about 150 pieces", () => {
    expect(makePieces()).toEqual(makePieces());
    expect(makePieces().length).toBe(CONFETTI_COUNT);
    expect(CONFETTI_COUNT).toBeLessThanOrEqual(150);
  });
  it("goes up, comes down, and is gone after 3 seconds", () => {
    const p = makePieces()[0];
    expect(heightAt(p, 0.3)).toBeGreaterThan(0);
    expect(heightAt(p, CONFETTI_SECONDS)).toBeLessThan(heightAt(p, 0.6));
    expect(burstActive(0)).toBe(true);
    expect(burstActive(CONFETTI_SECONDS)).toBe(false);
    expect(burstActive(-1)).toBe(false);
  });
  it("uses no red or green, so no piece can look like a status", () => {
    for (const c of CONFETTI_COLOURS) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      const redish = r > 150 && g < 110 && b < 110;
      const greenish = g > 150 && r < 110 && b < 110;
      expect(redish || greenish, c).toBe(false);
    }
  });
});
