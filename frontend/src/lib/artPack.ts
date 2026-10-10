import { useCallback, useEffect, useState } from "react";

/** The AI-generated art pack (trial): a banner plate, a table-edge strip and a grain texture. A view
 * preference only, kept in this browser like Plain view. One switch turns every piece of it off, and
 * with it off the app is exactly what it was before the art existed.
 *
 * Ways to flip it, from quickest: the "Painted art" button in a room banner; `?art=off` or `?art=on`
 * on any URL (remembered afterwards); or `ART_PACK_DEFAULT` below for everyone with no choice stored. */

/** Whether the art shows for a browser that has never chosen. Set to false to ship the pack dark. */
export const ART_PACK_DEFAULT = true;

const KEY = "aladdin-art-pack";
const EVENT = "aladdin-art-pack-change";

/** Pure: a `?art=` value in the URL wins, then the stored choice, then the default. */
export function resolveArtPack(search: string, stored: string | null, fallback: boolean = ART_PACK_DEFAULT): boolean {
  const q = new URLSearchParams(search).get("art");
  if (q === "on") return true;
  if (q === "off") return false;
  if (stored === "on") return true;
  if (stored === "off") return false;
  return fallback;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function readArtPack(): boolean {
  if (typeof window === "undefined") return ART_PACK_DEFAULT;
  return resolveArtPack(window.location.search, readStored());
}

function applyAttribute(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.art = on ? "on" : "off";
}

function persist(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* blocked storage: the choice just isn't remembered */
  }
}

/** Called once before the first render: applies the choice to the page and remembers a `?art=` link. */
export function initArtPack(): void {
  if (typeof window === "undefined") return;
  const on = readArtPack();
  const q = new URLSearchParams(window.location.search).get("art");
  if (q === "on" || q === "off") persist(on);
  applyAttribute(on);
}

export function useArtPack(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(readArtPack);
  useEffect(() => {
    const sync = () => setOn(resolveArtPack("", readStored()));
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const set = useCallback((next: boolean) => {
    persist(next);
    applyAttribute(next);
    setOn(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}
