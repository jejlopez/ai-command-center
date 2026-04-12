// 3D JARVIS Reactor — vivid, sharp, not washed out.
// Smaller particles, intense core glow, crisp rings.

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, Ring } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import ArcReactorCore from "./ArcReactorCore.jsx";

function getTimeColor() {
  const hour = new Date().getHours();
  // Always vivid — no washed-out purple. Core is always cyan-dominant.
  if (hour >= 6 && hour < 12) return { core: "#00f0ff", accent: "#00e5a0", ring3: "#4488ff" };
  if (hour >= 12 && hour < 18) return { core: "#00e5ff", accent: "#00d4aa", ring3: "#4477ff" };
  if (hour >= 18 && hour < 22) return { core: "#00ddff", accent: "#ffaa30", ring3: "#4499ff" };
  return { core: "#00e5ff", accent: "#00ccbb", ring3: "#5588ff" }; // night — still cyan, not purple
}

// Tiny sharp particles — not blobs
function Particles({ count = 180, state, impulse }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = getTimeColor();

  const pts = useMemo(() =>
    Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.3 + Math.random() * 1.6;
      return {
        y: r * Math.cos(phi),
        speed: 0.1 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
        radius: r,
        size: 0.005 + Math.random() * 0.01, // TINY
      };
    }), [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    let sp = 1, rm = 1;
    if (state === "authenticating") sp = 2.5;
    else if (state === "error") { sp = 0.2; rm = 1.5; }
    else if (state === "success") { sp = 5; rm = 0.2; }
    else if (state === "unlocking") { sp = 8; rm = 4; }

    const imp = (impulse?.current ?? 0) * 0.25;

    pts.forEach((p, i) => {
      const a = t * p.speed * sp + p.offset;
      const r = p.radius * rm - imp;
      dummy.position.set(r * Math.cos(a), p.y * rm + Math.sin(t * 0.4 + p.offset) * 0.15, r * Math.sin(a));
      dummy.scale.setScalar(p.size * (state === "unlocking" ? 4 : 1));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={c.core} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function CoreOrb({ state, impulse }) {
  return (
    <Float speed={state === "error" ? 0 : 0.6} rotationIntensity={0.06} floatIntensity={0.08}>
      <ArcReactorCore state={state} impulse={impulse} />
    </Float>
  );
}

function HoloRings({ state }) {
  const r1 = useRef(), r2 = useRef(), r3 = useRef();
  const c = getTimeColor();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (state === "error") {
      const j = Math.sin(t * 22) * 0.12;
      if (r1.current) { r1.current.rotation.x = t * 0.3 + j; r1.current.rotation.z = Math.cos(t * 19) * 0.1; }
      if (r2.current) { r2.current.rotation.y = t * 0.4 + j; r2.current.rotation.x = Math.PI / 3 + j; }
      if (r3.current) { r3.current.rotation.z = -t * 0.2 + j; }
      return;
    }
    if (state === "success") {
      if (r1.current) { r1.current.rotation.x = THREE.MathUtils.lerp(r1.current.rotation.x, 0, 0.06); r1.current.rotation.z *= 0.95; }
      if (r2.current) { r2.current.rotation.x = THREE.MathUtils.lerp(r2.current.rotation.x, 0, 0.05); r2.current.rotation.y += 0.1; }
      if (r3.current) { r3.current.rotation.x = THREE.MathUtils.lerp(r3.current.rotation.x, 0, 0.04); r3.current.rotation.z += 0.07; }
      return;
    }

    const sp = state === "authenticating" ? 2 : state === "unlocking" ? 7 : 1;
    if (r1.current) { r1.current.rotation.x = t * 0.2 * sp; r1.current.rotation.z = t * 0.06; }
    if (r2.current) { r2.current.rotation.y = t * 0.28 * sp; r2.current.rotation.x = Math.PI / 3; }
    if (r3.current) { r3.current.rotation.z = -t * 0.15 * sp; r3.current.rotation.x = Math.PI / 2.2; }
  });

  // Thinner, crisper rings
  return (
    <group>
      <Ring ref={r1} args={[0.95, 0.97, 128]}>
        <meshBasicMaterial color={c.core} transparent opacity={0.25} side={THREE.DoubleSide} />
      </Ring>
      <Ring ref={r2} args={[1.2, 1.22, 128]}>
        <meshBasicMaterial color={c.accent} transparent opacity={0.15} side={THREE.DoubleSide} />
      </Ring>
      <Ring ref={r3} args={[1.48, 1.5, 128]}>
        <meshBasicMaterial color={c.ring3} transparent opacity={0.08} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
}

function CameraRig({ state }) {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    if (state === "unlocking") {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 1.5, 0.015);
    } else if (state === "error") {
      camera.position.x = Math.sin(t * 14) * 0.04;
      camera.position.y = Math.cos(t * 11) * 0.03;
    } else {
      camera.position.x = Math.sin(t * 0.08) * 0.15;
      camera.position.y = Math.cos(t * 0.06) * 0.08;
    }
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function JarvisReactor({ state = "idle", impulse }) {
  const defaultImp = useRef(0);
  const imp = impulse || defaultImp;
  const c = getTimeColor();

  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 36 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1.5, 2]}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0} />
      <pointLight position={[0, 0, 0]} intensity={0.3} color={c.core} distance={2.5} decay={3} />

      <CameraRig state={state} />
      <CoreOrb state={state} impulse={imp} />
      <HoloRings state={state} />
      <Particles count={180} state={state} impulse={imp} />

      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.25} luminanceSmoothing={0.3} radius={0.4} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
