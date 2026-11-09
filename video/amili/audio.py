"""
Original score, sound design and voice-over for the AMILI Beauty Studio film.

Score is synthesised here (warm pads, felt-piano notes, sub, air) so it is original and
royalty-free. Voice-over is generated locally with Kokoro TTS (af_heart, a warm natural
female voice), then given a gentle broadcast chain and mixed with ducking.

usage: python3 audio.py OUT.wav KOKORO_MODEL_DIR
"""
import os
import sys

import numpy as np
from scipy import signal

SR = 48000
DUR = 42.0
N = int(SR * DUR)
RNG = np.random.default_rng(23)

# (start, text, is_phonemes)
VO_LINES = [
    (1.6, "Some places are made to be felt.", False),
    (6.2, "Calm. Considered. Quietly luxurious.", False),
    (14.2, "Every detail, crafted with precision.", False),
    (21.6, "Every touch, with intention.", False),
    (26.4, "Because true beauty is never rushed.", False),
    (35.0, "ɑːmˈiːli bjˈuːɾi stˈuːdɪˌoʊ.", True),  # "AMILI Beauty Studio" — ah-MEE-lee
    (37.1, "Where beauty becomes an experience.", False),
]

# chord per section (start time, voicing midi notes, bass root)
CHORDS = [
    (0.0, [50, 54, 57, 61, 64], 38),   # Dmaj9
    (4.4, [47, 50, 54, 57, 61], 35),   # Bm9
    (9.0, [55, 59, 62, 66, 69], 43),   # Gmaj9
    (13.6, [52, 55, 59, 62, 66], 40),  # Em9
    (17.4, [47, 50, 54, 57, 61], 35),  # Bm9
    (20.8, [55, 59, 62, 66, 73], 43),  # Gmaj7#11
    (25.4, [52, 55, 59, 62, 66], 40),  # Em9
    (29.6, [57, 62, 64, 66, 69], 45),  # A6sus
    (34.4, [50, 57, 61, 64, 66, 69], 38),  # Dmaj9 (home)
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tx(n):
    return np.arange(n) / SR


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    buf[i:j] += gain * x[: j - i]


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, f1, f2):
    b, a = signal.butter(2, [f1 / (SR / 2), f2 / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    e[n - nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e


def pad_voice(m, dur):
    """Warm analog-style pad voice: detuned triangles + sine, stereo spread, slow vibrato."""
    n = int(dur * SR)
    t = tx(n)
    out = np.zeros((n, 2))
    for k, d in enumerate((-0.07, 0.0, 0.07)):
        f = hz(m) * 2 ** (d / 12)
        vib = 1 + 0.0015 * np.sin(2 * np.pi * (0.18 + 0.05 * k) * t + RNG.random() * 6)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR + RNG.random() * 6
        tri = 2 / np.pi * np.arcsin(np.sin(ph))
        s = 0.55 * tri + 0.45 * np.sin(ph)
        pan = 0.5 + (k - 1) * 0.35
        out[:, 0] += s * (1 - pan)
        out[:, 1] += s * pan
    return out / 3


def pad(chord, dur, a=2.0, r=2.5, fc=1400):
    x = sum(pad_voice(m, dur) for m in chord) / len(chord)
    x = lp(x, fc, 2)
    return x * env(len(x), a, r)[:, None]


def felt_piano(m, dur=4.0, vel=1.0):
    """Soft felt-piano: inharmonic partials, fast mellow decay, gentle hammer thump."""
    n = int(dur * SR)
    t = tx(n)
    f = hz(m)
    x = np.zeros(n)
    for h in range(1, 8):
        fh = f * h * np.sqrt(1 + 0.0004 * h * h)
        x += np.sin(2 * np.pi * fh * t + RNG.random()) * np.exp(-t * (0.9 + 0.9 * h)) / h ** 1.4
    thump = lp(RNG.standard_normal(n) * np.exp(-t * 90), 600) * 0.25
    x = (x + thump) * (1 - np.exp(-t * 400))
    x = lp(x, 2600 + 1800 * vel)
    return x * vel


def bell(m, dur=6.0):
    n = int(dur * SR)
    t = tx(n)
    f = hz(m)
    ratios = [(1, 1.0, 0.7), (2.0, 0.5, 1.2), (2.76, 0.35, 1.8), (5.4, 0.15, 3.0), (8.93, 0.07, 4.5)]
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ratios)
    return x * (1 - np.exp(-t * 600))


def swell(dur, peak=0.7):
    """Soft airy breath that rises into a cut (no hard whoosh)."""
    n = int(dur * SR)
    t = tx(n) / dur
    x = RNG.standard_normal((n, 2))
    out = np.zeros_like(x)
    blk = 1024
    zi = np.zeros((2, 2))
    for k in range(0, n, blk):
        fc = 400 + 3800 * (k / n) ** 2
        b, a = signal.butter(2, fc / (SR / 2), "low")
        out[k:k + blk], zi = signal.lfilter(b, a, x[k:k + blk], axis=0, zi=zi)
    e = np.where(t < peak, (t / peak) ** 2.2, np.cos((t - peak) / (1 - peak) * np.pi / 2) ** 2)
    return out * e[:, None]


def sub(m, dur):
    n = int(dur * SR)
    t = tx(n)
    x = np.sin(2 * np.pi * hz(m) * t) + 0.25 * np.sin(2 * np.pi * hz(m) * 2 * t)
    return x * env(n, 1.2, 1.8)


def reverb(x, size=2.8, mix=0.3, damp=5000):
    n = int(size * SR)
    t = tx(n)
    ir = RNG.standard_normal((n, 2)) * np.exp(-t * 6.9 / size)[:, None]
    ir[: int(0.012 * SR)] = 0  # pre-delay
    ir = lp(ir, damp)
    for c in range(2):
        ir[:, c] /= np.sqrt((ir[:, c] ** 2).sum())
    wet = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - mix * 0.4) + mix * wet


def make_music():
    mus = np.zeros((N, 2))
    sfx = np.zeros((N, 2))
    # room tone / air bed
    air = lp(hp(RNG.standard_normal((N, 2)), 180), 2400) * 0.05
    place(sfx, air * env(N, 3.0, 2.0)[:, None], 0.0)

    for i, (at, chord, root) in enumerate(CHORDS):
        end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DUR
        dur = end - at + 2.2  # overlap = legato pad
        if i == len(CHORDS) - 1:
            dur = DUR - at
        a = 3.0 if i == 0 else 1.6
        place(mus, pad(chord, dur, a, 2.4 if i < len(CHORDS) - 1 else 4.5, 1100 + 120 * i), at - (0 if i == 0 else 0.6), 0.55)
        place(mus, sub(root, dur), at - (0 if i == 0 else 0.4), 0.22 if i else 0.12)
        if i < len(CHORDS) - 1 and i > 0:
            place(sfx, swell(1.6), at - 1.2, 0.05)

    # felt-piano motif: sparse, unhurried, from chord tones
    motif = [
        (2.2, 69, 0.7), (3.4, 73, 0.55),
        (5.4, 66, 0.65), (7.3, 69, 0.5),
        (9.6, 71, 0.65), (10.9, 74, 0.5), (12.4, 78, 0.4),
        (14.3, 71, 0.6), (15.9, 67, 0.5),
        (17.9, 73, 0.6), (19.6, 69, 0.45),
        (21.3, 74, 0.6), (22.6, 78, 0.5), (24.1, 76, 0.45),
        (25.9, 71, 0.6), (27.6, 67, 0.5),
        (30.0, 69, 0.6), (31.3, 74, 0.5), (32.6, 76, 0.55), (33.5, 78, 0.5),
        (34.45, 74, 0.75), (34.47, 62, 0.5), (36.3, 73, 0.5), (38.2, 69, 0.45),
    ]
    for at, m, v in motif:
        x = felt_piano(m, 4.5, v) * 0.16
        pan = 0.5 + 0.25 * np.sin(m)
        place(mus, np.stack([x * (1 - pan) * 2, x * pan * 2], 1) / 1.0, at)

    # signature moment: soft bell + low bloom as the wordmark appears
    b = bell(86, 6.0) * 0.05
    place(sfx, np.stack([b * 0.8, b], 1), 34.45)
    b2 = bell(81, 6.0) * 0.035
    place(sfx, np.stack([b2, b2 * 0.8], 1), 34.75)
    place(sfx, swell(2.4, 0.85), 32.2, 0.07)
    t = tx(int(5 * SR))
    bloom = np.sin(2 * np.pi * hz(26) * t) * np.exp(-t * 0.8) * (1 - np.exp(-t * 30))
    place(mus, bloom, 34.4, 0.35)

    mus = reverb(mus, 3.2, 0.42, 4500)
    sfx = reverb(sfx, 2.6, 0.3, 6000)
    return mus, sfx


def make_voice(model_dir):
    from kokoro_onnx import Kokoro

    k = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
    style = k.get_voice_style("af_heart")
    vo = np.zeros((N, 2))
    timing = []
    for at, line, is_ph in VO_LINES:
        a, sr = k.create(line, voice=style, speed=0.86, lang="en-us", is_phonemes=is_ph)
        a = signal.resample_poly(a, SR, sr)
        idx = np.where(np.abs(a) > 0.008)[0]
        a = a[max(0, idx[0] - 300): idx[-1] + 3000]
        a = a * env(len(a), 0.006, 0.05)
        # intimate broadcast chain: HP, warmth, air, soft saturation
        a = hp(a, 80)
        a = a + 0.22 * lp(a, 260)      # chest
        a = a - 0.10 * bp(a, 2800, 4200)  # tame harshness
        a = a + 0.12 * hp(a, 7500)     # air
        a = np.tanh(a * 1.4) / np.tanh(1.4)
        place(vo, a, at)
        timing.append((round(at, 2), round(at + len(a) / SR, 2), line))
    vo = reverb(vo, 1.1, 0.10, 5000)
    return vo, timing


def build(out_wav, model_dir):
    import soundfile as sf

    mus, sfx = make_music()
    vo, timing = make_voice(model_dir)
    e = lp(np.abs(vo).max(1), 4)
    e = np.clip(e / (e.max() + 1e-9) * 3.5, 0, 1)
    duck = 1 - 0.45 * e
    mix = mus * duck[:, None] * 0.85 + sfx + vo * 1.3
    t = tx(N)
    mix *= (np.minimum(1, t / 0.05) * np.clip((DUR - t) / 2.0, 0, 1) ** 1.5)[:, None]
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    mix /= np.abs(mix).max() / 0.89
    sf.write(out_wav, mix.astype(np.float32), SR, subtype="PCM_24")
    return timing


if __name__ == "__main__":
    for row in build(sys.argv[1], sys.argv[2]):
        print(row)
