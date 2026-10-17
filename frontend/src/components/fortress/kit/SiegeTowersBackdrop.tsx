import { useState } from "react";
import { FALL_STAGES, fallStage } from "../../../lib/siege";
import type { FallStage } from "../../../lib/siege";
import { towersBackdropFor, towersBackdropId } from "../../../lib/siegeBackdrop";
import { getObjectArt } from "../../../lib/stitchArt";
import type { ObjectArt } from "../../../lib/stitchArt";

/**
 * The scenery behind "The towers under attack": one Stitch picture per size of fall (calm, storm, siege, ruin),
 * cross-faded as the "falls by" slider moves. Pure decoration: no fact, empty alt text, a darkening veil keeps the
 * towers readable, and a picture that fails to load or is not packed yet leaves the plain dark panel. Draw it
 * inside a `relative overflow-hidden` box, behind the content.
 */
export default function SiegeTowersBackdrop({ drop }: { drop: number | string | null | undefined }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const wanted = towersBackdropFor(fallStage(drop));
  const layers = FALL_STAGES.map((s) => ({ stage: s, art: getObjectArt(towersBackdropId(s)) })).filter(
    (l): l is { stage: FallStage; art: ObjectArt } => l.art !== null && !failed.has(l.stage),
  );
  if (layers.length === 0) return null;
  const shown = layers.some((l) => l.stage === wanted?.stage) ? wanted?.stage : layers[0].stage;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-testid="siege-towers-backdrop" data-stage={shown}>
      {layers.map(({ stage, art }) => (
        <img
          key={stage}
          src={art.src}
          alt=""
          width={art.width}
          height={art.height}
          loading="lazy"
          decoding="async"
          style={{ opacity: stage === shown ? 1 : 0, objectPosition: "50% 60%" }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none"
          onError={() => setFailed((f) => new Set(f).add(stage))}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/45" />
    </div>
  );
}
