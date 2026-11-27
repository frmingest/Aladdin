import { useEffect, useRef, useState } from "react";

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
 * Measures where the element starts on the page and keeps it current: on a resize (the strip wraps differently) and when
 * `dep` changes (demo mode switching the strip on or off). Returns the ref to attach and the height to give it.
 */
export function useFitToScreen<T extends HTMLElement>(dep: unknown): [React.RefObject<T>, string] {
  const ref = useRef<T>(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (el === null) return;
      setTop(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    // The strip's own height settles after fonts load; one more look on the next frame catches that.
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [dep]);
  return [ref, fitHeight(top)];
}
