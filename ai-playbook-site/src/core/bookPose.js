import * as THREE from 'three'
import { lerp, seg, smooth, STAGE } from './timeline'

/** Book dimensions in world units (cover ratio 827 × 1169). */
export const BW = 2.0
export const BH = 2.0 * (1169 / 827)
export const BT = 0.26
export const BB = 0.035 // board thickness

// four leaves turn during "Inside"
export const LEAF_TIMES = [34.4, 36.6, 38.8, 41.0]
export const LEAF_DUR = 1.6
export const OPEN_AT = [31.7, 33.6] // cover opening window

const FLAT = -Math.PI / 2

/**
 * Deterministic pose of the book (relative to the studio) at film time t.
 * Shots are separated by editorial cuts, so each one owns its pose.
 */
export function bookPose(t, portrait = false) {
  // 03 · reveal — standing on the stone plinth, turning a few degrees
  if (t < 31.0) {
    const u = smooth(seg(t, 19, 31))
    return { x: 0, y: BH / 2, z: 0, rx: 0, ry: lerp(0.22, -0.2, u), rz: 0, s: 1, open: 0, visible: t >= 19 }
  }
  // 04 · inside — lying open on the stone, spine centred
  if (t < 43.0) {
    const open = smooth(seg(t, OPEN_AT[0], OPEN_AT[1]))
    return { x: (BW / 2) * open, y: BT / 2 + 0.002, z: 0.1, rx: FLAT, ry: 0, rz: 0, s: 1, open, visible: true }
  }
  // 05 · product — closed, lying at an angle on the stone
  if (t < 51.0) {
    return { x: 0, y: BT / 2 + 0.002, z: 0, rx: FLAT, ry: 0.32 + 0.03 * smooth(seg(t, 43, 51)), rz: 0, s: 1, open: 0, visible: true }
  }
  // 06 · what you get → 07 · call to action — upright product mockup, turning gently
  const u = smooth(seg(t, 51, 66))
  return {
    x: portrait ? 0 : -1.3,
    y: BH / 2,
    z: 0,
    rx: 0,
    ry: portrait ? lerp(-0.5, -0.24, u) : lerp(0.75, 0.36, u),
    rz: 0,
    s: 1,
    open: 0,
    visible: true,
  }
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()

export function poseMatrix(p, out = new THREE.Matrix4(), extraYaw = 0, extraPitch = 0) {
  _e.set(p.rx + extraPitch, p.ry + extraYaw, p.rz, 'YXZ')
  _q.setFromEuler(_e)
  _v.set(STAGE.book.x + p.x, STAGE.book.y + p.y, STAGE.book.z + p.z)
  _s.setScalar(p.s)
  return out.compose(_v, _q, _s)
}

/** Shared live transform of the book (written by <Book>, read by camera / lights). */
export const bookLive = {
  matrix: new THREE.Matrix4(),
  position: new THREE.Vector3(0, 0, -2000),
  open: 0,
}
