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

/** Held movement keys as a ref (read it every frame; changing it never re-renders). */
export function useKeys(): MutableRefObject<Keys> {
  const keys = useRef<Keys>({ ...NO_KEYS });

  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const action = KEY_ACTIONS[e.code];
      if (!action || typingInField(e.target)) return;
      keys.current[action] = down;
      // Space and the arrows would otherwise scroll the page behind the game.
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    };
    const onDown = (e: KeyboardEvent) => set(e, true);
    const onUp = (e: KeyboardEvent) => set(e, false);
    // Losing focus must not leave a key "stuck" down.
    const release = () => {
      keys.current = { ...NO_KEYS };
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, []);

  return keys;
}
