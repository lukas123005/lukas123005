"""
Original instrumental score for the SILVIA Beauty Studio film (no voice).

Elegant luxury-lounge cue at 96 BPM: one bar = 2.5 s, so every cut lands on a downbeat.
  bar 1      intro: pad + felt piano + air swell
  bars 2-5   groove: soft kick, rim, shaker, round bass, piano chords
  12.5 s     signature: drums drop, soft bloom + bell, resolve on Dmaj9 and ring out
Fully synthesised here (original, royalty-free). Reuses the instruments from ../amili/audio.py.

usage: python3 music.py OUT.wav
"""
import importlib.util
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("amili_audio", os.path.join(HERE, "..", "amili", "audio.py"))
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

SR = A.SR
DUR = 18.0
N = int(SR * DUR)
BEAT = 60 / 96
BAR = 4 * BEAT  # 2.5 s
RNG = np.random.default_rng(5)

CHORDS = [  # per bar: voicing, bass root
    ([50, 54, 57, 61, 64], 38),   # Dmaj9
    ([47, 50, 54, 57, 61], 35),   # Bm9
    ([55, 59, 62, 66, 69], 43),   # Gmaj9
    ([52, 55, 59, 62, 66], 40),   # Em9
    ([57, 62, 64, 66, 69], 45),   # A6sus
    ([50, 57, 61, 64, 66, 69], 38),  # Dmaj9 (signature)
]


def kick(g=1.0):
    t = A.tx(int(0.5 * SR))
    f = 46 + 70 * np.exp(-t * 28)
    k = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    k += A.lp(RNG.standard_normal(len(t)) * np.exp(-t * 300), 3000) * 0.08
    return g * k


def rim(g=1.0):
    t = A.tx(int(0.25 * SR))
    body = np.sin(2 * np.pi * 1750 * t) * np.exp(-t * 60) * 0.5 + np.sin(2 * np.pi * 820 * t) * np.exp(-t * 45) * 0.4
    click = A.bp(RNG.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 120)
    return g * (body + click)


def snap(g=1.0):
    t = A.tx(int(0.4 * SR))
    x = A.bp(RNG.standard_normal(len(t)), 900, 7000) * (np.exp(-t * 25) + 0.5 * np.exp(-np.maximum(t - 0.012, 0) * 30) * (t > 0.012))
    return g * x


def shaker(g=1.0):
    t = A.tx(int(0.09 * SR))
    e = np.sin(np.clip(t / 0.09, 0, 1) * np.pi) ** 2 * np.exp(-t * 20)
    return g * A.hp(RNG.standard_normal(len(t)), 6500) * e


def bass(m, dur, g=1.0):
    t = A.tx(int(dur * SR))
    f = A.hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    x = np.tanh(x * 1.3) * A.env(len(t), 0.008, min(0.12, dur * 0.4)) * np.exp(-t * 1.2)
    return g * x


def stereo(x, pan=0.5):
    return np.stack([x * (1 - pan) * 1.4, x * pan * 1.4], 1)


