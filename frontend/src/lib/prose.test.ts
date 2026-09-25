import { describe, expect, it } from "vitest";
import { mentionsDataGap, paragraphs, segmentFigures, splitSentences } from "./prose";

describe("splitSentences", () => {
  it("splits on sentence ends but not inside decimals", () => {
    const s = splitSentences("ROE averaged 88.8% over two years. That is high. Net debt is 2.93x FCF.");
    expect(s).toEqual(["ROE averaged 88.8% over two years.", "That is high.", "Net debt is 2.93x FCF."]);
  });

  it("keeps blank-line paragraph breaks as boundaries", () => {
    expect(splitSentences("First part\n\nsecond part")).toEqual(["First part", "second part"]);
  });

  it("groups sentences into paragraphs", () => {
    expect(paragraphs(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });
});

describe("segmentFigures", () => {
  it("marks figures with units, but not years", () => {
    const figures = segmentFigures("ROE of 88.8%, D/E 10.61 and 1,787m FCF in 2025")
      .filter((s) => s.figure)
      .map((s) => s.text);
    expect(figures).toEqual(["88.8%", "10.61", "1,787m"]);
  });

  it("leaves evidence IDs and model names alone", () => {
    expect(segmentFigures("see EV-007 and qwen3").some((s) => s.figure)).toBe(false);
  });

  it("round-trips the text", () => {
    const text = "Coverage is 11.35, margin 4.2% to 9.9%.";
    expect(segmentFigures(text).map((s) => s.text).join("")).toBe(text);
  });
});

describe("mentionsDataGap", () => {
  it("flags sentences about missing data", () => {
    expect(mentionsDataGap("However, the lack of data on ROIC limits the view.")).toBe(true);
    expect(mentionsDataGap("The valuation synthesis is not possible.")).toBe(true);
    expect(mentionsDataGap("Interest coverage is strong.")).toBe(false);
  });
});
