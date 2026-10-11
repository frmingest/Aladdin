import { useState } from "react";
import type { CrestKind } from "../../../lib/crest";
import { roomBackdropId } from "../../../lib/roomArt";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";

/**
 * The wide scene behind a room's banner (Design Master Sprint 8), only with the Settings "Object art"
 * switch on. Decoration: it carries no fact, has empty alt text and is lazy-loaded. A dark wash keeps the
 * title and the buttons readable; a picture that fails to load simply disappears, leaving today's banner.
 */
export default function RoomBackdrop({ room }: { room: CrestKind }) {
  const mode = useArtMode();
  const [failed, setFailed] = useState(false);
  const id = roomBackdropId(room);
  const art = id ? getObjectArt(id) : null;
  if (mode !== "stitch" || failed || !art) return null;
  return (
    <>
      <img
        src={art.src}
        alt=""
        aria-hidden="true"
        width={art.width}
        height={art.height}
        loading="lazy"
        decoding="async"
        className="room-backdrop pointer-events-none absolute inset-0 h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120c07]/90 via-[#120c07]/70 to-[#120c07]/35"
      />
    </>
  );
}
