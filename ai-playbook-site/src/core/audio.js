import { IMPACTS, PULSES, seg, win } from './timeline'
import { plan, toMaster, voiceAt } from './narration'

/**
 * Cinematic sound system (Web Audio API).
 *
 *   voice ─► voice chain ───────────────────────────┐
 *   music (drone, pad, chords, arp, sub) ─► DUCK ───┼─► master ─► fade ─► compressor ─► out
 *   sfx (impacts, particles, mechanics) ─► gate ────┘        (+ shared reverb send)
 *
 * The narrator is always the lead element: music sits at ~40 % in pauses and is ducked to ~15 %
 * while he speaks (with look-ahead, so it dips before the first word). Loud effects are skipped
 * during spoken sentences; subtle particle/activation sounds play quietly underneath.
 */
const MUSIC_FULL = 0.4
const MUSIC_DUCKED = 0.15
const DUCK_TC = 0.22 // time constant → ~0.65 s fades

// One-shot cues in FILM seconds (converted to master time for voice gating)
const CUES = [
  ...PULSES.filter((p) => !IMPACTS.includes(p)).map((t) => ({ t, type: 'pulse' })),
  ...IMPACTS.map((t) => ({ t, type: t === 19.0 ? 'reveal' : 'impact' })),
  { t: 0.15, type: 'spark' },
  { t: 4.4, type: 'riser', dur: 1.0 },
  { t: 6.3, type: 'activate' }, { t: 7.4, type: 'activate' }, { t: 8.6, type: 'activate' },
  { t: 9.8, type: 'activate' }, { t: 10.7, type: 'activate' },
  { t: 11.0, type: 'riser', dur: 1.0 },
  { t: 12.9, type: 'whoosh' }, { t: 14.9, type: 'whoosh' }, { t: 16.9, type: 'whoosh' },
  { t: 13.5, type: 'mech' }, { t: 15.5, type: 'mech' }, { t: 17.5, type: 'mech' },
  { t: 17.8, type: 'riser', dur: 1.2 },
  { t: 19.6, type: 'particles', dur: 2.6 },
  { t: 29.3, type: 'mech' }, { t: 29.8, type: 'mech' },
  ...[31.05, 32.65, 34.25, 35.85].map((t) => ({ t, type: 'page' })),
  ...Array.from({ length: 9 }, (_, i) => ({ t: 31.0 + i * 0.72, type: 'activate' })),
  { t: 38.95, type: 'suck', dur: 1.3 },
  { t: 40.1, type: 'page' }, { t: 40.3, type: 'page' },
  { t: 41.35, type: 'thud' },
  { t: 48.3, type: 'chime' },
]
// effects that must never sit on top of spoken words
const LOUD = new Set(['impact', 'reveal', 'riser', 'whoosh', 'suck', 'thud', 'mech', 'chime'])

const CHORDS = [
  [57, 60, 64, 69, 72], // Am
  [53, 57, 60, 65, 69], // F
  [55, 60, 64, 67, 72], // C
  [55, 59, 62, 67, 71], // G
]
const BPM = 84
const BEAT = 60 / BPM
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)

