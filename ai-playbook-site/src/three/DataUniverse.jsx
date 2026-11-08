import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { POINT_FRAG } from './shaders'
import { circuit, uiPanel } from './textures'
import { hash, seg, store, win } from '../core/timeline'

const Z0 = -6
const Z1 = -250

const STREAM_VERT = /* glsl */ `
uniform float uTime, uOpacity, uPR, uSpeed;
attribute vec4 aRand;
varying float vAlpha; varying vec3 vColor;
void main(){
  vec3 p = position;
  p.z = ${Z1.toFixed(1)} + mod(p.z - ${Z1.toFixed(1)} + uTime * uSpeed * (0.6 + aRand.x), ${(Z0 - Z1).toFixed(1)});
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  gl_PointSize = (2.0 + aRand.y * 5.0) * uPR * (14.0 / max(d, 0.5));
  vAlpha = uOpacity * smoothstep(120.0, 10.0, d) * (0.4 + aRand.z * 0.6);
  vColor = mix(vec3(0.1, 0.45, 1.0), vec3(0.8, 0.9, 1.0), aRand.w);
  gl_Position = projectionMatrix * mv;
}
`

/** The infinite AI universe the camera flies through after entering the sphere. */
export function DataUniverse({ nodes = 1200 }) {
  const group = useRef()
  const nodeMesh = useRef()
  const lines = useRef()
  const structures = useRef([])
  const panels = useRef([])
  const circuits = useRef([])

  const data = useMemo(() => {
    const P = []
    // free-floating nodes around a tunnel
    for (let i = 0; i < nodes; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 5 + Math.pow(Math.random(), 0.7) * 26
      P.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.7, Z0 - Math.random() * (Z0 - Z1)))
    }
    // neural-network structures (layered)
    const nnEdges = []
    for (let s = 0; s < 7; s++) {
      const side = s % 2 ? 1 : -1
      const cx = side * (9 + hash(s) * 6)
      const cy = (hash(s + 3) - 0.5) * 10
      const cz = -30 - s * 30
      const layers = [4, 7, 7, 4]
      const ids = []
      layers.forEach((n, li) => {
        const row = []
        for (let k = 0; k < n; k++) {
          row.push(P.length)
          P.push(new THREE.Vector3(cx + (li - 1.5) * 2.4 * -side, cy + (k - (n - 1) / 2) * 1.1, cz + (li - 1.5) * 1.6))
        }
        ids.push(row)
      })
      for (let li = 0; li < 3; li++) for (const a of ids[li]) for (const b of ids[li + 1]) nnEdges.push([a, b])
    }
    // k-nearest connections between free nodes
    const edges = [...nnEdges]
    const sorted = P.map((p, i) => [p.z, i]).sort((a, b) => a[0] - b[0])
    for (let s = 0; s < nodes; s++) {
      const i = sorted[s][1]
      if (i >= nodes) continue
      let best = []
      for (let o = Math.max(0, s - 30); o < Math.min(sorted.length, s + 30); o++) {
        const j = sorted[o][1]
        if (j === i || j >= nodes) continue
        const d = P[i].distanceToSquared(P[j])
        best.push([d, j])
      }
      best.sort((a, b) => a[0] - b[0])
      best.slice(0, 2).forEach(([d, j]) => d < 120 && edges.push([i, j]))
    }
    const pos = new Float32Array(edges.length * 6)
    edges.forEach(([a, b], k) => {
      pos.set([P[a].x, P[a].y, P[a].z, P[b].x, P[b].y, P[b].z], k * 6)
    })
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    // data stream particles
    const n = 4000
    const sp = new Float32Array(n * 3)
    const sr = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 2 + Math.random() * 22
      sp.set([Math.cos(a) * r, Math.sin(a) * r * 0.75, Z0 - Math.random() * (Z0 - Z1)], i * 3)
      sr.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    }
    const streamGeo = new THREE.BufferGeometry()
    streamGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    streamGeo.setAttribute('aRand', new THREE.BufferAttribute(sr, 4))

    const geos = [
      new THREE.IcosahedronGeometry(1.6, 1),
      new THREE.OctahedronGeometry(1.8, 0),
      new THREE.TorusKnotGeometry(1.1, 0.32, 80, 8),
      new THREE.BoxGeometry(2.2, 2.2, 2.2, 2, 2, 2),
      new THREE.DodecahedronGeometry(1.5, 0),
    ].map((g) => new THREE.EdgesGeometry(g, 1))
    const structs = Array.from({ length: 26 }, (_, i) => ({
      geo: geos[i % geos.length],
      pos: [(hash(i * 3) - 0.5) * 34, (hash(i * 7) - 0.5) * 18, -12 - i * 9],
      spin: [hash(i) * 0.6, hash(i + 1) * 0.8],
      scale: 0.6 + hash(i + 5) * 1.6,
      gold: i % 5 === 1,
    }))
    const kinds = ['chat', 'neural', 'code', 'vision', 'flow', 'voice', 'chat', 'neural']
    const pans = kinds.map((k, i) => ({
      tex: uiPanel(k),
      pos: [(i % 2 ? 1 : -1) * (5.5 + hash(i) * 3), (hash(i + 2) - 0.4) * 6, -22 - i * 27],
      ry: (i % 2 ? -1 : 1) * 0.5,
    }))
    const circ = [0, 1, 2, 3, 4, 5].map((i) => ({
      tex: circuit(7 + i),
      pos: [(i % 2 ? 1 : -1) * 16, 0, -40 - i * 36],
      ry: (i % 2 ? -1 : 1) * Math.PI * 0.5,
    }))
    return { P, lineGeo, streamGeo, structs, pans, circ }
  }, [nodes])

  const streamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPR: { value: 1 }, uSpeed: { value: 30 } },
        vertexShader: STREAM_VERT,
        fragmentShader: POINT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#2a78ff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  )
  const nodeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#5aa2ff').multiplyScalar(2.2), toneMapped: false }), [])
  const wireBlue = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#4d95ff').multiplyScalar(1.6), transparent: true, opacity: 0.8, toneMapped: false }), [])
  const wireGold = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#e3bb72').multiplyScalar(1.6), transparent: true, opacity: 0.8, toneMapped: false }), [])

  const nodeGeo = useMemo(() => new THREE.SphereGeometry(0.09, 8, 6), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const initd = useRef(false)

  useFrame((state, dt) => {
    const t = store.time
    const vis = t > 4.6 && t < 12.6
    group.current.visible = vis
    if (!vis) return
    const a = win(t, 4.8, 12.4, 1.0, 0.4)
    const et = state.clock.elapsedTime
    if (!initd.current) {
      data.P.forEach((p, i) => {
        tmp.position.copy(p)
        tmp.scale.setScalar(i >= nodes ? 1.6 : 0.7 + hash(i) * 1.4)
        tmp.updateMatrix()
        nodeMesh.current.setMatrixAt(i, tmp.matrix)
      })
      nodeMesh.current.instanceMatrix.needsUpdate = true
      initd.current = true
    }
    lineMat.opacity = 0.32 * a
    wireBlue.opacity = 0.75 * a
    wireGold.opacity = 0.75 * a
    nodeMat.color.setRGB(0.35 * 2.2 * a, 0.64 * 2.2 * a, 2.2 * a)
    streamMat.uniforms.uTime.value = et
    streamMat.uniforms.uOpacity.value = a
    streamMat.uniforms.uPR.value = state.gl.getPixelRatio()
    structures.current.forEach((m, i) => {
      if (!m) return
      const s = data.structs[i]
      m.rotation.x = et * s.spin[0]
      m.rotation.y = et * s.spin[1]
    })
    panels.current.forEach((m, i) => {
      if (!m) return
      m.material.opacity = 0.95 * a
      m.position.y = data.pans[i].pos[1] + Math.sin(et * 0.8 + i) * 0.25
    })
    circuits.current.forEach((m, i) => {
      if (!m) return
      m.material.opacity = 0.55 * a
      m.material.map.offset.y = (et * 0.05 * (i % 2 ? 1 : -1)) % 1
    })
  })

  return (
    <group ref={group}>
      <instancedMesh ref={nodeMesh} args={[nodeGeo, nodeMat, data.P.length]} frustumCulled={false} />
      <lineSegments ref={lines} geometry={data.lineGeo} material={lineMat} frustumCulled={false} />
      <points geometry={data.streamGeo} material={streamMat} frustumCulled={false} />
      {data.structs.map((s, i) => (
        <lineSegments
          key={i}
          ref={(el) => (structures.current[i] = el)}
          geometry={s.geo}
          material={s.gold ? wireGold : wireBlue}
          position={s.pos}
          scale={s.scale}
        />
      ))}
      {data.pans.map((p, i) => (
        <mesh key={i} ref={(el) => (panels.current[i] = el)} position={p.pos} rotation={[0, p.ry, 0]}>
          <planeGeometry args={[6.4, 4]} />
          <meshBasicMaterial map={p.tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {data.circ.map((p, i) => (
        <mesh key={i} ref={(el) => (circuits.current[i] = el)} position={p.pos} rotation={[0, p.ry, 0]}>
          <planeGeometry args={[40, 26]} />
          <meshBasicMaterial map={p.tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
