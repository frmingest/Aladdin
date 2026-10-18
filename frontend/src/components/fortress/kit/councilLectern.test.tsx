import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import CouncilLectern from "./CouncilLectern";
import CouncilQuiet from "./CouncilQuiet";
import { councilSeats } from "../../../lib/councilSeats";

const tokens = [
  { id: "a", name: "Alpha", weight: "12", named: true },
  { id: "b", name: "Beta", weight: null, named: false },
];

describe("CouncilLectern", () => {
  it("offers towers, four fixed questions and two councillors, with no free-text box", () => {
    const out = renderToStaticMarkup(<MemoryRouter><CouncilLectern tokens={tokens} /></MemoryRouter>);
    expect(out).toContain("Call someone to the floor");
    expect(out).toContain("Alpha");
    expect(out).toContain("on tonight&#x27;s agenda");
    for (const q of ["Why is this here?", "How close is the edge?", "What does the storm do?", "Who stands beside it?"]) expect(out).toContain(q);
    expect(out).toContain("Ask the Oracle");
    expect(out).toContain("Ask the Partner");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<textarea");
  });

  it("has a tower, a question and a councillor picked from the start, so no tap is wasted on an empty form", () => {
    const out = renderToStaticMarkup(<MemoryRouter><CouncilLectern tokens={tokens} /></MemoryRouter>);
    // The first token (agenda-named) is pressed, the first question and the Oracle are checked.
    expect(out).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Alpha/s);
    expect(out).toMatch(/aria-checked="true"[^>]*id="ask-q-why_here"|id="ask-q-why_here"[^>]*aria-checked="true"/);
    expect(out).toMatch(/role="radio" aria-checked="true" aria-label="Ask the Oracle about Alpha/);
    // No gate to unlock and no separate "ask" press: nothing is disabled, no "pick first" nag.
    expect(out).not.toContain("disabled");
    expect(out).not.toContain("Pick a tower first");
  });

  it("falls back to the first token when the picked one is gone", () => {
    const out = renderToStaticMarkup(<MemoryRouter><CouncilLectern tokens={[tokens[1]]} /></MemoryRouter>);
    expect(out).toContain("Ask the Oracle about Beta");
  });

  it("draws nothing when there are no towers", () => {
    expect(renderToStaticMarkup(<MemoryRouter><CouncilLectern tokens={[]} /></MemoryRouter>)).toBe("");
  });
});

describe("CouncilQuiet", () => {
  it("falls back to the usual chamber when the picture mode is off", () => {
    const seats = councilSeats({ items: [] });
    const out = renderToStaticMarkup(<MemoryRouter><CouncilQuiet seats={seats} onJump={() => {}} unresolved={false} /></MemoryRouter>);
    expect(out).toContain("Council chamber");
  });
});
