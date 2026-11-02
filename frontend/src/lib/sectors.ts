import type { ObjectArtId } from "./stitchArt";
import type { FortressStructure } from "./types";
import { hashString } from "./worldMap";

/**
 * One sector table (S24, 2026-11-02). Before this the flat Map pictures (`mapArt.ts`) and the dive scenes
 * (`mapScenes.ts`) each kept their own keyword list and could disagree about the same sector. Now each sector
 * keyword set lives here once, with the Map pictures it may show, the dive scene it opens, and (derived from
 * the picture) the theme the 3D holding area will wear. Where the old lists clashed, the Map pictures won.
 *
 * Pure choice, no React. A sector decides the look only: never the survey, the weight or a verdict, so it
 * carries no fact and an unknown sector stays plain.
 */

export type SceneId = "mines" | "forge" | "mill" | "farm" | "exchange" | "clinic" | "workshop" | "bank" | "tech";

export type Theme3dId = "mine" | "quarry" | "ingots" | "farm" | "stall" | "bank" | "factory" | "windmill" | "watermill" | "fountain" | "plain";

export interface SectorRow {
  /** Matched loosely, case-insensitive: the sector comes from the user's own data. */
  match: RegExp;
  /** Map pictures for the sector, most telling first. Empty: the Map shows the structure picture. */
  mapArt: readonly ObjectArtId[];
  /** The scene the dive opens onto. */
  diveScene: SceneId;
}

/** First match wins. Rows with no Map picture keep their own dive scene (health, tech, defence...). */
export const SECTOR_ROWS: readonly SectorRow[] = [
  { match: /diversif|fund|etf/i, mapArt: ["map-fountain-square"], diveScene: "exchange" },
  { match: /energy|oil|petrol|gas\b/i, mapArt: ["map-windmill", "map-watermill"], diveScene: "mill" },
  { match: /utilit|power|electric/i, mapArt: ["map-watermill", "map-windmill"], diveScene: "mill" },
  { match: /renewable|solar|wind|hydro|water/i, mapArt: [], diveScene: "mill" },
  { match: /financ|bank|insur/i, mapArt: ["map-bank-vault"], diveScene: "bank" },
  { match: /industr|manufactur|transport/i, mapArt: ["map-factory"], diveScene: "forge" },
  { match: /defen[cs]e|aerospace|weapon|arms\b|military|machin/i, mapArt: [], diveScene: "forge" },
  { match: /staple|food|agri|beverage/i, mapArt: ["map-farmhouse", "map-market-stall"], diveScene: "farm" },
  { match: /farm|grain/i, mapArt: [], diveScene: "farm" },
  { match: /discretionary|retail|consumer/i, mapArt: ["map-market-stall"], diveScene: "exchange" },
  { match: /cyclical|leisure|apparel|luxury|automobile|\bautos?\b|homebuild|furnitur|hotel|restaurant/i, mapArt: [], diveScene: "workshop" },
  { match: /material|mining|metal|gold|commodit/i, mapArt: ["map-gold-mine", "map-quarry", "map-gold-ingots"], diveScene: "mines" },
  { match: /silver|copper|platinum|palladium|bullion|miners?\b|quarr/i, mapArt: [], diveScene: "mines" },
  { match: /health|pharma|medic|biotech|hospital|drug|life science/i, mapArt: [], diveScene: "clinic" },
  { match: /information|technolog|software|semiconduct|hardware|internet|communicat|telecom|\bit\b/i, mapArt: [], diveScene: "tech" },
  { match: /exchange|broker/i, mapArt: [], diveScene: "exchange" },
];

/** The row for a sector name, or null when the sector is empty or matches nothing. */
export function sectorRow(sector: string | null | undefined): SectorRow | null {
  const s = sector?.trim();
  if (!s) return null;
  return SECTOR_ROWS.find((r) => r.match.test(s)) ?? null;
}

/** Gold bars are for a holding that is gold itself (the bullion structure). */
const BULLION_ART: ObjectArtId = "map-gold-ingots";

/** The 3D theme each Map picture stands for. */
const THEME_OF_ART: Partial<Record<ObjectArtId, Theme3dId>> = {
  "map-gold-mine": "mine",
  "map-quarry": "quarry",
  "map-gold-ingots": "ingots",
  "map-farmhouse": "farm",
  "map-market-stall": "stall",
  "map-bank-vault": "bank",
  "map-factory": "factory",
  "map-windmill": "windmill",
  "map-watermill": "watermill",
  "map-fountain-square": "fountain",
};

export function theme3dOfArt(art: ObjectArtId | null): Theme3dId {
  return (art && THEME_OF_ART[art]) || "plain";
}

/**
 * The Map picture for a holding in a sector, or null when the sector has no picture. Gold (bullion) gets the
 * bars where the sector offers them; every other holding takes one of the rest by a stable hash of its id, so
 * it never changes when the weights do.
 */
export function pickSectorArt(sector: string | null | undefined, holdingId: string, structure?: FortressStructure): ObjectArtId | null {
  const ids = sectorRow(sector)?.mapArt ?? [];
  if (ids.length === 0) return null;
  if (structure === "bullion" && ids.includes(BULLION_ART)) return BULLION_ART;
  const pool = ids.filter((id) => id !== BULLION_ART);
  const from = pool.length > 0 ? pool : ids;
  return from[hashString(holdingId) % from.length]!;
}

/** The theme for the 3D holding area. Always the one the flat Map picture shows for the same holding. */
export function holdingTheme3d(sector: string | null | undefined, holdingId: string, structure?: FortressStructure): Theme3dId {
  return theme3dOfArt(pickSectorArt(sector, holdingId, structure));
}
