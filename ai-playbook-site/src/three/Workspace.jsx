import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CONFIG } from '../config'
import { seg, STAGE, store } from '../core/timeline'
import { drawScreen, grilleTex, woodMaps } from './textures'

const SW = 2048
const SH = 1280

// laptop dimensions (world units)
const LW = 2.6
const LD = 1.8
const LT = 0.055

/** 02 · The idea — an evening workspace: aluminium laptop with real keys, notebook, pen, cup, lamp, city bokeh. */
export function Workspace({ quality }) {
  const g = useRef()
  const keys = useRef()
  const screenMat = useRef()
  const cover = useTexture(CONFIG.book.cover)
  const D = STAGE.desk

  const res = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = SW
    c.height = SH
    const screenTex = new THREE.CanvasTexture(c)
    screenTex.colorSpace = THREE.SRGBColorSpace
    screenTex.anisotropy = 16
    const wood = woodMaps()
    wood.repeat.set(1.4, 1)
    const grille = grilleTex()
    // ceramic cup + saucer profiles
    const cup = new THREE.LatheGeometry(
      [[0, 0], [0.3, 0], [0.32, 0.02], [0.34, 0.12], [0.37, 0.5], [0.39, 0.64], [0.375, 0.655], [0.355, 0.52], [0.33, 0.14], [0.3, 0.05], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)),
      72
    )
    const saucer = new THREE.LatheGeometry(
      [[0, 0], [0.5, 0], [0.62, 0.035], [0.64, 0.05], [0.6, 0.045], [0.48, 0.02], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y)),
      72
    )
    // keyboard: 6 rows of real keycaps (instanced rounded boxes)
    const rows = [14, 14, 14, 13, 12, 9]
    const keyGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12)
    const layout = []
    const deckW = 2.2
    rows.forEach((n, r) => {
      const unit = deckW / 14
      const z = -0.66 + r * 0.142
      const kh = r === 0 ? 0.07 : 0.118
      if (r === 5) {
        // bottom row with a wide space bar
        const widths = [1, 1, 1.2, 4.6, 1.2, 1, 1, 1]
        let x = -deckW / 2
        widths.forEach((wu) => {
          layout.push([x + (wu * unit) / 2, z, wu * unit - 0.018, kh])
          x += wu * unit
        })
        return
      }
      const span = deckW / n
      for (let k = 0; k < n; k++) layout.push([-deckW / 2 + span * (k + 0.5), z, span - 0.018, kh])
    })
    return { screenTex, ctx: c.getContext('2d'), wood, grille, cup, saucer, keyGeo, layout }
  }, [])

  // city lights behind the window — they become soft bokeh through the lens
  const bokeh = useMemo(() => {
    const pts = []
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 90; i++) {
      pts.push({
        p: [(r() - 0.5) * 22, -0.2 + r() * 5.5, -9 - r() * 6],
        c: r() < 0.7 ? new THREE.Color().setHSL(0.08 + r() * 0.05, 0.85, 0.6) : new THREE.Color().setHSL(0.58, 0.3, 0.75),
        s: 0.05 + r() * 0.09,
      })
    }
    return pts
  }, [])

  const tmp = useMemo(() => new THREE.Object3D(), [])
  const placed = useRef(false)
  const last = useRef('')

  useFrame(() => {
    const t = store.time
    const vis = t > 6.8 && t < 19.3
    g.current.visible = vis
    if (!vis) return
    if (!placed.current) {
      res.layout.forEach(([x, z, w, d], i) => {
        tmp.position.set(x, 0.006, z)
        tmp.scale.set(w, 0.02, d)
        tmp.updateMatrix()
        keys.current.setMatrixAt(i, tmp.matrix)
      })
      keys.current.instanceMatrix.needsUpdate = true
      placed.current = true
    }
    const mode = t < 12.8 ? 'prompt' : 'product'
    const typed = seg(t, 8.0, 10.6)
    const reveal = seg(t, 10.7, 12.6)
    const key = `${mode}-${typed.toFixed(3)}-${reveal.toFixed(2)}`
    if (key !== last.current) {
      last.current = key
      drawScreen(res.ctx, SW, SH, mode, typed, cover.image, reveal)
      res.screenTex.needsUpdate = true
    }
    screenMat.current.emissiveIntensity = mode === 'prompt' ? 1.05 : 0.62
  })

  const alu = { color: '#c3c4c7', metalness: 1, roughness: 0.3, envMapIntensity: 1.2 }
  return (
    <group ref={g}>
      <group position={[D.x, D.y, D.z]}>
        {/* desk */}
        <mesh position={[0, -0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[9, 0.1, 4]} />
          <meshPhysicalMaterial map={res.wood} roughness={0.5} clearcoat={0.3} clearcoatRoughness={0.45} />
        </mesh>
        {/* room: floor, dark wall with a window full of evening city lights */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#0d0d0d" roughness={1} />
        </mesh>
        <mesh position={[0, 3, -16]}>
          <planeGeometry args={[80, 30]} />
          <meshStandardMaterial color="#0b0c0f" roughness={1} />
        </mesh>
        {bokeh.map((b, i) => (
          <mesh key={i} position={b.p}>
            <sphereGeometry args={[b.s, 10, 8]} />
            <meshBasicMaterial color={b.c.clone().multiplyScalar(2.2)} toneMapped={false} />
          </mesh>
        ))}

        {/* laptop */}
        <group position={[0, 0, 0.12]}>
          <RoundedBox args={[LW, LT, LD]} radius={0.026} smoothness={5} position={[0, LT / 2, 0]} castShadow receiveShadow>
            <meshPhysicalMaterial {...alu} />
          </RoundedBox>
          {/* recessed keyboard well */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, LT + 0.0006, -0.3]}>
            <planeGeometry args={[2.26, 0.88]} />
            <meshStandardMaterial color="#141416" roughness={0.9} />
          </mesh>
          <instancedMesh ref={keys} args={[res.keyGeo, null, res.layout.length]} position={[0, LT, 0]} castShadow>
            <meshPhysicalMaterial color="#1c1c1f" roughness={0.55} clearcoat={0.15} />
          </instancedMesh>
          {/* speaker grilles */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} rotation={[-Math.PI / 2, 0, 0]} position={[sx * 1.2, LT + 0.0006, -0.3]}>
              <planeGeometry args={[0.1, 0.86]} />
              <meshStandardMaterial map={res.grille} roughness={0.5} metalness={0.6} />
            </mesh>
          ))}
          {/* glass trackpad */}
          <RoundedBox args={[1.05, 0.004, 0.62]} radius={0.002} smoothness={2} position={[0, LT + 0.0005, 0.48]}>
            <meshPhysicalMaterial color="#b9babd" metalness={0.4} roughness={0.22} clearcoat={0.8} clearcoatRoughness={0.15} />
          </RoundedBox>
          {/* hinge */}
          <mesh position={[0, LT + 0.012, -LD / 2 + 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 2.2, 24]} />
            <meshPhysicalMaterial color="#2a2a2d" metalness={0.8} roughness={0.35} />
          </mesh>
          {/* lid */}
          <group position={[0, LT, -LD / 2 + 0.02]} rotation={[-0.27, 0, 0]}>
            <RoundedBox args={[LW, LD - 0.04, 0.026]} radius={0.012} smoothness={5} position={[0, (LD - 0.04) / 2, -0.004]} castShadow>
              <meshPhysicalMaterial {...alu} />
            </RoundedBox>
            {/* glass front with thin black bezel */}
            <mesh position={[0, (LD - 0.04) / 2, 0.0095]}>
              <planeGeometry args={[LW - 0.04, LD - 0.08]} />
              <meshPhysicalMaterial color="#030303" roughness={0.05} clearcoat={1} clearcoatRoughness={0.03} envMapIntensity={1.4} />
            </mesh>
            <mesh position={[0, (LD - 0.04) / 2 + 0.01, 0.0102]}>
              <planeGeometry args={[LW - 0.13, (LW - 0.13) * (SH / SW)]} />
              <meshStandardMaterial ref={screenMat} map={res.screenTex} emissiveMap={res.screenTex} emissive="#ffffff" emissiveIntensity={1} color="#000000" roughness={0.18} toneMapped={false} />
            </mesh>
            <mesh position={[0, LD - 0.085, 0.0104]}>
              <circleGeometry args={[0.009, 16]} />
              <meshStandardMaterial color="#0b0d14" roughness={0.1} />
            </mesh>
          </group>
        </group>

        {/* notebook: charcoal cloth cover, ivory edges */}
        <group position={[2.6, 0, 0.6]} rotation={[0, -0.32, 0]}>
          <mesh position={[0, 0.028, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.25, 0.056, 1.75]} />
            <meshStandardMaterial attach="material-0" color="#e7e1d4" roughness={0.9} />
            <meshStandardMaterial attach="material-1" color="#e7e1d4" roughness={0.9} />
            <meshStandardMaterial attach="material-2" color="#26262a" roughness={0.8} />
            <meshStandardMaterial attach="material-3" color="#26262a" roughness={0.8} />
            <meshStandardMaterial attach="material-4" color="#e7e1d4" roughness={0.9} />
            <meshStandardMaterial attach="material-5" color="#e7e1d4" roughness={0.9} />
          </mesh>
          <mesh position={[0.48, 0.058, 0]} castShadow>
            <boxGeometry args={[0.03, 0.006, 1.76]} />
            <meshStandardMaterial color="#111" roughness={0.6} />
          </mesh>
        </group>
        {/* pen */}
        <group position={[2.1, 0.03, 1.55]} rotation={[0, 0.35, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.026, 0.026, 1.0, 32]} />
            <meshPhysicalMaterial color="#1f1f22" metalness={0.6} roughness={0.3} clearcoat={0.6} />
          </mesh>
          <mesh position={[0, 0.56, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.006, 0.12, 32]} />
            <meshPhysicalMaterial color="#c9a76a" metalness={1} roughness={0.25} />
          </mesh>
        </group>
        {/* ceramic cup on a saucer */}
        <group position={[-2.55, 0, 0.75]}>
          <mesh geometry={res.saucer} castShadow receiveShadow>
            <meshPhysicalMaterial color="#efebe3" roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.2} side={THREE.DoubleSide} />
          </mesh>
          <group position={[0, 0.03, 0]}>
            <mesh geometry={res.cup} castShadow receiveShadow>
              <meshPhysicalMaterial color="#efebe3" roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.2} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
              <circleGeometry args={[0.35, 48]} />
              <meshPhysicalMaterial color="#20140c" roughness={0.12} clearcoat={1} />
            </mesh>
          </group>
        </group>
        {/* desk lamp: warm practical light */}
        <group position={[-3.4, 0, -0.9]}>
          <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.32, 0.34, 0.04, 48]} />
            <meshPhysicalMaterial color="#1b1b1d" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 2.0, 16]} />
            <meshPhysicalMaterial color="#1b1b1d" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0.45, 2.0, 0.2]} rotation={[0, 0, -1.1]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 1.0, 16]} />
            <meshPhysicalMaterial color="#1b1b1d" metalness={0.7} roughness={0.35} />
          </mesh>
          <group position={[0.9, 1.78, 0.35]} rotation={[0.25, 0, -0.5]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.1, 0.32, 0.4, 48, 1, true]} />
              <meshPhysicalMaterial color="#1b1b1d" metalness={0.7} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, -0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.3, 32]} />
              <meshBasicMaterial color={new THREE.Color('#ffd9a3').multiplyScalar(3)} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
