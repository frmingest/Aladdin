import { describe, expect, it } from "vitest";
import { STATUS_CLASS, STATUS_LABEL, TONE_CLASS, hoursText, stampLine } from "./nightWatch";
import type { NightWatch } from "./types";

const watch = (over: Partial<NightWatch> = {}): NightWatch => ({
  rules_version: "v1", demo: false, as_of: "2026-10-04T08:00:00Z", status: "quiet", headline: "A quiet night: nothing is firing.",
  watch_state: "ok", watch_last_at: null, watch_age_hours: 5, watch_summary: null, tripwires_firing: 0, fired_overnight: [],
  snapshots_last_at: null, snapshots_summary: null, frames_stored: 2, last_frame_day: "2026-10-04", ravens_landed: 0,
  changes_since_last_frame: [], lines: [], ...over,
});

describe("night watch wording", () => {
  it("reads ages in plain hours and days", () => {
    expect(hoursText(null)).toBe("never");
    expect(hoursText(0)).toBe("under an hour ago");
    expect(hoursText(1)).toBe("1 hour ago");
    expect(hoursText(47)).toBe("47 hours ago");
    expect(hoursText(72)).toBe("3 days ago");
  });

  it("states the watch age and the frames stored", () => {
    expect(stampLine(watch())).toBe("Watch: 5 hours ago · 2 frames stored");
    expect(stampLine(watch({ watch_age_hours: null, frames_stored: 0 }))).toBe("Watch: never");
    expect(stampLine(watch({ frames_stored: 1 }))).toContain("1 frame stored");
  });

  it("never colours an unknown watch as quiet", () => {
    expect(STATUS_LABEL.unknown).not.toMatch(/quiet/i);
    expect(STATUS_CLASS.unknown).not.toContain("positive");
    expect(STATUS_CLASS.quiet).toContain("positive");
    expect(TONE_CLASS.warning).toContain("negative");
  });

  it("uses no advice wording", () => {
    const text = Object.values(STATUS_LABEL).join(" ");
    expect(text).not.toMatch(/\b(buy|sell|add|trim|invest|purchase)\b/i);
  });
});
