/**
 * Which Fortress view this browser last used (Scene, Plain or Ledger). A per-browser view
 * preference in guarded localStorage, like the theme and the game-mode switch: it never touches
 * the backend and never changes a stored value. The Plain view is also the low-power fallback:
 * a browser that asks to save data starts there when it has never chosen.
 */

export type FortressView = "scene" | "plain" | "ledger";
export const FORTRESS_VIEWS: readonly FortressView[] = ["scene", "plain", "ledger"];
export const FORTRESS_VIEW_KEY = "aladdin-fortress-view";

export const FORTRESS_VIEW_LABEL: Record<FortressView, string> = {
  scene: "Scene",
  plain: "Plain",
  ledger: "Ledger",
};

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isFortressView(v: unknown): v is FortressView {
  return typeof v === "string" && (FORTRESS_VIEWS as readonly string[]).includes(v);
}

/** The saved view, or null when nothing valid is saved or storage is blocked. Never throws. */
export function loadFortressView(storage: Pick<Storage, "getItem"> | null = safeStorage()): FortressView | null {
  try {
    const raw = storage?.getItem(FORTRESS_VIEW_KEY);
    return isFortressView(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Remember the view. Never throws. */
export function saveFortressView(view: FortressView, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(FORTRESS_VIEW_KEY, view);
  } catch {
    /* blocked or full: the view simply is not remembered */
  }
}

interface NavLike {
  connection?: { saveData?: boolean };
}
type MatchMedia = (query: string) => { matches: boolean };

/** True when the browser asks for less data (Save-Data or prefers-reduced-data): the painted
 * scene is the heaviest thing on the page, so such a browser starts on the Plain view. */
export function prefersLightView(
  nav: NavLike | undefined = typeof navigator === "undefined" ? undefined : (navigator as NavLike),
  match: MatchMedia | undefined = typeof window !== "undefined" && window.matchMedia ? window.matchMedia.bind(window) : undefined,
): boolean {
  try {
    if (nav?.connection?.saveData === true) return true;
    return match?.("(prefers-reduced-data: reduce)").matches === true;
  } catch {
    return false;
  }
}

/** The view to open on: the saved one, else Plain for a data-saving browser, else the Scene. */
export function initialFortressView(
  saved: FortressView | null = loadFortressView(),
  light: boolean = prefersLightView(),
): FortressView {
  if (saved) return saved;
  return light ? "plain" : "scene";
}
