import type { ModelId } from "./modelFit";

/**
 * Which GLB fills which slot, and which child nodes to hide. KayKit Character Pack: Adventurers
 * (Kay Lousberg, CC0 1.0); see public/models/CREDITS.md. Hidden nodes are separate meshes in the file,
 * so hiding is `visible = false` and the fit height is measured on what stays visible.
 */
export interface ModelSpec {
  url: string;
  hide: readonly string[];
}

export const MODELS3D: Partial<Record<ModelId, ModelSpec>> = {
  hero: {
    url: "/models/Rogue_Hooded.glb",
    hide: ["Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Knife", "Throwable"],
  },
  // The Oracle: the Mage with hat and cape, without book, wand or staff (they would stretch the fitted height).
  oracle: {
    url: "/models/Mage.glb",
    hide: ["Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff"],
  },
  // The Partner: the Knight with helmet and cape, without swords or shields.
  partner: {
    url: "/models/Knight.glb",
    hide: [
      "1H_Sword_Offhand",
      "Badge_Shield",
      "Rectangle_Shield",
      "Round_Shield",
      "Spike_Shield",
      "1H_Sword",
      "2H_Sword",
    ],
  },
};
