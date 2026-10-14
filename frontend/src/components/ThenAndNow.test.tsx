import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ThenAndNow as ThenAndNowData } from "../lib/types";
import ThenAndNow, { ThenAndNowView } from "./ThenAndNow";

const stamp = (iso: string) => ({ run_id: "r", analyzed_at: iso, model_name: null });

const compared: ThenAndNowData = {
  version: "then-and-now-v1",
  status: "compared",
  then: stamp("2026-01-10T00:00:00Z"),
  now: stamp("2026-03-01T00:00:00Z"),
  unchanged_count: 3,
  note: null,
  changes: [
    { key: "verdict", label: "Verdict", kind: "value", then_value: "Buy", now_value: "Hold", then_items: [], now_items: [] },
    {
      key: "top_risks", label: "Top risks", kind: "list", then_value: null, now_value: null,
      then_items: ["Oil price falls"], now_items: ["Capex overrun", "Oil price falls"],
    },
  ],
};

describe("ThenAndNowView", () => {
  it("shows only the changed lines, both sides, and counts the rest", () => {
    const html = renderToStaticMarkup(<ThenAndNowView data={compared} />);
    expect(html).toContain("Verdict");
    expect(html).toContain("Buy");
    expect(html).toContain("Hold");
    expect(html).toContain("Capex overrun");
    expect(html).toContain("3 other lines say the same as then");
    expect(html).not.toContain("Moat");
  });

  it("says the lists are worded differently and never judges a change", () => {
    const html = renderToStaticMarkup(<ThenAndNowView data={compared} />);
    expect(html).toContain("read the two lists side by side");
    for (const word of ["better", "worse", "improved", "declined", "▲", "▼", "↑", "↓"]) {
      expect(html).not.toContain(word);
    }
  });

  it("states that the comparison is the view before the analyst saw your notes", () => {
    expect(renderToStaticMarkup(<ThenAndNowView data={compared} />)).toContain("before it saw your notes");
  });

  it("shows the note, not an empty comparison, for every other status", () => {
    for (const status of ["same_run", "no_analysis_then", "no_analysis_now", "no_holding", "demo"] as const) {
      const html = renderToStaticMarkup(
        <ThenAndNowView data={{ ...compared, status, changes: [], note: `note for ${status}` }} />,
      );
      expect(html).toContain(`note for ${status}`);
      expect(html).not.toContain("Verdict");
    }
  });

  it("says plainly when nothing changed", () => {
    const html = renderToStaticMarkup(
      <ThenAndNowView data={{ ...compared, changes: [], note: "Nothing the analysis says has changed since you decided." }} />,
    );
    expect(html).toContain("Nothing the analysis says has changed");
  });
});

describe("ThenAndNow", () => {
  it("starts closed and fetches nothing until opened", () => {
    const html = renderToStaticMarkup(<ThenAndNow entryId="e1" />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Then and now");
    expect(html).toContain("hidden");
  });
});
