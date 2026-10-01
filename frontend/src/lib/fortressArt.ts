import { SCENE_TOP } from "./fortress";
import type { FortressSiegeLevel } from "./types";

/**
 * Paint for the Fortress scene (F33, G7 art pass): which colours the sky,
 * hills, grass and light use for each weather. Pure data, no React. The
 * weather itself is the backend's siege level; this only picks the paint.
 */

/** Painter's palette per weather. The sky still follows the backend's siege
 * level; this only decides which paint is used for it. */
export interface WorldPalette {
  sky: [string, string, string];
  /** Where the light comes from, and its colour. */
  sun: { x: number; y: number; r: number; color: string; core: string; opacity: number };
  farHills: string;
  nearHills: string;
  snow: string;
  forest: string;
  grass: [string, string];
  /** Warm rim on the left of every building. */
  rim: string;
  rimOpacity: number;
  motes: "fireflies" | "embers" | "rain" | "none";
}

export const HORIZON = SCENE_TOP + 118;

export function worldPalette(level: FortressSiegeLevel | null): WorldPalette {
  switch (level) {
    case "gathering":
      return {
        sky: ["#121722", "#2f3644", "#69686a"],
        sun: { x: 210, y: HORIZON - 40, r: 260, color: "#c7c1b0", core: "#e9e3d2", opacity: 0.22 },
        farHills: "#4b505c",
        nearHills: "#323743",
        snow: "#9aa0aa",
        forest: "#1c2420",
        grass: ["#55603c", "#2a311e"],
        rim: "#d8d2c0",
        rimOpacity: 0.08,
        motes: "rain",
      };
    case "besieged":
      return {
        sky: ["#12080b", "#43161a", "#b0482a"],
        sun: { x: 520, y: HORIZON + 6, r: 380, color: "#ff6b35", core: "#ffb070", opacity: 0.5 },
        farHills: "#4a2a2a",
        nearHills: "#2d1a1c",
        snow: "#a06a5a",
        forest: "#1a1012",
        grass: ["#4e4528", "#241d12"],
        rim: "#ff8a4a",
        rimOpacity: 0.16,
        motes: "embers",
      };
    case "unsurveyed":
    case null:
      return {
        sky: ["#121a2a", "#2a3a54", "#5c6c82"],
        sun: { x: 800, y: 60, r: 200, color: "#c9d8f0", core: "#f2f6ff", opacity: 0.28 },
        farHills: "#4b5870",
        nearHills: "#2f3a4c",
        snow: "#b8c4d8",
        forest: "#18221f",
        grass: ["#4b573d", "#252d1f"],
        rim: "#c9d8f0",
        rimOpacity: 0.08,
        motes: "none",
      };
    default:
      return {
        sky: ["#1a2350", "#6b4c74", "#f0a35e"],
        sun: { x: 170, y: HORIZON - 6, r: 330, color: "#ffb35a", core: "#fff0c2", opacity: 0.75 },
        farHills: "#6a5a7a",
        nearHills: "#3e3654",
        snow: "#f3d7c4",
        forest: "#1d2a24",
        grass: ["#6d7a35", "#2f3b1a"],
        rim: "#ffc070",
        rimOpacity: 0.16,
        motes: "fireflies",
      };
  }
}

