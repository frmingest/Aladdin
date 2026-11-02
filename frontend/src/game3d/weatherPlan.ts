/**
 * The weather over the courtyard (3D sprint S16, PR 3). Pure data and maths, no three.js and no React.
 *
 * The flat Fortress paints a sky that follows the backend's siege level (`state.siege.level`: calm, gathering,
 * besieged, unsurveyed). In 3D the same level changes three things and nothing else: the **sky tint**, the **fog
 * distance**, and the number of **storm clouds** hung high over the walls. Rules kept from the plan:
 *  - **Flat neutral lighting stays.** No light is changed, so no tower is lit more kindly or more harshly by the weather.
 *  - **Calm skies is exactly today's sky.** A calm fortress looks the same as it did before this step.
 *  - **Unknown stays fog.** A weather that was never surveyed (or could not be read) is a pale mist, never a clear sky.
 *  - No red and no green: a siege is a darker slate-violet sky, not a red one (the flat page's red horizon is not copied).
 *  - Colour is never the only signal: the same level is named in words (`SIEGE_LABEL`) in the realm verdict panel.
 *
 * This file never works out a level; it only maps the one the backend already decided to how the sky looks.
 */
import type { FortressSiegeLevel } from "../lib/types";

/** The sky of a calm day: the value the courtyard has always had. */
export const SKY_CALM = "#cfe3f1";

export interface WeatherLook {
  /** Background and fog colour. */
  sky: string;
  fogNear: number;
  fogFar: number;
  /** How many storm clouds hang over the walls. */
  clouds: number;
  /** Colour of the storm clouds (unlit, so no light changes). */
  cloudColor: string;
  /** The weather was not surveyed or could not be read: a pale mist, not a clear sky. */
  mist: boolean;
}

const CALM: WeatherLook = { sky: SKY_CALM, fogNear: 100, fogFar: 230, clouds: 0, cloudColor: "#ffffff", mist: false };

/** Fixed, so the same level always looks the same. */
export const WEATHER_LOOKS: Record<FortressSiegeLevel, WeatherLook> = {
  calm: CALM,
  gathering: { sky: "#9fadbd", fogNear: 90, fogFar: 215, clouds: 6, cloudColor: "#6f7589", mist: false },
  besieged: { sky: "#6f7490", fogNear: 80, fogFar: 195, clouds: 12, cloudColor: "#454861", mist: false },
  unsurveyed: { sky: "#e1e7ee", fogNear: 55, fogFar: 170, clouds: 0, cloudColor: "#ffffff", mist: true },
};

/** The look for a level; a missing or unknown level is the mist, never calm. */
export function weatherLook(level: FortressSiegeLevel | null | undefined): WeatherLook {
  if (level === null || level === undefined) return WEATHER_LOOKS.unsurveyed;
  return WEATHER_LOOKS[level] ?? WEATHER_LOOKS.unsurveyed;
}

export const MAX_CLOUDS = 12;

export interface CloudSlot {
  x: number;
  y: number;
  z: number;
  /** Half-width and half-depth of the flat cloud. */
  rx: number;
  rz: number;
  /** Half-height. */
  ry: number;
}

/** Twelve fixed places high over the walls (inside the backdrop ring). */
const SLOTS: readonly CloudSlot[] = Array.from({ length: MAX_CLOUDS }, (_, i) => {
  const angle = (i / MAX_CLOUDS) * Math.PI * 2 + 0.4;
  const radius = i % 2 === 0 ? 70 : 118;
  return {
    x: Math.round(Math.sin(angle) * radius * 10) / 10,
    y: 86 + (i % 3) * 7,
    z: Math.round(Math.cos(angle) * radius * 10) / 10,
    rx: 24 + (i % 4) * 4,
    rz: 14 + (i % 3) * 3,
    ry: 3.2,
  };
});

/** Fixed slots, filled in the same order whatever the count, so a darker level adds clouds and never moves one. */
export function cloudSlots(count: number): CloudSlot[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.min(MAX_CLOUDS, Math.floor(count))) : 0;
  return SLOTS.slice(0, n);
}
