import { embedUrl, flatUrl } from "./parity3d";
import type { Door } from "./parity3d";

/**
 * A flat page shown inside the world. It is the page itself, loaded with `?embed=world` (no sidebar),
 * so every number comes from the same code as the flat route. "Open the flat page" goes to the full
 * app, so a 3D problem never hides data.
 */
export default function WorldPanel({ door, onBack, onClose }: { door: Door; onBack: () => void; onClose: () => void }) {
  return (
    <aside aria-label={door.title} className="g3d-panel g3d-slide absolute inset-x-3 bottom-3 top-16 z-40 flex flex-col p-3 md:left-auto md:w-[min(48rem,60%)]">
      <div className="g3d-head">
        <h2>{door.title}</h2>
        <div className="flex items-center gap-2">
          <button type="button" className="g3d-btn" onClick={onBack}>← Where to?</button>
          <a className="g3d-btn" href={flatUrl(door)}>Open the flat page</a>
          <button type="button" className="g3d-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
      </div>
      <iframe title={door.title} src={embedUrl(door)} className="mt-2 w-full flex-1 rounded bg-surface" />
    </aside>
  );
}
