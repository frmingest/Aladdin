import { describe, expect, it } from "vitest";
import { HOURGLASS_SHUT, HOURGLASS_TODAY } from "./hourglassWordsV1";
import { talkHint } from "./questWordsV3";
import { STARTER_WORDS } from "./starterWordsV2";
import { TOUCH_WORDS as V1 } from "./touchWordsV1";
import { TOUCH_WORDS, forTouch, keyWords } from "./touchWordsV2";

/** A line names a key a phone does not have. */
const NAMES_A_KEY = /\bPress [A-Z]\b|\([A-Z]\)|W A S D/;

describe("touchWordsV2 (#536)", () => {
  it("keeps V1's words as they were", () => {
    for (const [k, v] of Object.entries(V1)) expect(TOUCH_WORDS[k as keyof typeof V1]).toBe(v);
  });

  it("the lines that named a key say the tap on a touch screen", () => {
    expect(forTouch("Got it (E)")).toBe("Got it");
    expect(forTouch("Not now (E)")).toBe("Not now");
    expect(forTouch("Close (E)")).toBe("Close");
    expect(forTouch(`${HOURGLASS_TODAY} (H)`)).toBe(HOURGLASS_TODAY);
    expect(forTouch(HOURGLASS_SHUT)).toBe("Shut while you look back. Tap Back to today");
    expect(forTouch(talkHint(["Barren", "Marlie"]))).toBe("Walk up to Barren or Marlie and tap Talk.");
    expect(forTouch("Press T: each tower says its walls.")).toBe("Tap Towers: each tower says its walls.");
  });

  it("no Book line, close label, talk hint or hourglass line names a key on a touch screen", () => {
    const lines = [
      HOURGLASS_SHUT,
      `${HOURGLASS_TODAY} (H)`,
      talkHint(["Barren", "Marlie"]),
      "Got it (E)",
      "Close (E)",
      ...Object.values(STARTER_WORDS.book.pages).map((p) => p.real ?? ""),
      TOUCH_WORDS.canvas,
    ];
    for (const line of lines) expect(forTouch(line)).not.toMatch(NAMES_A_KEY);
  });

  it("a desktop keeps the line as written; a line with no key is unchanged", () => {
    expect(keyWords("Got it (E)", false)).toBe("Got it (E)");
    expect(forTouch("Looking back. Nothing can be written.")).toBe("Looking back. Nothing can be written.");
  });
});
