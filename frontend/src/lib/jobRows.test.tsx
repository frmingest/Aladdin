import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JobItem } from "./types";
import { JobRows } from "../pages/SystemStatusPage";

const job = (over: Partial<JobItem>): JobItem => ({
  key: "tripwire_check",
  label: "Tripwire check",
  runs_on: "PC worker",
  schedule: "daily after 03:00 UTC, when the queue is idle",
  last_at: null,
  status: "ok",
  detail: "",
  ...over,
});

describe("Background jobs card on System status", () => {
  it("shows where a job runs, its schedule and when it last ran", () => {
    const html = renderToStaticMarkup(
      <JobRows items={[job({ last_at: new Date(Date.now() - 3 * 3600_000).toISOString(), detail: "0 newly fired" })]} />,
    );
    expect(html).toContain("Tripwire check");
    expect(html).toContain("Last ran 3 h ago");
    expect(html).toContain("PC worker");
    expect(html).toContain("daily after 03:00 UTC");
    expect(html).toContain("0 newly fired");
  });

  it("says Never ran and flags an overdue job as Check", () => {
    const html = renderToStaticMarkup(
      <JobRows items={[job({ status: "warn", detail: "Overdue. The PC worker is offline." })]} />,
    );
    expect(html).toContain("Never ran");
    expect(html).toContain("Check");
    expect(html).toContain("Overdue. The PC worker is offline.");
  });

  it("marks a switched-off job as Off", () => {
    const html = renderToStaticMarkup(<JobRows items={[job({ status: "off", detail: "Switched off in settings." })]} />);
    expect(html).toContain("Off");
  });
});
