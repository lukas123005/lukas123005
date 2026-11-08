import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bookLive } from '../core/bookPose'
import { easeOut, hash, pulseAt, seg, STAGE, store, win } from '../core/timeline'
import { Glow } from './Glow'
import { POINT_FRAG } from './shaders'

const RING_FRAG = /* glsl */ `
uniform float uTime, uOpacity, uSpeed, uDash; uniform vec3 uColor;
varying vec2 vUv;
void main(){
  float d = fract(vUv.x * uDash - uTime * uSpeed);
  float dash = smoothstep(0.0, 0.08, d) * smoothstep(0.62, 0.5, d);
  float head = smoothstep(0.5, 0.62, d) * smoothstep(0.66, 0.62, d) * 2.0;
  gl_FragColor = vec4(uColor * (0.25 + dash + head) * uOpacity, 1.0);
}
`
const RAY_FRAG = /* glsl */ `
uniform float uTime, uOpacity; uniform vec3 uColor;
varying vec2 vUv;
void main(){
  float a = vUv.x * 6.2831;
  float rays = 0.55 + 0.45 * sin(a * 7.0 + uTime * 0.3) * sin(a * 13.0 - uTime * 0.2);
  float fall = pow(vUv.y, 1.6);
  gl_FragColor = vec4(uColor * rays * fall * uOpacity, 1.0);
}
`
const SHOCK_FRAG = /* glsl */ `
uniform float uOpacity, uWidth;
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(uWidth, 0.0, abs(r - 0.92)) ;
  float inner = smoothstep(0.92, 0.0, r) * 0.12;
  vec3 col = mix(vec3(0.15, 0.45, 1.0), vec3(1.0, 0.78, 0.4), smoothstep(0.85, 0.97, r));
  gl_FragColor = vec4(col * (ring * 2.5 + inner) * uOpacity, 1.0);
}
`
const ORBIT_VERT = /* glsl */ `
uniform float uTime, uOpacity, uPR, uSuck;
uniform vec3 uCenter;
attribute vec4 aOrbit; // radius, speed, phase, tilt
attribute vec2 aRand;
varying float vAlpha; varying vec3 vColor;
void main(){
  float ang = aOrbit.z + uTime * aOrbit.y;
  float r = aOrbit.x * (1.0 - uSuck * 0.95);
  vec3 p = vec3(cos(ang) * r, sin(ang * 2.0 + aOrbit.z) * 0.35 + (aRand.x - 0.5) * 2.8, sin(ang) * r);
  float c = cos(aOrbit.w), s = sin(aOrbit.w);
  p.xy = mat2(c, -s, s, c) * p.xy;
  p += uCenter;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.5 + aRand.y * 3.5) * uPR * (12.0 / max(-mv.z, 0.5));
  vAlpha = uOpacity * (0.5 + 0.5 * sin(uTime * 3.0 + aOrbit.z * 10.0));
  vColor = vec3(1.0, 0.78, 0.4) * 1.6;
  gl_Position = projectionMatrix * mv;
}
`

function bolt(a, b, seed, segs = 14, amp = 0.35) {
  const pts = []
  for (let i = 0; i <= segs; i++) {
    const k = i / segs
    const p = a.clone().lerp(b, k)
    if (i > 0 && i < segs) {
      const j = amp * Math.sin(Math.PI * k)
      p.x += (hash(seed + i * 1.7) - 0.5) * j
      p.y += (hash(seed + i * 2.3) - 0.5) * j
      p.z += (hash(seed + i * 3.1) - 0.5) * j
    }
    pts.push(p)
  }
  return pts
}

