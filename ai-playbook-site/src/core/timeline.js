import * as THREE from 'three'

/** Master duration of the animation in film seconds (narration stretches it at load). */
export const DURATION = 57

export const SCENES = [
  { id: 'intro', label: 'Introduction', start: 0, end: 7 },
  { id: 'idea', label: 'The Idea', start: 7, end: 19 },
  { id: 'reveal', label: 'The Playbook', start: 19, end: 31 },
  { id: 'content', label: 'Inside', start: 31, end: 43 },
  { id: 'product', label: 'The Product', start: 43, end: 51 },
  { id: 'cta', label: 'Your Copy', start: 51, end: 57 },
]

/** World-space origins: one photographic studio, one workspace set. */
export const STAGE = {
  desk: new THREE.Vector3(0, 0, -1000),
  book: new THREE.Vector3(0, 0, -2000),
}

/** Editorial cuts — each is a short dip to black. */
export const CUTS = [7.0, 12.8, 19.0, 24.3, 27.3, 31.0, 43.0, 51.0]

/** The single restrained impact: the book emerging from darkness. */
export const REVEAL_AT = 20.4

/** Shared mutable state (read every frame — never triggers React renders). */
export const store = {
  time: 0, // film seconds (what the visuals use)
  master: 0, // wall-clock seconds of the narrated film
  frozen: null, // ?t=12.5 freezes time for debugging / screenshots
  mouse: new THREE.Vector2(0, 0), // -1..1
  mouseSmooth: new THREE.Vector2(0, 0),
  pointerActive: false,
  drag: { yaw: 0, vel: 0, down: false, lastX: 0 },
  quality: 'high',
  aspect: 1,
  playing: false,
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x))
export const seg = (t, a, b) => clamp01((t - a) / (b - a))
export const lerp = (a, b, p) => a + (b - a) * p
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const easeOut = (x) => 1 - Math.pow(1 - x, 3)
export const easeIn = (x) => x * x * x
export const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10)
export const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))

/** Visibility envelope: 0 outside [a,b], eased ramps of fi / fo seconds. */
export function win(t, a, b, fi = 0.5, fo = 0.5) {
  if (t <= a || t >= b) return 0
  return Math.min(fi > 0 ? smooth(clamp01((t - a) / fi)) : 1, fo > 0 ? smooth(clamp01((b - t) / fo)) : 1)
}

/** Decaying envelope after events. */
export function pulseAt(t, list = [REVEAL_AT], decay = 5.5) {
  let v = 0
  for (const p of list) {
    if (t >= p && t - p < 1.5) v = Math.max(v, Math.exp(-(t - p) * decay))
  }
  return v
}

/** Deterministic pseudo-random (so scrubbing back and forth looks identical). */
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function sceneAt(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i
  return 0
}
