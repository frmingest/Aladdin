import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import type { WinterPoint, WinterRehearsal } from "../lib/types";
import WinterRehearsalPage, { BottomCard, CoverageBlock, DaysTable, OrderEditor, Readout } from "./WinterRehearsalPage";

const pt = (i: number): WinterPoint => ({
  day: `2025-03-${String(10 + i).padStart(2, "0")}`,
  value_nok: String(1_000_000 - i * 20_000),
  change_nok: String(-i * 20_000),
  change: String(-0.02 * i),
  days_under_water: i,
});
const points = Array.from({ length: 6 }, (_, i) => pt(i));

const data = (over: Partial<WinterRehearsal> = {}): WinterRehearsal => ({
  version: "v1",
  demo: false,
  status: "ok",
  status_reason: "",
  real_winter_fall: "0.10",
  coverage: {
    covered_count: 5,
    total_count: 8,
    covered_value_nok: "1000000",
    covered_value_share: "0.8",
    holdings: [
      { holding_id: "a", name: "Covered Co", covered: true, reason: null },
      { holding_id: "b", name: "Fogged Co", covered: false, reason: "no price history stored for this holding" },
    ],
  },
  days_on_file: 400,
  worst_fall: "-0.1",
  window: { peak_date: points[0].day, trough_date: points[5].day, fall: "-0.1", trading_days: 6, points },
  notes: ["Today's weights are held constant."],
  caption: "A replay of today's holdings.",
  ...over,
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe("OrderEditor", () => {
  it("asks the question in the first person, limits the line and says where it is kept", () => {
    const html = renderToStaticMarkup(<OrderEditor saved="" onSave={() => {}} />);
    expect(html).toContain("If the market falls hard, I will first check");
    expect(html).toContain('maxLength="200"');
    expect(html).toContain("Kept only in this browser");
    expect(html).toContain("Save my order");
    expect(html).not.toContain("Clear my order");
  });

  it("offers to update or clear a saved order", () => {
    const html = renderToStaticMarkup(<OrderEditor saved="reread my notes" onSave={() => {}} />);
    expect(html).toContain("Update my order");
    expect(html).toContain("Clear my order");
    expect(html).toContain('value="reread my notes"');
  });
});

describe("Readout", () => {
  it("prints day, kroner, fall, days under water and frost in words and numbers", () => {
    const html = renderToStaticMarkup(<Readout point={points[3]} frost={0.6} />);
    expect(html).toContain("−60 000 kr");
    expect(html).toContain("−6.0%");
    expect(html).toContain("3 days");
    expect(html).toContain("60% of the worst day");
    expect(html).toContain('aria-live="polite"');
  });
});

describe("BottomCard", () => {
  it("shows only your own words and the numbers: no score, no verdict, no advice", () => {
    const html = renderToStaticMarkup(<BottomCard order="reread my thesis" point={points[5]} gameMode={false} />);
    expect(html).toContain("reread my thesis");
    expect(html).toContain("Down 100 000 kr");
    expect(html).toContain("10.0%");
    expect(html).toContain("5 days under water");
    expect(html).not.toMatch(/well done|good|bad|buy|sell|hold|should|score|calm/i);
  });

  it("says plainly that no order was written, without nagging", () => {
    const html = renderToStaticMarkup(<BottomCard order="" point={points[5]} gameMode={false} />);
    expect(html).toContain("You have not written one.");
    expect(html).not.toMatch(/please|remember|write one now/i);
  });
});

describe("DaysTable and CoverageBlock", () => {
  it("is a real table with a row per stored day, the Plain view of the scene", () => {
    const html = renderToStaticMarkup(<DaysTable points={points} />);
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html.match(/scope="row"/g)?.length).toBe(6);
    expect(html).toContain("Days under water");
  });

  it("prints coverage with its 'of' and keeps the fog holdings' reasons one click deeper", () => {
    const html = renderToStaticMarkup(<CoverageBlock data={data()} />);
    expect(html).toContain("5 of 8 holdings had stored prices");
    expect(html).toContain("Show the 1 in fog");
  });
});

describe("WinterRehearsalPage", () => {
  it("renders its loading state first, in a router and game mode provider", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GameModeProvider>
          <WinterRehearsalPage />
        </GameModeProvider>
      </MemoryRouter>,
    );
    expect(html).toContain("Winter Rehearsal");
    expect(html).toContain("Lighting the candles");
  });
});
