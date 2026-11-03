/**
 * What is open over the world (S22 PR 2), so Esc and B can answer "what closes first?" in one place. Pure, no React.
 *
 * The HUD panels (Quests, Towers) are not layers: they are a standing preference you toggle with Q and T, so Esc
 * leaves them alone and B works with them open.
 */
export type LayerId =
  | "booth"
  | "lamp"
  | "report"
  | "books"
  | "shelf"
  | "talking"
  | "desk"
  | "drill"
  | "vault"
  | "realm"
  | "watch"
  | "perch"
  | "worldPage"
  | "where";

export type OpenLayers = Partial<Record<LayerId, boolean>>;

/** Top of the stack first: the layer drawn over the others closes before the ones under it. */
export const LAYER_ORDER: readonly LayerId[] = [
  "booth",
  "lamp",
  "report",
  "books",
  "shelf",
  "talking",
  "desk",
  "drill",
  "vault",
  "realm",
  "watch",
  "perch",
  "worldPage",
  "where",
];

/** These close themselves on Esc (their own handler), so the page must not close a second layer on the same press. */
export const SELF_CLOSING: readonly LayerId[] = ["booth", "lamp", "report"];

/** The layer on top, or null when nothing is open. */
export function topLayer(open: OpenLayers): LayerId | null {
  return LAYER_ORDER.find((id) => open[id]) ?? null;
}

/** What the page should close on Esc: the top layer, unless it closes itself. */
export function escapeTarget(open: OpenLayers): LayerId | null {
  const top = topLayer(open);
  return top && !SELF_CLOSING.includes(top) ? top : null;
}

/** B goes back only when nothing is open over the world. */
export function canGoBack(open: OpenLayers): boolean {
  return topLayer(open) === null;
}
