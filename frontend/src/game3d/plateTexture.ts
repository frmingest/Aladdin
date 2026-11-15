import { useEffect } from "react";
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from "three";

/** A texture drawn once on a 2D canvas: crisp text and lines, no DOM label, no per-frame work. */
export function makeTexture(size: { w: number; h: number }, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

/** Throws a texture away when it is replaced or the mesh goes. */
export function useDispose(texture: CanvasTexture) {
  useEffect(() => () => texture.dispose(), [texture]);
}
