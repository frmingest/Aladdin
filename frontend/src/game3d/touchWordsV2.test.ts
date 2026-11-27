import { describe, expect, it } from "vitest";
import { HOURGLASS_SHUT, HOURGLASS_TODAY } from "./hourglassWordsV1";
import { talkHint } from "./questWordsV3";
import { STARTER_WORDS as STARTER_V1 } from "./starterWordsV1";
import { STARTER_WORDS as STARTER_V2 } from "./starterWordsV2";
import { STREET_EMPTY_AT_SAL } from "./streetPlan";
import { TOUCH_WORDS as V1 } from "./touchWordsV1";
import { TOUCH_LINES, TOUCH_WORDS, forTouch, keyWords } from "./touchWordsV2";

/** A line names a key a phone does not have. */
const NAMES_A_KEY = /\bPress [A-Z]\b|\([A-Z]\)|W A S D|\bmouse\b/;

describe("touchWordsV2 (#536)", () => {
  it("keeps V1's words as they were", () => {
    for (const [k, v] of Object.entries(V1)) expect(TOUCH_WORDS[k as keyof typeof V1]).toBe(v);
  });

  it("every line a touch screen passes through forTouch names no key", () => {
    // Every line the components hand to keyWords on a touch screen, plus the Quest log's talk hint and the canvas name.
    const lines = [
      HOURGLASS_SHUT,
      STREET_EMPTY_AT_SAL,
      `${HOURGLASS_TODAY} (H)`,
      "Got it (E)",
      "Not now (E)",
      "Close (E)",
      ...Object.values(STARTER_V1.book.pages).map((p) => p.real ?? ""),
      ...Object.values(STARTER_V2.book.pages).map((p) => p.real ?? ""),
    ];
    for (const line of lines) expect(forTouch(line), line).not.toMatch(NAMES_A_KEY);
    expect(TOUCH_WORDS.talkHint(["Barren", "Marlie"])).not.toMatch(NAMES_A_KEY);
    expect(TOUCH_WORDS.canvas).not.toMatch(NAMES_A_KEY);
  });

  it("each whole touch line replaces a real desktop line that names a key", () => {
    for (const [desk, phone] of Object.entries(TOUCH_LINES)) {
      expect(desk).toMatch(NAMES_A_KEY);
      expect(phone).not.toMatch(NAMES_A_KEY);
    }
  });

  it("says the tap: the seal's word, the chip or the button", () => {
    expect(forTouch("Got it (E)")).toBe("Got it");
    expect(forTouch(`${HOURGLASS_TODAY} (H)`)).toBe(HOURGLASS_TODAY);
    expect(forTouch(HOURGLASS_SHUT)).toBe('Shut while you look back. Tap "Back to today".');
    expect(forTouch(STREET_EMPTY_AT_SAL)).toBe("No stalls yet. Tap Talk and Sal opens the first one.");
    expect(TOUCH_WORDS.talkHint(["Barren", "Marlie"])).toBe("Walk up to Barren or Marlie and tap Talk.");
    // The desktop hint and the touch one name the same people.
    expect(talkHint(["Barren"])).toContain("Barren");
  });

  it("a desktop keeps the line as written; a bracketed letter that is not a game key stays", () => {
    expect(keyWords("Got it (E)", false)).toBe("Got it (E)");
    expect(forTouch("Looking back. Nothing can be written.")).toBe("Looking back. Nothing can be written.");
    expect(forTouch("Ticker (F)")).toBe("Ticker (F)");
  });
});
