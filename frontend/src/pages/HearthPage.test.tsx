import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Hearth } from "../lib/types";
import { GapNote, HearthRoom, InvalidationShelf, OrderShelf } from "./HearthPage";

const line = (text: string, id = "a") => ({ holding_id: id, name: "Alpha", text, day: "2026-10-15" });
const open = (over: Partial<Hearth> = {}): Hearth => ({
  version: "v1", demo: false, state: "open", state_reason: "The weather is besieged.", weather: "besieged",
  as_of: "2026-10-15", look_back_from: "2026-09-15",
  moved: [line("Beta went from 10% to 14% of the realm.", "b")], held: [line("Gamma: unchanged.", "c")],
  changed: [line("The weather turned from calm to besieged.", "x")],
  invalidations: [{
    holding_id: "a", name: "Alpha", entry_id: "e1", decided_on: "2026-01-05", line: "If debt does not fall I sell.",
    tripwires: [{ metric: "net_debt_to_ebitda", label: "Debt above 2x", operator: "above", threshold: "2", current_value: "2.4", unavailable_reason: null, firing: true }],
  }],
  order: { text: "Read the thesis first.", made_at: "2026-10-01T00:00:00Z" },
  record: { status: "ok", text: "The worst stored fall was 18.0%.", worst_fall: "-0.18", fall_nok: "-180000", days_under_water: 20 },
  gaps: ["Nothing was recorded on 2026-10-01 (1 day): the worker was off."], notes: [],
  ...over,
});
const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe("The Hearth", () => {
  it("lays out the three shelves, your own line verbatim beside the live tripwire, and the order", () => {
    const html = render(<HearthRoom data={open()} gameMode={false} />);
    expect(html).toContain("Beta went from 10% to 14%");
    expect(html).toContain("Gamma: unchanged.");
    expect(html).toContain("The weather turned from calm to besieged.");
    expect(html).toContain("If debt does not fall I sell.");
    expect(html).toContain("Debt above 2x: 2.4, line above 2 (crossed)");
    expect(html).toContain("Read the thesis first.");
    expect(html).toContain("1 stretch with nothing recorded");
  });

  it("shuts the door in calm weather and says so", () => {
    const html = render(<HearthRoom data={open({ state: "shut", state_reason: "The weather is calm.", gaps: [] })} gameMode={false} />);
    expect(html).toContain("The door is shut");
    expect(html).not.toContain("The three shelves");
  });

  it("says plainly when there is no order, no lines, and no tripwire value", () => {
    expect(render(<OrderShelf order={{ text: null, made_at: null }} />)).toContain("You have not written one.");
    expect(render(<InvalidationShelf items={[]} />)).toContain("No invalidation line is written");
    const noValue = open().invalidations.map((i) => ({ ...i, tripwires: [{ ...i.tripwires[0], current_value: null, unavailable_reason: "no data", firing: false }] }));
    expect(render(<InvalidationShelf items={noValue} />)).toContain("no value (no data)");
  });

  it("pluralises the gap note", () => {
    expect(render(<GapNote gaps={["a", "b"]} gameMode={false} />)).toContain("2 stretches with nothing recorded");
  });
});
