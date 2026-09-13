import type { CSSProperties } from "react";
import { CHROME } from "./palette";

/** Shared recharts <Tooltip contentStyle=.../> — one definition so every
 * chart's tooltip matches this app's dark slate chrome (see palette.ts). */
export const tooltipContentStyle: CSSProperties = {
  backgroundColor: CHROME.tooltipBg,
  border: `1px solid ${CHROME.tooltipBorder}`,
  borderRadius: 6,
  fontSize: 12,
  color: CHROME.text,
};

export const tooltipLabelStyle: CSSProperties = { color: CHROME.text };
