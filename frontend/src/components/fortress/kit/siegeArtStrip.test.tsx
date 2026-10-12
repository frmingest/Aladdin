import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SiegeArtStrip from "./SiegeArtStrip";
import type { SiegeSimHolding } from "../../../lib/types";

const base = {
  ticker: "AAA.OL",
  name: "Alpha",
  structure: "keep",
  size_class: "medium",
  wall: "granite",
  weight_pct: "10",
  beta: "1",
  beta_as_of: null,
  modelled: true,
  shock_pct: "-0.30",
  loss_nok: "-30000",
  exposure: "exposed",
  stored_shock_pct: null,
  reason: null,
  method: "price_history",
  observations: 40,
  r_squared: "0.5",
  caution: null,
  value_nok: "100000",
} as const;

const rows = [
  { ...base, holding_id: "a" },
  { ...base, holding_id: "b", modelled: false, shock_pct: null, loss_nok: null, exposure: "unmodelled", reason: "No beta." },
  { ...base, holding_id: "c", wall: "unsurveyed", modelled: false, shock_pct: null, exposure: "unmodelled" },
] as unknown as SiegeSimHolding[];

describe("SiegeArtStrip", () => {
  it("renders pictures, a scorched band and a question mark for what is not modelled", () => {
    const html = renderToStaticMarkup(<SiegeArtStrip rows={rows} level="besieged" />);
    expect(html).toContain("<image");
    expect(html).toContain("clip-path");
    expect(html).toContain("?");
    expect(html).toContain('role="img"');
  });

  it("draws no camp when calm", () => {
    const calm = renderToStaticMarkup(<SiegeArtStrip rows={rows} level="calm" />);
    const besieged = renderToStaticMarkup(<SiegeArtStrip rows={rows} level="besieged" />);
    expect(besieged.split("<image").length).toBeGreaterThan(calm.split("<image").length);
  });
});
