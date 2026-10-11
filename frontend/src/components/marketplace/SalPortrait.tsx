import ObjectArtImage from "../ObjectArtImage";
import { salBustId } from "../../lib/marketArt";
import type { Mood } from "../../lib/salesRep";
import { SalesRep } from "./SalesRepArt";

/**
 * Sal in the Sal and Hype dialogs: the Stitch bust for his mood when art is on, the SVG otherwise
 * (art off, a mood with no bust yet such as "cheer", or a picture that failed to load).
 * Same width either way, so the dialog does not shift.
 */
export default function SalPortrait({ mood, size, className = "" }: { mood: Mood; size: number; className?: string }) {
  const svg = <SalesRep mood={mood} size={size} className={className} />;
  const id = salBustId(mood);
  if (!id) return svg;
  return <ObjectArtImage id={id} width={size} className={className} fallback={svg} />;
}
