import type { AreaPhase } from "./areaMachine";

/**
 * The step between two places (S22): a short dark veil with a thin gold edge, and the name plate that says where
 * you arrived. Both are plain HTML over the canvas. Reduced motion turns the fade into a cut in the stylesheet.
 */
export default function AreaFade({ phase, plate }: { phase: AreaPhase; plate: string | null }) {
  const dark = phase === "fadingOut" || phase === "loading";
  return (
    <>
      <div
        aria-hidden="true"
        className="g3d-veil"
        data-phase={phase}
        style={{ opacity: dark ? 1 : 0, transitionDuration: phase === "fadingOut" ? "350ms" : "450ms" }}
      />
      <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center">
        {plate && <p className="g3d-plate">{plate}</p>}
      </div>
    </>
  );
}
