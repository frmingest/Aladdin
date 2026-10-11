/**
 * Stitch Master object art (Phase A, decided 2026-10-11): raster pictures of
 * objects, shown only when the viewer switches them on. Pure view preference,
 * like game mode: it never changes a fact, a score or a stored row.
 *
 *   ?art=stitch   switch on (remembered in this browser)
 *   ?art=svg      switch off (back to the hand-coded SVG, the default)
 *
 * Rules for every slot that uses a picture (docs/stitch-master-object-art-2026-10-11.md):
 * the picture must carry NO fact (no status colour, no count, no text); a slot
 * whose look encodes data stays SVG; the SVG is always the fallback.
 */

export type ArtMode = "stitch" | "svg";

export const ART_STORAGE_KEY = "aladdin-art-stitch";

export interface ObjectArt {
  src: string;
  width: number;
  height: number;
  /** Empty = decorative (the page already says it in words). */
  alt: string;
}

/** Packed by scripts/art/pack.py. Sizes are the packed WebP sizes. */
export const OBJECT_ART = {
  "booth-goods": { src: "/art/objects/booth-goods.webp", width: 455, height: 512, alt: "" },
  "sal-counter": { src: "/art/objects/sal-counter.webp", width: 467, height: 512, alt: "" },
} as const satisfies Record<string, ObjectArt>;

export type ObjectArtId = keyof typeof OBJECT_ART;

/** `?art=stitch|svg` from a query string, or null when absent or unknown. */
export function parseArtParam(search: string): ArtMode | null {
  const value = new URLSearchParams(search).get("art");
  return value === "stitch" || value === "svg" ? value : null;
}

/** URL choice wins, then the remembered choice, then SVG. */
export function resolveArtMode(search: string, stored: string | null): ArtMode {
  const fromUrl = parseArtParam(search);
  if (fromUrl) return fromUrl;
  return stored === "stitch" ? "stitch" : "svg";
}

/** Read the mode in the browser. Storage can be blocked, so every access is guarded. */
export function readArtMode(): ArtMode {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(ART_STORAGE_KEY);
  } catch {
    /* blocked storage: the choice just isn't remembered */
  }
  const mode = resolveArtMode(typeof window === "undefined" ? "" : window.location.search, stored);
  if (parseArtParam(typeof window === "undefined" ? "" : window.location.search)) {
    try {
      localStorage.setItem(ART_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }
  return mode;
}
