import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";

/** If keep.glb fails to load, draw the fallback (the plain shapes) instead. */
export class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D keep/tower model failed to load, using plain shapes:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** One clone of a named node in keep.glb, shadows on. */
export function ModelClone({ url, node, scale }: { url: string; node: string; scale: number }) {
  const gltf = useGLTF(url);
  const object = useMemo<Object3D | null>(() => {
    const found = gltf.scene.getObjectByName(node);
    if (!found) return null;
    const copy = found.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [gltf, node]);
  if (!object) return null;
  return <primitive object={object} scale={scale} />;
}

/** The model while it loads shows the fallback, so the courtyard is never missing its keep. */
export function WithFallback({ model, fallback }: { model: ReactNode; fallback: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{model}</Suspense>
    </ModelBoundary>
  );
}
