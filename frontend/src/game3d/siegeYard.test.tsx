import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { formatNok } from "../lib/format";
import { formatShock } from "../lib/fortress";
import { coverageLine, headline, holdingLine, rowStatus } from "../lib/siege";
import type { SiegeSim, SiegeSimHolding } from "../lib/types";
import { YardResults } from "./SiegeYardResults";
import { YARD_MAX_ROWS, yardView } from "./siegeYard";
import * as words from "./siegeYardWordsV1";

function holding(o: Partial<SiegeSimHolding>): SiegeSimHolding {
  return {
    holding_id: "h", ticker: "AAA", name: "Alpha", structure: "keep", size_class: "medium", wall: "granite",
    value_nok: "1000", weight_pct: "10", beta: "1.1", beta_as_of: null, modelled: true, shock_pct: "-0.30",
    loss_nok: "300", exposure: "exposed", stored_shock_pct: "-0.30", reason: null, method: "price_history",
    observations: 40, r_squared: "0.8", caution: null, ...o,
  } as SiegeSimHolding;
}

function sim(holdings: SiegeSimHolding[], o: Partial<SiegeSim> = {}): SiegeSim {
  return {
    scenarios_version: "v4", mapping_version: "v1", demo: false, market_drop: "0.30", drop_min: "0.05", drop_max: "0.60",
    drop_step: "0.05", level: "gathering", level_reason: "", portfolio_shock_pct: "-0.25", portfolio_loss_nok: "2500",
    covered_value_nok: "9000", total_value_nok: "10000", coverage: "0.9", weighted_beta: "0.95", gathering_line: "-0.15",
    besieged_line: "-0.30", drop_to_gathering: null, drop_to_besieged: null, reach_note_gathering: "", reach_note_besieged: "",
    counts: {}, oldest_beta_at: null, holdings, notes: [], benchmark_ticker: "OSEBX", benchmark_key: "local",
    ...o,
  } as SiegeSim;
}

const hurt = holding({ holding_id: "a", name: "Alpha", shock_pct: "-0.40", loss_nok: "400" });
const mild = holding({ holding_id: "b", name: "Beta", shock_pct: "-0.10", loss_nok: "100", exposure: "sheltered" });
const gain = holding({ holding_id: "c", name: "Gamma", shock_pct: "0.02", loss_nok: "-20", exposure: "sheltered" });
const fog = holding({ holding_id: "d", name: "Delta", modelled: false, shock_pct: null, loss_nok: null, beta: null, exposure: "unmodelled", reason: "Too few price days." });

describe("yardView: the same numbers and words as the flat Siege Simulator", () => {
  it("lists modelled towers worst hit first, with the flat page's own formatting", () => {
    const v = yardView(sim([mild, gain, hurt, fog]));
    expect(v.rows.map((r) => r.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(v.rows[0].shock).toBe(formatShock("-0.40"));
    expect(v.rows[0].loss).toBe(formatNok("400"));
    expect(v.rows[0].status).toBe(rowStatus(hurt));
    expect(v.rows[0].line).toBe(holdingLine(hurt));
    expect(v.rows[2].status).toBe("Gains");
  });

  it("uses the flat headline and coverage sentences and the whole-book figures", () => {
    const s = sim([hurt, mild, fog]);
    const v = yardView(s);
    expect(v.headline).toBe(headline(s));
    expect(v.book?.coverageLine).toBe(coverageLine(s));
    expect(v.book?.shock).toBe(formatShock("-0.25"));
    expect(v.book?.loss).toBe(formatNok("2500"));
    expect(v.book?.beta).toBe("0.95");
    expect(v.book?.coverage).toBe("90%");
  });

  it("keeps a tower with no usable beta in the fog, with the backend's reason and no number", () => {
    const v = yardView(sim([hurt, fog]));
    expect(v.rows.map((r) => r.id)).toEqual(["a"]);
    expect(v.fog).toEqual([{ id: "d", name: "Delta", reason: "Too few price days." }]);
  });

  it("says nothing of the book when it could not be modelled at all", () => {
    const v = yardView(sim([fog], { portfolio_shock_pct: null, portfolio_loss_nok: null, coverage: null, weighted_beta: null, level: "unsurveyed" }));
    expect(v.book).toBeNull();
    expect(v.rows).toEqual([]);
    expect(v.fog).toHaveLength(1);
  });

  it("caps the list and counts the rest", () => {
    const many = Array.from({ length: YARD_MAX_ROWS + 3 }, (_, i) => holding({ holding_id: `m${i}`, name: `T${i}`, shock_pct: `-0.${10 + i}` }));
    const v = yardView(sim(many));
    expect(v.rows).toHaveLength(YARD_MAX_ROWS);
    expect(v.more).toBe(3);
  });

  it("flags a rough guide and a differing stress case with the flat rules", () => {
    const rough = holding({ holding_id: "r", caution: "Weak fit.", shock_pct: "-0.50", stored_shock_pct: "-0.05" });
    const v = yardView(sim([rough]));
    expect(v.rows[0].rough).toBe(true);
    expect(v.rows[0].gap).not.toBeNull();
  });
});

function html(state: Parameters<typeof YardResults>[0]["state"]) {
  return renderToStaticMarkup(<MemoryRouter><YardResults state={state} /></MemoryRouter>);
}

describe("YardResults", () => {
  it("says it is counting while it reads, and says so plainly when it cannot", () => {
    expect(html({ status: "reading" })).toContain(words.YARD_READING);
    expect(html({ status: "failed" })).toContain(words.YARD_FAILED.replace("'", "&#x27;"));
  });

  it("prints a ? and the fog block for a tower that was not modelled, and links the flat page", () => {
    const out = html({ status: "ready", refreshing: false, view: yardView(sim([hurt, fog])) });
    expect(out).toContain(words.yardFogTitle(1));
    expect(out).toContain("Too few price days.");
    expect(out).toContain(`${words.YARD_UNKNOWN} `);
    expect(out).toContain('href="/fortress/siege"');
    expect(out).toContain('href="/holdings/a"');
  });

  it("shows the empty state for a book with no towers", () => {
    expect(html({ status: "ready", refreshing: false, view: yardView(sim([])) })).toContain(words.YARD_EMPTY);
  });

  it("never says buy or sell and uses no red or green", () => {
    const out = html({ status: "ready", refreshing: false, view: yardView(sim([hurt, mild, fog])) });
    const all = [out, ...Object.values(words).filter((w) => typeof w === "string") as string[]].join(" ");
    expect(all).not.toMatch(/\b(buy|sell|sold|bought)\b/i);
    expect(out).not.toMatch(/#(?:f00|0f0|ff0000|00ff00)\b|\bred\b|\bgreen\b/i);
  });
});
