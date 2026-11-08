import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bookLive } from '../core/bookPose'
import { easeIn, hash, IMPACTS, lerp, seg, smooth, STAGE, store } from '../core/timeline'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/** Keyframed cinematic camera: returns { pos, target, roll, hfov } for time t. */
function makeShots() {
  const city = STAGE.city
  const cityCurve = new THREE.CatmullRomCurve3(
    [V(-70, 90, 120), V(-28, 48, 48), V(0, 24, 4), V(0, 13, -42), V(0, 17, -105), V(0, 32, -170)].map((v) => v.add(city)),
    false,
    'centripetal'
  )
  const book = STAGE.book
  return {
    void(t) {
      const p = smooth(seg(t, 0, 4.6))
      const r = lerp(32, 10.5, p)
      const a = lerp(-0.55, 0.22, p)
      const pos = V(Math.sin(a) * r, lerp(4.5, 0.5, p), Math.cos(a) * r)
      const target = V(0, 0, 0)
      const d = easeIn(seg(t, 4.55, 5.6))
      pos.lerp(V(0, 0, -5), d)
      target.lerp(V(0, 0, -40), d)
      return { pos, target, roll: -0.08 * d, hfov: 58 }
    },
    universe(t) {
      const u = seg(t, 5.6, 12.0)
      const k = 0.55 * u + 0.45 * smooth(u)
      const z = lerp(-5, -238, k)
      const pos = V(3.2 * Math.sin(u * 5.2), 1.4 * Math.sin(u * 3.6), z)
      const target = V(3.2 * Math.sin(u * 5.2 + 0.7) * 1.4, 0.6 + 1.2 * Math.sin(u * 3.6 + 0.5), z - 24)
      return { pos, target, roll: 0.14 * Math.sin(u * 4.2), hfov: 64 }
    },
    city(t) {
      const u = seg(t, 12.0, 19.0)
      const k = 0.35 * u + 0.65 * smooth(u)
      const pos = cityCurve.getPointAt(Math.min(0.999, k))
      const target = cityCurve.getPointAt(Math.min(1, k + 0.08)).add(V(0, -6, 0))
      const tan = cityCurve.getTangentAt(Math.min(0.999, k))
      return { pos, target, roll: -tan.x * 0.25, hfov: 66 }
    },
    reveal(t) {
      const u = smooth(seg(t, 19.0, 29.0))
      const a = lerp(-0.75, 0.42, u)
      const r = lerp(9.6, 7.0, u)
      const pos = V(book.x + Math.sin(a) * r, book.y + lerp(1.8, 0.55, u), book.z + Math.cos(a) * r)
      return { pos, target: book.clone().add(V(0, 0.05, 0)), roll: 0.03 * Math.sin(t * 0.4), hfov: 40 }
    },
    knowledge(t) {
      const u = smooth(seg(t, 29.0, 39.0))
      const pull = smooth(seg(t, 30.5, 34.0))
      const r = lerp(7.4, 11.2, pull)
      const pos = V(book.x + 0.9 * Math.sin(t * 0.25), book.y + 0.9 + 0.6 * pull, book.z + r)
      return { pos, target: book.clone().add(V(0, -0.1 + 0.05 * u, 0)), roll: 0, hfov: 44 }
    },
    impact(t) {
      const z = smooth(seg(t, 41.5, 48.0))
      const pos = V(book.x + 0.25 * Math.sin(t * 0.3), book.y + 0.35, book.z + lerp(11.0, 9.2, z))
      return { pos, target: book.clone().add(V(0, 0.1, 0)), roll: 0, hfov: 56 }
    },
    purchase(t) {
      const pos = V(book.x + 0.2 * Math.sin(t * 0.3), book.y + 0.35, book.z + 7.6)
      return { pos, target: book.clone().add(V(0, 0.15, 0)), roll: 0, hfov: 42 }
    },
  }
}

const ORDER = [
  ['void', 0, 5.6],
  ['universe', 5.6, 12.0],
  ['city', 12.0, 19.0],
  ['reveal', 19.0, 29.0],
  ['knowledge', 29.0, 39.0],
  ['impact', 39.0, 48.0],
  ['purchase', 48.0, 99],
]
// smooth blends between consecutive shots (seconds); hard cuts happen behind flashes
const BLEND = { knowledge: 1.3, impact: 1.6, purchase: 1.6 }

export function CameraRig() {
  const { camera, size } = useThree()
  const shots = useMemo(makeShots, [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const t = store.time
    store.aspect = size.width / size.height
    // smoothed mouse for parallax
    store.mouseSmooth.lerp(store.mouse, Math.min(1, dt * 3))

    let i = ORDER.findIndex(([, a, b]) => t >= a && t < b)
    if (i < 0) i = ORDER.length - 1
    const [name, start] = ORDER[i]
    let s = shots[name](t)
    const bl = BLEND[name]
    if (bl && i > 0 && t < start + bl) {
      const prev = shots[ORDER[i - 1][0]](t)
      const w = smooth(seg(t, start, start + bl))
      s = {
        pos: prev.pos.lerp(s.pos, w),
        target: prev.target.lerp(s.target, w),
        roll: lerp(prev.roll, s.roll, w),
        hfov: lerp(prev.hfov, s.hfov, w),
      }
    }

    // mouse parallax (stronger in open space, gentle on the product)
    const par = name === 'void' || name === 'universe' || name === 'city' ? 1.2 : 0.35
    s.pos.x += store.mouseSmooth.x * par
    s.pos.y += store.mouseSmooth.y * par * 0.6

    // physical camera shake after impacts
    let shake = 0
    for (const p of IMPACTS) if (t >= p && t - p < 1.2) shake = Math.max(shake, Math.exp(-(t - p) * 4.5) * (p === 19.0 || p === 41.6 ? 0.22 : 0.12))
    if (shake > 0.001) {
      const n = Math.floor(t * 60)
      s.pos.x += (hash(n) - 0.5) * shake
      s.pos.y += (hash(n + 7) - 0.5) * shake
      s.roll += (hash(n + 3) - 0.5) * shake * 0.15
    }

    camera.position.copy(s.pos)
    look.copy(s.target)
    camera.up.set(Math.sin(s.roll), Math.cos(s.roll), 0)
    camera.lookAt(look)
    // keep a minimum horizontal field of view on portrait phones
    const aspect = store.aspect
    const hf = THREE.MathUtils.degToRad(s.hfov)
    const vf = 2 * Math.atan(Math.tan(hf / 2) / aspect)
    const productShot = t >= 19
    const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.max(vf, THREE.MathUtils.degToRad(s.hfov * 0.62))), 30, productShot && aspect < 0.9 ? 64 : 92)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })
  return null
}
