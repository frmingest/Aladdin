import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { councilSeats } from "../../../lib/councilSeats";
import { countWords, WORD_BUDGET } from "../../../lib/wordBudget";
import type { CouncilItem } from "../../../lib/types";
import CouncilChamber from "./CouncilChamber";
import Crest from "./Crest";
import FogPanel from "./FogPanel";
import SealMark from "./SealMark";
import TorchPair from "./TorchPair";

const item = (kind: CouncilItem["kind"], tone: CouncilItem["tone"]): CouncilItem => ({
  kind,
  tone,
  title: "t",
  text: "x",
  holdings: [{ holding_id: "1", name: "A", weight_pct: "2.0" }],
  more: 2,
  facts: [],
});

describe("page-scene kit", () => {
  it("SealMark prints its word and never relies on colour: shape, glyph and label differ", () => {
    const a = renderToStaticMarkup(<SealMark kind="alert" showLabel />);
    const n = renderToStaticMarkup(<SealMark kind="notice" showLabel />);
    const u = renderToStaticMarkup(<SealMark kind="unknown" showLabel />);
    expect(a).toContain("Warning");
    expect(n).toContain("Note");
    expect(u).toContain("Unknown");
    expect(a).toContain("<path");
    expect(n).toContain("<circle");
    expect(u).toContain("stroke-dasharray");
    expect(a).toContain(">!<");
    expect(u).toContain(">?<");
  });

  it("a seal without a printed label is named for screen readers", () => {
    expect(renderToStaticMarkup(<SealMark kind="alert" />)).toContain('aria-label="Warning"');
  });

  it("FogPanel shows one ? per unknown and nothing when there is nothing unknown", () => {
    const html = renderToStaticMarkup(<FogPanel title="Fog" lines={["a", "b"]} />);
    expect((html.match(/>\?</g) ?? []).length).toBe(2);
    expect(renderToStaticMarkup(<FogPanel title="Fog" lines={[]} />)).toBe("");
  });

  it("the chamber with an empty agenda has eight neutral seats, no buttons, no celebration", () => {
    const html = renderToStaticMarkup(<CouncilChamber seats={councilSeats({ items: [] })} onJump={() => {}} />);
    expect(html).not.toContain("<button");
    expect((html.match(/nothing found/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(html).not.toMatch(/\b(all clear|well done|complete|reward|points?|streak|score|\d of 8)\b/i);
    expect(html).not.toMatch(/(positive|#2e7d32|#3a8f4b|green)/i);
  });

  it("an occupied seat is a button carrying the real count", () => {
    const html = renderToStaticMarkup(<CouncilChamber seats={councilSeats({ items: [item("review_due", "warning")] })} onJump={() => {}} />);
    expect(html).toContain("<button");
    expect(html).toContain("Reviews owed: 3 holdings");
  });

  it("the chamber's own chrome stays within its word budget", () => {
    const html = renderToStaticMarkup(<CouncilChamber seats={councilSeats({ items: [] })} onJump={() => {}} />);
    // Each seat's label is printed twice (table and phone grid) by design; budget counts one set + the empty-state words.
    expect(countWords(html) / 2).toBeLessThanOrEqual(WORD_BUDGET.councilChamberChrome);
  });

  it("crest and torches are decorative (aria-hidden)", () => {
    expect(renderToStaticMarkup(<Crest kind="council" />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<TorchPair />)).toContain('aria-hidden="true"');
  });
});
