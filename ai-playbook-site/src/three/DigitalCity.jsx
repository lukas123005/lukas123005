import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cityHolo } from './textures'
import { hash, pulseAt, STAGE, store, win } from '../core/timeline'

const BUILD_VERT = /* glsl */ `
attribute vec3 aSize;
attribute float aSeed;
varying vec3 vLocal; varying vec3 vSize; varying float vSeed; varying vec3 vNormal2; varying float vFog;
void main(){
  vLocal = position + 0.5;           // 0..1 inside the unit box
  vSize = aSize; vSeed = aSeed;
  vNormal2 = normal;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const BUILD_FRAG = /* glsl */ `
uniform float uTime, uOpacity, uPulse;
varying vec3 vLocal; varying vec3 vSize; varying float vSeed; varying vec3 vNormal2; varying float vFog;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main(){
  vec3 base = vec3(0.012, 0.02, 0.045);
  // face coordinates in metres
  vec2 f = abs(vNormal2.y) > 0.5 ? vLocal.xz * vSize.xz : (abs(vNormal2.x) > 0.5 ? vLocal.zy * vSize.zy : vLocal.xy * vSize.xy);
  vec2 cell = floor(f / vec2(1.1, 1.4));
  vec2 g = fract(f / vec2(1.1, 1.4));
  float win = step(0.28, g.x) * step(g.x, 0.78) * step(0.3, g.y) * step(g.y, 0.75);
  float on = step(0.62, h(cell + vSeed * 13.0 + floor(uTime * 0.25 + vSeed * 7.0)));
  vec3 wc = mix(vec3(0.15, 0.5, 1.0), vec3(0.75, 0.88, 1.0), h(cell + 3.1));
  if (vSeed > 0.93) wc = vec3(1.0, 0.78, 0.42);
  vec3 col = base + wc * win * on * (abs(vNormal2.y) > 0.5 ? 0.0 : 1.4);
  // glowing edges
  vec3 e = min(vLocal, 1.0 - vLocal) * vSize;
  float edge = 0.0;
  if (abs(vNormal2.x) > 0.5) edge = min(e.y, e.z);
  else if (abs(vNormal2.y) > 0.5) edge = min(e.x, e.z);
  else edge = min(e.x, e.y);
  col += vec3(0.1, 0.45, 1.0) * smoothstep(0.12, 0.0, edge) * (1.6 + uPulse * 2.0);
  // scanning band rising up the towers
  float band = smoothstep(0.6, 0.0, abs(fract(vLocal.y * vSize.y * 0.02 - uTime * 0.3) - 0.5) * 8.0);
  col += vec3(0.05, 0.2, 0.6) * band * 0.4;
  float fog = exp(-vFog * 0.006);
  gl_FragColor = vec4(col * fog * uOpacity, 1.0);
}
`

const GRID_FRAG = /* glsl */ `
uniform float uOpacity, uTime;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 220.0;
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  vec2 q = vUv * 22.0;
  vec2 g2 = abs(fract(q - 0.5) - 0.5) / fwidth(q);
  float major = 1.0 - min(min(g2.x, g2.y), 1.0);
  float r = length(vUv - 0.5) * 2.0;
  float fade = smoothstep(1.0, 0.1, r);
  float pulse = smoothstep(0.03, 0.0, abs(r - fract(uTime * 0.18))) * 0.8;
  vec3 col = vec3(0.08, 0.35, 1.0) * (line * 0.35 + major * 0.9 + pulse * major * 3.0);
  gl_FragColor = vec4(col * fade * uOpacity, 1.0);
}
`

const KINDS = ['assistant', 'creation', 'business', 'production', 'product']

export function DigitalCity({ count = 800 }) {
  const group = useRef()
  const mesh = useRef()
  const holos = useRef([])
  const streaks = useRef()

  const { geo, mat, gridMat, holoData, streakData, ringMats } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const sizes = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const mats = []
    let k = 0
    const N = Math.ceil(Math.sqrt(count))
    for (let i = 0; i < N && k < count; i++) {
      for (let j = 0; j < N && k < count; j++) {
        const x = (i - N / 2) * 7 + (hash(k) - 0.5) * 2
        const z = (j - N / 2) * 7 + (hash(k + 1) - 0.5) * 2
        if (Math.abs(x) < 5 || Math.abs(z + 40) < 4) continue // boulevards
        const dist = Math.sqrt(x * x + (z + 30) * (z + 30))
        const hgt = 4 + Math.pow(hash(k + 2), 3) * 70 * Math.max(0.25, 1 - dist / 160) + (hash(k + 9) > 0.97 ? 40 : 0)
        const w = 2.5 + hash(k + 3) * 3
        const d = 2.5 + hash(k + 4) * 3
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x, hgt / 2, z),
          new THREE.Quaternion(),
          new THREE.Vector3(w, hgt, d)
        )
        mats.push(m)
        sizes.set([w, hgt, d], k * 3)
        seeds[k] = hash(k + 11)
        k++
      }
    }
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPulse: { value: 0 } },
      vertexShader: BUILD_VERT,
      fragmentShader: BUILD_FRAG,
    })
    mat.userData.matrices = mats
    const gridMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: GRID_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      extensions: { derivatives: true },
    })
    const holoData = KINDS.map((kind, i) => ({ kind, tex: cityHolo(kind), i }))
    const streakData = Array.from({ length: 140 }, (_, i) => ({
      lane: (hash(i) - 0.5) * 120,
      y: 1 + hash(i + 1) * 30,
      speed: 40 + hash(i + 2) * 90,
      off: hash(i + 3) * 300,
      axis: i % 3 === 0 ? 'x' : 'z',
      gold: i % 7 === 0,
    }))
    const ringMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#3d8bff').multiplyScalar(2), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
    return { geo, mat, gridMat, holoData, streakData, ringMats }
  }, [count])

  const streakGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.12, 6), [])
  const streakMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  const cBlue = useMemo(() => new THREE.Color('#6fb0ff').multiplyScalar(3), [])
  const cGold = useMemo(() => new THREE.Color('#ffcf7a').multiplyScalar(3), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const ready = useRef(false)
  const rings = useRef([])
  const fwdV = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const t = store.time
    const vis = t > 11.7 && t < 19.4
    group.current.visible = vis
    if (!vis) return
    const et = state.clock.elapsedTime
    if (!ready.current) {
      mat.userData.matrices.forEach((m, i) => mesh.current.setMatrixAt(i, m))
      mesh.current.count = mat.userData.matrices.length
      mesh.current.instanceMatrix.needsUpdate = true
      ready.current = true
    }
    const a = win(t, 11.9, 19.3, 0.35, 0.35)
    // buildings rise out of the grid during the explosive transition
    const rise = 1 - Math.pow(1 - Math.min(1, Math.max(0, (t - 12.0) / 1.6)), 3)
    group.current.children[0].scale.y = 0.02 + 0.98 * rise
    mat.uniforms.uOpacity.value = a
    mat.uniforms.uTime.value = et
    mat.uniforms.uPulse.value = pulseAt(t)
    gridMat.uniforms.uOpacity.value = a
    gridMat.uniforms.uTime.value = et

    // holograms orbit around the moving camera
    const cam = state.camera
    holos.current.forEach((g, i) => {
      if (!g) return
      const ang = et * 0.25 + (i / KINDS.length) * Math.PI * 2
      const r = 8 + Math.sin(et * 0.5 + i) * 1.2
      const fwd = state.camera.getWorldDirection(fwdV)
      g.position.set(
        cam.position.x + fwd.x * 14 + Math.cos(ang) * r - STAGE.city.x,
        cam.position.y + fwd.y * 14 + Math.sin(ang * 1.3) * 2.6 - STAGE.city.y,
        cam.position.z + fwd.z * 14 + Math.sin(ang) * r * 0.5 - STAGE.city.z
      )
      g.lookAt(cam.position)
      const appear = win(t, 12.4 + i * 0.35, 19.2, 0.6, 0.4)
      g.children[0].material.opacity = appear * 0.75
      g.scale.setScalar(0.4 + 0.6 * appear)
      g.children[1].rotation.z = et * 0.6 * (i % 2 ? 1 : -1)
      g.children[1].material.opacity = appear * 0.8
    })
    // light streaks along the boulevards
    streakData.forEach((s, i) => {
      const d = ((s.off + et * s.speed) % 300) - 150
      if (s.axis === 'z') tmp.position.set(s.lane * 0.05 + (i % 2 ? 2 : -2), s.y * 0.2 + 0.5, d - 40)
      else tmp.position.set(d, s.y * 0.2 + 0.5, -40 + (i % 2 ? 1.5 : -1.5))
      tmp.rotation.set(0, s.axis === 'x' ? Math.PI / 2 : 0, 0)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      streaks.current.setMatrixAt(i, tmp.matrix)
      streaks.current.setColorAt(i, s.gold ? cGold : cBlue)
    })
    streaks.current.instanceMatrix.needsUpdate = true
    if (streaks.current.instanceColor) streaks.current.instanceColor.needsUpdate = true
    // floating halo rings over the city
    rings.current.forEach((m, i) => {
      if (!m) return
      m.rotation.z = et * (0.2 + i * 0.1)
      ringMats[i].opacity = 0.7 * a
    })
  })

  return (
    <group ref={group} position={STAGE.city}>
      <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -30]} material={gridMat}>
        <planeGeometry args={[400, 400]} />
      </mesh>
      <instancedMesh ref={streaks} args={[streakGeo, streakMat, streakData.length]} frustumCulled={false} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} position={[0, 45 + i * 9, -60]} rotation={[Math.PI / 2, 0, 0]} material={ringMats[i]}>
          <ringGeometry args={[18 + i * 7, 18.3 + i * 7, 128]} />
        </mesh>
      ))}
      {holoData.map((h, i) => (
        <group key={h.kind} ref={(el) => (holos.current[i] = el)}>
          <mesh renderOrder={10}>
            <planeGeometry args={[2.8, 2.8]} />
            <meshBasicMaterial map={h.tex} transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, -0.2]} renderOrder={10}>
            <ringGeometry args={[1.85, 1.89, 96]} />
            <meshBasicMaterial color={i === 4 ? '#e8c27c' : '#4f9bff'} transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
