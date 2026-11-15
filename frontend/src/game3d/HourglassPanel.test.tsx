import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SPOTS } from "./near";
import HourglassBanner from "./HourglassBanner";
import HourglassPanel from "./HourglassPanel";
import type { HistoryStatus } from "./HourglassPanel";
import { buildTimeline, openInThePast } from "./hourglassPlan";

const noop = () => {};
const timeline = buildTimeline(["2026-11-11", "2026-11-13"], "2026-11-15");

function html(o: Partial<React.ComponentProps<typeof HourglassPanel>> = {}) {
  return renderToStaticMarkup(
    <HourglassPanel
      status={"ready" as HistoryStatus}
      demo={false}
      timeline={timeline}
      day={null}
      dayStatus={null}
      turning={false}
      playing={false}
      onPick={noop}
      onEarlier={noop}
      onLater={noop}
      onPlayToggle={noop}
      onToday={noop}
      onRetry={noop}
      onClose={noop}
      {...o}
    />,
  );
}

describe("HourglassPanel", () => {
  it("shows today, the controls, and a record-not-forecast line", () => {
    const h = html();
    expect(h).toContain("The Hourglass");
    expect(h).toContain(">Today<");
    expect(h).toContain(">Earlier<");
    expect(h).toContain(">Play<");
    expect(h).toContain("Never a forecast");
    expect(h).toContain('aria-label="Close"');
  });

  it("shows a gap as an empty outline with its date and says so, never as a kept night", () => {
    const h = html({ day: "2026-11-12", dayStatus: "gap" });
    expect(h).toContain("Thu 12 Nov 2026");
    expect(h).toContain("No picture was kept this day.");
    expect(h).toContain('aria-label="Thu 12 Nov 2026, no picture kept"');
    expect(h).toContain("bg-transparent");
    // The timeline runs to yesterday, so the 14th (nothing stored) is a gap too.
    expect(h).toContain("2 nights kept, 2 with no picture");
  });

  it("says the hourglass is still filling when nothing before today was stored", () => {
    const h = html({ timeline: [] });
    expect(h).toContain("still filling");
    expect(h).not.toContain(">Play<");
  });

  it("says the sample fortress keeps no history", () => {
    expect(html({ demo: true, timeline: [] })).toContain("The sample fortress keeps no history.");
  });

  it("says when the history cannot be read, with a way to try again", () => {
    const h = html({ status: "failed", timeline: [] });
    expect(h).toContain("could not be read");
    expect(h).toContain("Try again");
  });

  it("offers Pause while it plays, and turns Earlier off on the oldest night", () => {
    expect(html({ playing: true, day: "2026-11-12", dayStatus: "gap" })).toContain(">Pause<");
    expect(html({ day: "2026-11-11", dayStatus: "frame" })).toMatch(/disabled=""[^>]*>Earlier</);
  });

  it("says one night, not one nights", () => {
    expect(html({ timeline: buildTimeline(["2026-11-14"], "2026-11-15") })).toContain("1 night kept.");
  });

  it("has no buy or sell wording", () => {
    expect(html({ day: "2026-11-12", dayStatus: "gap" }).toLowerCase()).not.toMatch(/\b(buy|sell|should)\b/);
  });
});

describe("HourglassBanner", () => {
  it("always carries the date, that nothing can be written, and the key home", () => {
    const h = renderToStaticMarkup(<HourglassBanner day="2026-11-03" status="frame" onToday={noop} />);
    expect(h).toContain("Tue 3 Nov 2026");
    expect(h).toContain("Nothing can be written");
    expect(h).toContain("Back to today (H)");
  });
  it("says so when the day has no picture or could not be read", () => {
    expect(renderToStaticMarkup(<HourglassBanner day="2026-11-12" status="gap" onToday={noop} />)).toContain("No picture was kept");
    expect(renderToStaticMarkup(<HourglassBanner day="2026-11-12" status="failed" onToday={noop} />)).toContain("could not be read");
  });
});

describe("what is shut while you look back", () => {
  it("leaves every place that writes shut: only the hourglass and the Realm post stay open", () => {
    const open = [...new Set(SPOTS.map((s) => s.kind))].filter(openInThePast).sort();
    expect(open).toEqual(["hourglass", "realm"]);
  });
});
