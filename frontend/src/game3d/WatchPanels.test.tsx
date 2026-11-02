import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import type { Raven, Ravens } from "../lib/types";
import RavensPanel from "./RavensPanel";
import WatchPanel from "./WatchPanel";

function raven(o: Partial<Raven>): Raven {
  return {
    id: "r1", kind: "figures", holding_id: "h1", ticker: "EQNR.OL", name: "Equinor", in_portfolio: true, period: "Q3 2026",
    previous_period: "Q2 2026", captured_at: "2026-11-01T06:00:00Z", age_days: 0, document_id: null, summary: "Figures moved.",
    better: 3, worse: 1, lines: [], ...o,
  };
}

function ravens(list: Raven[], demo = false): Ravens {
  return { rules_version: "v1", demo, as_of: "2026-11-01T08:00:00Z", window_days: 30, ravens: list, notes: [] };
}

function ravensHtml(r: Ravens, seen: Set<string> = new Set()) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RavensPanel ravens={r} seen={seen} onSeen={() => {}} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("RavensPanel (the perch's panel)", () => {
  it("shows the flat Ravens card's own words, a way to mark seen, and a link to the flat page", () => {
    const h = ravensHtml(ravens([raven({})]));
    expect(h).toContain("The ravens");
    expect(h).toContain("1 new");
    expect(h).toContain("Equinor");
    expect(h).toContain("Mark as seen");
    expect(h).toContain('href="/fortress"');
    expect(h).toContain("Open the flat page");
    expect(h).toContain('aria-label="Close"');
  });

  it("says plainly when no report has landed, instead of drawing nothing", () => {
    expect(ravensHtml(ravens([]))).toContain("No report has been captured in the last 30 days.");
  });

  it("says every raven was seen when they all were, not that none landed", () => {
    expect(ravensHtml(ravens([raven({})]), new Set(["r1"]))).toContain("Every raven of the last 30 days has been seen.");
  });
});

describe("WatchPanel (the watch post's panel)", () => {
  it("hosts the flat Night Watch card, which holds its place while the dispatch loads, with a link to the flat page", () => {
    const h = renderToStaticMarkup(
      <GameModeProvider>
        <MemoryRouter>
          <WatchPanel onClose={() => {}} />
        </MemoryRouter>
      </GameModeProvider>,
    );
    expect(h).toContain("Night Watch");
    expect(h).toContain('aria-busy="true"');
    expect(h).toContain('href="/fortress"');
    expect(h).toContain('aria-label="Close"');
  });
});
