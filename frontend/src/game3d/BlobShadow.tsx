import { useMemo } from "react";
import { CanvasTexture } from "three";

/** One soft round texture for every blob: white in the middle fading to clear. Made once, shared. */
let shared: CanvasTexture | null = null;
function blobTexture(): CanvasTexture {
  if (shared) return shared;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.6, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  shared = new CanvasTexture(c);
  return shared;
}

/**
 * A soft round shadow on the ground under a person or a stall (3D polish PR 4). Pure decoration: the same size for
 * everyone of a kind, never sized by a number. Place it inside the thing's own group at ground level.
 */
export default function BlobShadow({ radius = 0.6, y = 0.03 }: { radius?: number; y?: number }) {
  const map = useMemo(() => (typeof document === "undefined" ? null : blobTexture()), []);
  if (!map) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={-1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
    </mesh>
  );
}
