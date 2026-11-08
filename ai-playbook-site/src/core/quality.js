/** Rough device tiering so iPhones and laptops both stay smooth. */
export function detectQuality() {
  if (typeof window === 'undefined') return 'high'
  const params = new URLSearchParams(window.location.search)
  if (params.get('q')) return params.get('q')
  const ua = navigator.userAgent || ''
  const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || window.matchMedia('(pointer: coarse)').matches
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 8
  // modern phones handle the full look; only clearly weak devices drop to 'low'
  if (mobile) return cores >= 4 || !navigator.hardwareConcurrency ? 'medium' : 'low'
  if (cores <= 4 || mem <= 4) return 'medium'
  return 'high'
}

export const QUALITY = {
  high: { dpr: [1, 1.75], sphere: 70000, bookParticles: 32000, nodes: 1400, buildings: 900, gold: 1800, post: 'full' },
  medium: { dpr: [1, 2], sphere: 38000, bookParticles: 20000, nodes: 900, buildings: 600, gold: 1200, post: 'full' },
  low: { dpr: [1, 1.25], sphere: 18000, bookParticles: 11000, nodes: 520, buildings: 320, gold: 700, post: 'lite' },
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl')
  } catch {
    return false
  }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
