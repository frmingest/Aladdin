import { describe, expect, it } from "vitest";
import { buildAttention } from "./attention";
import { budgetWarnings } from "./warnings";
import type { MonitorRow, SummaryPoint } from "./types";

const row = (ticker: string, status: MonitorRow["status"], firing = 0): MonitorRow => ({
  holding_id: ticker,
  ticker,
  name: ticker,
  status,
  status_label: status,
  firing_count: firing,
  change_reason_count: 0,
  analyzed_at: null,
});

describe("buildAttention", () => {
  it("puts a fired tripwire first and counts tripwires, not holdings", () => {
    const summary: SummaryPoint[] = [{ tone: "warn", text: "Top holding is 41% of the portfolio" }];
    const a = buildAttention(summary, [row("EQNR", "tripwire_fired", 2), row("MOWI", "tripwire_fired", 1)]);
    const { visible } = budgetWarnings(a.items);
    expect(visible[0].title).toBe("3 tripwires fired on 2 holdings");
    expect(visible[0].detail).toBe("EQNR, MOWI");
    expect(a.tripwireFiring).toBe(true);
  });

  it("turns only warn points into items and keeps good points as passed checks", () => {
    const a = buildAttention(
      [
        { tone: "info", text: "Portfolio value is 1 kr" },
        { tone: "good", text: "All equities analysed" },
        { tone: "warn", text: "2 analyses older than 180 days" },
      ],
      [],
    );
    expect(a.items.map((i) => i.title)).toEqual(["2 analyses older than 180 days"]);
    expect(a.passed).toEqual(["All equities analysed"]);
    expect(a.tripwireFiring).toBe(false);
  });

  it("is empty when nothing needs attention", () => {
    expect(buildAttention([{ tone: "info", text: "x" }], [row("A", "intact")]).items).toEqual([]);
  });

  it("names at most three tickers and counts the rest", () => {
    const rows = ["A", "B", "C", "D", "E"].map((t) => row(t, "review"));
    const a = buildAttention([], rows);
    expect(a.items[0].title).toBe("5 theses changed since the last review");
    expect(a.items[0].detail).toBe("A, B, C and 2 more");
  });

  it("keeps the feed to three items however many warnings exist", () => {
    const warns: SummaryPoint[] = Array.from({ length: 6 }, (_, i) => ({ tone: "warn", text: `w${i}` }));
    const r = budgetWarnings(buildAttention(warns, [row("A", "tripwire_fired", 1)]).items);
    expect(r.visible).toHaveLength(3);
    expect(r.hidden).toHaveLength(4);
    expect(r.visible[0].id).toBe("tripwires");
  });
});
