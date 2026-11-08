import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CONFIG } from '../config'
import { BB, BH, BT, BW, bookLive, bookPose, LEAF_DUR, LEAF_TIMES, poseMatrix } from '../core/bookPose'
import { seg, smooth, store } from '../core/timeline'
import { clothBump, coverMaps, editorialPages, endpaperTex, pageEdgeTex, spineTex } from './textures'

function makeLeafGeo() {
  const g = new THREE.PlaneGeometry(BW - 0.08, BH - 0.07, 40, 1)
  g.translate((BW - 0.08) / 2, 0, 0)
  g.userData.rest = Float32Array.from(g.attributes.position.array)
  return g
}

/** A physically-modelled hardcover: boards, rounded spine, text block, hinged cover, turning leaves. */
export function Book({ shadows = true }) {
  const { gl } = useThree()
  const root = useRef()
  const frontPivot = useRef()
  const leaves = useRef([])
  const look = useRef({ yaw: 0, pitch: 0 })
  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const cover = useTexture(CONFIG.book.cover)

  const L = useMemo(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    cover.colorSpace = THREE.SRGBColorSpace
    cover.anisotropy = aniso
    const { orm, bump } = coverMaps(cover.image)
    const cloth = clothBump()

    const coverMat = new THREE.MeshPhysicalMaterial({
      map: cover,
      roughnessMap: orm,
      metalnessMap: orm,
      roughness: 1,
      metalness: 1,
      bumpMap: bump,
      bumpScale: 1.6,
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      sheen: 0.25,
      sheenColor: new THREE.Color('#2a2a2a'),
      envMapIntensity: 0.9,
    })
    const board = new THREE.MeshPhysicalMaterial({ color: '#0f0f0f', roughness: 0.78, bumpMap: cloth, bumpScale: 0.35, sheen: 0.4, sheenColor: new THREE.Color('#3a3a3a'), envMapIntensity: 0.6 })
    const back = board.clone()
    const end = new THREE.MeshStandardMaterial({ map: endpaperTex(), roughness: 0.85 })
    const spine = new THREE.MeshPhysicalMaterial({ map: spineTex(), roughness: 0.75, bumpMap: cloth, bumpScale: 0.35, sheen: 0.4, sheenColor: new THREE.Color('#3a3a3a'), envMapIntensity: 0.6 })
    const edgeV = new THREE.MeshStandardMaterial({ map: pageEdgeTex(true), roughness: 0.92 })
    const edgeH = new THREE.MeshStandardMaterial({ map: pageEdgeTex(false), roughness: 0.92 })
    const pages = editorialPages()
    pages.last.anisotropy = aniso
    const paperTop = new THREE.MeshStandardMaterial({ map: pages.last, roughness: 0.9 })
    const paperPlain = new THREE.MeshStandardMaterial({ color: '#ebe6db', roughness: 0.92 })

    const leafData = pages.leaves.map(([f, b]) => {
      f.anisotropy = b.anisotropy = aniso
      const geo = makeLeafGeo()
      const front = new THREE.MeshStandardMaterial({ map: f, roughness: 0.9, side: THREE.FrontSide })
      b.wrapS = THREE.RepeatWrapping
      b.repeat.x = -1
      b.offset.x = 1
      b.needsUpdate = true
      const backM = new THREE.MeshStandardMaterial({ map: b, roughness: 0.9, side: THREE.BackSide })
      return { geo, front, back: backM }
    })
    const spineGeo = new THREE.CylinderGeometry(BT / 2, BT / 2, BH + 0.004, 48, 1, true, Math.PI, Math.PI)
    // boards with softly rounded edges and corners, like real case-bound covers
    const boardGeo = new RoundedBoxGeometry(BW, BH, BB, 4, 0.0075)
    // text block: a slightly concave fore-edge (the natural shape of a rounded-spine book)
    const pw = BW - 0.05
    const ph = BH - 0.07
    const pd = BT - 2 * BB
    const blockGeo = new THREE.BoxGeometry(pw, ph, pd, 1, 1, 18)
    const bp = blockGeo.attributes.position
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i)
      const z = bp.getZ(i)
      if (x > 0) bp.setX(i, x - 0.012 * (1 - Math.pow((2 * z) / pd, 2)))
    }
    blockGeo.computeVertexNormals()
    return { boardGeo, blockGeo, coverMat, board, back, end, spine, edgeV, edgeH, paperTop, paperPlain, leafData, spineGeo }
  }, [cover, gl])

  useFrame((state, dt) => {
    const t = store.time
    const portrait = store.aspect < 0.9
    const p = bookPose(t, portrait)
    root.current.visible = p.visible

    // gentle, physical mouse/drag inspection on the upright shots only
    const interactive = (t > 21 && t < 31) || t > 51.5 ? 1 : 0
    const d = store.drag
    if (!d.down) {
      d.yaw += d.vel * dt
      d.vel *= Math.pow(0.1, dt)
      d.yaw *= Math.pow(0.5, dt)
    }
    const ty = (store.mouseSmooth.x * 0.12 + d.yaw * 0.6) * interactive
    const tp = -store.mouseSmooth.y * 0.05 * interactive
    look.current.yaw += (ty - look.current.yaw) * Math.min(1, dt * 2.5)
    look.current.pitch += (tp - look.current.pitch) * Math.min(1, dt * 2.5)

    poseMatrix(p, tmpM, look.current.yaw, look.current.pitch)
    tmpM.decompose(root.current.position, root.current.quaternion, root.current.scale)
    bookLive.matrix.copy(tmpM)
    bookLive.position.copy(root.current.position)
    bookLive.open = p.open
    if (!p.visible) return

    frontPivot.current.rotation.y = -p.open * Math.PI

    const n = LEAF_TIMES.length
    leaves.current.forEach((m, k) => {
      if (!m) return
      const turn = smooth(seg(t, LEAF_TIMES[k], LEAF_TIMES[k] + LEAF_DUR)) * (t < 43 ? 1 : 0)
      m.visible = p.open > 0.01
      if (!m.visible) return
      const geo = L.leafData[k].geo
      const pos = geo.attributes.position
      const rest = geo.userData.rest
      const zR = (n - 1 - k) * 0.0035
      const zL = BB + 0.014 + k * 0.0035
      const zoff = zR + (zL - zR) * turn
      const W = BW - 0.08
      const base = Math.PI * turn
      const bend = 0.9 * Math.sin(Math.PI * turn)
      for (let i = 0; i < pos.count; i++) {
        const r = rest[i * 3]
        const y = rest[i * 3 + 1]
        const phi = Math.min(Math.PI, Math.max(0, base + bend * Math.pow(r / W, 1.6) * (1 - 2 * turn) * 0.7))
        pos.setXYZ(i, r * Math.cos(phi), y, r * Math.sin(phi) + zoff + 0.1 * Math.sin(Math.PI * turn) * (r / W))
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
    })
  })

  const pb = { w: BW - 0.05, h: BH - 0.07, d: BT - 2 * BB }
  return (
    <group ref={root}>
      <mesh position={[0, 0, -BT / 2 + BB / 2]} geometry={L.boardGeo} castShadow={shadows} receiveShadow material={[L.board, L.board, L.board, L.board, L.end, L.back]} />
      <mesh position={[-BW / 2, 0, 0]} geometry={L.spineGeo} material={L.spine} castShadow={shadows} />
      <mesh position={[0.018, 0, 0]} geometry={L.blockGeo} castShadow={shadows} receiveShadow material={[L.edgeV, L.paperPlain, L.edgeH, L.edgeH, L.paperTop, L.paperPlain]} />
      <group position={[-BW / 2 + 0.035, 0, pb.d / 2 + 0.002]}>
        {L.leafData.map((lf, k) => (
          <group key={k} ref={(el) => (leaves.current[k] = el)} visible={false}>
            <mesh geometry={lf.geo} material={lf.front} receiveShadow castShadow={shadows} />
            <mesh geometry={lf.geo} material={lf.back} receiveShadow />
          </group>
        ))}
      </group>
      <group ref={frontPivot} position={[-BW / 2, 0, BT / 2 - BB / 2]}>
        <mesh position={[BW / 2, 0, 0]} geometry={L.boardGeo} castShadow={shadows} receiveShadow material={[L.board, L.board, L.board, L.board, L.coverMat, L.end]} />
      </group>
    </group>
  )
}
