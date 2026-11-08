import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lerp, seg, smooth, STAGE, store } from '../core/timeline'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/**
 * Shot list. Each shot is a slow, motivated move between two framings (dolly / orbit / push-in),
 * on one lens, with its own focus point and depth of field. Shots are joined by editorial cuts.
 *   fov     vertical field of view on a 16:9 screen
 *   keep    share of the 16:9 frame width that must stay visible on a portrait phone
 *   dof     bokeh scale (0 = deep focus)
 */
const SHOTS = [
  { // 01 · grazing light across the stone plinth
    a: 0, b: 7.0, stage: 'book', fov: 30, keep: 0.6, dof: 3.2, range: 1.6,
    from: { pos: V(-3.6, 0.38, 5.2), target: V(0.9, 0.02, -0.4) },
    to: { pos: V(-1.9, 0.52, 4.5), target: V(0.6, 0.06, -0.7) },
  },
  { // 02a · symmetrical, frontal dolly-in to the laptop
    a: 7.0, b: 12.8, stage: 'desk', fov: 30, keep: 0.62, dof: 2.0,
    from: { pos: V(0, 1.5, 5.0), target: V(0, 0.82, -0.62) },
    to: { pos: V(0, 1.32, 4.05), target: V(0, 0.82, -0.62) },
  },
  { // 02b · macro across the desk, focus on the screen
    a: 12.8, b: 19.0, stage: 'desk', fov: 26, keep: 0.6, dof: 4.0, range: 1.0,
    from: { pos: V(3.9, 0.56, 2.7), target: V(0.1, 0.8, -0.68) },
    to: { pos: V(3.2, 0.5, 2.05), target: V(0.05, 0.8, -0.68) },
  },
  { // 03a · the book emerges; slow orbit from the fore-edge toward the cover
    a: 19.0, b: 24.3, stage: 'book', fov: 28, keep: 0.5, dof: 2.4, orbit: { r: [6.6, 5.7], ang: [0.82, 0.24], y: [1.95, 1.6], target: V(0, 1.38, 0) },
  },
  { // 03b · macro on the title typography
    a: 24.3, b: 27.3, stage: 'book', fov: 22, keep: 0.9, dof: 5.5, range: 0.45,
    from: { pos: V(0.62, 1.12, 1.62), target: V(0.0, 0.84, 0.13) },
    to: { pos: V(0.3, 1.0, 1.42), target: V(0.0, 0.84, 0.13) },
  },
  { // 03c · around to the spine and the hardcover boards
    a: 27.3, b: 31.0, stage: 'book', fov: 28, keep: 0.5, dof: 2.4, orbit: { r: [5.0, 4.6], ang: [-0.62, -1.08], y: [1.72, 1.52], target: V(-0.15, 1.38, 0) },
  },
  { // 04 · above the open book, a slow descent while the pages turn
    a: 31.0, b: 43.0, stage: 'book', fov: 32, keep: 0.92, dof: 1.6,
    from: { pos: V(0.0, 5.7, 3.35), target: V(0, 0.1, 0.12) },
    to: { pos: V(0.0, 4.75, 2.6), target: V(0, 0.1, 0.12) },
  },
  { // 05 · three-quarter view on stone, gentle push-in
    a: 43.0, b: 51.0, stage: 'book', fov: 28, keep: 0.66, dof: 2.6,
    from: { pos: V(3.1, 3.2, 3.9), target: V(0, 0.12, 0) },
    to: { pos: V(1.9, 2.25, 2.55), target: V(0, 0.12, 0) },
  },
  { // 06 · what you get — slow dolly-in on the product while the facts land
    a: 51.0, b: 63.0, stage: 'book', fov: 30, keep: 0.5, dof: 1.4,
    from: { pos: V(0.6, 1.75, 9.4), target: V(0, 1.4, 0) },
    to: { pos: V(0.1, 1.62, 7.9), target: V(0, 1.4, 0) },
  },
  { // 07 · call to action — locked-off product shot
    a: 63.0, b: 99, stage: 'book', fov: 30, keep: 0.5, dof: 1.2,
    from: { pos: V(0, 1.62, 7.8), target: V(0, 1.4, 0) },
    to: { pos: V(0, 1.55, 7.35), target: V(0, 1.4, 0) },
  },
]

export const focus = { point: new THREE.Vector3(), bokeh: 2, range: 1 }

export function CameraRig() {
  const { camera, size } = useThree()
  const look = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const t = store.time
    store.aspect = size.width / size.height
    store.mouseSmooth.lerp(store.mouse, Math.min(1, dt * 1.6))
    const portrait = store.aspect < 0.9
    const shot = SHOTS.find((s) => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1]
    const O = STAGE[shot.stage]
    const u = smooth(seg(t, shot.a, Math.min(shot.b, shot.a + 12)))
    let pos
    let target
    if (shot.orbit) {
      const o = shot.orbit
      const ang = lerp(o.ang[0], o.ang[1], u)
      const r = lerp(o.r[0], o.r[1], u)
      target = o.target.clone()
      pos = V(Math.sin(ang) * r, lerp(o.y[0], o.y[1], u), Math.cos(ang) * r)
    } else {
      pos = shot.from.pos.clone().lerp(shot.to.pos, u)
      target = shot.from.target.clone().lerp(shot.to.target, u)
    }
    // landscape compositions leave room for the typography
    if (!portrait && t >= 31 && t < 43) {
      target.x -= 0.72
      pos.x -= 0.72
      pos.sub(target).multiplyScalar(1.3).add(target)
    }
    if (t >= 43 && t < 51) {
      if (portrait) {
        target.y -= 0.35
      } else {
        target.x -= 0.75
        target.z += 0.35
      }
    }
    // the final shot frames the book to one side on wide screens, above the text on phones
    if (t >= 51) {
      if (portrait) {
        target.y = 0.55
        pos.y = 1.25
      } else {
        target.x = 0.05
      }
    }
    if (portrait) {
      // pull back until the chosen share of the landscape composition fits the narrow frame
      const vf = THREE.MathUtils.degToRad(shot.fov / 2)
      const vfp = THREE.MathUtils.degToRad((shot.fov * 1.12) / 2)
      const ratio = (Math.tan(vf) * (16 / 9)) / (Math.tan(vfp) * store.aspect)
      pos.sub(target).multiplyScalar(Math.max(1, ratio * shot.keep)).add(target)
      if (t < 7) pos.y += 1.2
    }
    // barely-there parallax: a handheld-free, tripod-steady feel
    pos.x += store.mouseSmooth.x * 0.06
    pos.y += store.mouseSmooth.y * 0.04
    pos.add(O)
    target.add(O)
    camera.position.copy(pos)
    look.copy(target)
    camera.up.set(0, 1, 0)
    camera.lookAt(look)
    const fov = portrait ? shot.fov * 1.12 : shot.fov
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    focus.point.copy(target)
    focus.bokeh = shot.dof
    focus.range = shot.range || 2.2
  })
  return null
}
