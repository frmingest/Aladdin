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
    expect(out).toContain("Pick a tower first.");
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
