/** Words for the Realm post (the keep's banner), the weather plate and the Magic Lamp on the desk (version 1). A change that alters meaning is a new version file. */
import type { RealmLevel } from "../lib/realmVerdict";

export const REALM_PROMPT = "Press E to read the realm's verdict";
export const REALM_PANEL_TITLE = "The whole fortress";
export const REALM_CLOSE = "Close";
export const REALM_PLAIN = "Open the flat page";

/** Short words for the banner plate. The full sentence (and the line-by-line reasons) open in the panel. */
export const REALM_PLATE: Record<RealmLevel, string> = {
  attention: "Look first",
  mixed: "Mixed",
  sound: "No flags",
  unknown: "Unknown ?",
};

/** The lamp button in the desk panel. */
export const LAMP_BUTTON = "Rub the lamp";
export const LAMP_HINT = "Three wishes for the analysis queue";
