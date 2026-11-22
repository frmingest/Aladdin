import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PANELS, PANEL_KEYS, loadPanels, savePanels, togglePanel } from "./hudPanels";
import Toolbar from "./Toolbar";
import { autoOpenQuests } from "./hudPanels";
import { roundChipCount } from "./round";
import { KEY_ACTIONS } from "./movement";
import { guideChipLabel } from "./guideWordsV2";

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

  it("the signpost key never clashes with walking, talking, stats or the panel keys", () => {
    expect(KEY_ACTIONS["KeyG"]).toBeUndefined();
    expect(["KeyE", "KeyP", "F3", ...Object.keys(PANEL_KEYS)]).not.toContain("KeyG");
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
      <Toolbar open={DEFAULT_PANELS} onToggle={() => {}} questsWaiting={2} towerCount={7} statsOn={false} statsLabel="" onToggleStats={() => {}} whereOpen={false} onToggleWhere={() => {}} {...o} />,
    );

  it("is a labelled toolbar with a button per panel, and badges that say something is waiting", () => {
    const h = html();
    expect(h).toContain('role="toolbar"');
    expect(h).toContain("Quests");
    expect(h).toContain("Towers");
    expect(h).toContain("Where to?");
    expect(h).toContain(">2<");
    expect(h).toContain(">7<");
  });

  it("shows a Sound button only when the browser can play sound, and says whether it is on", () => {
    expect(html()).not.toContain("Sound");
    expect(html({ sound: { on: false, onToggle: () => {} } })).toContain("Sound off");
    const on = html({ sound: { on: true, onToggle: () => {} } });
    expect(on).toContain("Sound on");
    expect(on).toContain('aria-pressed="true"');
  });

  it("keeps the frame-rate button out of the player's toolbar unless it is asked for (?debug), but never hides it while on", () => {
    expect(html()).toContain("Stats");
    expect(html({ showStats: false })).not.toContain("Stats");
    expect(html({ showStats: false, statsOn: true, statsLabel: "60 fps" })).toContain("60 fps");
  });

  it("marks open panels as pressed and hides a zero badge", () => {
    const h = html({ open: { quests: true, towers: false }, questsWaiting: 0 });
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(h).not.toContain(">0<");
  });
});

describe("the round on the Quests chip", () => {
  const html = (o: Partial<Parameters<typeof Toolbar>[0]> = {}) =>
    renderToStaticMarkup(
      <Toolbar open={DEFAULT_PANELS} onToggle={() => {}} questsWaiting={0} towerCount={7} statsOn={false} statsLabel="" onToggleStats={() => {}} whereOpen={false} onToggleWhere={() => {}} {...o} />,
    );
  it("shows the open count with an accessible name", () => {
    const h = html({ roundOpen: 5 });
    expect(h).toContain(">5<");
    expect(h).toContain('aria-label="Quests, 5 stops open"');
  });
  it("shows nothing for the round when none are open", () => {
    const h = html({ roundOpen: 0 });
    expect(h).not.toContain("stops open");
    expect(h).not.toContain("g3d-badge\">0");
  });
  it("the count is zero while a source is pending, with no round, and when all are done", () => {
    expect(roundChipCount({ open: 5, pending: true })).toBe(0);
    expect(roundChipCount(undefined)).toBe(0);
    expect(roundChipCount({ open: 0, pending: false })).toBe(0);
    expect(roundChipCount({ open: 5, pending: false })).toBe(5);
  });
  it("while First Steps is open the chip counts its steps, over the round (#478)", () => {
    const h = html({ roundOpen: 5, questsWaiting: 2, guideLeft: 4, guideLabel: guideChipLabel(4) });
    expect(h).toContain(">4<");
    expect(h).not.toContain(">5<");
    expect(h).toContain('aria-label="Quests, 4 first steps to go"');
    expect(guideChipLabel(1)).toBe("Quests, 1 first step to go");
  });
  it("with First Steps done the chip goes back to the round", () => {
    const h = html({ roundOpen: 5, guideLeft: 0, guideLabel: guideChipLabel(0) });
    expect(h).toContain('aria-label="Quests, 5 stops open"');
  });
});

describe("auto-open of the sample round", () => {
  it("opens Quests once in the sample fortress, never twice, never for the real one", () => {
    expect(autoOpenQuests(DEFAULT_PANELS, true, false)).toEqual({ quests: true, towers: false });
    expect(autoOpenQuests(DEFAULT_PANELS, true, true)).toBeNull();
    expect(autoOpenQuests(DEFAULT_PANELS, false, false)).toBeNull();
    expect(autoOpenQuests({ quests: true, towers: false }, true, false)).toBeNull();
  });
});
