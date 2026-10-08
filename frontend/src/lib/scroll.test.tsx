import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScrollRollers, ScrollSeal } from "../components/ScrollStage";
import {
  SCROLL_MS,
  defaultTint,
  initialPhase,
  isOpening,
  nextPhase,
  openingTotalMs,
  phaseDelay,
  scrollHeading,
  sealVisible,
  skipToOpen,
  type ScrollPhase,
} from "./scroll";
import { countWords } from "./wordBudget";

describe("scroll sequence (game mode G28)", () => {
  it("opens sealed, and straight at open when motion is reduced", () => {
    expect(initialPhase(false)).toBe("sealed");
    expect(initialPhase(true)).toBe("open");
  });

  it("walks sealed to cracking to unrolling to open, then closes by rolling up", () => {
    const seen: ScrollPhase[] = ["sealed"];
    for (let i = 0; i < 5; i++) seen.push(nextPhase(seen[seen.length - 1]));
    expect(seen).toEqual(["sealed", "cracking", "unrolling", "open", "rolling", "rolling"]);
  });

  it("moves on by itself only while opening", () => {
    expect(phaseDelay("sealed")).toBe(SCROLL_MS.sealedHold);
    expect(phaseDelay("cracking")).toBe(SCROLL_MS.crack);
    expect(phaseDelay("unrolling")).toBe(SCROLL_MS.unroll);
    expect(phaseDelay("open")).toBeNull();
    expect(phaseDelay("rolling")).toBeNull();
    expect(openingTotalMs()).toBeLessThanOrEqual(1500);
  });

  it("any key shows the report at once, and never reopens a closing scroll", () => {
    expect(skipToOpen("sealed")).toBe("open");
    expect(skipToOpen("cracking")).toBe("open");
    expect(skipToOpen("unrolling")).toBe("open");
    expect(skipToOpen("open")).toBe("open");
    expect(skipToOpen("rolling")).toBe("rolling");
  });

  it("knows when the seal is on the page and when the report cannot be read yet", () => {
    expect(sealVisible("sealed")).toBe(true);
    expect(sealVisible("cracking")).toBe(true);
    expect(sealVisible("unrolling")).toBe(false);
    expect(isOpening("unrolling")).toBe(true);
    expect(isOpening("open")).toBe(false);
  });

  it("tints HTML filings by default but not PDFs, whose viewer has a grey surround", () => {
    expect(defaultTint("html")).toBe(true);
    expect(defaultTint("pdf")).toBe(false);
    expect(defaultTint("download")).toBe(false);
  });
});

describe("scroll heading", () => {
  it("labels the document and its period", () => {
    expect(
      scrollHeading({ original_filename: "aker_bp-annual_report_2025.pdf", type: "annual_report", reporting_period: "FY2025" }),
    ).toEqual({ kicker: "Annual report · FY2025", title: "aker bp annual report 2025" });
  });
  it("falls back to a plain label when the type is unknown", () => {
    expect(scrollHeading({ original_filename: "x.xhtml" }).kicker).toBe("Report");
    expect(scrollHeading({ original_filename: "q3.pdf", type: "quarterly_report" }).kicker).toBe("Interim report");
  });
});

describe("scroll stage markup", () => {
  it("keeps the seal short and says nothing about rewards, buying or selling", () => {
    const html = renderToStaticMarkup(
      <ScrollSeal phase="sealed" kicker="Annual report · FY2025" title="Example" onBreak={() => {}} />,
    );
    expect(countWords(html)).toBeLessThanOrEqual(20);
    expect(html).not.toMatch(/\b(buy|sell|reward|points?|streak|unlock)\b/i);
  });
  it("draws no seal once the paper is unrolling", () => {
    expect(renderToStaticMarkup(<ScrollSeal phase="unrolling" kicker="k" title="t" onBreak={() => {}} />)).toBe("");
  });
  it("hides the rollers from assistive technology", () => {
    expect(renderToStaticMarkup(<ScrollRollers phase="open" />)).toContain('aria-hidden="true"');
  });
});
