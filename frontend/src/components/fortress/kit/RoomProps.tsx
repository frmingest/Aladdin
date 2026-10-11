import { useState } from "react";
import type { CrestKind } from "../../../lib/crest";
import { roomPropIds } from "../../../lib/roomArt";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";

const HEIGHT = 76;

function Prop({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  const art = getObjectArt(id);
  if (failed || !art) return null;
  return (
    <img
      src={art.src}
      alt=""
      aria-hidden="true"
      width={Math.round((HEIGHT * art.width) / art.height)}
      height={HEIGHT}
      loading="lazy"
      decoding="async"
      className="room-prop shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The furniture that stands in a room's banner (Design Master Sprints 10 to 13): the bookshelf and lectern
 * for the Records, and so on. Only with the Settings "Object art" switch on, hidden on phones, decoration
 * with empty alt text. It sits between the title and the page's buttons, never over them.
 */
export default function RoomProps({ room }: { room: CrestKind }) {
  const mode = useArtMode();
  const ids = roomPropIds(room);
  if (mode !== "stitch" || ids.length === 0) return null;
  return (
    <div className="hidden flex-1 items-end justify-center gap-3 self-end sm:flex" aria-hidden="true">
      {ids.map((id) => (
        <Prop key={id} id={id} />
      ))}
    </div>
  );
}