def build(out):
    import soundfile as sf

    mus = np.zeros((N, 2))
    drm = np.zeros((N, 2))
    sfx = np.zeros((N, 2))

    # air bed
    air = A.lp(A.hp(RNG.standard_normal((N, 2)), 200), 2600) * 0.04
    A.place(sfx, air * A.env(N, 1.5, 2.5)[:, None], 0)

    for b, (chord, root) in enumerate(CHORDS):
        at = b * BAR
        last = b == len(CHORDS) - 1
        dur = (DUR - at) if last else BAR + 1.6
        A.place(mus, A.pad(chord, dur, 1.8 if b == 0 else 0.9, 4.0 if last else 1.8, 1300 + 150 * b),
                max(0, at - (0 if b == 0 else 0.35)), 0.5)
        A.place(mus, A.sub(root, dur), at, 0.10 if b == 0 else 0.16)

        # piano: chord stabs on 1 and the "and" of 2, sparse top-line answers
        if b >= 1 and not last:
            for off, vel in ((0.0, 0.55), (1.5 * BEAT, 0.4), (3 * BEAT, 0.35)):
                for m in chord[1:4]:
                    A.place(mus, stereo(A.felt_piano(m + 12, 2.5, vel) * 0.06, 0.45), at + off)
        top = [(0.0, chord[-1] + 12, 0.6), (2 * BEAT, chord[-2] + 12, 0.45), (3.5 * BEAT, chord[-3] + 12, 0.4)]
        if last:
            top = [(0.0, 74, 0.75), (0.02, 62, 0.5), (1.5, 73, 0.5), (3.0, 69, 0.45)]
        for off, m, v in top:
            A.place(mus, stereo(A.felt_piano(m, 4.0, v) * 0.13, 0.55), at + off)

        # groove bars 2-5
        if 1 <= b <= 4:
            for i in range(4):
                bt = at + i * BEAT
                if i in (0, 2):
                    A.place(drm, kick(0.85), bt)
                if i == 2 and b % 2 == 0:
                    A.place(drm, kick(0.5), bt - BEAT / 2)  # pickup
                if i in (1, 3):
                    A.place(drm, stereo(snap(0.22), 0.5), bt)
                    A.place(drm, stereo(rim(0.10), 0.62), bt + BEAT * 0.75)
                for s in range(4):
                    acc = 1.0 if s == 2 else 0.55
                    A.place(drm, stereo(shaker(0.06 * acc), 0.35 + 0.3 * (s % 2)), bt + s * BEAT / 4 + (0.012 if s % 2 else 0))
            # bass: root on 1, fifth/octave movement, syncopated
            A.place(mus, bass(root + 12, BEAT * 1.4, 0.32), at)
            A.place(mus, bass(root + 12, BEAT * 0.6, 0.22), at + 1.5 * BEAT)
            A.place(mus, bass(root + 19, BEAT * 0.9, 0.22), at + 2.5 * BEAT)
            A.place(mus, bass(root + 24, BEAT * 0.4, 0.15), at + 3.5 * BEAT)

    # transitions: soft breaths into each cut, bigger one into the signature
    for b in range(1, 5):
        A.place(sfx, A.swell(1.0, 0.85), b * BAR - 0.85, 0.035)
    A.place(sfx, A.swell(2.2, 0.9), 5 * BAR - 1.95, 0.08)
    # signature moment
    t = A.tx(int(5 * SR))
    bloom = np.sin(2 * np.pi * A.hz(26) * t) * np.exp(-t * 0.9) * (1 - np.exp(-t * 40))
    bloom += A.lp(RNG.standard_normal(len(t)) * np.exp(-t * 5), 220) * 1.2
    A.place(sfx, bloom, 5 * BAR, 0.32)
    A.place(sfx, stereo(A.bell(86, 5.0) * 0.05, 0.4), 5 * BAR + 0.02)
    A.place(sfx, stereo(A.bell(81, 5.0) * 0.035, 0.6), 5 * BAR + 0.32)
    A.place(sfx, stereo(A.bell(90, 4.0) * 0.02, 0.5), 5 * BAR + 0.64)

    mus = A.reverb(mus, 2.6, 0.38, 5000)
    drm = A.reverb(drm, 1.0, 0.16, 7000)
    sfx = A.reverb(sfx, 2.4, 0.3, 6000)

    # gentle side-chain pump from the kick on the pad/piano bus
    kick_env = A.lp(np.abs(drm).max(1), 8)
    kick_env = np.clip(kick_env / (kick_env.max() + 1e-9) * 2.5, 0, 1)
    mix = mus * (1 - 0.18 * kick_env)[:, None] + drm * 0.9 + sfx
    tt = A.tx(N)
    mix *= (np.minimum(1, tt / 0.03) * np.clip((DUR - tt) / 2.2, 0, 1) ** 1.4)[:, None]
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix /= np.abs(mix).max() / 0.89
    sf.write(out, mix.astype(np.float32), SR, subtype="PCM_24")


if __name__ == "__main__":
    build(sys.argv[1])
