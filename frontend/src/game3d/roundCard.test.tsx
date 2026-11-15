import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import QuestLog from "./QuestLog";
import type { Round } from "./round";

const quest = { status: "empty", total: 0, written: 0, missing: [] } as never;
const reviews = { status: "empty", due: [] } as never;
const render = (extra: Partial<Parameters<typeof QuestLog>[0]>) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <QuestLog quest={quest} reviews={reviews} demo={false} {...extra} />
    </MemoryRouter>,
  );
const stop = (o: Partial<Round["stops"][number]> = {}) => ({
  id: "smoke:h:w", kind: "smoke" as const, holdingId: "h", factId: "w", text: "Smoke at Vår Energi", offYard: false, done: false, ...o,
});
const round = (o: Partial<Round> = {}): Round => ({ stops: [stop()], more: 0, moreLine: null, open: 1, quiet: false, line: null, ...o });

describe("Today's round in the quest log", () => {
  it("shows the stops at the top, before the Guide, with no tap needed", () => {
    const html = render({ round: round(), guide: { status: { level: 0, done: {} as never, current: "meet" }, saved: { met: [], taken: [], salVisited: false, weatherVisited: false, baseline: null }, onReplay: () => {} } });
    expect(html).toContain("Smoke at Vår Energi");
    expect(html.indexOf("Today&#x27;s round")).toBeLessThan(html.indexOf("First Steps"));
  });
  it("a ticked stop says done in words too, and an off-yard stop says it has no room", () => {
    const html = render({ round: round({ stops: [stop({ done: true, offYard: true })], open: 0 }) });
    expect(html).toContain("(done)");
    expect(html).toContain("No room");
  });
  it("each stop has a hidden kind glyph, and unticked stops say 'to do' for screen readers", () => {
    const html = render({ round: round({ stops: [stop({ kind: "raven" }), stop({ id: "b", kind: "bell" }), stop({ id: "d", done: true })], open: 2 }) });
    expect(html).toContain('data-glyph="raven"');
    expect(html).toContain('data-glyph="bell"');
    expect(html).toContain("(to do)");
    expect(html).toContain("(done)");
  });
  it("is a heading and announces the open count politely", () => {
    const html = render({ round: round({ open: 2 }) });
    expect(html).toMatch(/<h3[^>]*>Today&#x27;s round/);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("2 stops to do");
  });
  it("shows the more line and the source line", () => {
    const html = render({ round: round({ moreLine: "and 3 more", line: "The watch did not report in" }) });
    expect(html).toContain("and 3 more");
    expect(html).toContain("The watch did not report in");
    expect(html).not.toMatch(/All quiet/);
  });
  it("shows no round in the sample fortress, even if one is passed", () => {
    expect(render({ demo: true, round: round() })).not.toContain("Smoke at Vår Energi");
    expect(render({ demo: true, round: round() })).not.toContain("Today&#x27;s round");
  });
  it("shows no block when no round is passed", () => {
    expect(render({})).not.toContain("Today&#x27;s round");
  });
});
