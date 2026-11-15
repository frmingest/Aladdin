/**
 * Which courtyard panels are open (3D courtyard HUD). Pure helpers, no React.
 * The panels start shut so the scene is all you see; what you open is remembered
 * in this browser only. Storage can be missing or throw (private windows), so every
 * read and write is guarded and the page works without it.
 */

export type PanelId = "quests" | "towers";
export type OpenPanels = Record<PanelId, boolean>;

export const DEFAULT_PANELS: OpenPanels = { quests: false, towers: false };

/** Keys that flip a panel. Not movement keys (W A S D, arrows, Shift, Space), E (talk) or P (stats). */
export const PANEL_KEYS: Record<string, PanelId> = { KeyQ: "quests", KeyT: "towers" };

const STORAGE_KEY = "aladdin.game3d.panels.v1";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPanels(store: Store | null = browserStore()): OpenPanels {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PANELS };
    const o = JSON.parse(raw) as Partial<Record<PanelId, unknown>>;
    return { quests: o.quests === true, towers: o.towers === true };
  } catch {
    return { ...DEFAULT_PANELS };
  }
}

export function savePanels(open: OpenPanels, store: Store | null = browserStore()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(open));
  } catch {
    /* nothing to do: the panels still work, they are just not remembered */
  }
}

/**
 * The sample fortress opens the Quests panel once per page load, so the made-up round is on screen with no tap. The real
 * fortress never auto-opens. Returns the panels to set, or null to leave them. In memory only: nothing is stored for it.
 */
export function autoOpenQuests(open: OpenPanels, sample: boolean, alreadyDone: boolean): OpenPanels | null {
  if (!sample || alreadyDone) return null;
  return open.quests ? null : { ...open, quests: true };
}

export function togglePanel(open: OpenPanels, id: PanelId): OpenPanels {
  return { ...open, [id]: !open[id] };
}
