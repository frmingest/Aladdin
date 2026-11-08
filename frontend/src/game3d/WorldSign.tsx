import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { V3 } from "./Inked";
import { SIGN_PX, paintSign } from "./signTexture";
import type { SignSpec } from "./signTexture";

interface WorldSignProps {
  spec: SignSpec;
  position: V3;
  /** World width; the height follows the shape's aspect. */
  width: number;
  /** Yaw in radians; 0 faces +z. Both faces carry the words, so it reads from either side. */
  yaw?: number;
  /** Words on both faces (a hanging sign). False for a sign mounted flat on a wall or stone, front face only. */
  both?: boolean;
}

/**
 * A name painted on a plank, banner or stone and standing in the world: it hides behind walls and shrinks like
 * any object, unlike an `Html` overlay. Painted once per distinct spec, words on both faces.
 */
export default function WorldSign({ spec, position, width, yaw = 0, both = true }: WorldSignProps) {
  const key = JSON.stringify(spec);
  const tex = useMemo(() => {
    const x = new CanvasTexture(paintSign(JSON.parse(key) as SignSpec));
    x.colorSpace = SRGBColorSpace;
    x.anisotropy = 8;
    return x;
  }, [key]);
  useEffect(() => () => tex.dispose(), [tex]);
  const px = SIGN_PX[spec.kind];
  const height = (width * px.h) / px.w;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {both && (
        <mesh position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
