import { useEffect, useState, type RefObject } from "react";
import { sceneShouldRun } from "../../lib/sceneNav";

/** G41: true while the scene should animate. Pauses (so the CSS loops stop costing frames) when the
 * browser tab is hidden or the scene has scrolled out of view. Where the browser has no
 * IntersectionObserver it assumes the scene is on screen. Never throws. */
export function useSceneRunning(ref: RefObject<Element | null>): boolean {
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setOnScreen(last.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return sceneShouldRun(pageVisible, onScreen);
}