export class SoundEngine {
  constructor() {
    this.ctx = null
    this.muted = true
    this.ready = false
    this.lastFilm = 0
    this.lastMaster = 0
    this.lastReal = 0
    this.rate = 0
    this.voice = null // { seg, src, gain, startedAt, offset }
    this.arpNext = 0
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -9
    comp.ratio.value = 6
    comp.knee.value = 6
    comp.attack.value = 0.005
    comp.release.value = 0.25
    this.fade = ctx.createGain() // end-of-film fade
    this.master = ctx.createGain() // mute
    this.master.gain.value = 0
    this.master.connect(this.fade).connect(comp).connect(ctx.destination)
    this.out = comp

    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(3.0, 2.8)
    const verbOut = ctx.createGain()
    verbOut.gain.value = 0.3
    this.verb.connect(verbOut).connect(this.master)

    // MUSIC bus (ducked)
    this.music = ctx.createGain()
    this.music.gain.value = MUSIC_FULL
    this.music.connect(this.master)
    this.musicIn = ctx.createGain()
    this.musicIn.connect(this.music)
    this.musicIn.connect(this.verb)

    // SFX bus
    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.55
    this.sfx.connect(this.master)
    this.sfx.connect(this.verb)

    // VOICE bus: gentle high-pass, warmth, presence, leveler — always on top
    this.voiceBus = ctx.createGain()
    this.voiceBus.gain.value = 1.0
    const hpf = ctx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = 80
    const warm = ctx.createBiquadFilter()
    warm.type = 'lowshelf'
    warm.frequency.value = 200
    warm.gain.value = 2
    const pres = ctx.createBiquadFilter()
    pres.type = 'peaking'
    pres.frequency.value = 3200
    pres.Q.value = 0.8
    pres.gain.value = 2
    const lev = ctx.createDynamicsCompressor()
    lev.threshold.value = -22
    lev.ratio.value = 2.5
    lev.attack.value = 0.01
    lev.release.value = 0.2
    const room = ctx.createGain()
    room.gain.value = 0.05
    this.voiceBus.connect(hpf).connect(warm).connect(pres).connect(lev).connect(this.master)
    lev.connect(room).connect(this.verb)

    this.noiseBuf = this.noise(2)
    this.buildMusic()
    this.ready = true
  }

