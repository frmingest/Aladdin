import { useLayoutEffect, useRef, useState } from "react";

/**
 * The 3D view fills the screen below whatever sits above it (#528). It used to be `100dvh - 5rem`, which leaves room for
 * the header only: on a phone the demo-mode strip wraps to three lines, so the bottom of the view (the controls hint, the
 * action prompt, the practice yard's plates) slid below the fold and the page scrolled.
 *
 * The view now subtracts how far down the page it really starts, but never less than the old 5rem, so a layout that
 * already fitted (desktop, or demo mode off) keeps exactly the box it had.
 */
export const OLD_TOP_REM = 5;

/** The CSS height for a view that starts `topPx` down the page. */
export function fitHeight(topPx: number): string {
  const top = Number.isFinite(topPx) && topPx > 0 ? Math.ceil(topPx) : 0;
  return `calc(100dvh - max(${OLD_TOP_REM}rem, ${top}px))`;
}

/**
 * Measures where the element starts on the page and keeps it current. It measures before the first paint (no frame at the
 * old size, no extra canvas resize), then again whenever the page's layout changes size: the strip rewrapping on a resize or
 * a late font, or `dep` changing (demo mode switching the strip on or off). The box's own height never moves its top, so a
 * re-measure after the box resizes finds the same value and renders nothing.
 */
export function useFitToScreen<T extends HTMLElement>(dep: unknown): [React.RefObject<T>, string] {
  const ref = useRef<T>(null);
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (el === null) return;
      // Whole pixels, so sub-pixel noise never re-renders the page.
      setTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const seen = new ResizeObserver(measure);
    seen.observe(document.body);
    return () => seen.disconnect();
  }, [dep]);
  return [ref, fitHeight(top)];
}
