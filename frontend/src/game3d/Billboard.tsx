import { Billboard as FaceCamera, useTexture } from "@react-three/drei";
import { ART3D } from "./artManifest3d";
import type { Art3dId } from "./artManifest3d";

/** A flat picture that stays upright and turns to face you (only round the vertical axis). */
export default function Sprite({ art, height }: { art: Art3dId; height: number }) {
  const a = ART3D[art];
  const map = useTexture(a.url);
  map.anisotropy = 4;
  const width = (height * a.width) / a.height;
  return (
    <>
      {/* A soft blob on the ground so the picture does not float. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <circleGeometry args={[Math.min(width, height) * 0.45, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <FaceCamera follow lockX lockZ position={[0, height / 2, 0]}>
        <mesh>
          <planeGeometry args={[width, height]} />
          {/* Unlit on purpose: the same flat light on everything, as in the rest of the courtyard. */}
          <meshBasicMaterial map={map} transparent alphaTest={0.45} toneMapped={false} />
        </mesh>
      </FaceCamera>
    </>
  );
}
