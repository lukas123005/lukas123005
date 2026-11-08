import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CONFIG } from '../config'
import { BB, BH, BT, BW, bookLive, bookPose, LEAF_DUR, LEAF_TIMES, poseMatrix } from '../core/bookPose'
import { seg, smooth, store } from '../core/timeline'
import { NOISE } from './shaders'
import { coverMaps, endpaperTex, pageEdgeTex, spineTex } from './textures'

/** Inject a noise dissolve (particles → solid) into any built-in material. */
function dissolvable(mat, shared) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDissolve = shared.uDissolve
    sh.uniforms.uEdge = shared.uEdge
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDPos = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uDissolve; uniform vec3 uEdge; varying vec3 vDPos;\n${NOISE}`)
      .replace(
        'void main() {',
        'void main() {\n  float dn = vnoise(vDPos * 2.6) * 0.5 + 0.5 + vDPos.y * 0.05;\n  if (dn > uDissolve) discard;'
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  gl_FragColor.rgb += uEdge * smoothstep(0.08, 0.0, uDissolve - dn) * (1.0 - step(1.05, uDissolve));'
      )
  }
  mat.customProgramCacheKey = () => 'dissolve-' + mat.type
  return mat
}

function makeLeafGeo() {
  const g = new THREE.PlaneGeometry(BW - 0.08, BH - 0.07, 28, 1)
  g.translate((BW - 0.08) / 2, 0, 0)
  g.userData.rest = Float32Array.from(g.attributes.position.array)
  return g
}

export function Book() {
  const { gl } = useThree()
  const root = useRef()
  const frontPivot = useRef()
  const leaves = useRef([])
  const look = useRef({ yaw: 0, pitch: 0 })
  const tmpM = useMemo(() => new THREE.Matrix4(), [])

  const cover = useTexture(CONFIG.book.cover)
  const pageTex = useTexture(CONFIG.book.pages)

  const parts = useMemo(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    cover.colorSpace = THREE.SRGBColorSpace
    cover.anisotropy = aniso
    pageTex.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = aniso
    })
    const shared = { uDissolve: { value: 0 }, uEdge: { value: new THREE.Color('#3f8cff').multiplyScalar(6) } }
    const { orm, bump } = coverMaps(cover.image)

    const coverMat = dissolvable(
      new THREE.MeshPhysicalMaterial({
        map: cover,
        roughnessMap: orm,
        metalnessMap: orm,
        roughness: 1,
        metalness: 0.9,
        bumpMap: bump,
        bumpScale: 1.4,
        clearcoat: 0.35,
        clearcoatRoughness: 0.32,
        emissiveMap: cover,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.06,
        envMapIntensity: 1.25,
      }),
      shared
    )
    const boardMat = dissolvable(new THREE.MeshPhysicalMaterial({ color: '#0d0d10', roughness: 0.55, clearcoat: 0.2, envMapIntensity: 0.8 }), shared)
    const backMat = dissolvable(new THREE.MeshPhysicalMaterial({ color: '#0e0e11', roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#333844'), envMapIntensity: 0.8 }), shared)
    const endMat = dissolvable(new THREE.MeshStandardMaterial({ map: endpaperTex(), roughness: 0.8 }), shared)
    const spineMat = dissolvable(new THREE.MeshPhysicalMaterial({ map: spineTex(), roughness: 0.5, clearcoat: 0.3, envMapIntensity: 1 }), shared)
    const edgeV = dissolvable(new THREE.MeshStandardMaterial({ map: pageEdgeTex(true), color: '#8a8580', roughness: 0.95 }), shared)
    const edgeH = dissolvable(new THREE.MeshStandardMaterial({ map: pageEdgeTex(false), color: '#8a8580', roughness: 0.95 }), shared)
    const paper = dissolvable(new THREE.MeshStandardMaterial({ color: '#8f8b84', roughness: 0.95 }), shared)

    const leafData = LEAF_TIMES.map((_, k) => {
      const geo = makeLeafGeo()
      const front = new THREE.MeshStandardMaterial({ map: pageTex[2 * k], color: '#9a9a9a', roughness: 0.95, side: THREE.FrontSide })
      const backMap = pageTex[2 * k + 1].clone()
      backMap.wrapS = THREE.RepeatWrapping
      backMap.repeat.x = -1
      backMap.offset.x = 1
      backMap.needsUpdate = true
      const back = new THREE.MeshStandardMaterial({ map: backMap, color: '#9a9a9a', roughness: 0.95, side: THREE.BackSide })
      return { geo, front, back }
    })

    // spine: half cylinder with the curved side facing -x
    const spineGeo = new THREE.CylinderGeometry(BT / 2, BT / 2, BH + 0.004, 32, 1, true, Math.PI, Math.PI)
    return { shared, coverMat, boardMat, backMat, endMat, spineMat, edgeV, edgeH, paper, leafData, spineGeo }
  }, [cover, pageTex, gl])

  useFrame((state, dt) => {
    const t = store.time
    const vis = t > 21.7
    root.current.visible = vis
    const portrait = store.aspect < 0.9
    const p = bookPose(t, portrait)

    // mouse + drag controlled rotation (smoothed, physics-like)
    const interactive = t > 23 ? 1 : 0
    const d = store.drag
    if (!d.down) {
      d.yaw += d.vel * dt
      d.vel *= Math.pow(0.12, dt)
      d.yaw *= Math.pow(0.55, dt) // spring back
    }
    const targetYaw = (store.mouseSmooth.x * 0.35 + d.yaw) * interactive * (1 - 0.6 * p.open)
    const targetPitch = -store.mouseSmooth.y * 0.18 * interactive
    look.current.yaw += (targetYaw - look.current.yaw) * Math.min(1, dt * 4)
    look.current.pitch += (targetPitch - look.current.pitch) * Math.min(1, dt * 4)

    poseMatrix(p, tmpM, look.current.yaw, look.current.pitch)
    tmpM.decompose(root.current.position, root.current.quaternion, root.current.scale)
    bookLive.matrix.copy(tmpM)
    bookLive.position.copy(root.current.position)
    bookLive.open = p.open
    if (!vis) return

    parts.shared.uDissolve.value = p.dissolve
    frontPivot.current.rotation.y = -p.open * Math.PI * 0.985

    // page turning with paper bend
    const n = LEAF_TIMES.length
    leaves.current.forEach((m, k) => {
      if (!m) return
      const ret = 40.0 + (n - 1 - k) * 0.12
      const turn = smooth(seg(t, LEAF_TIMES[k], LEAF_TIMES[k] + LEAF_DUR)) * (1 - smooth(seg(t, ret, ret + 0.5)))
      const showLeaves = p.open > 0.02
      m.visible = showLeaves
      if (!showLeaves) return
      const geo = parts.leafData[k].geo
      const pos = geo.attributes.position
      const rest = geo.userData.rest
      const zR = (n - 1 - k) * 0.004
      const zL = BB + 0.008 + k * 0.004
      const zoff = zR + (zL - zR) * turn
      const W = BW - 0.08
      const base = Math.PI * turn
      const bend = 0.95 * Math.sin(Math.PI * turn)
      for (let i = 0; i < pos.count; i++) {
        const r = rest[i * 3]
        const y = rest[i * 3 + 1]
        const phi = Math.min(Math.PI, Math.max(0, base + bend * Math.pow(r / W, 1.6) * (1 - 2 * turn) * 0.7))
        pos.setXYZ(i, r * Math.cos(phi), y, r * Math.sin(phi) + zoff + 0.12 * Math.sin(Math.PI * turn) * (r / W))
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
    })
  })

  const pb = { w: BW - 0.05, h: BH - 0.07, d: BT - 2 * BB }
  const L = parts
  return (
    <group ref={root}>
      {/* back board */}
      <mesh position={[0, 0, -BT / 2 + BB / 2]} castShadow receiveShadow material={[L.boardMat, L.boardMat, L.boardMat, L.boardMat, L.endMat, L.backMat]}>
        <boxGeometry args={[BW, BH, BB]} />
      </mesh>
      {/* rounded spine */}
      <mesh position={[-BW / 2, 0, 0]} geometry={L.spineGeo} material={L.spineMat} castShadow />
      {/* text block with fore-edge stripes */}
      <mesh position={[0.018, 0, 0]} castShadow receiveShadow material={[L.edgeV, L.edgeV, L.edgeH, L.edgeH, L.paper, L.paper]}>
        <boxGeometry args={[pb.w, pb.h, pb.d]} />
      </mesh>
      {/* turning leaves (real interior pages) */}
      <group position={[-BW / 2 + 0.035, 0, pb.d / 2 + 0.002]}>
        {L.leafData.map((lf, k) => (
          <group key={k} ref={(el) => (leaves.current[k] = el)} visible={false}>
            <mesh geometry={lf.geo} material={lf.front} castShadow />
            <mesh geometry={lf.geo} material={lf.back} />
          </group>
        ))}
      </group>
      {/* front board hinged at the spine */}
      <group ref={frontPivot} position={[-BW / 2, 0, BT / 2 - BB / 2]}>
        <mesh position={[BW / 2, 0, 0]} castShadow material={[L.boardMat, L.boardMat, L.boardMat, L.boardMat, L.coverMat, L.endMat]}>
          <boxGeometry args={[BW, BH, BB]} />
        </mesh>
      </group>
    </group>
  )
}
