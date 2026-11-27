import { useEffect, useState } from "react";
import { TOUCH_QUERY } from "./touchInput";

function matches(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(TOUCH_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * True on a touch screen (the main pointer is a finger), false on a desktop with a mouse (#485). Follows a change while the
 * page is open (a tablet docked to a keyboard and mouse, or the browser's device emulation switched on).
 */
export function useTouchScreen(): boolean {
  const [touch, setTouch] = useState(matches);
  useEffect(() => {
    let q: MediaQueryList;
    try {
      q = window.matchMedia(TOUCH_QUERY);
    } catch {
      return;
    }
    const on = () => setTouch(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return touch;
}
