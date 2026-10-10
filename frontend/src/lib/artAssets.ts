import type { CrestKind } from "./crest";

/** Which painted pieces of the art pack a game room uses (see lib/artPack.ts for the switch). Pure so
 * it is tested. Only art that states no fact is mapped here: a scene with seated figures, a tent
 * count or fog patches baked in would misstate the survey, so those stay in public/art/library. */

/** A room's banner scene, or null for the shared plate. Council uses the chandelier-and-archway
 * strip only (the full painting has three seated figures: it would claim three advisers). */
export function bannerArtFor(kind: CrestKind): { url: string; position: string } | null {
  switch (kind) {
    case "council":
      return { url: "/art/banner-council.webp", position: "center 30%" };
    case "records":
    case "chronicle":
      return { url: "/art/banner-study.webp", position: "center 35%" };
    default:
      return null;
  }
}

/** The tab-strip emblem for a Fortress route, or null when there is none. */
export function emblemForPath(to: string): string | null {
  const last = to.split("/").filter(Boolean).pop() ?? "";
  const name = last === "fortress" ? "fortress" : last;
  return EMBLEMS.has(name) ? `/art/emblem-${name}.webp` : null;
}

const EMBLEMS = new Set(["fortress", "marketplace", "siege", "chronicle", "council", "records", "circle", "map"]);

export const PORTRAIT_URL = { oracle: "/art/portrait-oracle.webp", partner: "/art/portrait-partner.webp" } as const;
export const FRAME_CORNER_URL = "/art/frame-corner.webp";
