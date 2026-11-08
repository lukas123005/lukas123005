import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CONFIG } from '../config'
import { seg, STAGE, store } from '../core/timeline'
import { drawScreen, keyboardTex, woodMaps } from './textures'

const SW = 1600
const SH = 1000

/** 02 · The idea — a quiet, well-made workspace: aluminium laptop, notebook, pen, ceramic cup. */
export function Workspace({ quality }) {
  const g = useRef()
  const cover = useTexture(CONFIG.book.cover)
  const D = STAGE.desk

  const { screenTex, screenCtx, wood, kbd, cupGeo } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = SW
    c.height = SH
    const screenTex = new THREE.CanvasTexture(c)
    screenTex.colorSpace = THREE.SRGBColorSpace
    screenTex.anisotropy = 16
    const wood = woodMaps()
    wood.repeat.set(1.4, 1)
    const kbd = keyboardTex()
    // ceramic cup profile (lathe)
    const pts = [
      [0, 0], [0.32, 0], [0.34, 0.02], [0.36, 0.12], [0.38, 0.5], [0.4, 0.66], [0.38, 0.67], [0.36, 0.53], [0.34, 0.14], [0.31, 0.05], [0, 0.05],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const cupGeo = new THREE.LatheGeometry(pts, 64)
    return { screenTex, screenCtx: c.getContext('2d'), wood, kbd, cupGeo }
  }, [])

  const last = useRef('')
  const screenMat = useRef()

  useFrame(() => {
    const t = store.time
    const vis = t > 6.8 && t < 19.3
    g.current.visible = vis
    if (!vis) return
    const mode = t < 12.8 ? 'prompt' : 'product'
    const typed = seg(t, 8.0, 11.2)
    const reveal = seg(t, 11.3, 12.7)
    screenMat.current.emissiveIntensity = mode === 'prompt' ? 0.85 : 0.5
    const key = `${mode}-${typed.toFixed(3)}-${reveal.toFixed(2)}`
    if (key !== last.current) {
      last.current = key
      drawScreen(screenCtx, SW, SH, mode, typed, cover.image, reveal)
      screenTex.needsUpdate = true
    }
  })

  const metal = { color: '#BFC0C2', metalness: 1, roughness: 0.32, envMapIntensity: 1.1 }
  return (
    <group ref={g}>
      <group position={[D.x, D.y, D.z]}>
        {/* desk */}
        <mesh position={[0, -0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[9, 0.1, 4]} />
          <meshPhysicalMaterial map={wood} roughness={0.55} clearcoat={0.2} clearcoatRoughness={0.5} />
        </mesh>
        {/* room */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#0d0d0d" roughness={1} />
        </mesh>
        <mesh position={[0, 3, -5]} receiveShadow>
          <planeGeometry args={[60, 14]} />
          <meshStandardMaterial color="#1b1b1b" roughness={1} />
        </mesh>

        {/* laptop */}
        <group position={[0, 0, 0.1]}>
          <RoundedBox args={[2.6, 0.06, 1.8]} radius={0.028} smoothness={4} position={[0, 0.03, 0]} castShadow receiveShadow>
            <meshPhysicalMaterial {...metal} />
          </RoundedBox>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0612, 0.0]}>
            <planeGeometry args={[2.5, 1.72]} />
            <meshPhysicalMaterial map={kbd} roughness={0.5} metalness={0.5} envMapIntensity={0.6} color="#9a9b9e" />
          </mesh>
          <group position={[0, 0.06, -0.9]} rotation={[-0.27, 0, 0]}>
            <RoundedBox args={[2.6, 1.72, 0.03]} radius={0.014} smoothness={4} position={[0, 0.86, 0]} castShadow>
              <meshPhysicalMaterial {...metal} />
            </RoundedBox>
            <mesh position={[0, 0.86, 0.0162]}>
              <planeGeometry args={[2.56, 1.68]} />
              <meshPhysicalMaterial color="#050505" roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} />
            </mesh>
            <mesh position={[0, 0.875, 0.0168]}>
              <planeGeometry args={[2.42, 1.5125]} />
              <meshStandardMaterial ref={screenMat} map={screenTex} emissiveMap={screenTex} emissive="#ffffff" emissiveIntensity={0.7} color="#000000" roughness={0.2} toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* notebook: charcoal cloth cover, ivory edges */}
        <group position={[2.55, 0, 0.55]} rotation={[0, -0.32, 0]}>
          <mesh position={[0, 0.028, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.25, 0.056, 1.75]} />
            <meshStandardMaterial attach="material-0" color="#e7e1d4" roughness={0.9} />
            <meshStandardMaterial attach="material-1" color="#e7e1d4" roughness={0.9} />
            <meshStandardMaterial attach="material-2" color="#232323" roughness={0.8} />
            <meshStandardMaterial attach="material-3" color="#232323" roughness={0.8} />
            <meshStandardMaterial attach="material-4" color="#e7e1d4" roughness={0.9} />
            <meshStandardMaterial attach="material-5" color="#e7e1d4" roughness={0.9} />
          </mesh>
          <mesh position={[0.48, 0.058, 0]} castShadow>
            <boxGeometry args={[0.03, 0.006, 1.76]} />
            <meshStandardMaterial color="#111" roughness={0.6} />
          </mesh>
        </group>
        {/* pen */}
        <mesh position={[2.05, 0.03, 1.55]} rotation={[0, 0.35, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 1.15, 32]} />
          <meshPhysicalMaterial color="#2c2c2c" metalness={0.9} roughness={0.28} />
        </mesh>
        {/* ceramic cup */}
        <group position={[-2.55, 0, 0.75]}>
          <mesh geometry={cupGeo} castShadow receiveShadow>
            <meshPhysicalMaterial color="#efebe3" roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.52, 0]}>
            <circleGeometry args={[0.36, 48]} />
            <meshPhysicalMaterial color="#1a120c" roughness={0.15} clearcoat={1} />
          </mesh>
        </group>
      </group>

    </group>
  )
}
