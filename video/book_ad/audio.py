"""
Original soundtrack + sound design + voiceover mix for the AI Money Playbook ad.

All music is synthesised here (no samples), so it is fully original and royalty-free.
Voiceover is generated locally with the Kokoro TTS model (kokoro-onnx).
"""
import os

import numpy as np
from scipy import signal

SR = 48000
DUR = 40.0
N = int(SR * DUR)
RNG = np.random.default_rng(11)

VO_LINES = [  # (start time, text)
    (1.7, "The future belongs to those who know how to use AI."),
    (19.4, "Learn the tools."),
    (21.1, "Master the prompts."),
    (22.9, "Create digital products."),
    (25.3, "Build something of your own."),
    (29.9, "The AI Money Playbook."),
    (32.1, "Your journey starts here."),
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_axis(n):
    return np.arange(n) / SR


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    if buf.ndim == 2 and x.ndim == 1:
        buf[i:j] += gain * x[: j - i, None]
    else:
        buf[i:j] += gain * x[: j - i]


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def sweep_lp(x, f0, f1):
    """Time-varying low-pass (filter opens from f0 to f1), processed in blocks."""
    out = np.zeros_like(x)
    blk = 2048
    zi = None
    nb = int(np.ceil(len(x) / blk))
    for k in range(nb):
        fc = f0 * (f1 / f0) ** (k / max(1, nb - 1))
        b, a = signal.butter(2, min(fc, SR / 2 - 200) / (SR / 2), "low")
        seg = x[k * blk:(k + 1) * blk]
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
            if x.ndim == 2:
                zi = np.zeros((2, x.shape[1]))
        y, zi = signal.lfilter(b, a, seg, axis=0, zi=zi)
        out[k * blk:(k + 1) * blk] = y
    return out


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1.0) - 1


def supersaw(m, dur, voices=5, detune=0.14):
    t = t_axis(int(dur * SR))
    out = np.zeros((len(t), 2))
    for v in range(voices):
        d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
        f = hz(m) * 2 ** (d / 12)
        s = saw(f, t, RNG.random())
        pan = 0.5 + 0.4 * (v / (voices - 1) - 0.5)
        out[:, 0] += s * (1 - pan)
        out[:, 1] += s * pan
    return out / voices


def env_adsr(n, a, r, sustain_end=None):
    e = np.ones(n)
    na = int(a * SR)
    nr = int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def pad(chord, dur, a=1.5, r=1.5, f0=400, f1=2500):
    x = sum(supersaw(m, dur) for m in chord) / len(chord)
    x = sweep_lp(x, f0, f1)
    return x * env_adsr(len(x), a, r)[:, None]


def kick(gain=1.0, deep=False):
    t = t_axis(int(0.6 * SR))
    f = (40 if deep else 48) + 110 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-t * (4 if deep else 7))
    click = RNG.standard_normal(len(t)) * np.exp(-t * 400) * 0.3
    return gain * (k + click)


def noise_hit(dur, decay, fc_lo=200, fc_hi=9000):
    t = t_axis(int(dur * SR))
    n = RNG.standard_normal(len(t)) * np.exp(-t * decay)
    n = hp(lp(n, fc_hi), fc_lo)
    return n


def whoosh(dur=0.9, up=True):
    n = int(dur * SR)
    x = RNG.standard_normal((n, 2))
    x = sweep_lp(x, 300 if up else 6000, 6000 if up else 300)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x * e[:, None] * 0.6


def riser(dur):
    n = int(dur * SR)
    t = t_axis(n)
    x = RNG.standard_normal((n, 2))
    x = sweep_lp(x, 200, 12000) * (t / dur)[:, None] ** 2
    f = 200 * 2 ** (t / dur * 3)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 3 * 0.25
    return x * 0.5 + tone[:, None]


def impact():
    """Cinematic sub drop + boom + noise tail."""
    t = t_axis(int(3.5 * SR))
    f = 30 + 70 * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.1)
    boom = lp(RNG.standard_normal(len(t)) * np.exp(-t * 3.5), 300) * 3
    tail = hp(RNG.standard_normal(len(t)) * np.exp(-t * 2.2), 2500) * 0.12
    x = sub * 0.9 + boom * 0.5 + tail
    return np.stack([x, x * 0.97], 1)


def braam(m=33, dur=4.0):
    x = supersaw(m, dur, 7, 0.25) + 0.6 * supersaw(m + 12, dur, 5, 0.2) + 0.4 * supersaw(m + 7, dur, 5, 0.2)
    x = sweep_lp(x, 1800, 250)
    return x * env_adsr(len(x), 0.04, 2.5)[:, None]


def blip(f, dur=0.12):
    t = t_axis(int(dur * SR))
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 35)


def pluck(m, dur=1.6):
    t = t_axis(int(dur * SR))
    f = hz(m)
    x = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (2.5 + h * 1.5)) / h for h in range(1, 6))
    return x


