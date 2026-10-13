import { useEffect, useState } from "react";

/**
 * False for the first paint, then true (Design Master Sprint 7, phone speed).
 *
 * A heavy picture (the Fortress scene is about 1,300 drawn shapes) blocks the page's first paint while the
 * phone builds it. Drawing the cheap parts first (the title, the figures, the sky) and the heavy parts one
 * frame later lets a phone show the page about a second sooner. The reserved space is the same, so nothing
 * moves. Under tests (and on a server render) it is true at once, so no test has to wait for a frame.
 */
export function useAfterFirstPaint(): boolean {
  const immediate = import.meta.env.MODE === "test" || typeof window === "undefined" || typeof requestAnimationFrame !== "function";
  const [ready, setReady] = useState(immediate);
  useEffect(() => {
    if (immediate) return;
    let t = 0;
    // Two frames: the first lets the browser paint what is there, the second starts after that paint.
    const raf = requestAnimationFrame(() => {
      t = window.setTimeout(() => setReady(true), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [immediate]);
  return ready;
}
