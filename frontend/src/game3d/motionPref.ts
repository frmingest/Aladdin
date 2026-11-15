/** True when the person asked their system for less motion. Cheer, confetti and casting all respect it. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Subscribe to the system's reduced-motion setting, so a change while the page is open is followed. */
export function subscribeReducedMotion(onChange: () => void): () => void {
  try {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  } catch {
    return () => {};
  }
}
