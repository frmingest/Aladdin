import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3 } from "three";
import type { Mesh } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODELS3D } from "./models3d";
import { MODEL_YAW, fitToHeight } from "./modelFit";
import type { ModelId } from "./modelFit";

/** If a model file fails to load or draw, the shape figure stays; the courtyard never loses a person. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D model failed to load, using the shape figure instead:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RealModel({ url, height, yaw }: { url: string; height: number; yaw: number }) {
  const { scene } = useGLTF(url);
  const fitted = useMemo(() => {
    const object = clone(scene);
    object.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new Box3().setFromObject(object);
    return { object, ...fitToHeight(box.min, box.max, height) };
  }, [scene, height]);
  return (
    <group rotation={[0, yaw, 0]}>
      <group scale={fitted.scale} position={fitted.offset}>
        <primitive object={fitted.object} />
      </group>
    </group>
  );
}

/**
 * One place in the courtyard: the real generated model if that slot has one (models3d.ts),
 * otherwise the shape figure. While a model loads, and if it ever fails, the shape figure shows.
 */
export default function Avatar({ id, height, fallback }: { id: ModelId; height: number; fallback: ReactNode }) {
  const url = MODELS3D[id];
  if (!url) return <>{fallback}</>;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RealModel url={url} height={height} yaw={MODEL_YAW[id] ?? 0} />
      </Suspense>
    </ModelBoundary>
  );
}
