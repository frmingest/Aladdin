import { useState } from "react";
import { circleBrazier, circleStones, fogStakeId, type RingPiece } from "../../../lib/roomArt";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";

function pieceStyle(p: RingPiece, anchor: "base" | "centre") {
  return {
    left: `${p.left}%`,
    top: `${p.top}%`,
    width: `max(16px, ${p.width}%)`,
    transform: anchor === "base" ? "translate(-50%, -78%)" : "translate(-50%, -50%)",
  } as const;
}

function Piece({ piece, anchor }: { piece: RingPiece; anchor: "base" | "centre" }) {
  const [failed, setFailed] = useState(false);
  const art = getObjectArt(piece.id);
  if (failed || !art) return null;
  return (
    <img
      src={art.src}
      alt=""
      aria-hidden="true"
      width={art.width}
      height={art.height}
      loading="lazy"
      decoding="async"
      className="circle-piece object-art"
      style={pieceStyle(piece, anchor)}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The standing stones and the brazier on the Circle map (Design Master Sprint 11), under the markers and
 * the zone names. Constant decoration: the same stones and the same brazier whatever the data says, so the
 * ring never changes with a mark and the circle line stays an outline. Only with the Settings "Object art"
 * switch on; empty alt text; the markers, the list and the Plain view are untouched.
 */
export default function CircleRingArt() {
  const mode = useArtMode();
  if (mode !== "stitch") return null;
  const brazier = circleBrazier();
  return (
    <div className="circle-ring-art" aria-hidden="true">
      {circleStones().map((s, i) => (
        <Piece key={i} piece={s} anchor="base" />
      ))}
      {brazier && <Piece piece={brazier} anchor="centre" />}
    </div>
  );
}

/** A stake with a frayed rope beside the "No sector set" marker: unclassified holdings stand in the fog. */
export function FogStake() {
  const mode = useArtMode();
  const [failed, setFailed] = useState(false);
  const id = fogStakeId();
  const art = id ? getObjectArt(id) : null;
  if (mode !== "stitch" || failed || !art) return null;
  return (
    <img
      src={art.src}
      alt=""
      aria-hidden="true"
      width={art.width}
      height={art.height}
      loading="lazy"
      decoding="async"
      className="circle-stake object-art"
      onError={() => setFailed(true)}
    />
  );
}
