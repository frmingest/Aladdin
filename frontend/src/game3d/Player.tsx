import { useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SPAWN } from "./layout";
import {
  JUMP_SPEED,
  RUN_SPEED,
  WALK_SPEED,
  cameraOffset,
  facingYaw,
  moveVector,
  shortestAngle,
} from "./movement";
import type { Keys } from "./movement";
import type { OrbitState } from "./useOrbit";

const HALF_HEIGHT = 0.5;
const RADIUS = 0.35;
/** Capsule centre sits this far above the feet. */
const CENTRE_HEIGHT = HALF_HEIGHT + RADIUS;
const FOCUS_HEIGHT = 1.5;
const TURN_RATE = 12;
const CAMERA_FOLLOW = 14;

interface Props {
  keys: MutableRefObject<Keys>;
  orbit: MutableRefObject<OrbitState>;
}

/**
 * The hero: a Rapier capsule driven by WASD, with a stand-in body (week 3
 * swaps it for a rigged character). Camera follows behind and above.
 */
export default function Player({ keys, orbit }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<THREE.Group>(null);
  const facing = useRef(0);
  const { world, rapier } = useRapier();

  useFrame((state, delta) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);
    const pos = rb.translation();
    const vel = rb.linvel();
    const k = keys.current;

    const dir = moveVector(k, orbit.current.yaw);
    const speed = k.run ? RUN_SPEED : WALK_SPEED;

    // Standing on something? A short ray down from the capsule centre.
    const ray = new rapier.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const grounded = world.castRay(ray, CENTRE_HEIGHT + 0.15, true, undefined, undefined, undefined, rb) !== null;
    const vy = grounded && k.jump && vel.y <= 0.1 ? JUMP_SPEED : vel.y;
    rb.setLinvel({ x: dir.x * speed, y: vy, z: dir.z * speed }, true);

    // Turn the body towards where it is walking.
    if (dir.x !== 0 || dir.z !== 0) {
      facing.current += shortestAngle(facing.current, facingYaw(dir)) * Math.min(1, TURN_RATE * dt);
    }
    if (model.current) model.current.rotation.y = facing.current;

    // Follow camera: behind and above, easing so it never snaps.
    const o = orbit.current;
    const [ox, oy, oz] = cameraOffset(o.yaw, o.pitch, o.distance);
    const fx = pos.x;
    const fy = pos.y - CENTRE_HEIGHT + FOCUS_HEIGHT;
    const fz = pos.z;
    const cam = state.camera;
    cam.position.lerp(new THREE.Vector3(fx + ox, fy + oy, fz + oz), 1 - Math.exp(-CAMERA_FOLLOW * dt));
    cam.lookAt(fx, fy, fz);
  });

  return (
    <RigidBody
      ref={body}
      position={[SPAWN.x, SPAWN.y, SPAWN.z]}
      enabledRotations={[false, false, false]}
      colliders={false}
      canSleep={false}
      linearDamping={0}
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} friction={0} />
      <group ref={model} position={[0, -CENTRE_HEIGHT, 0]}>
        <Hero />
      </group>
    </RigidBody>
  );
}

/** Stand-in hero from simple shapes: robe, head, hat, a lantern to show which way is forward. */
function Hero() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.4, 1.1, 8]} />
        <meshStandardMaterial color="#3d5a80" flatShading />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color="#e0b88f" flatShading />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <coneGeometry args={[0.3, 0.45, 8]} />
        <meshStandardMaterial color="#293241" flatShading />
      </mesh>
      <mesh position={[0.28, 0.8, 0.3]} castShadow>
        <boxGeometry args={[0.12, 0.16, 0.12]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={0.6} flatShading />
      </mesh>
    </group>
  );
}
