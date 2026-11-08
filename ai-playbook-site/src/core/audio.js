import { IMPACTS, PULSES, seg, win } from './timeline'

/**
 * Procedural cinematic sound system (Web Audio API, no audio files).
 * Continuous layers follow the master time; one-shot cues fire when time crosses them forward.
 */
const CUES = [
  ...PULSES.filter((p) => !IMPACTS.includes(p)).map((t) => ({ t, type: 'pulse' })),
  ...IMPACTS.map((t) => ({ t, type: 'impact' })),
  { t: 0.15, type: 'spark' },
  { t: 4.1, type: 'riser', dur: 1.35 },
  { t: 6.2, type: 'activate' }, { t: 7.1, type: 'activate' }, { t: 8.5, type: 'activate' },
  { t: 9.7, type: 'activate' }, { t: 10.8, type: 'activate' },
  { t: 10.6, type: 'riser', dur: 1.4 },
  { t: 12.9, type: 'whoosh' }, { t: 14.9, type: 'whoosh' }, { t: 16.9, type: 'whoosh' },
  { t: 13.5, type: 'mech' }, { t: 15.5, type: 'mech' }, { t: 17.5, type: 'mech' },
  { t: 17.6, type: 'riser', dur: 1.4 },
  { t: 19.6, type: 'charge', dur: 2.8 },
  { t: 29.4, type: 'mech' }, { t: 29.9, type: 'mech' },
  ...[31.05, 32.65, 34.25, 35.85].map((t) => ({ t, type: 'page' })),
  ...Array.from({ length: 9 }, (_, i) => ({ t: 31.0 + i * 0.72, type: 'activate' })),
  { t: 38.9, type: 'suck', dur: 1.5 },
  { t: 40.1, type: 'page' }, { t: 40.3, type: 'page' },
  { t: 41.35, type: 'thud' },
  { t: 48.3, type: 'chime' },
]

