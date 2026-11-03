import { describe, expect, it } from "vitest";
import { SURVEY_CHECKS } from "../lib/survey";
import { LANTERN_WORDS } from "./landLanternWordsV1";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("land lantern words v1", () => {
  it("keeps the approach prompt short for every check", () => {
    for (const c of SURVEY_CHECKS) expect(words(LANTERN_WORDS.prompt(c.label))).toBeLessThanOrEqual(10);
  });
  it("frames the plate with the survey's own label and reason, and adds no facts", () => {
    expect(LANTERN_WORDS.plate("Analysis fresh", "The analysis is recent.")).toBe("Analysis fresh. The analysis is recent.");
  });
  it("names each look in a word or two", () => {
    for (const w of [LANTERN_WORDS.lit, LANTERN_WORDS.mist, LANTERN_WORDS.bare]) expect(words(w)).toBeLessThanOrEqual(2);
  });
});
