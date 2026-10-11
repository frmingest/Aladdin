import { useState } from "react";
import { getObjectArt, useArtMode, type ObjectArtId } from "../lib/stitchArt";

/**
 * One Stitch Master object picture, with the SVG as the fallback: art off,
 * an id with no picture, or the file failed to load. Static: no animation.
 * The mode is live (Settings switch), so no reload is needed.
 */
export default function ObjectArtImage({
  id,
  fallback,
  className = "",
  width,
}: {
  id: ObjectArtId;
  fallback: React.ReactNode;
  className?: string;
  /** Rendered width in CSS px; height follows the picture's ratio. */
  width: number;
}) {
  const mode = useArtMode();
  const [failed, setFailed] = useState(false);
  const art = getObjectArt(id);
  if (mode !== "stitch" || failed || !art) return <>{fallback}</>;
  return (
    <img
      src={art.src}
      alt={art.alt}
      aria-hidden={art.alt === "" ? true : undefined}
      width={width}
      height={Math.round((width * art.height) / art.width)}
      loading="lazy"
      decoding="async"
      className={`object-art ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
