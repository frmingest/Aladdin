import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AnimationMixer, Box3, LoopRepeat } from "three";
import type { AnimationAction, Group, Mesh, Object3D } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FADE_SECONDS, resolveClip, wantedClip } from "./animClips";
import type { Motion } from "./animClips";
import { MODELS3D } from "./models3d";
import type { ModelSpec } from "./models3d";
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

/** Box round the meshes that are actually shown (Box3.setFromObject would count hidden weapons too). */
function visibleBox(root: Object3D): Box3 {
  root.updateWorldMatrix(true, true);
  const box = new Box3();
  const part = new Box3();
  root.traverseVisible((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    if (!m.geometry.boundingBox) return;
    part.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    box.union(part);
  });
  return box;
}

const NO_MOTION: Motion = { moving: false, running: false };

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function RealModel({
  spec,
  id,
  height,
  motion,
}: {
  spec: ModelSpec;
  id: ModelId;
  height: number;
  motion?: MutableRefObject<Motion>;
}) {
  const { scene, animations } = useGLTF(spec.url);
  const mixer = useRef<AnimationMixer | null>(null);
  const current = useRef<AnimationAction | null>(null);
  const currentName = useRef<string | null>(null);
  const reduced = useRef(prefersReducedMotion());
  const warned = useRef(false);
  const group = useRef<Group>(null);

  const fitted = useMemo(() => {
    const object = clone(scene);
    const hide = new Set(spec.hide);
    object.traverse((o) => {
      if (hide.has(o.name)) o.visible = false;
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false; // skinned bounds are from the bind pose; do not let a pose cull the body
      }
    });
    const box = visibleBox(object);
    return { object, ...fitToHeight(box.min, box.max, height) };
  }, [scene, spec, height]);

  useEffect(() => {
    const m = new AnimationMixer(fitted.object);
    mixer.current = m;
    current.current = null;
    currentName.current = null;
    return () => {
      m.stopAllAction();
      m.uncacheRoot(fitted.object);
      mixer.current = null;
    };
  }, [fitted.object]);

  useFrame((_, delta) => {
    const m = mixer.current;
    if (!m) return;
    const names = animations.map((a) => a.name);
    const wanted = wantedClip(motion?.current ?? NO_MOTION, reduced.current);
    const name = resolveClip(wanted, names);
    if (name && name !== wanted && !warned.current) {
      warned.current = true;
      console.warn(`3D model ${spec.url}: clip "${wanted}" missing, using "${name}". Clips:`, names.join(", "));
    }
    if (name && name !== currentName.current) {
      const clip = animations.find((a) => a.name === name);
      if (clip) {
        const next = m.clipAction(clip, fitted.object);
        next.setLoop(LoopRepeat, Infinity);
        next.reset().fadeIn(reduced.current ? 0 : FADE_SECONDS).play();
        current.current?.fadeOut(reduced.current ? 0 : FADE_SECONDS);
        current.current = next;
        currentName.current = name;
      }
    }
    m.update(delta);
  });

  return (
    <group ref={group} rotation={[0, MODEL_YAW[id] ?? 0, 0]}>
      <group scale={fitted.scale} position={fitted.offset}>
        <primitive object={fitted.object} />
      </group>
    </group>
  );
}

/**
 * One person in the courtyard: the real model if that slot has one (models3d.ts), otherwise the
 * shape figure. While the model loads, and if it ever fails, the shape figure shows.
 */
export default function Avatar({
  id,
  height,
  fallback,
  motion,
}: {
  id: ModelId;
  height: number;
  fallback: ReactNode;
  motion?: MutableRefObject<Motion>;
}) {
  const spec = MODELS3D[id];
  if (!spec) return <>{fallback}</>;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RealModel spec={spec} id={id} height={height} motion={motion} />
      </Suspense>
    </ModelBoundary>
  );
}
