// Arc Reactor Core — flowing energy contained inside a sphere.
// Custom shader with swirling plasma currents, energy veins, and a hot center.

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uImpulse;
  uniform float uState; // 0=idle, 1=auth, 2=error, 3=success, 4=unlock
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  // Simplex-like noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float speed = uState == 1.0 ? 1.5 : uState == 2.0 ? 0.5 : uState == 3.0 ? 2.0 : 1.0;
    float t = uTime * speed * 0.25;

    vec3 pos = normalize(vPosition) * 1.5;

    // Very slow, large-scale flow — like clouds inside a sphere
    float flow1 = snoise(pos * 1.0 + vec3(t * 0.12, t * 0.08, t * 0.05)) * 0.5 + 0.5;
    float flow2 = snoise(pos * 1.6 + vec3(-t * 0.1, t * 0.06, -t * 0.08)) * 0.5 + 0.5;
    float flow3 = snoise(pos * 0.7 + vec3(t * 0.05, -t * 0.07, t * 0.09)) * 0.5 + 0.5;

    // Gentle blend — all stays in a narrow range, no harsh contrast
    float plasma = flow1 * 0.35 + flow2 * 0.35 + flow3 * 0.3;
    plasma = smoothstep(0.25, 0.75, plasma); // compress range — less contrast
    plasma += uImpulse * 0.1;

    // Fresnel
    float fresnel = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));

    // Energy is mostly the plasma flow, barely affected by center
    float energy = plasma;

    // Color stays within the cyan family — NO white, just light cyan at brightest
    vec3 deep = uColor * 0.25;       // dark teal
    vec3 mid = uColor * 0.7;         // medium cyan
    vec3 bright = uColor * 1.0;      // full cyan — NOT white

    vec3 color = mix(deep, mid, smoothstep(0.0, 0.5, energy));
    color = mix(color, bright, smoothstep(0.5, 1.0, energy));

    // Soft darker edge — orb fades at the rim
    color *= (1.0 - fresnel * 0.4);

    // Error — gentle warm
    if (uState == 2.0) {
      float warm = sin(uTime * 2.5) * 0.5 + 0.5;
      color = mix(color, vec3(0.8, 0.15, 0.2), warm * 0.3);
    }

    // Success — slightly brighter
    if (uState == 3.0) {
      color *= 1.3;
    }

    gl_FragColor = vec4(color, 0.9);
  }
`;

export default function ArcReactorCore({ state, impulse }) {
  const meshRef = useRef();
  const matRef = useRef();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uImpulse: { value: 0 },
    uState: { value: 0 },
    uColor: { value: new THREE.Color("#00e5ff") },
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const imp = impulse?.current ?? 0;

    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uImpulse.value = imp;

      let stateVal = 0;
      if (state === "authenticating") stateVal = 1;
      else if (state === "error") stateVal = 2;
      else if (state === "success") stateVal = 3;
      else if (state === "unlocking") stateVal = 4;
      matRef.current.uniforms.uState.value = stateVal;
    }

    if (meshRef.current) {
      let s = 0.6;
      if (state === "authenticating") s = 0.65;
      else if (state === "success") s = 0.75;
      else if (state === "unlocking") s = 0.7 + t * 0.3;
      else if (state === "error") s = 0.55 + Math.sin(t * 18) * 0.04;
      meshRef.current.scale.setScalar(s + Math.sin(t * 1.5) * 0.015 + imp * 0.05);
      meshRef.current.rotation.y = t * 0.1;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}