export function RevealFX({ gold = 1500 }) {
  const { gl } = useThree()
  const group = useRef()
  const rings = useRef([])
  const flash = useRef()
  const halo = useRef()
  const goldPts = useRef()
  const lightning = useRef()
  const rays = useRef()
  const shock = useRef()
  const shockGlow = useRef()
  const flashG = useRef()
  const haloG = useRef()
  const shockG = useRef()

  const ringMats = useMemo(
    () =>
      [
        ['#3b86ff', 26, 0.25],
        ['#e8c27c', 18, -0.18],
        ['#7fb6ff', 40, 0.35],
      ].map(
        ([c, dash, sp]) =>
          new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(c).multiplyScalar(2.2) }, uDash: { value: dash }, uSpeed: { value: sp } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: RING_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
      ),
    []
  )
  const rayMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#d9b56f') } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: RAY_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  )
  const shockMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uWidth: { value: 0.04 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: SHOCK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )
  const { goldGeo, goldMat } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const o = new Float32Array(gold * 4)
    const r = new Float32Array(gold * 2)
    for (let i = 0; i < gold; i++) {
      o.set([2.4 + Math.random() * 1.8, (0.12 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1), Math.random() * 6.283, (Math.random() - 0.5) * 0.5], i * 4)
      r.set([Math.random(), Math.random()], i * 2)
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gold * 3), 3))
    g.setAttribute('aOrbit', new THREE.BufferAttribute(o, 4))
    g.setAttribute('aRand', new THREE.BufferAttribute(r, 2))
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPR: { value: 1 }, uSuck: { value: 0 }, uCenter: { value: new THREE.Vector3() } },
      vertexShader: ORBIT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { goldGeo: g, goldMat: m }
  }, [gold])

  const boltGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 14 * 2 * 3), 3))
    return g
  }, [])
  const boltMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#9fd0ff').multiplyScalar(4), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), [])

  const A = useMemo(() => new THREE.Vector3(), [])
  const Bv = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const t = store.time
    const vis = t > 18.8
    group.current.visible = vis
    if (!vis) return
    const et = state.clock.elapsedTime
    const c = bookLive.position
    const open = bookLive.open

    // --- explosion flash (19.0) and materialise flash (22.6)
    const f1 = Math.exp(-Math.max(0, t - 19.0) * 3.2) * (t >= 18.98 ? 1 : 0)
    const f2 = Math.exp(-Math.max(0, t - 22.6) * 3.0) * (t >= 22.58 ? 1 : 0)
    flash.current.material.uniforms.uOpacity.value = f1 * 1.1 + f2 * 0.55
    flashG.current.position.copy(STAGE.book)
    flash.current.scale.setScalar(6 + 26 * (1 - f1))
    halo.current.material.uniforms.uOpacity.value = 0.32 * win(t, 22.4, 39.5, 1.5, 1) + 0.25 * win(t, 41.5, 53, 1, 1)
    haloG.current.position.set(c.x, c.y, c.z - 1.2)
    halo.current.scale.setScalar(13)

    // --- energy rings around the book
    const ringA = win(t, 22.7, 29.6, 1.2, 0.8) + 0.3 * win(t, 41.6, 48.3, 1.0, 0.8)
    rings.current.forEach((m, i) => {
      if (!m) return
      m.position.copy(c)
      m.rotation.set(1.25 + i * 0.35 + Math.sin(et * 0.3 + i) * 0.1, et * (0.15 + i * 0.07), i * 0.6)
      const sc = 1 + 0.03 * Math.sin(et * 2 + i) + 0.4 * (1 - easeOut(seg(t, 22.7, 24.2)))
      m.scale.setScalar(sc)
      ringMats[i].uniforms.uTime.value = et
      ringMats[i].uniforms.uOpacity.value = ringA * (1 + pulseAt(t) * 2)
    })

    // --- golden particles orbiting the product
    goldMat.uniforms.uTime.value = et
    goldMat.uniforms.uCenter.value.copy(c)
    goldMat.uniforms.uPR.value = gl.getPixelRatio()
    goldMat.uniforms.uOpacity.value = win(t, 23.0, 53, 1.5, 1) * (1 - 0.6 * open)
    goldMat.uniforms.uSuck.value = Math.pow(seg(t, 39.2, 41.4), 2) * (1 - seg(t, 41.5, 43.5))

    // --- blue lightning (deterministic per 70ms tick so scrubbing is stable)
    const la = win(t, 19.1, 23.2, 0.1, 0.6) + 0.8 * win(t, 41.5, 42.6, 0.05, 0.6)
    const tick = Math.floor(t * 14)
    const arr = boltGeo.attributes.position.array
    let k = 0
    for (let b = 0; b < 6; b++) {
      const on = hash(tick * 3.1 + b) > 0.35
      const ang = hash(tick + b * 7.7) * Math.PI * 2
      const rad = 3.0 + hash(tick * 1.3 + b) * 1.5
      A.set(c.x + Math.cos(ang) * rad, c.y + (hash(b + tick) - 0.5) * 3, c.z + Math.sin(ang) * rad)
      Bv.set(c.x + (hash(b * 5 + tick) - 0.5) * 2, c.y + (hash(b * 9 + tick) - 0.5) * 2.8, c.z + (hash(b * 2 + tick) - 0.5) * 0.3)
      const pts = bolt(A, Bv, tick * 13 + b * 101)
      for (let i = 0; i < 14; i++) {
        const p0 = on ? pts[i] : c
        const p1 = on ? pts[i + 1] : c
        arr[k++] = p0.x; arr[k++] = p0.y; arr[k++] = p0.z
        arr[k++] = p1.x; arr[k++] = p1.y; arr[k++] = p1.z
      }
    }
    boltGeo.attributes.position.needsUpdate = true
    boltMat.opacity = la * (0.6 + 0.4 * hash(tick))

    // --- volumetric light rays from above
    rays.current.position.set(c.x, c.y + 5.2, c.z - 0.4)
    rayMat.uniforms.uTime.value = et
    rayMat.uniforms.uOpacity.value = 0.32 * win(t, 22.2, 39.5, 2, 1) + 0.5 * win(t, 41.5, 53, 1.2, 1)

    // --- final shockwave (41.6)
    const sk = seg(t, 41.55, 43.0)
    shock.current.visible = t > 41.55 && sk < 1
    shock.current.position.copy(c)
    shock.current.scale.setScalar(0.5 + easeOut(sk) * 34)
    shockMat.uniforms.uOpacity.value = 1 - sk
    shockGlow.current.material.uniforms.uOpacity.value = Math.exp(-Math.max(0, t - 41.6) * 3.5) * (t > 41.55 ? 1.6 : 0)
    shockG.current.position.copy(c)
    shockGlow.current.scale.setScalar(4 + 30 * sk)
  })

  return (
    <group ref={group}>
      <group ref={flashG}><Glow ref={flash} color="#8ec5ff" size={1} power={1.8} rays={0.8} opacity={0} /></group>
      <group ref={haloG}><Glow ref={halo} color="#1b4fb8" size={1} power={2.2} opacity={0} /></group>
      <group ref={shockG}><Glow ref={shockGlow} color="#ffd590" size={1} power={2.0} rays={0.6} opacity={0} /></group>
      {[3.0, 3.35, 3.75].map((r, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} material={ringMats[i]} frustumCulled={false}>
          <torusGeometry args={[r, 0.01 + i * 0.004, 6, 220]} />
        </mesh>
      ))}
      <points ref={goldPts} geometry={goldGeo} material={goldMat} frustumCulled={false} />
      <lineSegments ref={lightning} geometry={boltGeo} material={boltMat} frustumCulled={false} />
      <mesh ref={rays} material={rayMat} frustumCulled={false}>
        <cylinderGeometry args={[0.6, 4.2, 10, 64, 1, true]} />
      </mesh>
      <mesh ref={shock} material={shockMat} visible={false} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  )
}