  impulse(sec, decay) {
    const ctx = this.ctx
    const len = ctx.sampleRate * sec
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  noise(sec) {
    const ctx = this.ctx
    const buf = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  buildMusic() {
    const ctx = this.ctx
    // deep drone
    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 180
    this.droneFilter.Q.value = 2
    this.droneGain = ctx.createGain()
    this.droneGain.gain.value = 0
    this.droneFilter.connect(this.droneGain).connect(this.musicIn)
    for (const [f, det] of [[55, -7], [55, 6], [82.4, 0]]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      const g = ctx.createGain()
      g.gain.value = 0.2
      o.connect(g).connect(this.droneFilter)
      o.start()
    }
    // sub
    const sub = ctx.createOscillator()
    sub.frequency.value = 55
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    sub.connect(this.subGain).connect(this.musicIn)
    sub.start()
    this.subOsc = sub
    // airy ambience
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    n.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoG = ctx.createGain()
    lfoG.gain.value = 800
    lfo.connect(lfoG).connect(bp.frequency)
    lfo.start()
    this.airGain = ctx.createGain()
    this.airGain.gain.value = 0
    n.connect(bp).connect(this.airGain).connect(this.musicIn)
    n.start()
    // warm chord pad (retuned per bar, gliding)
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 1200
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0
    this.padFilter.connect(this.padGain).connect(this.musicIn)
    this.padOsc = CHORDS[0].map((m, i) => {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'triangle' : 'sawtooth'
      o.frequency.value = hz(m)
      o.detune.value = (i - 2) * 4
      const g = ctx.createGain()
      g.gain.value = i % 2 ? 0.07 : 0.03
      o.connect(g).connect(this.padFilter)
      o.start()
      return o
    })
    this.chord = 0
  }

  async setMuted(m) {
    this.muted = m
    if (!m) {
      this.init()
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.78, this.ctx.currentTime, 0.2)
    if (m) this.stopVoice(0.15)
  }

  /** Called every animation frame. film = animation time, master = narrated wall-clock time. */
  update(film, master) {
    const realNow = performance.now() / 1000
    const realDt = realNow - this.lastReal
    this.lastReal = realNow
    const dm = master - this.lastMaster
    if (realDt > 0 && realDt < 0.5) {
      const r = dm / realDt
      this.rate += (r - this.rate) * Math.min(1, realDt * 6)
    }
    if (!this.ready || this.muted) {
      this.lastFilm = film
      this.lastMaster = master
      return
    }
    const ctx = this.ctx
    const now = ctx.currentTime
    const forward = this.rate > 0.55 && this.rate < 1.8

    // one-shot cues (only when moving forward at a sensible speed)
    if (dm > 0 && dm < 0.6) {
      for (const c of CUES) if (c.t > this.lastFilm && c.t <= film) this.fire(c)
    }

    // narrator
    this.updateVoice(master, forward, now)

    // ducking with look-ahead
    const speaking = voiceAt(master, 0.6, 0.75)
    this.duck = speaking ? MUSIC_DUCKED : MUSIC_FULL
    this.music.gain.setTargetAtTime(this.duck, now, DUCK_TC)

    // music layers follow the story (film time)
    const t = film
    const drone = 0.55 + 0.25 * seg(t, 0, 4) - 0.2 * win(t, 12, 19, 1, 1) + 0.2 * win(t, 19, 29, 0.3, 1) - 0.4 * seg(t, 48.5, 53)
    const cutoff = 150 + 700 * seg(t, 0, 5) * (1 - seg(t, 5.4, 6.4)) + 500 * win(t, 5.5, 12, 1, 0.3) + 1200 * win(t, 19, 23, 0.2, 2) + 300 * win(t, 29, 48, 1, 1)
    this.droneGain.gain.setTargetAtTime(Math.max(0, drone) * 0.5, now, 0.4)
    this.droneFilter.frequency.setTargetAtTime(cutoff, now, 0.4)
    this.subGain.gain.setTargetAtTime(0.35 * win(t, 0.5, 52.5, 2, 2), now, 0.5)
    this.airGain.gain.setTargetAtTime(0.25 * win(t, 0, 53, 2, 2) + 0.15 * win(t, 5.5, 19, 1, 1), now, 0.5)
    this.padGain.gain.setTargetAtTime(0.9 * win(t, 4.5, 53, 3, 2.5), now, 0.6)
    this.padFilter.frequency.setTargetAtTime(700 + 1600 * win(t, 12, 48, 2, 3) + 900 * win(t, 22.5, 29, 1, 1), now, 0.6)

    // chord progression in master time (one chord per two bars)
    const ci = Math.floor(master / (BEAT * 8)) % CHORDS.length
    if (ci !== this.chord) {
      this.chord = ci
      CHORDS[ci].forEach((m, i) => this.padOsc[i].frequency.setTargetAtTime(hz(m), now, 0.35))
      this.subOsc.frequency.setTargetAtTime(hz(CHORDS[ci][0] - 24), now, 0.3)
    }
    // soft piano-like arpeggio from the city onward (quantised to the master-time grid)
    if (forward && t > 12 && t < 52) {
      const step = BEAT / 2
      if (this.arpNext < master) this.arpNext = Math.ceil(master / step) * step
      while (this.arpNext < master + 0.12) {
        const k = Math.round(this.arpNext / step)
        const notes = CHORDS[this.chord]
        const m = notes[[0, 2, 4, 3, 1, 2, 4, 3][k % 8]] + 12
        this.pluck(hz(m), now + (this.arpNext - master), voiceAt(this.arpNext, 0.3, 0.2) ? 0.035 : 0.06)
        this.arpNext += step
      }
    }

    // gentle fade-out over the last seconds
    const left = plan.total - master
    this.fade.gain.setTargetAtTime(Math.max(0, Math.min(1, left / 3.2)), now, 0.3)

    this.lastFilm = film
    this.lastMaster = master
  }

  updateVoice(master, forward, now) {
    const v = this.voice
    if (v) {
      // keep the sentence flowing; only interrupt on a clear seek, reverse, stop or jump away
      const expected = v.offset + (now - v.startedAt)
      const pos = master - v.seg.start
      const stalled = this.rate < 0.2 || this.rate > 2.6
      if (stalled) v.stall = (v.stall || 0) + 1
      else v.stall = 0
      const lost = Math.abs(expected - pos) > 1.2 || pos < -0.3 || pos > v.seg.dur + 0.6
      if (lost || v.stall > 20 || expected >= v.seg.dur) this.stopVoice(lost || v.stall > 20 ? 0.25 : 0.05)
      else return
    }
    const seg_ = voiceAt(master)
    if (!forward || !seg_ || !seg_.buffer) return
    const offset = master - seg_.start
    if (offset > seg_.dur - 0.4) return
    if (this.voiceDone === seg_ && offset > 0.3) return // finished naturally just now
    const src = this.ctx.createBufferSource()
    src.buffer = seg_.buffer
    const g = this.ctx.createGain()
    const off = Math.max(0, offset)
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(1, now + (off > 0.05 ? 0.15 : 0.01))
    src.connect(g).connect(this.voiceBus)
    src.start(now, off)
    this.voice = { seg: seg_, src, gain: g, startedAt: now, offset: off }
    this.voiceDone = null
  }

  stopVoice(fade = 0.1) {
    const v = this.voice
    if (!v || !this.ctx) return
    this.voiceDone = v.seg
    const now = this.ctx.currentTime
    v.gain.gain.cancelScheduledValues(now)
    v.gain.gain.setValueAtTime(v.gain.gain.value, now)
    v.gain.gain.linearRampToValueAtTime(0, now + fade)
    try {
      v.src.stop(now + fade + 0.02)
    } catch {
      /* already stopped */
    }
    this.voice = null
  }

  env(g, at, a, d, peak) {
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a)
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d)
  }

