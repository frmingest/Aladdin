import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { KEY_ACTIONS, NO_KEYS } from "./movement";
import type { Keys } from "./movement";

/**
 * True while the player is typing in a form field (quest answers, the desk, search), so game hotkeys
 * (Q, T, P, E and the movement keys) must stand down and let the letters through.
 */
export function typingInField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/** What a key event needs to carry for movement: its code and whether a shortcut modifier is down. */
export interface KeyLike {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * Apply one key event to the held keys. A key going UP always lets go, wherever focus is: if the letter
 * was pressed on the game and released in a text field (a search box opened while walking), ignoring the
 * release left the hero walking sideways for good. A key going DOWN only counts outside fields and
 * without a shortcut modifier (Ctrl+D, Alt+A and the like are the browser's, and swallow the release).
 */
export function applyKey(keys: Keys, e: KeyLike, down: boolean, typing: boolean): boolean {
  const action = KEY_ACTIONS[e.code];
  if (!action) return false;
  if (down) {
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return false;
    keys[action] = true;
  } else {
    keys[action] = false;
  }
  return true;
}

/** Held movement keys as a ref (read it every frame; changing it never re-renders). */
export function useKeys(): MutableRefObject<Keys> {
  const keys = useRef<Keys>({ ...NO_KEYS });

  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      if (!applyKey(keys.current, e, down, typingInField(e.target))) return;
      // Space and the arrows would otherwise scroll the page behind the game (never inside a field).
      if ((e.code === "Space" || e.code.startsWith("Arrow")) && !typingInField(e.target)) e.preventDefault();
    };
    const onDown = (e: KeyboardEvent) => set(e, true);
    const onUp = (e: KeyboardEvent) => set(e, false);
    // Losing focus, the mouse being captured or freed, or the tab hiding must not leave a key "stuck" down.
    // A key that is still held repeats its keydown, so it simply starts again.
    const release = () => {
      keys.current = { ...NO_KEYS };
    };
    const onVisibility = () => {
      if (document.hidden) release();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    window.addEventListener("contextmenu", release);
    document.addEventListener("pointerlockchange", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
      window.removeEventListener("contextmenu", release);
      document.removeEventListener("pointerlockchange", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return keys;
}
