import { describe, expect, it } from "vitest";
import { HINT_TEXT } from "./hintLine";
import { TOUCH_WORDS } from "./touchWordsV1";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("touch words v1 (#485)", () => {
  it("keeps the touch hint short: four short parts, no longer than the keyboard hint", () => {
    const parts = TOUCH_WORDS.hint.split(" · ");
    expect(parts).toHaveLength(4);
    for (const p of parts) expect(words(p)).toBeLessThanOrEqual(5);
    expect(TOUCH_WORDS.hint.length).toBeLessThanOrEqual(HINT_TEXT.length);
  });

  it("never names a key or the mouse on a touch screen", () => {
    expect(TOUCH_WORDS.hint).not.toMatch(/\b(W A S D|Shift|Space|Esc|Wheel|Click|mouse|E)\b/);
  });

  it("names both controls for a screen reader", () => {
    expect(TOUCH_WORDS.stick).toBe("Walk");
    expect(TOUCH_WORDS.swapLabel("left")).toMatch(/stick to the right/);
    expect(TOUCH_WORDS.swapLabel("right")).toMatch(/stick to the left/);
  });
});