def stereo_delay(x, ms_l=310, ms_r=460, fb=0.35, mix=0.3):
    out = x.copy()
    for ch, ms in ((0, ms_l), (1, ms_r)):
        d = int(ms / 1000 * SR)
        y = np.zeros(len(x))
        src = x[:, ch]
        for k in range(1, 5):
            if d * k < len(x):
                y[d * k:] += src[: len(x) - d * k] * (fb ** k)
        out[:, ch] += mix * lp(y, 5000)
    return out


def reverb(x, size=1.8, mix=0.25):
    n = int(size * SR)
    t = t_axis(n)
    ir = RNG.standard_normal((n, 2)) * np.exp(-t * 3.2 / size)[:, None]
    ir = lp(ir, 6000)
    ir[:, 0] /= np.sqrt((ir[:, 0] ** 2).sum())
    ir[:, 1] /= np.sqrt((ir[:, 1] ** 2).sum())
    wet = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x + mix * wet


def make_music():
    mus = np.zeros((N, 2))
    sfx = np.zeros((N, 2))

    # ---- Scene 1: darkness, drone, digital particles (0–5)
    t = t_axis(int(6.0 * SR))
    drone = np.sin(2 * np.pi * 55 * t) * 0.35 + np.sin(2 * np.pi * 82.5 * t) * 0.12
    drone *= np.minimum(1, t / 3.0) * np.minimum(1, (6.0 - t) / 1.0)
    place(mus, np.stack([drone, drone], 1), 0.0, 0.5)
    air = sweep_lp(RNG.standard_normal((len(t), 2)) * 0.25, 300, 3000)
    air *= (np.minimum(1, t / 4) * np.minimum(1, (6 - t) / 1.5))[:, None]
    place(mus, air, 0.0, 0.35)
    for k in range(26):
        at = 0.7 + k * 0.17 + RNG.random() * 0.1
        f = hz(RNG.choice([81, 84, 86, 88, 91, 93, 96]))
        b = blip(f) * (0.05 + 0.04 * RNG.random())
        p = RNG.random()
        place(sfx, np.stack([b * (1 - p), b * p], 1), at)
    place(sfx, whoosh(1.2, True), 4.3, 0.55)

    # ---- Scene 2: pulse builds (5–11)
    beat = 60 / 112
    arp_notes = [57, 64, 69, 72, 76, 72, 69, 64]
    for i in range(int(6.0 / (beat / 2))):
        at = 5.0 + i * beat / 2
        m = arp_notes[i % 8]
        x = pluck(m, 0.6) * 0.09 * (0.6 + 0.4 * min(1, i / 16))
        pan = 0.5 + 0.3 * np.sin(i)
        place(mus, np.stack([x * (1 - pan), x * pan], 1), at)
    place(mus, pad([45, 52, 57, 60, 64], 6.4, 1.2, 0.8, 300, 1800), 5.0, 0.32)
    for i in range(12):
        at = 6.9 + i * beat / 1
        if at < 10.4:
            place(mus, kick(0.5), at)
    for i in range(int(4.3 / (beat / 2))):
        at = 6.9 + i * beat / 2 + beat / 4
        if at < 10.4:
            place(mus, np.stack([noise_hit(0.05, 90, 7000, 16000)] * 2, 1), at, 0.07)

    # ---- Scene 3: riser, silence, impact, reveal crescendo (10–19)
    place(sfx, riser(1.6), 9.25, 0.5)
    place(sfx, impact(), 11.15, 0.95)
    place(mus, braam(33, 4.5), 11.15, 0.32)
    place(mus, pad([45, 52, 57, 60, 64, 71], 8.4, 2.5, 1.2, 250, 6000), 11.2, 0.6)
    place(mus, pad([33, 45], 8.2, 1.0, 1.5, 120, 400), 11.2, 0.5)
    shimmer = pad([81, 88, 93], 7.5, 3.0, 1.5, 2000, 9000)
    place(mus, shimmer, 11.8, 0.12)
    place(sfx, whoosh(1.4, True), 13.3, 0.25)
    place(mus, braam(36, 3.5), 15.2, 0.22)
    place(sfx, riser(1.4), 17.6, 0.45)
    # crescendo: accelerating sub pulses + swelling strings-like pad
    at, gap, k = 14.4, 0.62, 0
    while at < 18.9:
        g = 0.25 + 0.55 * (at - 14.4) / 4.5
        place(mus, kick(g, deep=True), at)
        at += gap
        gap = max(0.16, gap * 0.9)
    place(mus, pad([57, 64, 69, 72, 76], 4.6, 3.8, 0.3, 500, 7000), 14.4, 0.32)

    # ---- Scene 4: driving section (19–29)
    bpm = 120
    b4 = 60 / bpm
    bass_seq = [33, 33, 36, 31]  # A, A, C, G (per bar)
    chords = [[57, 60, 64, 67], [57, 60, 64, 69], [55, 60, 64, 67], [55, 59, 62, 67]]
    t0 = 19.0
    n_beats = int((29.0 - t0) / b4)
    for i in range(n_beats):
        at = t0 + i * b4
        bar = (i // 4) % 4
        place(mus, kick(0.75), at)
        if i % 2 == 1:
            place(mus, np.stack([noise_hit(0.22, 18, 900, 9000)] * 2, 1), at, 0.18)
        for h in range(2):
            place(mus, np.stack([noise_hit(0.04, 110, 8000, 18000)] * 2, 1), at + h * b4 / 2 + b4 / 4, 0.06)
        # off-beat bass
        bt = t_axis(int(b4 / 2 * SR))
        f = hz(bass_seq[bar] + 12)
        bs = (saw(f, bt) * 0.6 + np.sin(2 * np.pi * f / 2 * bt)) * np.exp(-bt * 6)
        bs = lp(bs, 900)
        place(mus, np.stack([bs, bs], 1), at + b4 / 2, 0.22)
        # arp sixteenths
        for s in range(4):
            m = chords[bar][(i * 4 + s) % 4] + 12
            x = pluck(m, 0.35) * 0.05
            pan = 0.5 + 0.35 * np.sin((i * 4 + s) * 0.9)
            place(mus, np.stack([x * (1 - pan), x * pan], 1), at + s * b4 / 4)
    for bar in range(int((29.0 - t0) / (b4 * 4)) + 1):
        place(mus, pad([m - 12 for m in chords[bar % 4]], b4 * 4 + 0.3, 0.2, 0.4, 900, 2600), t0 + bar * b4 * 4, 0.16)
    for at in [19.0, 20.5, 22.4, 23.9, 25.3, 26.6, 27.8]:
        place(sfx, whoosh(0.7, False), at - 0.25, 0.3)
    place(sfx, riser(1.5), 27.5, 0.4)

    # ---- Scene 5: final product shot (29–36)
    place(sfx, impact(), 29.0, 0.8)
    place(mus, pad([45, 52, 57, 60, 64, 71], 7.5, 1.8, 2.0, 400, 3000), 29.05, 0.5)
    place(mus, pad([33, 45], 7.2, 0.6, 2.0, 120, 300), 29.05, 0.45)
    for k, (at, m) in enumerate([(29.5, 76), (30.7, 72), (31.9, 74), (33.1, 71), (34.3, 69)]):
        x = pluck(m, 2.2) * 0.07
        place(mus, np.stack([x, x], 1), at)

    # ---- Scene 6: CTA (36–40)
    place(sfx, noise_hit(1.5, 3, 3000, 14000)[:, None].repeat(2, 1), 36.0, 0.05)
    place(mus, kick(0.7, deep=True), 36.0)
    place(mus, pad([45, 52, 57, 64, 69, 76], 4.0, 0.3, 3.2, 1200, 600), 36.0, 0.42)
    x = pluck(81, 3.5) * 0.06
    place(mus, np.stack([x, x], 1), 36.05)

    mus = stereo_delay(mus, mix=0.18)
    mus = reverb(mus, 2.2, 0.22)
    sfx = reverb(sfx, 1.6, 0.18)
    return mus, sfx


def make_voice(model_dir):
    import soundfile as sf  # noqa: F401
    from kokoro_onnx import Kokoro

    k = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
    # A deeper, confident blend of two male American voices
    style = 0.6 * k.get_voice_style("am_michael") + 0.4 * k.get_voice_style("am_onyx")
    vo = np.zeros((N, 2))
    timing = []
    for at, line in VO_LINES:
        a, sr = k.create(line, voice=style, speed=0.92, lang="en-us")
        a = signal.resample_poly(a, SR, sr)
        # trim leading/trailing silence
        idx = np.where(np.abs(a) > 0.01)[0]
        a = a[max(0, idx[0] - 400): idx[-1] + 2400]
        # broadcast voice chain: high-pass, gentle presence, warm low end
        a = hp(a, 70)
        a = a + 0.25 * hp(a, 2500)
        a = a + 0.20 * lp(a, 220)
        a = np.tanh(a * 1.6) / np.tanh(1.6)
        place(vo, a, at)
        timing.append((at, at + len(a) / SR, line))
    vo = reverb(vo, 0.9, 0.08)
    return vo, timing


def build(out_wav, model_dir):
    import soundfile as sf
    mus, sfx = make_music()
    vo, timing = make_voice(model_dir)
    # side-chain duck music under voice
    env = np.abs(vo).max(1)
    env = lp(env, 6)
    env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    duck = 1 - 0.55 * env
    mix = mus * duck[:, None] * 0.9 + sfx * 0.9 + vo * 1.25
    t = t_axis(N)
    mix *= (np.minimum(1, t / 0.05) * np.clip((DUR - t) / 1.6, 0, 1))[:, None]
    # master: soft clip + normalise to -1 dBFS
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix /= np.abs(mix).max() / 0.89
    sf.write(out_wav, mix.astype(np.float32), SR, subtype="PCM_24")
    return timing


if __name__ == "__main__":
    import sys
    print(build(sys.argv[1], sys.argv[2]))
