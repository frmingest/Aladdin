import type { GateStatus, ShopTone, StoreLevel } from "./marketplace";

/** Fixed paint colours for the Marketplace art (kept apart from the components for fast refresh). */

export const LEVEL_PAINT: Record<StoreLevel, { a: string; b: string; text: string }> = {
  ready: { a: "#2f8a4d", b: "#efe6c8", text: "#7fe0a0" },
  promising: { a: "#c9962e", b: "#f3e7c4", text: "#f2d16b" },
  wait: { a: "#3a63b0", b: "#e6e9f2", text: "#9dbaf0" },
  pass: { a: "#6b6f78", b: "#dcdad2", text: "#c3c6cf" },
  unknown: { a: "#7c8599", b: "#e4e1d8", text: "#c0c8d8" },
};

export const TONE_PAINT: Record<ShopTone, { a: string; b: string }> = {
  gold: { a: "#c9962e", b: "#f6ecc6" },
  amber: { a: "#b8672a", b: "#f1e0c4" },
  plain: { a: "#4f6a9a", b: "#e5e8f0" },
  mist: { a: "#7c8599", b: "#e4e1d8" },
};

export const STATUS_PAINT: Record<GateStatus, { fill: string; stroke: string }> = {
  open: { fill: "#3fae6a", stroke: "#1d5c38" },
  ajar: { fill: "#e0a838", stroke: "#7a5718" },
  closed: { fill: "#d9534f", stroke: "#6e1f1c" },
  unknown: { fill: "transparent", stroke: "#9aa3b5" },
  na: { fill: "#555", stroke: "#444" },
};

