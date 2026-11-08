import { useEffect, useMemo } from "react";
import { Color, Float32BufferAttribute, MeshStandardMaterial, RingGeometry } from "three";
import { PAL } from "./Inked";
import { STREAM_INNER } from "./landStream";
import type { LandStream } from "./landStream";
import WorldLabel from "./WorldLabel";

/** The one flat material every stream band shares: the tint rides on vertex colours, so a tier never needs its own material. */
const STREAM_MATERIAL = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
const BED_STONES = 14;

/**
 * The stream round the centre (S26 PR 1): the moat tier drawn the same way for every dressing. A flat ring of one shared
 * material; the dry bed also gets a ring of stones (shape, not colour) and the mist band carries a "?". Still, always.
 */
export default function StreamBand({ stream, position = [0, 0, 0], inner = STREAM_INNER }: { stream: LandStream; position?: [number, number, number]; inner?: number }) {
  const geo = useMemo(() => {
    if (stream.width <= 0) return null;
    const g = new RingGeometry(inner, inner + stream.width, 40, 1);
    const col = new Color(stream.tint);
    const n = g.getAttribute("position").count;
    g.setAttribute("color", new Float32BufferAttribute(Array.from({ length: n }, () => [col.r, col.g, col.b]).flat(), 3));
    return g;
  }, [stream.width, stream.tint, inner]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  const mid = inner + stream.width / 2;
  return (
    <group position={position}>
      <mesh geometry={geo} material={STREAM_MATERIAL} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow />
      {stream.bed &&
        Array.from({ length: BED_STONES }, (_, i) => {
          const a = (i / BED_STONES) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * mid, 0.14, Math.sin(a) * mid]} rotation={[0.2 * i, a, 0]}>
              <boxGeometry args={[0.3, 0.16, 0.26]} />
              <meshStandardMaterial color={PAL.slateDark} flatShading />
            </mesh>
          );
        })}
      {stream.mark && (
        <WorldLabel position={[0, 0.6, mid]} distanceFactor={9}>{stream.mark}</WorldLabel>
      )}
    </group>
  );
}