  osc(type, f, at, dur) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, at)
    o.start(at)
    o.stop(at + dur + 0.1)
    return o
  }

  noiseSrc(at, dur) {
    const n = this.ctx.createBufferSource()
    n.buffer = this.noiseBuf
    n.loop = true
    n.start(at)
    n.stop(at + dur + 0.1)
    return n
  }

  pluck(f, at, peak) {
    const o = this.osc('sine', f, at, 1.6)
    const o2 = this.osc('sine', f * 2, at, 1.0)
    const g = this.ctx.createGain()
    this.env(g, at, 0.006, 1.4, peak)
    const g2 = this.ctx.createGain()
    this.env(g2, at, 0.004, 0.5, peak * 0.3)
    o.connect(g).connect(this.musicIn)
    o2.connect(g2).connect(this.musicIn)
  }

  fire(c) {
    // voice gate: never put loud effects on top of the narrator
    const m = toMaster(c.t)
    const dur = c.dur || 0.6
    const overlaps = voiceAt(m, 0.4, 0.2) || voiceAt(m + dur, 0.2, 0)
    if (overlaps && LOUD.has(c.type)) return
    const quiet = overlaps ? 0.35 : 1 // subtle particles / activations may stay underneath
    const ctx = this.ctx
    const at = ctx.currentTime + 0.01
    const out = ctx.createGain()
    out.gain.value = quiet
    out.connect(this.sfx)
    switch (c.type) {
      case 'pulse': {
        const o = this.osc('sine', 110, at, 0.8)
        o.frequency.exponentialRampToValueAtTime(40, at + 0.35)
        const g = ctx.createGain()
        this.env(g, at, 0.008, 0.6, 0.55)
        o.connect(g).connect(out)
        break
      }
      case 'reveal':
      case 'impact': {
        // soft cinematic bass impact (sub-led, rounded transient)
        const big = c.type === 'reveal'
        const o = this.osc('sine', big ? 70 : 80, at, 3)
        o.frequency.exponentialRampToValueAtTime(30, at + 1.6)
        const g = ctx.createGain()
        this.env(g, at, 0.02, big ? 3.0 : 2.0, big ? 1.0 : 0.65)
        o.connect(g).connect(out)
        const n = this.noiseSrc(at, 2.4)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(1800, at)
        lp.frequency.exponentialRampToValueAtTime(90, at + 1.8)
        const ng = ctx.createGain()
        this.env(ng, at, 0.015, 2.0, big ? 0.3 : 0.18)
        n.connect(lp).connect(ng).connect(out)
        if (big) {
          // shimmering tail
          ;[1318.5, 1760, 2637].forEach((f, i) => {
            const s = this.osc('sine', f, at + 0.2 + i * 0.06, 3)
            const sg = ctx.createGain()
            this.env(sg, at + 0.2 + i * 0.06, 0.4, 2.4, 0.025)
            s.connect(sg).connect(out)
          })
        }
        break
      }
      case 'spark':
      case 'activate': {
        const f = c.type === 'spark' ? 1760 : 880 * Math.pow(2, [0, 3, 5, 7, 10][Math.floor(c.t * 7) % 5] / 12)
        const o = this.osc('sine', f, at, 0.5)
        const mo = this.osc('sine', f * 2.01, at, 0.5)
        const mg = ctx.createGain()
        mg.gain.value = f * 0.6
        mo.connect(mg).connect(o.frequency)
        o.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.12)
        const g = ctx.createGain()
        this.env(g, at, 0.004, 0.4, 0.09)
        o.connect(g).connect(out)
        break
      }
      case 'particles': {
        // granular glitter while particles gather
        for (let i = 0; i < 26; i++) {
          const tt = at + (i / 26) * (c.dur || 2.4) + Math.random() * 0.05
          const o = this.osc('sine', 2000 + Math.random() * 3000, tt, 0.15)
          const g = ctx.createGain()
          this.env(g, tt, 0.002, 0.1, 0.02 + 0.02 * (i / 26))
          o.connect(g).connect(out)
        }
        break
      }
      case 'riser':
      case 'suck': {
        const d = c.dur || 1.2
        const n = this.noiseSrc(at, d)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 1.8
        const up = c.type === 'riser'
        bp.frequency.setValueAtTime(up ? 300 : 5000, at)
        bp.frequency.exponentialRampToValueAtTime(up ? 6000 : 220, at + d)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.32, at + d * 0.92)
        g.gain.exponentialRampToValueAtTime(0.0001, at + d + 0.1)
        n.connect(bp).connect(g).connect(out)
        break
      }
      case 'whoosh': {
        const n = this.noiseSrc(at, 0.9)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 1.3
        bp.frequency.setValueAtTime(400, at)
        bp.frequency.exponentialRampToValueAtTime(4000, at + 0.35)
        bp.frequency.exponentialRampToValueAtTime(300, at + 0.85)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.3, at + 0.3)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.85)
        n.connect(bp).connect(g).connect(out)
        break
      }
      case 'mech':
      case 'thud': {
        const heavy = c.type === 'thud'
        for (let k = 0; k < (heavy ? 1 : 3); k++) {
          const t0 = at + k * 0.07
          const n = this.noiseSrc(t0, 0.08)
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = heavy ? 160 : 2400 + k * 600
          bp.Q.value = heavy ? 1 : 8
          const g = ctx.createGain()
          this.env(g, t0, 0.002, heavy ? 0.45 : 0.07, heavy ? 0.7 : 0.18)
          n.connect(bp).connect(g).connect(out)
        }
        break
      }
      case 'page': {
        const n = this.noiseSrc(at, 0.45)
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 2000
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.12, at + 0.12)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42)
        n.connect(hp).connect(g).connect(out)
        break
      }
      case 'chime': {
        ;[0, 0.14, 0.28].forEach((d, i) => {
          const o = this.osc('sine', [1046.5, 1318.5, 1568][i], at + d, 2)
          const g = ctx.createGain()
          this.env(g, at + d, 0.006, 1.8, 0.08)
          o.connect(g).connect(out)
        })
        break
      }
      default:
    }
  }
}

export const sound = new SoundEngine()
