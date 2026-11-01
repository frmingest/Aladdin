import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { doors } from "./parity3d";
import Toolbar from "./Toolbar";
import { DEFAULT_PANELS } from "./hudPanels";
import WorldMenu from "./WorldMenu";
import WorldPanel from "./WorldPanel";

describe("Where to? menu", () => {
  it("has a button for every door of the register", () => {
    const h = renderToStaticMarkup(<WorldMenu onPick={() => {}} onClose={() => {}} />);
    expect(h).toContain("Where to?");
    expect((h.match(/g3d-btn/g) ?? []).length).toBe(doors().length);
    for (const d of doors()) expect(h).toContain(d.title);
  });

  it("opens a page in a frame with the embed flag, and links to the flat page", () => {
    const door = doors().find((d) => d.route === "/journal")!;
    const h = renderToStaticMarkup(<WorldPanel door={door} onBack={() => {}} onClose={() => {}} />);
    expect(h).toContain('src="/journal?embed=world"');
    expect(h).toContain('href="/journal"');
    expect(h).toContain("Open the flat page");
  });

  it("the toolbar shows the button only when a handler is given", () => {
    const base = { open: DEFAULT_PANELS, onToggle: () => {}, questsWaiting: 0, towerCount: 0, statsOn: false, statsLabel: "", onToggleStats: () => {} };
    expect(renderToStaticMarkup(<Toolbar {...base} />)).not.toContain("Where to?");
    expect(renderToStaticMarkup(<Toolbar {...base} onWhere={() => {}} />)).toContain("Where to?");
  });
});
