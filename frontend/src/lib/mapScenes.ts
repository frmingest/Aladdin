import minesUrl from "../assets/map/scenes/mines.webp";
import forgeUrl from "../assets/map/scenes/forge.webp";
import millUrl from "../assets/map/scenes/mill.webp";
import farmUrl from "../assets/map/scenes/farm.webp";
import exchangeUrl from "../assets/map/scenes/exchange.webp";
import { clampView, MAX_ZOOM, type Pt, type View } from "./worldMap";

/**
 * Scene dive (Cartographer's map): press a settlement and the camera flies into it while a round window
 * opens onto a full painted scene of what that holding does for a living (mines, forge, mill, farm,
 * exchange). Pure choice and arithmetic only, no React.
 *
 * Truth rules: a scene is chosen from the holding's sector, name and structure alone, never from the
 * survey, the weight or a verdict, and it carries no fact (no figure, no status colour). A holding whose
 * sector has no scene of its own gets the Exchange, the general market picture, so nothing is left blank.
 * Names come from the user's own data, so matching is loose and case-insensitive.
 */

export type SceneId = "mines" | "forge" | "mill" | "farm" | "exchange";

export interface SceneArt {
  id: SceneId;
  src: string;
  /** Said once, short, as the player's place: "Deep in the Mines". */
  kicker: string;
  /** The picture's own size, for aspect and decoding. */
  width: number;
  height: number;
}

export const SCENES: Record<SceneId, SceneArt> = {
  mines: { id: "mines", src: minesUrl, kicker: "Deep in the mines", width: 1280, height: 714 },
  forge: { id: "forge", src: forgeUrl, kicker: "At the forge", width: 1280, height: 714 },
  mill: { id: "mill", src: millUrl, kicker: "By the mill", width: 1280, height: 714 },
  farm: { id: "farm", src: farmUrl, kicker: "Out on the farm", width: 1280, height: 714 },
  exchange: { id: "exchange", src: exchangeUrl, kicker: "On the exchange floor", width: 1280, height: 714 },
};

export const SCENE_IDS = Object.keys(SCENES) as SceneId[];

// Metals first (a gold fund or miner can sit in any sector), then sectors. First match wins.
const MINES_SECTOR = /gold|silver|copper|platinum|palladium|bullion|mining|miners?\b|metal|material|commodit|quarr/i;
/** A holding's own name only counts when it says the metal or the trade outright ("Gold ETC", "Gold Miners ETF"). */
const MINES_NAME = /\b(gold|silver|copper|platinum|palladium|bullion|mining|miners?|metals)\b/i;
const SECTOR_SCENES: readonly { match: RegExp; id: SceneId }[] = [
  { match: /defen[cs]e|aerospace|weapon|arms\b|military|industr|manufactur|machin|transport/i, id: "forge" },
  { match: /energy|oil|petrol|gas\b|utilit|power|electric|renewable|solar|wind|hydro|water/i, id: "mill" },
  { match: /staple|food|agri|beverage|farm|grain/i, id: "farm" },
  { match: /financ|bank|insur|diversif|fund|etf|exchange|broker/i, id: "exchange" },
];

export interface SceneInput {
  sector?: string | null;
  name?: string | null;
  /** The holding's structure when known; bullion is gold itself. */
  structure?: string | null;
}

/** The scene for a holding. Always one of the five. */
export function sceneFor({ sector, name, structure }: SceneInput): SceneId {
  const sec = sector?.trim() ?? "";
  if (structure === "bullion" || MINES_SECTOR.test(sec) || MINES_NAME.test(name ?? "")) return "mines";
  return SECTOR_SCENES.find((s) => s.match.test(sec))?.id ?? "exchange";
}

// --- The camera dive -------------------------------------------------------------------------------------

/** How far the camera goes in; the map's own zoom ceiling still applies. */
export const DIVE_ZOOM = 3.4;
/** Camera flight, iris opening and the way back, in ms. The iris starts while the camera is still falling in. */
export const DIVE_MS = { fly: 900, irisAt: 480, iris: 760, out: 560 } as const;

/** Where the camera ends up: centred on the settlement, in close, inside the map's bounds. */
export function diveView(from: View, at: Pt, cw: number, ch: number, bounds?: { x: number; y: number; w: number; h: number }): View {
  return clampView({ cx: at.x, cy: at.y, z: Math.min(MAX_ZOOM, Math.max(from.z, DIVE_ZOOM)) }, cw, ch, bounds);
}

/** Radius that reaches the farthest corner of a box from a point inside it: the iris's final size. */
export function irisRadius(origin: Pt, cw: number, ch: number): number {
  const dx = Math.max(origin.x, cw - origin.x);
  const dy = Math.max(origin.y, ch - origin.y);
  return Math.ceil(Math.hypot(dx, dy)) + 2;
}

/** The point the iris opens from, kept inside the box so a settlement at the edge still opens a window. */
export function irisOrigin(p: Pt, cw: number, ch: number): Pt {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { x: clamp(p.x, 0, cw), y: clamp(p.y, 0, ch) };
}
