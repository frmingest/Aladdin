import { useState } from "react";
import { OBJECT_ART, readArtMode, type ObjectArtId } from "../lib/stitchArt";

/**
 * One Stitch Master object picture, with the SVG as the fallback (art off, or
 * the file failed to load). Static: no animation. The mode is read once per
 * mount, so a page reload picks up a changed ?art= choice.
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
  const [on] = useState(() => readArtMode() === "stitch");
  const [failed, setFailed] = useState(false);
  if (!on || failed) return <>{fallback}</>;
  const art = OBJECT_ART[id];
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
