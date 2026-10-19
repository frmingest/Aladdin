import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { SCENES, type SceneId } from "../../../lib/mapScenes";
import "./sceneDive.css";

/** The window the map opens onto when you press a settlement (Cartographer's map, scene dive): a full
 * painted scene of what the holding does for a living, opening as a round iris from the settlement's own
 * spot while the camera falls in, and closing the same way. Decoration only: the picture carries no fact,
 * the name is the holding's own, and the survey stays on the slate below the map. One focus stop (Back);
 * Escape also goes back. Reduced motion: no iris, no drift, the scene is simply there.
 *
 * `phase`: "in" the iris is opening, "open" it is wide, "out" it is closing. The parent owns the timers. */
export type DivePhase = "in" | "open" | "out";

export interface SceneDiveProps {
  scene: SceneId;
  /** The holding's name as the map shows it. */
  name: string;
  phase: DivePhase;
  /** Where the iris opens from, in the map box's pixels, and the radius that covers the box. */
  origin: { x: number; y: number };
  radius: number;
  onBack: () => void;
  onImageError: () => void;
}

export default function SceneDive({ scene, name, phase, origin, radius, onBack, onImageError }: SceneDiveProps) {
  const art = SCENES[scene];
  const backRef = useRef<HTMLButtonElement | null>(null);

  // Focus moves to Back once the window is wide, so a keyboard player is never left on a covered tower.
  useEffect(() => {
    if (phase === "open") backRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    } else if (e.key === "Tab") {
      // One stop only: keep focus off the map buried underneath.
      e.preventDefault();
      backRef.current?.focus({ preventScroll: true });
    }
  };

  const style = { "--ox": `${origin.x}px`, "--oy": `${origin.y}px`, "--r": `${radius}px` } as CSSProperties;
  return (
    <div
      className="wm-dive"
      data-phase={phase}
      data-scene={scene}
      style={style}
      role="region"
      aria-label={`${art.kicker}: ${name}`}
      onKeyDown={onKey}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="wm-dive-ring" aria-hidden="true" />
      <div className="wm-dive-pane">
        <img className="wm-dive-img" src={art.src} width={art.width} height={art.height} alt="" decoding="async" draggable={false} onError={onImageError} />
        <div className="wm-dive-shade" aria-hidden="true" />
        <div className="wm-dive-plate">
          <div className="min-w-0">
            <p className="wm-dive-kicker">{art.kicker}</p>
            <p className="wm-dive-name">{name}</p>
          </div>
          <button ref={backRef} type="button" className="wm-dive-back" onClick={onBack}>
            Back to the map
          </button>
        </div>
      </div>
    </div>
  );
}
