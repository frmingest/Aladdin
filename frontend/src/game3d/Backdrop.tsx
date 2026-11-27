import { useTexture } from "@react-three/drei";
import { MirroredRepeatWrapping } from "three";
import { ART3D } from "./artManifest3d";

const RADIUS = 155;
const HEIGHT = 70;
/** How many times the picture wraps round the horizon (mirrored, so the joins do not show). */
const TILES = 4;

/** Distant mountains and a lake all round the meadow. Far away, unlit, never part of any fact. */
export default function Backdrop({ tint }: { tint?: string } = {}) {
  const map = useTexture(ART3D.backdrop.url);
  map.wrapS = MirroredRepeatWrapping;
  map.repeat.set(TILES, 1);
  return (
    <mesh position={[0, HEIGHT / 2 - 2, 0]}>
      <cylinderGeometry args={[RADIUS, RADIUS, HEIGHT, 48, 1, true]} />
      {/* `tint` darkens the painting under a storm (the practice yard, #495); without it the picture shows as painted. */}
      <meshBasicMaterial map={map} color={tint ?? "#ffffff"} side={1} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
