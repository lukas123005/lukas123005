import { DURATION } from './timeline'

/**
 * Narration-driven timing.
 *
 * The animation is authored in "film seconds" (0–53). The narration needs room to breathe, so each
 * voice window of the film is stretched to fit its real clip lengths (measured at load from the audio
 * files themselves). Transitions and impacts between windows keep real-time speed. Result: a piecewise
 * linear map film ↔ master (wall-clock) time. Replace the MP3s and everything retimes automatically.
 */
export const plan = {
  ready: false,
  knots: [[0, 0], [DURATION, DURATION]],
  total: DURATION,
  segments: [], // { id, text, start, dur, buffer }
}

export function toMaster(f) {
  const k = plan.knots
  if (f <= k[0][0]) return k[0][1]
  for (let i = 1; i < k.length; i++) {
    if (f <= k[i][0]) {
      const [f0, m0] = k[i - 1]
      const [f1, m1] = k[i]
      return m0 + ((f - f0) / Math.max(1e-6, f1 - f0)) * (m1 - m0)
    }
  }
  return k[k.length - 1][1] + (f - k[k.length - 1][0])
}

export function toFilm(m) {
  const k = plan.knots
  if (m <= k[0][1]) return k[0][0]
  for (let i = 1; i < k.length; i++) {
    if (m <= k[i][1]) {
      const [f0, m0] = k[i - 1]
      const [f1, m1] = k[i]
      return f0 + ((m - m0) / Math.max(1e-6, m1 - m0)) * (f1 - f0)
    }
  }
  return k[k.length - 1][0]
}

/** Is the narrator speaking (or about to) at master time m? margin in seconds. */
export function voiceAt(m, before = 0, after = 0) {
  for (const s of plan.segments) if (m >= s.start - before && m <= s.start + s.dur + after) return s
  return null
}

function buildPlan(manifest, durations) {
  const byId = Object.fromEntries(manifest.segments.map((s) => [s.id, s]))
  let film = 0
  let master = 0
  const knots = [[0, 0]]
  const segments = []
  for (const w of [...manifest.windows].sort((a, b) => a.from - b.from)) {
    if (w.from > film) {
      master += w.from - film
      film = w.from
      knots.push([film, master])
    }
    const ids = w.segments
    const gap = w.gap ?? 1.0
    const voice = ids.reduce((a, id) => a + durations[id], 0) + gap * (ids.length - 1)
    const need = w.lead + voice + w.tail
    const len = Math.max(w.to - w.from, need)
    // centre any spare time around the narration
    let m = master + w.lead + (len - need) * 0.35
    for (const id of ids) {
      const seg = byId[id]
      segments.push({ id, text: seg.text || seg.parts.filter((p) => typeof p === 'string').join(' '), start: m, dur: durations[id], buffer: seg._buffer || null })
      m += durations[id] + gap
    }
    master += len
    film = w.to
    knots.push([film, master])
  }
  if (film < DURATION) {
    master += DURATION - film
    knots.push([DURATION, master])
  }
  plan.knots = knots
  plan.total = master
  plan.segments = segments
  plan.ready = true
}

/** Fetch the manifest, decode every clip (for exact durations + playback) and build the plan. */
export async function loadNarration(onProgress) {
  const base = import.meta.env.BASE_URL || './'
  let manifest
  try {
    manifest = await (await fetch(`${base}voiceover/manifest.json`)).json()
  } catch (e) {
    console.warn('Narration manifest missing — running without voice.', e)
    plan.ready = true
    return plan
  }
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const ctx = OAC ? new OAC(1, 1, 48000) : null
  const durations = {}
  let done = 0
  await Promise.all(
    manifest.segments.map(async (seg) => {
      const words = (seg.parts || []).filter((p) => typeof p === 'string').join(' ').split(/\s+/).length
      try {
        const buf = await (await fetch(base + seg.file)).arrayBuffer()
        const audio = await new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej))
        seg._buffer = audio
        durations[seg.id] = audio.duration
      } catch (e) {
        // local fallback: keep the timing even if the clip can't be loaded/decoded
        durations[seg.id] = seg.duration || words / 2.3
        console.warn(`Voiceover clip ${seg.file} unavailable — using estimated timing.`)
      }
      onProgress?.(++done / manifest.segments.length)
    })
  )
  buildPlan(manifest, durations)
  return plan
}
