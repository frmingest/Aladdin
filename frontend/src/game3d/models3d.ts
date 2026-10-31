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
};
