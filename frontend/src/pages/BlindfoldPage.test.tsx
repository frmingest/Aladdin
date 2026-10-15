import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import type { Blindfold, BlindfoldPuzzle, BlindfoldReveal } from "../lib/types";
import type { BlindfoldResult } from "../lib/blindfold";
import BlindfoldPage, { FiguresTable, RevealPanel, Tallies } from "./BlindfoldPage";

const puzzle: BlindfoldPuzzle = {
  puzzle_id: "abc:2021",
  sector: "Industrials",
  rows: [
    { key: "revenue", label: "Revenue", kind: "money" },
    { key: "net_debt", label: "Net debt", kind: "money" },
    { key: "roic", label: "Return on invested capital", kind: "ratio" },
  ],
  years: ["Year -3", "Year -2", "Year -1", "Year 0"].map((label, i) => ({
    label,
    cells: {
      revenue: { value: String(1_000_000 * (i + 1)), fog: null },
      net_debt: { value: null, fog: "missing: total_debt" },
      roic: { value: "0.123", fog: null },
    },
  })),
  stake_min: "0",
  stake_max: "200",
};

const data = (): Blindfold => ({
  version: "blindfold-v1",
  demo: false,
  min_n: 8,
  confidence_pct: 80,
  pool_size: 3,
  remaining: 3,
  puzzle,
  empty_reason: null,
  caption: "Practice, not measurement.",
});

const reveal = (position: BlindfoldReveal["position"]): BlindfoldReveal => ({
  puzzle_id: "abc:2021",
  actual: "150",
  low: "80",
  high: "140",
  inside: position === "inside",
  position,
  width_class: "medium",
  last_owner_earnings: "130",
  name: "Secret Co",
  ticker: "SECR.OL",
  shown_period: "FY2021",
  answer_period: "FY2022",
  source_file: "secr-2022.pdf",
  note: "Taken from the newest filing on file, so numbers may be restated.",
});

const results = (n: number): BlindfoldResult[] =>
  Array.from({ length: n }, (_, i) => ({ puzzle_id: `p${i}`, inside: i % 2 === 0, position: "inside", width_class: "medium" }));

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe("FiguresTable", () => {
  const html = renderToStaticMarkup(<FiguresTable puzzle={puzzle} />);

  it("is a real table with year columns and row headers, and says no currency is named", () => {
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("Year -3");
    expect(html).toContain("1.0 m");
    expect(html).toContain("12.3%");
    expect(html).toContain("hidden");
  });

  it("shows a missing figure as unknown with its reason, never a number", () => {
    expect(html).toContain("unknown");
    expect(html).toContain('title="missing: total_debt"');
  });
});

describe("Tallies", () => {
  it("shows only a count below the gate", () => {
    const html = renderToStaticMarkup(<Tallies results={results(5)} data={data()} onForget={() => {}} />);
    expect(html).toContain("Keep going: 5 answered. Your tally opens at 8.");
    expect(html).not.toContain("caught");
    expect(html).toContain("Clear my answers");
  });

  it("prints the ratio with its count once the gate opens, with no grade or trend wording", () => {
    const html = renderToStaticMarkup(<Tallies results={results(8)} data={data()} onForget={() => {}} />);
    expect(html).toContain("Your stakes caught it 4 of 8 times.");
    expect(html.toLowerCase()).not.toMatch(/improv|streak|score|grade|well done|great/);
  });
});

describe("RevealPanel", () => {
  it("words the position as shape and words, and lifts the mask only now", () => {
    for (const [position, mark, word] of [
      ["below", "▼", "Missed: it landed below your stakes"],
      ["inside", "●", "Caught it: inside your stakes"],
      ["above", "▲", "Missed: it landed above your stakes"],
    ] as const) {
      const html = renderToStaticMarkup(<RevealPanel reveal={reveal(position)} hasNext onNext={() => {}} />);
      expect(html).toContain(mark);
      expect(html).toContain(word);
      expect(html).toContain("Secret Co (SECR.OL)");
      expect(html).toContain("restated");
    }
  });

  it("offers no trade wording", () => {
    const html = renderToStaticMarkup(<RevealPanel reveal={reveal("inside")} hasNext={false} onNext={() => {}} />).toLowerCase();
    expect(html).not.toMatch(/\bbuy\b|\bsell\b|\bhold\b|\btrim\b|\badd to\b/);
  });
});

describe("BlindfoldPage", () => {
  it("opens on a loading line in both modes, with no puzzle and no answer yet", () => {
    for (const game of [true, false]) {
      (globalThis as unknown as { localStorage: Storage }).localStorage = {
        getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : null),
        setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
      };
      const html = renderToStaticMarkup(
        <GameModeProvider>
          <MemoryRouter>
            <BlindfoldPage />
          </MemoryRouter>
        </GameModeProvider>,
      );
      expect(html).toContain("Blindfold Years");
      expect(html).toContain("Walking down to the river");
      expect(html).not.toContain("<table");
    }
  });
});
