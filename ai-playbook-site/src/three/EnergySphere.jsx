import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE, POINT_FRAG } from './shaders'
import { Glow } from './Glow'
import { easeOut, hash, pulseAt, seg, smooth, store, win } from '../core/timeline'

const VERT = /* glsl */ `
${NOISE}
uniform float uTime, uForm, uExplode, uPulse, uOpacity, uSize, uPR, uFocus, uMouseOn;
uniform vec3 uMouse;
attribute vec3 aScatter;
attribute vec4 aRand;
varying float vAlpha;
varying vec3 vColor;
mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
void main(){
  float f = clamp(uForm * 1.7 - aRand.x * 0.7, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  // living sphere: differential rotation + breathing + curl turbulence
  vec3 sph = position;
  sph.xz = rot(uTime * (0.10 + 0.08 * aRand.z) + sph.y * 0.25) * sph.xz;
  sph += curl(sph * 0.55 + uTime * 0.12) * 0.12;
  float shell = 1.0 + 0.05 * sin(uTime * 1.6 + aRand.w * 6.2831 + position.y * 2.5) + uPulse * (0.12 + 0.28 * aRand.x);
  sph *= shell;
  // scattered state drifts in a slow vortex toward the centre
  vec3 sc = aScatter;
  sc.xz = rot(uTime * 0.05 * (1.0 + aRand.y)) * sc.xz;
  sc += curl(sc * 0.08 + uTime * 0.05) * 1.2;
  vec3 p = mix(sc, sph, f);
  // explosion as the camera dives in
  p += normalize(p + 1e-4) * uExplode * (2.0 + aRand.y * 16.0) + curl(p * 0.3) * uExplode * 2.0;
  // mouse field
  vec3 d = p - uMouse;
  float dl = length(d);
  p += normalize(d + 1e-4) * max(0.0, 1.6 - dl) * 0.9 * uMouseOn;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  float coc = clamp(abs(depth - uFocus) / max(uFocus, 0.001), 0.0, 3.0); // depth of field
  gl_PointSize = uSize * (0.45 + aRand.w * 0.9) * (1.0 + coc * 2.2) * uPR * (12.0 / max(depth, 0.5));
  vAlpha = uOpacity * (0.25 + 0.75 * f + uExplode) / (1.0 + coc * 2.5);
  vec3 blue = vec3(0.09, 0.42, 1.0);
  vec3 ice = vec3(0.72, 0.86, 1.0);
  vColor = mix(blue, ice, aRand.z * aRand.z) * (1.0 + uPulse * 1.4);
  gl_Position = projectionMatrix * mv;
}
`

function fibSphere(n, r) {
  const out = new Float32Array(n * 3)
  const g = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = g * i
    const k = r * (i % 7 === 0 ? 0.35 + Math.random() * 0.6 : 0.96 + Math.random() * 0.08)
    out[i * 3] = Math.cos(th) * rad * k
    out[i * 3 + 1] = y * k
    out[i * 3 + 2] = Math.sin(th) * rad * k
  }
  return out
}

export function EnergySphere({ count = 50000 }) {
  const group = useRef()
  const core = useRef()
  const halo = useRef()
  const rays = useRef()
  const rings = useRef([])
  const { gl, camera } = useThree()

  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(fibSphere(count, 3.2), 3))
    const sc = new Float32Array(count * 3)
    const rnd = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const r = 6 + Math.pow(Math.random(), 0.6) * 34
      const s = Math.sqrt(1 - u * u)
      sc[i * 3] = Math.cos(th) * s * r
      sc[i * 3 + 1] = u * r * 0.6
      sc[i * 3 + 2] = Math.sin(th) * s * r
      for (let k = 0; k < 4; k++) rnd[i * 4 + k] = Math.random()
    }
    geo.setAttribute('aScatter', new THREE.BufferAttribute(sc, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uForm: { value: 0 }, uExplode: { value: 0 }, uPulse: { value: 0 },
        uOpacity: { value: 0 }, uSize: { value: 1.6 }, uPR: { value: 1 }, uFocus: { value: 12 },
        uMouse: { value: new THREE.Vector3(99, 99, 99) }, uMouseOn: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [count])

  const ray = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  // tilted energy wave rings
  const ringData = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => ({ rot: [hash(i) * Math.PI, hash(i + 9) * Math.PI, 0], t0: [1.0, 1.8, 2.6, 3.4, 4.2, 5.45][i] })),
    []
  )
  const ringMat = useMemo(
    () => ringData.map(() => new THREE.MeshBasicMaterial({ color: '#4f9bff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })),
    [ringData]
  )

  useFrame((state) => {
    const t = store.time
    const vis = t < 8.2
    group.current.visible = vis
    if (!vis) return
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uForm.value = smooth(seg(t, 0.5, 4.0))
    u.uExplode.value = Math.pow(seg(t, 4.95, 7.5), 1.6)
    u.uPulse.value = pulseAt(t)
    u.uOpacity.value = win(t, 0.25, 8.2, 1.4, 1.6)
    u.uPR.value = gl.getPixelRatio()
    u.uFocus.value = camera.position.length()
    // interactive particles: mouse ray onto plane through sphere centre
    if (store.pointerActive) {
      ray.setFromCamera(store.mouse, camera)
      plane.normal.copy(camera.position).normalize()
      if (ray.ray.intersectPlane(plane, hit)) u.uMouse.value.lerp(hit, 0.2)
      u.uMouseOn.value += (1 - u.uMouseOn.value) * 0.05
    } else u.uMouseOn.value *= 0.95

    // tiny electric light → energy core
    const birth = easeOut(seg(t, 0.05, 1.2))
    const pul = pulseAt(t)
    core.current.material.uniforms.uOpacity.value = birth * (0.9 + pul * 1.4) * (1 - seg(t, 5.0, 5.8))
    core.current.scale.setScalar(0.6 + 2.2 * seg(t, 0.3, 4) + pul * 1.2)
    halo.current.material.uniforms.uOpacity.value = (0.35 * seg(t, 0.8, 4) + pul * 0.35) * (1 - seg(t, 5.0, 6))
    halo.current.scale.setScalar(14 + pul * 6)
    rays.current.material.uniforms.uOpacity.value = (0.13 + pulseAt(t) * 0.12) * win(t, 1.5, 6.0, 2, 0.8)
    rays.current.material.uniforms.uTime.value = state.clock.elapsedTime
    rays.current.scale.setScalar(26)

    ringData.forEach((r, i) => {
      const m = rings.current[i]
      const k = seg(t, r.t0, r.t0 + 1.6)
      const on = t >= r.t0 && k < 1
      m.visible = on
      if (!on) return
      m.scale.setScalar(2.4 + easeOut(k) * 16)
      ringMat[i].opacity = (1 - k) * 0.55
    })
  })

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <Glow ref={core} color="#9fd0ff" size={1} power={3.0} />
      <Glow ref={halo} color="#176BFF" size={1} power={2.4} />
      <Glow ref={rays} color="#2a6fff" size={1} power={4} rays={0.9} />
      {ringData.map((r, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} rotation={r.rot} material={ringMat[i]} visible={false}>
          <ringGeometry args={[0.985, 1, 160]} />
        </mesh>
      ))}
    </group>
  )
}
