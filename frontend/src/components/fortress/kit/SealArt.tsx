import { useState } from "react";
import { sealArtFor } from "../../../lib/roomArt";
import type { SealKind } from "../../../lib/seals";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import SealMark from "./SealMark";

/** The picture of a wax seal, long side `long` px, with the page's own glyph drawn over it (Sprint 9).
 * Pure markup so it can be tested without the Settings switch. A note is a whole seal, a warning a broken
 * one; the glyph ("i" or "!") and the accessible word are the same as the SVG seal's. */
export function SealPicture({
  kind,
  long,
  decorative = false,
  onError,
}: {
  kind: SealKind;
  long: number;
  /** True when a printed word beside it already says the same thing. */
  decorative?: boolean;
  onError?: () => void;
}) {
  const look = sealArtFor(kind);
  const art = look ? getObjectArt(look.id) : null;
  if (!look || !art) return null;
  const wide = art.width >= art.height;
  const w = wide ? long : Math.round((long * art.width) / art.height);
  const h = wide ? Math.round((long * art.height) / art.width) : long;
  const [mx, my] = art.anchors?.mark ?? [0.5, 0.5];
  return (
    <span className="relative inline-block shrink-0" style={{ width: w, height: h }} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : look.label} aria-hidden={decorative ? true : undefined}>
      <img src={art.src} alt="" aria-hidden="true" width={w} height={h} loading="lazy" decoding="async" className="object-art block" onError={onError} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute font-bold leading-none text-[#fbe9c2]"
        style={{
          left: `${mx * 100}%`,
          top: `${my * 100}%`,
          transform: "translate(-50%, -50%)",
          fontFamily: "Georgia, serif",
          fontSize: Math.round(long * 0.4),
          textShadow: "0 1px 1px #3a0f0b",
        }}
      >
        {look.glyph}
      </span>
    </span>
  );
}

/** A Council seal: the wax picture with Object art on (notes and warnings only), otherwise the SVG seal.
 * A picture that fails to load turns back into the SVG. */
export default function SealArt({ kind, size = 22, decorative = false }: { kind: SealKind; size?: number; decorative?: boolean }) {
  const mode = useArtMode();
  const [failed, setFailed] = useState(false);
  if (mode !== "stitch" || failed || sealArtFor(kind) === null) return <SealMark kind={kind} size={size} decorative={decorative} />;
  return <SealPicture kind={kind} long={Math.round(size * 1.5)} decorative={decorative} onError={() => setFailed(true)} />;
}
