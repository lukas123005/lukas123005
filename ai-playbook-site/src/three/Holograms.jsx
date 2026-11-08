import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CONFIG } from '../config'
import { bookLive } from '../core/bookPose'
import { easeIn, easeOut, seg, smooth, store } from '../core/timeline'
import { holoCard } from './textures'

const CARD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const CARD_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uOpacity, uTime, uAppear;
varying vec2 vUv;
void main(){
  // materialise with a scan line sweeping upward + subtle flicker
  float scan = smoothstep(uAppear + 0.02, uAppear - 0.02, vUv.y);
  float line = smoothstep(0.03, 0.0, abs(vUv.y - uAppear)) * (1.0 - step(0.999, uAppear));
  vec4 c = texture2D(uMap, vUv);
  float flick = 0.92 + 0.08 * sin(uTime * 40.0 + vUv.y * 80.0);
  vec3 col = c.rgb * c.a * scan * flick + vec3(0.3, 0.6, 1.0) * line * 2.0;
  gl_FragColor = vec4(col * uOpacity, 1.0);
}
`

const EMBLEMS = [
  () => new THREE.IcosahedronGeometry(0.34, 0),
  () => new THREE.TorusGeometry(0.28, 0.08, 8, 24),
  () => new THREE.OctahedronGeometry(0.36, 0),
  () => new THREE.TorusKnotGeometry(0.22, 0.06, 64, 8),
  () => new THREE.DodecahedronGeometry(0.32, 0),
  () => new THREE.BoxGeometry(0.42, 0.52, 0.12),
  () => new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6),
  () => new THREE.SphereGeometry(0.3, 10, 8),
  () => new THREE.TetrahedronGeometry(0.4, 0),
]

const EMERGE = (i) => 31.0 + i * 0.72

export function Holograms() {
  const group = useRef()
  const items = useRef([])
  const trails = useRef()

  const { cards, emblems, trailGeo, trailMat, links } = useMemo(() => {
    const cards = CONFIG.topics.map(
      (tp, i) =>
        new THREE.ShaderMaterial({
          uniforms: { uMap: { value: holoCard(tp, i) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uAppear: { value: 0 } },
          vertexShader: CARD_VERT,
          fragmentShader: CARD_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        })
    )
    const emblems = CONFIG.topics.map((_, i) => ({
      geo: new THREE.EdgesGeometry(EMBLEMS[i](), 1),
      mat: new THREE.LineBasicMaterial({ color: new THREE.Color(i % 3 === 1 ? '#f0c77c' : '#7ab5ff').multiplyScalar(2.4), transparent: true, opacity: 0, toneMapped: false }),
    }))
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 2 * 3 + 9 * 2 * 3), 3))
    trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9 * 2 * 3 + 9 * 2 * 3), 3))
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    const links = CONFIG.topics.map((_, i) => [i, (i + 1) % 9])
    return { cards, emblems, trailGeo, trailMat, links }
  }, [])

  const cam = useRef(new THREE.Vector3())
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const t = store.time
    const vis = t > 30.8 && t < 40.8
    group.current.visible = vis
    if (!vis) return
    const et = state.clock.elapsedTime
    const c = bookLive.position
    const portrait = store.aspect < 0.9
    const rx = portrait ? 1.7 : 4.1
    const ry = portrait ? 3.3 : 2.45
    const suck = easeIn(seg(t, 39.0, 40.4))
    cam.current.copy(state.camera.position)
    const pos = trailGeo.attributes.position.array
    const col = trailGeo.attributes.color.array
    const P = []
    items.current.forEach((g, i) => {
      if (!g) return
      const te = EMERGE(i)
      const em = easeOut(seg(t, te, te + 1.25))
      const ang = Math.PI / 2 + (i / 9) * Math.PI * 2 + (t - 31) * 0.045
      // ring target in the plane facing the camera, with depth variation
      const tx = c.x + Math.cos(ang) * rx
      const ty = c.y + Math.sin(ang) * ry * 0.92 + 0.1 * Math.sin(et + i)
      const tz = c.z - 0.9 + Math.sin(ang * 2 + i) * 0.45
      // emerge from the open pages, arcing toward the viewer
      const sx = c.x + 0.4
      const sy = c.y
      const sz = c.z + 0.2
      const arc = Math.sin(Math.PI * em) * 1.6
      let x = sx + (tx - sx) * em
      let y = sy + (ty - sy) * em
      let z = sz + (tz - sz) * em + arc
      // final impact: everything is pulled back into the book
      x += (c.x - x) * suck
      y += (c.y - y) * suck
      z += (c.z - z) * suck
      g.position.set(x, y, z)
      g.lookAt(cam.current)
      const s = (0.2 + 0.6 * em) * (1 - suck * 0.9) * (portrait ? 0.78 : 1)
      g.scale.setScalar(s)
      const op = Math.min(1, em * 1.4) * (1 - seg(t, 40.0, 40.5))
      const m = cards[i]
      m.uniforms.uOpacity.value = op
      m.uniforms.uAppear.value = smooth(seg(t, te + 0.15, te + 1.0))
      m.uniforms.uTime.value = et
      const e = g.children[1]
      e.rotation.set(et * 0.7 + i, et * 0.9, 0)
      emblems[i].mat.opacity = op
      P.push([x, y, z, op])
      // trail from book to hologram
      tmp.set(c.x, c.y, c.z + 0.15)
      pos.set([tmp.x, tmp.y, tmp.z, x, y, z], i * 6)
      const k = op * (0.35 + 0.25 * Math.sin(et * 3 + i))
      col.set([0.1 * k, 0.4 * k, 1.2 * k, 0.6 * k, 0.8 * k, 1.4 * k], i * 6)
    })
    // ecosystem links between neighbours
    links.forEach(([a, b], j) => {
      const A = P[a]
      const B = P[b]
      if (!A || !B) return
      const o = 54 + j * 6
      pos.set([A[0], A[1], A[2], B[0], B[1], B[2]], o)
      const k = Math.min(A[3], B[3]) * 0.25
      col.set([0.8 * k, 0.65 * k, 0.35 * k, 0.8 * k, 0.65 * k, 0.35 * k], o)
    })
    trailGeo.attributes.position.needsUpdate = true
    trailGeo.attributes.color.needsUpdate = true
  })

  return (
    <group ref={group}>
      <lineSegments ref={trails} geometry={trailGeo} material={trailMat} frustumCulled={false} />
      {CONFIG.topics.map((tp, i) => (
        <group key={tp.label} ref={(el) => (items.current[i] = el)}>
          <mesh material={cards[i]} frustumCulled={false}>
            <planeGeometry args={[2.2, 1.29]} />
          </mesh>
          <lineSegments geometry={emblems[i].geo} material={emblems[i].mat} position={[0.85, 0.82, 0.15]} />
        </group>
      ))}
    </group>
  )
}
