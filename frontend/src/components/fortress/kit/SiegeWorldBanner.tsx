import { useState } from "react";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";

/**
 * The picture behind the Siege page's "World" yardstick (2026-10-14): a lookout tower on a coast with a faint
 * globe on the horizon, the watch kept on the whole world instead of on Oslo. Only with Game mode (Object art)
 * on and only while World is selected. Pure decoration: no fact, empty alt text, lazy-loaded, and a picture that
 * fails to load simply disappears. The toggle and the words around it say everything the picture means.
 */
export default function SiegeWorldBanner({ active }: { active: boolean }) {
  const mode = useArtMode();
  const [failed, setFailed] = useState(false);
  const art = getObjectArt("backdrop-siege-world");
  if (!active || mode !== "stitch" || failed || !art) return null;
  return (
    <div aria-hidden="true" className="relative mb-3 h-24 overflow-hidden rounded-md border border-border-subtle sm:h-32">
      <img
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: "50% 45%" }}
        className="pointer-events-none h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
