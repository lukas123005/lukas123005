import { REVEAL_AT, seg, win } from './timeline'
import { LEAF_TIMES, OPEN_AT } from './bookPose'
import { plan, toMaster, voiceAt } from './narration'

/**
 * Studio sound (Web Audio API).
 *
 *   voice ─► light voice chain ─────────────────────────────┐
 *   music (groove: kick, rim, shaker, bass, arp, piano, pad) ─► DUCK ─┼─► master ─► end fade ─► limiter
 *   details (paper, hardcover, keys, one impact) ───────────┘          (+ one shared room reverb)
 *
 * A modern, elegant groove (96 bpm) that grows with the story and peaks on "what you get".
 * The narrator always leads: music rests at ~42 % in pauses and dips to ~15 % while he speaks.
 */
const MUSIC_FULL = 0.42
const MUSIC_DUCKED = 0.15
const DUCK_TC = 0.24

const CUES = [
  { t: REVEAL_AT, type: 'reveal', loud: true },
  ...Array.from({ length: 22 }, (_, i) => ({ t: 8.05 + i * 0.145 + (i % 3) * 0.03, type: 'key' })),
  { t: OPEN_AT[0] + 0.1, type: 'cover', loud: true },
  ...LEAF_TIMES.map((t) => ({ t: t + 0.25, type: 'page' })),
  { t: 43.15, type: 'place' },
  { t: 51.15, type: 'place' },
  { t: 68.0, type: 'final', loud: true },
]

// warm, optimistic progression; one chord per bar at 96 bpm
const CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [48, 55, 60, 64], // C
  [57, 60, 64, 67], // Am7
  [55, 59, 62, 67], // G
]
const BPM = 96
const STEP = 60 / BPM / 4 // sixteenth
const BAR = STEP * 16

