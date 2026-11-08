import * as THREE from 'three'
import { lerp, seg, smooth, STAGE } from './timeline'

/** Book dimensions in world units (cover ratio 827 × 1169). */
export const BW = 2.0
export const BH = 2.0 * (1169 / 827)
export const BT = 0.26
export const BB = 0.035 // board thickness

export const LEAF_TIMES = [31.0, 32.6, 34.2, 35.8]
export const LEAF_DUR = 1.15

function mixPose(a, b, w) {
  const o = {}
  for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k], w)
  return o
}

/** Deterministic pose of the hero book at time t (world space, before mouse offsets). */
export function bookPose(t, portrait = false) {
  // A — reveal: slow 3D rotation in space
  const A = {
    x: 0,
    y: 0.12 * Math.sin(t * 1.1),
    z: 0,
    rx: 0.1 * Math.sin(t * 0.6) - 0.04,
    ry: -0.95 + (t - 22) * 0.17 + 0.05 * Math.sin(t * 0.9),
    rz: 0.05 * Math.sin(t * 0.45),
    s: portrait ? 0.92 : 1,
  }
  // B — reading pose: open, tilted back toward the viewer
  const open = smooth(seg(t, 29.6, 30.9)) * (1 - smooth(seg(t, 40.55, 41.35)))
  const Bp = {
    x: (BW / 2) * open * (portrait ? 0.82 : 1),
    y: portrait ? -0.5 : -0.25,
    z: 0,
    rx: -0.32,
    ry: 0.04 * Math.sin(t * 0.5),
    rz: 0,
    s: portrait ? 0.82 : 1,
  }
  // C — the final floating hero shot
  const C = {
    x: 0,
    y: (portrait ? 1.05 : 0.78) + 0.06 * Math.sin(t * 1.2),
    z: 0,
    rx: 0.04,
    ry: lerp(-0.42, -0.1, smooth(seg(t, 41.3, 48))),
    rz: 0.015 * Math.sin(t * 0.8),
    s: portrait ? 1.05 : 1,
  }
  // D — purchase mockup
  const D = {
    x: portrait ? 0 : -1.95,
    y: (portrait ? 1.55 : 0.05) + 0.05 * Math.sin(t * 1.2),
    z: 0,
    rx: 0.02,
    ry: portrait ? -0.28 : 0.42,
    rz: 0,
    s: portrait ? 0.82 : 0.92,
  }
  let p = A
  p = mixPose(p, Bp, smooth(seg(t, 29.0, 30.2)))
  p = mixPose(p, C, smooth(seg(t, 40.4, 41.5)))
  p = mixPose(p, D, smooth(seg(t, 48.0, 49.6)))
  return { ...p, open, dissolve: seg(t, 21.9, 23.7) * 1.25 }
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

/** Shared live transform of the book (written by <Book>, read by FX). */
export const bookLive = {
  matrix: new THREE.Matrix4(),
  position: new THREE.Vector3(0, 0, -2000),
  open: 0,
}
