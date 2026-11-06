import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Float32BufferAttribute, SphereGeometry } from "three";
import type { Mesh } from "three";
import { skyBlend } from "./weatherPlan";
import type { WeatherLook } from "./weatherPlan";

const RADIUS = 400;

/**
 * The sky as a soft gradient (3D polish PR 4): the horizon is the weather's fog colour, so the far fog melts into it,
 * and the colour deepens overhead. Vertex colours on one dome, no shader, one draw call. It follows the camera so you can
 * never walk out from under it. Colour only, no fact: the weather's own colours decide the look (weatherPlan.ts), and the
 * mist stays flat. Nothing moves, so reduced motion needs nothing.
 */
export default function SkyDome({ look }: { look: WeatherLook }) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new SphereGeometry(RADIUS, 24, 14);
    const horizon = new Color(look.sky);
    const top = new Color(look.skyTop);
    const mixed = new Color();
    const pos = g.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      mixed.copy(horizon).lerp(top, skyBlend(pos.getY(i) / RADIUS));
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return g;
  }, [look.sky, look.skyTop]);

  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} geometry={geometry} renderOrder={-10} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={1} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  );
}