/** Musical energy of the story (film seconds) — drives which instruments play. */
function energy(t) {
  if (t < 7) return 0.15
  if (t < 19) return 0.42
  if (t < 20.4) return 0.08 // hold the breath before the reveal
  if (t < 31) return 0.55
  if (t < 43) return 0.68
  if (t < 51) return 0.5
  if (t < 63) return 0.9 // what you get / why this book
  if (t < 68.0) return 0.62
  return 0.12 // resolve
}
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
    this.voice = null
    this.nextNote = 0
    this.chord = -1
    this.duck = MUSIC_FULL
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 4
    limiter.ratio.value = 8
    limiter.attack.value = 0.003
    limiter.release.value = 0.2
    this.fade = ctx.createGain()
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.fade).connect(limiter).connect(ctx.destination)
    this.out = limiter

    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(3.4, 3.2)
    const verbOut = ctx.createGain()
    verbOut.gain.value = 0.32
    this.verb.connect(verbOut).connect(this.master)

    this.music = ctx.createGain()
    this.music.gain.value = MUSIC_FULL
    this.music.connect(this.master)
    this.musicIn = ctx.createGain()
    this.musicIn.connect(this.music)
    const send = ctx.createGain()
    send.gain.value = 0.9
    this.musicIn.connect(send).connect(this.verb)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.6
    this.sfx.connect(this.master)
    this.sfx.connect(this.verb)

    // voice: clean and natural — rumble filter, a touch of air, gentle leveling
    this.voiceBus = ctx.createGain()
    const hpf = ctx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = 75
    const air = ctx.createBiquadFilter()
    air.type = 'highshelf'
    air.frequency.value = 7000
    air.gain.value = 1.2
    const lev = ctx.createDynamicsCompressor()
    lev.threshold.value = -24
    lev.ratio.value = 1.8
    lev.attack.value = 0.012
    lev.release.value = 0.25
    const room = ctx.createGain()
    room.gain.value = 0.035
    this.voiceBus.connect(hpf).connect(air).connect(lev).connect(this.master)
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
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1)
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
    // soft pad: sine + triangle voices through a low-pass, slowly breathing
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 700
    this.padFilter.Q.value = 0.3
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0
    this.padFilter.connect(this.padGain).connect(this.musicIn)
    this.padOsc = CHORDS[0].map((m, i) => {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'triangle' : 'sine'
      o.frequency.value = hz(m)
      o.detune.value = (i - 1.5) * 3
      const g = ctx.createGain()
      g.gain.value = 0.06
      o.connect(g).connect(this.padFilter)
      o.start()
      return o
    })
    // low cinematic air: very quiet sub + filtered room tone
    const sub = ctx.createOscillator()
    sub.frequency.value = hz(41)
    this.subOsc = sub
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    sub.connect(this.subGain).connect(this.musicIn)
    sub.start()
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    n.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    this.airGain = ctx.createGain()
    this.airGain.gain.value = 0
    n.connect(lp).connect(this.airGain).connect(this.musicIn)
    n.start()
  }

  async setMuted(m) {
    this.muted = m
    if (!m) {
      this.init()
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.25)
    if (m) this.stopVoice(0.2)
  }

  /** Called every animation frame. film = animation time, master = narrated wall-clock time. */
  update(film, master) {
    const realNow = performance.now() / 1000
    const realDt = realNow - this.lastReal
    this.lastReal = realNow
    const dm = master - this.lastMaster
    if (realDt > 0 && realDt < 2) this.rate += (dm / realDt - this.rate) * Math.min(1, realDt * 4)
    if (!this.ready || this.muted) {
      this.lastFilm = film
      this.lastMaster = master
      return
    }
    const ctx = this.ctx
    const now = ctx.currentTime
    const forward = this.rate > 0.55 && this.rate < 1.8

    if (dm > 0 && dm < 0.6) for (const c of CUES) if (c.t > this.lastFilm && c.t <= film) this.fire(c)

    this.updateVoice(master, forward, now)

    // ducking with look-ahead; held through short pauses between sentences
    const speaking = voiceAt(master, 0.6, 0.8)
    this.duck = speaking ? MUSIC_DUCKED : MUSIC_FULL
    this.music.gain.setTargetAtTime(this.duck, now, DUCK_TC)

    const t = film
    this.padGain.gain.setTargetAtTime(0.5 * win(t, 0.3, 69, 4, 3) + 0.25 * win(t, 19.5, 31, 2, 1.5) + 0.2 * win(t, 51, 63, 1, 1), now, 0.8)
    this.padFilter.frequency.setTargetAtTime(560 + 520 * win(t, 19, 67, 3, 3) + 500 * win(t, 51, 63, 1, 1), now, 0.9)
    this.subGain.gain.setTargetAtTime(0.14 * win(t, 0.2, 68, 3, 3) + 0.12 * win(t, 19, 23, 1, 2), now, 0.9)
    this.airGain.gain.setTargetAtTime(0.05 * win(t, 0, 69, 2, 3), now, 0.9)

    // harmony moves in master time, one chord per bar
    const ci = Math.floor(master / BAR) % CHORDS.length
    if (ci !== this.chord) {
      this.chord = ci
      CHORDS[ci].forEach((m, i) => this.padOsc[i].frequency.setTargetAtTime(hz(m), now, 0.35))
    }
    // step sequencer on the master-time sixteenth grid (with look-ahead)
    if (forward && t > 0.6 && t < 68.4) {
      if (this.nextNote < master) this.nextNote = Math.ceil(master / STEP) * STEP
      while (this.nextNote < master + 0.2) {
        const at = now + (this.nextNote - master)
        this.step(Math.round(this.nextNote / STEP), at, film + (this.nextNote - master))
        this.nextNote += STEP
      }
    }

    const left = plan.total - master
    this.fade.gain.setTargetAtTime(Math.max(0, Math.min(1, left / 3.6)), now, 0.35)
    this.lastFilm = film
    this.lastMaster = master
  }

  updateVoice(master, forward, now) {
    const v = this.voice
    if (v) {
      const expected = v.offset + (now - v.startedAt)
      const pos = master - v.seg.start
      // stalls are measured in real time, so slow devices never chop a sentence
      const moving = this.rate > 0.2 && this.rate < 2.6
      if (moving) v.stallSince = null
      else if (v.stallSince == null) v.stallSince = now
      const stalled = v.stallSince != null && now - v.stallSince > 1.0
      const lost = Math.abs(expected - pos) > 2.0 || pos < -0.5 || pos > v.seg.dur + 1.0
      if (lost || stalled || expected >= v.seg.dur) this.stopVoice(lost || stalled ? 0.3 : 0.05)
      else return
    }
    const seg_ = voiceAt(master)
    if (!forward || !seg_ || !seg_.buffer) return
    const offset = master - seg_.start
    if (offset > seg_.dur - 0.4) return
    if (this.voiceDone === seg_ && offset > 0.3) return
    const src = this.ctx.createBufferSource()
    src.buffer = seg_.buffer
    const g = this.ctx.createGain()
    const off = Math.max(0, offset)
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(1, now + (off > 0.05 ? 0.18 : 0.01))
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
    n.loopStart = Math.random()
    n.start(at, Math.random())
    n.stop(at + dur + 0.1)
    return n
  }

  /** One sixteenth of the groove. k = global step index, ft = film time at that step. */
  step(k, at, ft) {
    const E = energy(ft)
    const s = k % 16
    const chord = CHORDS[Math.floor(k / 16) % CHORDS.length]
    // kick: 1 (+3 when the story moves, + a ghost at peak)
    if (E > 0.3 && (s === 0 || (E > 0.6 && s === 8) || (E > 0.85 && s === 10))) this.kick(at, s === 10 ? 0.35 : 0.75)
    // rim on 2 and 4
    if (E > 0.5 && (s === 4 || s === 12)) this.rim(at, 0.5)
    // shaker: eighths, sixteenths at the peak
    if (E > 0.35 && s % 2 === 0) this.shaker(at, s % 4 === 2 ? 0.55 : 0.32)
    else if (E > 0.8 && s % 2 === 1) this.shaker(at, 0.18)
    // syncopated bass on the root
    if (E > 0.35 && [0, 3, 6, 10, 14].includes(s)) this.bass(hz(chord[0] - 12 - (chord[0] > 52 ? 12 : 0)), at, STEP * (s === 0 ? 2.6 : 1.6), s === 0 ? 1 : 0.7)
    // arpeggio
    const arpEvery = E > 0.8 ? 1 : E > 0.5 ? 2 : 0
    if (arpEvery && s % arpEvery === 0) {
      const order = [0, 1, 2, 3, 2, 1, 3, 2]
      const m = chord[order[(s / arpEvery) % 8]] + 12
      this.arp(hz(m), at, E > 0.8 ? 0.05 : 0.04)
    }
    // felt piano phrases in the quiet moments
    if (E < 0.5 && E > 0.1 && (s === 0 || s === 6 || s === 10)) {
      const m = chord[(k >> 2) % chord.length] + 12 + (s === 10 ? 12 : 0)
      this.piano(hz(m), at, s === 0 ? 0.07 : 0.05)
    }
  }

  kick(at, v) {
    const o = this.osc('sine', 120, at, 0.45)
    o.frequency.exponentialRampToValueAtTime(44, at + 0.13)
    const g = this.ctx.createGain()
    this.env(g, at, 0.003, 0.36, 0.55 * v)
    o.connect(g).connect(this.musicIn)
  }

  rim(at, v) {
    const n = this.noiseSrc(at, 0.08)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1900
    bp.Q.value = 2
    const g = this.ctx.createGain()
    this.env(g, at, 0.001, 0.07, 0.22 * v)
    n.connect(bp).connect(g).connect(this.musicIn)
    const o = this.osc('triangle', 820, at, 0.05)
    const og = this.ctx.createGain()
    this.env(og, at, 0.001, 0.04, 0.05 * v)
    o.connect(og).connect(this.musicIn)
  }

  shaker(at, v) {
    const n = this.noiseSrc(at, 0.06)
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6500
    const g = this.ctx.createGain()
    this.env(g, at, 0.004, 0.05, 0.09 * v)
    n.connect(hp).connect(g).connect(this.musicIn)
  }

  bass(f, at, dur, v) {
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 520
    lp.connect(this.musicIn)
    ;[['triangle', 1, 0.22], ['sine', 0.5, 0.26]].forEach(([type, mul, amp]) => {
      const o = this.osc(type, f * mul, at, dur)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(amp * v, at + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      o.connect(g).connect(lp)
    })
  }

  arp(f, at, peak) {
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    lp.connect(this.musicIn)
    ;[[1, 1, 0.42], [2, 0.25, 0.22]].forEach(([h, a, d]) => {
      const o = this.osc(h === 1 ? 'triangle' : 'sine', f * h, at, d + 0.1)
      const g = this.ctx.createGain()
      this.env(g, at, 0.004, d, peak * a)
      o.connect(g).connect(lp)
    })
  }

  /** Soft felt-piano voice: decaying partials with a gentle low-pass. */
  piano(f, at, peak) {
    const ctx = this.ctx
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2600, at)
    lp.frequency.exponentialRampToValueAtTime(700, at + 2.5)
    lp.connect(this.musicIn)
    ;[[1, 1, 3.4], [2, 0.32, 2.2], [3, 0.12, 1.4], [4.01, 0.05, 0.9]].forEach(([h, a, d]) => {
      const o = this.osc('sine', f * h, at, d + 0.2)
      o.detune.value = (h - 1) * 1.5
      const g = ctx.createGain()
      this.env(g, at, 0.008, d, peak * a)
      o.connect(g).connect(lp)
    })
  }

  fire(c) {
    const m = toMaster(c.t)
    const overlaps = voiceAt(m, 0.4, 0.2) || voiceAt(m + 0.6, 0.2, 0)
    if (overlaps && c.loud) return
    const quiet = overlaps ? 0.25 : 1
    const ctx = this.ctx
    const at = ctx.currentTime + 0.01
    const out = ctx.createGain()
    out.gain.value = quiet
    out.connect(this.sfx)
    switch (c.type) {
      case 'reveal': {
        // one restrained cinematic impact: a rounded low swell and a soft felt hit
        const o = this.osc('sine', 62, at, 3.2)
        o.frequency.exponentialRampToValueAtTime(38, at + 2.4)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.75, at + 0.06)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 3.0)
        o.connect(g).connect(out)
        const n = this.noiseSrc(at, 1.6)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(900, at)
        lp.frequency.exponentialRampToValueAtTime(120, at + 1.2)
        const ng = ctx.createGain()
        this.env(ng, at, 0.02, 1.3, 0.14)
        n.connect(lp).connect(ng).connect(out)
        break
      }
      case 'key': {
        const n = this.noiseSrc(at, 0.04)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 2600 + Math.random() * 900
        bp.Q.value = 3
        const g = ctx.createGain()
        this.env(g, at, 0.001, 0.035, 0.05)
        n.connect(bp).connect(g).connect(out)
        break
      }
      case 'cover': {
        // hardcover lifting: soft cloth rustle + a low board knock
        const n = this.noiseSrc(at, 0.9)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 0.8
        bp.frequency.setValueAtTime(900, at)
        bp.frequency.exponentialRampToValueAtTime(2400, at + 0.7)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.07, at + 0.35)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
        n.connect(bp).connect(g).connect(out)
        const o = this.osc('sine', 120, at + 1.15, 0.4)
        o.frequency.exponentialRampToValueAtTime(70, at + 1.4)
        const og = ctx.createGain()
        this.env(og, at + 1.15, 0.004, 0.3, 0.18)
        o.connect(og).connect(out)
        break
      }
      case 'page': {
        // delicate paper turn: airy sweep with a soft flutter
        const n = this.noiseSrc(at, 0.75)
        const hp = ctx.createBiquadFilter()
        hp.type = 'bandpass'
        hp.Q.value = 0.6
        hp.frequency.setValueAtTime(2200, at)
        hp.frequency.exponentialRampToValueAtTime(5200, at + 0.35)
        hp.frequency.exponentialRampToValueAtTime(1800, at + 0.7)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.06, at + 0.22)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.72)
        n.connect(hp).connect(g).connect(out)
        break
      }
      case 'final': {
        // a warm closing chord as the groove stops
        CHORDS[0].concat([CHORDS[0][0] + 12]).forEach((m, i) => this.piano(hz(m + 12), at + i * 0.04, 0.06))
        break
      }
      case 'place': {
        const o = this.osc('sine', 95, at, 0.4)
        o.frequency.exponentialRampToValueAtTime(55, at + 0.25)
        const g = ctx.createGain()
        this.env(g, at, 0.004, 0.3, 0.12)
        o.connect(g).connect(out)
        break
      }
      default:
    }
  }
}

export const sound = new SoundEngine()
