import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Chronicle } from "../../../lib/types";
import TimeStrata from "./TimeStrata";

const chronicle: Chronicle = {
  rules_version: "chronicle-test",
  demo: false,
  frames: [],
  changes: [
    { day: "2026-10-01", kind: "tower_added", holding_id: "h1", holding_name: "Alpha", text: "Alpha joined the realm" },
    { day: "2026-10-05", kind: "tower_added", holding_id: null, holding_name: null, text: "A second change" },
  ],
  stored_frames: 0,
  positions_only_frames: 0,
  first_stored_day: null,
  hidden_frames: 0,
  gaps: [{ first_day: "2026-10-02", last_day: "2026-10-04", days: 3, text: "No frame was stored for 3 days." }],
  notes: [],
};

describe("TimeStrata with Object art off (the default)", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <TimeStrata chronicle={chronicle} />
    </MemoryRouter>,
  );

  it("draws the lozenge marks and no picture, so the spine is exactly what it was", () => {
    expect(html).not.toContain("<img");
    // two changes and one gap, each with its own mark
    expect(html.match(/class="strata-mark"/g)?.length).toBe(3);
  });

  it("keeps the gap as a gap: its own words, never a quiet day", () => {
    expect(html).toContain("strata-node-gap");
    expect(html).toContain("No frame was stored for 3 days.");
  });
});
