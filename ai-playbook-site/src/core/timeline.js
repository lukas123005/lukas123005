import * as THREE from 'three'

/** Master duration of the film (seconds). Scroll and autoplay both drive `store.time`. */
export const DURATION = 53

export const SCENES = [
  { id: 'void', label: 'The Void', start: 0, end: 5 },
  { id: 'awakening', label: 'AI Awakening', start: 5, end: 12 },
  { id: 'revolution', label: 'Digital Revolution', start: 12, end: 19 },
  { id: 'reveal', label: 'The Reveal', start: 19, end: 29 },
  { id: 'knowledge', label: 'Knowledge', start: 29, end: 39 },
  { id: 'impact', label: 'Final Impact', start: 39, end: 48 },
  { id: 'purchase', label: 'Get the Playbook', start: 48, end: 53 },
]

/** World-space origins of each stage (scenes live far apart and are culled by time). */
export const STAGE = {
  void: new THREE.Vector3(0, 0, 0),
  city: new THREE.Vector3(0, 0, -1000),
  book: new THREE.Vector3(0, 0, -2000),
}

/** Bass hits — shared by the visuals (pulses, shake, bloom) and by the audio engine. */
export const PULSES = [1.0, 1.8, 2.6, 3.4, 4.2, 5.45, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 22.6, 41.6]
export const IMPACTS = [5.45, 12.0, 19.0, 22.6, 41.6]

/** Shared mutable state (read every frame — never triggers React renders). */
export const store = {
  time: 0,
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

/** Decaying pulse after each bass hit. */
export function pulseAt(t, list = PULSES, decay = 5.5) {
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
