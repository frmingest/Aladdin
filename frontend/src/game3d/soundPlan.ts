import type { FortressSiegeLevel } from "../lib/types";
import { AREAS, type AreaId } from "./areas";

/**
 * Opt-in sound for the 3D town (polish pass 5). Pure rules, no audio here: the noise itself is the Fortress's
 * synthesized ambience (lib/fortressSound.ts), so there are no files and no network. It is OFF until the player
 * presses the Sound button (or M), it is never remembered across loads, and it carries no fact a sighted player
 * lacks: it follows the same stored siege level the sky and clouds already show, and it never plays on a trade.
 */

/** M flips the sound. Not a movement key, E (talk), P (stats) or a panel key (Q, T). */
export const SOUND_KEY = "KeyM";

/**
 * Which weather bed to play. Out in the open it follows the siege level (soft wind when calm, a fuller roar as
 * the weather turns, a low rumble in a siege). Indoors the walls shut the weather out, so every room gets the
 * quietest bed. An unknown level is the quiet bed too: unknown never sounds like a storm.
 */
export function ambienceLevel(areaId: AreaId, siege: FortressSiegeLevel | null | undefined): FortressSiegeLevel | null {
  if (AREAS[areaId].kind === "indoor") return null;
  return siege ?? null;
}

/** The button's words and its screen-reader state. Short and plain, like the other game buttons. */
export function soundLabel(on: boolean): { label: string; icon: string; title: string } {
  return on
    ? { label: "Sound on", icon: "🔊", title: "Soft wind and weather. Press to turn it off (M)" }
    : { label: "Sound off", icon: "🔇", title: "Soft wind and weather, off until you ask (M)" };
}
