import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PANELS, PANEL_KEYS, loadPanels, savePanels, togglePanel } from "./hudPanels";
import Toolbar from "./Toolbar";
import { KEY_ACTIONS } from "./movement";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("courtyard panels", () => {
  it("start shut, so the scene is not covered", () => {
    expect(loadPanels(memory())).toEqual({ quests: false, towers: false });
    expect(DEFAULT_PANELS).toEqual({ quests: false, towers: false });
  });

  it("toggle one panel at a time and remember it", () => {
    const store = memory();
    const open = togglePanel(DEFAULT_PANELS, "quests");
    expect(open).toEqual({ quests: true, towers: false });
    savePanels(open, store);
    expect(loadPanels(store)).toEqual(open);
    expect(togglePanel(open, "quests")).toEqual(DEFAULT_PANELS);
  });

  it("works with no storage, or storage that throws or holds junk", () => {
    expect(loadPanels(null)).toEqual(DEFAULT_PANELS);
    expect(() => savePanels(DEFAULT_PANELS, null)).not.toThrow();
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadPanels(broken)).toEqual(DEFAULT_PANELS);
    expect(() => savePanels(DEFAULT_PANELS, broken)).not.toThrow();
    expect(loadPanels({ getItem: () => "not json", setItem: () => {} })).toEqual(DEFAULT_PANELS);
  });

  it("panel keys never clash with walking, talking or stats", () => {
    for (const code of Object.keys(PANEL_KEYS)) {
      expect(KEY_ACTIONS[code]).toBeUndefined();
      expect(["KeyE", "KeyP", "F3"]).not.toContain(code);
    }
  });
});

describe("Toolbar", () => {
  const html = (o: Partial<Parameters<typeof Toolbar>[0]> = {}) =>
    renderToStaticMarkup(
      <Toolbar open={DEFAULT_PANELS} onToggle={() => {}} questsWaiting={2} towerCount={7} statsOn={false} statsLabel="" onToggleStats={() => {}} {...o} />,
    );

  it("is a labelled toolbar with a button per panel, and badges that say something is waiting", () => {
    const h = html();
    expect(h).toContain('role="toolbar"');
    expect(h).toContain("Quests");
    expect(h).toContain("Towers");
    expect(h).toContain(">2<");
    expect(h).toContain(">7<");
  });

  it("marks open panels as pressed and hides a zero badge", () => {
    const h = html({ open: { quests: true, towers: false }, questsWaiting: 0 });
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(h).not.toContain(">0<");
  });
});