export class SoundEngine {
  constructor() {
    this.ctx = null
    this.muted = true
    this.lastTime = 0
    this.ready = false
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.25
    this.master.connect(comp).connect(ctx.destination)

    // reverb send
    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(3.2, 2.6)
    this.verbGain = ctx.createGain()
    this.verbGain.gain.value = 0.35
    this.verb.connect(this.verbGain).connect(this.master)

    this.bus = ctx.createGain()
    this.bus.connect(this.master)
    this.bus.connect(this.verb)

    this.noiseBuf = this.noise(2)
    this.buildDrone()
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

  buildDrone() {
    const ctx = this.ctx
    // deep detuned saw drone through a moving low-pass
    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 180
    this.droneFilter.Q.value = 3
    this.droneGain = ctx.createGain()
    this.droneGain.gain.value = 0
    this.droneFilter.connect(this.droneGain).connect(this.bus)
    for (const [f, det] of [[55, -7], [55, 6], [82.4, 0], [110, 3]]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      const g = ctx.createGain()
      g.gain.value = f > 100 ? 0.12 : 0.22
      o.connect(g).connect(this.droneFilter)
      o.start()
    }
    // sub sine
    const sub = ctx.createOscillator()
    sub.frequency.value = 41.2
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    sub.connect(this.subGain).connect(this.master)
    sub.start()
    // airy electronic ambience (band-passed noise with slow LFO)
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    n.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoG = ctx.createGain()
    lfoG.gain.value = 900
    lfo.connect(lfoG).connect(bp.frequency)
    lfo.start()
    this.airGain = ctx.createGain()
    this.airGain.gain.value = 0
    n.connect(bp).connect(this.airGain).connect(this.bus)
    n.start()
    // shimmering pad (sine cluster) for the reveal / knowledge scenes
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0
    this.padGain.connect(this.bus)
    for (const m of [57, 64, 69, 71, 76]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 440 * Math.pow(2, (m - 69) / 12)
      const g = ctx.createGain()
      g.gain.value = 0.05
      const vib = ctx.createOscillator()
      vib.frequency.value = 0.2 + Math.random() * 0.3
      const vg = ctx.createGain()
      vg.gain.value = 3
      vib.connect(vg).connect(o.detune)
      vib.start()
      o.connect(g).connect(this.padGain)
      o.start()
    }
  }

  async setMuted(m) {
    this.muted = m
    if (!m) {
      this.init()
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.15)
  }

  /** Called every animation frame with the master time. */
  update(t) {
    if (!this.ready || this.muted) {
      this.lastTime = t
      return
    }
    const ctx = this.ctx
    const now = ctx.currentTime
    const dt = t - this.lastTime
    if (dt > 0 && dt < 0.6) {
      for (const c of CUES) if (c.t > this.lastTime && c.t <= t) this.fire(c)
    }
    this.lastTime = t

    // continuous layers follow the story
    const drone = 0.25 + 0.35 * seg(t, 0, 4.5) - 0.15 * win(t, 12, 19, 1, 1) + 0.25 * win(t, 19, 29, 0.2, 1) - 0.25 * seg(t, 47, 53)
    const cutoff = 140 + 900 * seg(t, 0, 5) * (1 - seg(t, 5.4, 6.5)) + 600 * win(t, 5.5, 12, 1, 0.3) +
      1600 * win(t, 19, 23, 0.2, 2) + 400 * win(t, 29, 48, 1, 1)
    this.droneGain.gain.setTargetAtTime(Math.max(0, drone) * 0.55, now, 0.25)
    this.droneFilter.frequency.setTargetAtTime(cutoff, now, 0.3)
    this.subGain.gain.setTargetAtTime(0.25 * win(t, 0.5, 52, 2, 3), now, 0.4)
    this.airGain.gain.setTargetAtTime(0.18 * win(t, 0, 53, 2, 3) + 0.15 * win(t, 5.5, 19, 1, 1), now, 0.4)
    this.padGain.gain.setTargetAtTime(0.9 * win(t, 22.5, 39, 1.5, 1.5) + 0.7 * win(t, 41.6, 53, 0.5, 3), now, 0.5)
  }

  env(g, at, a, d, peak) {
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + a)
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

  fire(c) {
    const ctx = this.ctx
    const at = ctx.currentTime + 0.01
    const out = this.bus
    switch (c.type) {
      case 'pulse': {
        const o = this.osc('sine', 120, at, 0.8)
        o.frequency.exponentialRampToValueAtTime(38, at + 0.35)
        const g = ctx.createGain()
        this.env(g, at, 0.005, 0.7, 0.9)
        o.connect(g).connect(this.master)
        break
      }
      case 'impact': {
        const o = this.osc('sine', 90, at, 3)
        o.frequency.exponentialRampToValueAtTime(28, at + 1.8)
        const g = ctx.createGain()
        this.env(g, at, 0.005, 2.8, 1.0)
        o.connect(g).connect(this.master)
        const n = this.noiseSrc(at, 2.5)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(5000, at)
        lp.frequency.exponentialRampToValueAtTime(120, at + 2)
        const ng = ctx.createGain()
        this.env(ng, at, 0.003, 2.2, 0.55)
        n.connect(lp).connect(ng).connect(out)
        break
      }
      case 'spark':
      case 'activate': {
        const f = c.type === 'spark' ? 1760 : 880 * Math.pow(2, Math.floor(Math.random() * 5) / 12)
        const o = this.osc('sine', f, at, 0.5)
        const m = this.osc('sine', f * 2.01, at, 0.5)
        const mg = ctx.createGain()
        mg.gain.value = f * 0.8
        m.connect(mg).connect(o.frequency)
        o.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.12)
        const g = ctx.createGain()
        this.env(g, at, 0.004, 0.4, 0.12)
        o.connect(g).connect(out)
        break
      }
      case 'riser':
      case 'charge':
      case 'suck': {
        const dur = c.dur || 1.4
        const n = this.noiseSrc(at, dur)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 2
        const up = c.type !== 'suck'
        bp.frequency.setValueAtTime(up ? 300 : 6000, at)
        bp.frequency.exponentialRampToValueAtTime(up ? 7000 : 200, at + dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(c.type === 'charge' ? 0.35 : 0.5, at + dur * 0.95)
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.08)
        n.connect(bp).connect(g).connect(out)
        const o = this.osc('sawtooth', up ? 110 : 440, at, dur)
        o.frequency.exponentialRampToValueAtTime(up ? 880 : 55, at + dur)
        const og = ctx.createGain()
        og.gain.setValueAtTime(0.0001, at)
        og.gain.exponentialRampToValueAtTime(0.06, at + dur * 0.9)
        og.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.05)
        const lp = ctx.createBiquadFilter()
        lp.frequency.value = 2000
        o.connect(lp).connect(og).connect(out)
        break
      }
      case 'whoosh': {
        const n = this.noiseSrc(at, 0.9)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 1.4
        bp.frequency.setValueAtTime(400, at)
        bp.frequency.exponentialRampToValueAtTime(4500, at + 0.35)
        bp.frequency.exponentialRampToValueAtTime(300, at + 0.85)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.45, at + 0.3)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.85)
        n.connect(bp).connect(g).connect(out)
        break
      }
      case 'mech':
      case 'thud': {
        // servo click + metallic resonance
        const heavy = c.type === 'thud'
        for (let k = 0; k < (heavy ? 1 : 3); k++) {
          const t0 = at + k * 0.07
          const n = this.noiseSrc(t0, 0.08)
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = heavy ? 180 : 2400 + k * 600
          bp.Q.value = heavy ? 1 : 8
          const g = ctx.createGain()
          this.env(g, t0, 0.001, heavy ? 0.5 : 0.07, heavy ? 1.0 : 0.3)
          n.connect(bp).connect(g).connect(out)
        }
        const o = this.osc('triangle', heavy ? 70 : 1320, at, 0.6)
        const g = ctx.createGain()
        this.env(g, at, 0.002, heavy ? 0.5 : 0.25, heavy ? 0.6 : 0.05)
        o.connect(g).connect(out)
        break
      }
      case 'page': {
        const n = this.noiseSrc(at, 0.45)
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 1800
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.18, at + 0.12)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42)
        n.connect(hp).connect(g).connect(out)
        break
      }
      case 'chime': {
        ;[0, 0.12, 0.24].forEach((d, i) => {
          const o = this.osc('sine', [1046.5, 1318.5, 1568][i], at + d, 2)
          const g = ctx.createGain()
          this.env(g, at + d, 0.004, 1.8, 0.12)
          o.connect(g).connect(out)
        })
        break
      }
      default:
    }
  }
}

export const sound = new SoundEngine()
