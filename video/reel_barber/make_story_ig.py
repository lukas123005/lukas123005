"""
Instagram Story for BOOM 14 Barber: "3 gabimet" -> zgjidhja -> link.
1080x1920, 30 fps, 20 s, black and gold like the reel, original music.
Text stays between y=280 and y=1600 (clear of the story header and the reply bar).
The space under "Prek linkun" is left free for Instagram's link sticker.

    python3 make_story_ig.py              -> boom14_barber_story.mp4
    python3 make_story_ig.py --stills 1 4 13 18
"""
import argparse
import importlib.util
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("barber_reel", os.path.join(HERE, "make_reel.py"))
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)

W, H, FPS, DUR = 1080, 1920, 30, 20.0
N = int(FPS * DUR)
CUTS = [2.7, 5.8, 8.9, 12.0]

MISTAKES = [
    ("Poston vetëm", "kur të kujtohet.", "Profili rri bosh me ditë dhe klientët e rinj nuk të shohin."),
    ("Poston vetëm", "foton e prerjes.", "Pa POV, pa para/pas, pa ASMR. Njerëzit kalojnë tutje."),
    ("Humbet kohë", "me caption-in.", "Mendon, fshin, shkruan prapë… dhe në fund nuk poston."),
]


def x_icon(p, r=58):
    c = Image.new("RGBA", (r * 2 + 12, r * 2 + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    m = r + 6
    rr_ = r * R.eob(R.clamp(p / 0.6))
    if rr_ > 1:
        d.ellipse([m - rr_, m - rr_, m + rr_, m + rr_], fill=R.RED + (255,), outline=R.GOLD + (255,), width=4)
    q = R.clamp((p - 0.35) / 0.65)
    if q > 0:
        k = r * 0.38
        d.line([(m - k, m - k), (m - k + 2 * k * min(1, q * 2), m - k + 2 * k * min(1, q * 2))], fill=R.WHITE, width=9)
        if q > 0.5:
            e = (q - 0.5) * 2
            d.line([(m + k, m - k), (m + k - 2 * k * e, m - k + 2 * k * e)], fill=R.WHITE, width=9)
    return c


# ---------------------------------------------------------------- scenes
def sc_hook(img, t, lay):
    a = R.env(t, 0.0, 2.9, 0.05, 0.15)
    R.place(img, lay["kick"], W / 2, 650, a * R.eo(prog(t, 0.05, 0.4)))
    f1 = R.f8(130)
    R.kinetic(img, R.text_img("Po i bën", f1, fill=R.TXT), "Po i bën", f1, W / 2, 850, t, 0.15, stagger=0.05, rise=80, a=a)
    f2 = R.f8i(150)
    s = "këto 3 gabime?"
    g = R.shine(R.text_img(s, R.fit(s, R.f8i, 150, 940), grad=True, shift=t * 0.25), (t - 1.3) / 0.8)
    R.kinetic(img, g, s, R.fit(s, R.f8i, 150, 940), W / 2, 1020, t, 0.5, stagger=0.04, rise=90, a=a, spin=True)
    p = R.eob(prog(t, 1.2, 0.45))
    R.place(img, lay["hook_sub"], W / 2, 1180 + 40 * (1 - p), a * R.clamp(p))
    p3 = R.eob(prog(t, 1.4, 0.5))
    if p3 > 0:
        R.place(img, R.icon_pole(140, t * 90), W / 2, 1390, a * R.clamp(p3), scale=0.6 + 0.4 * R.clamp(p3))


def prog(t, a, d):
    return R.prog(t, a, d)


def sc_mistake(i, t0, t1):
    top, line2, sub = MISTAKES[i]

    def fn(img, t, lay):
        a = R.env(t, t0, t1 + 0.2, 0.1, 0.15)
        num = f"0{i + 1}"
        fN = R.f8i(300)
        g = R.shine(R.text_img(num, fN, grad=True, shift=t * 0.2), (t - t0 - 0.6) / 0.7)
        R.kinetic(img, g, num, fN, W / 2 - 150, 670, t, t0 + 0.05, stagger=0.08, dur=0.5, rise=120, a=a)
        R.place(img, x_icon(prog(t, t0 + 0.35, 0.55)), W / 2 + 190, 670, a)
        R.place(img, lay["gab"], W / 2, 870, a * R.eo(prog(t, t0 + 0.25, 0.35)))
        f1 = R.fit(top, R.f8, 96, 940)
        R.kinetic(img, R.text_img(top, f1, fill=R.TXT), top, f1, W / 2, 990, t, t0 + 0.35, stagger=0.03, rise=60, a=a)
        f2 = R.fit(line2, R.f8i, 104, 940)
        g2 = R.text_img(line2, f2, grad=True, shift=t * 0.2)
        R.kinetic(img, g2, line2, f2, W / 2, 1110, t, t0 + 0.6, stagger=0.03, rise=60, a=a)
        for j, ln in enumerate(lay["subs"][i]):
            p = R.eo(prog(t, t0 + 1.05 + 0.12 * j, 0.4))
            R.place(img, ln, W / 2, 1270 + j * 62 + 30 * (1 - p), a * p)
        # thin gold progress for the 3 mistakes
        ov = R.overlay()
        d = ImageDraw.Draw(ov)
        for k in range(3):
            x0 = W / 2 - 165 + k * 115
            on = k <= i
            d.rounded_rectangle([x0, 1500, x0 + 100, 1508], radius=4, fill=(R.GOLD if on else (70, 62, 50)) + (int(255 * a),))
        img.alpha_composite(ov)
    return fn


def sc_solution(img, t, lay):
    t0 = 12.0
    a = R.env(t, t0, 16.2, 0.1, 0.2)
    R.place(img, lay["zgj"], W / 2, 330, a * R.eo(prog(t, t0 + 0.05, 0.35)))
    f = R.f8(130)
    g = R.shine(R.text_img("BOOM 14", f, grad=True, shift=t * 0.2), (t - t0 - 0.9) / 0.8)
    R.kinetic(img, g, "BOOM 14", f, W / 2, 470, t, t0 + 0.15, stagger=0.05, rise=-90, a=a)
    R.place(img, lay["barber"], W / 2, 590, a * R.eo(prog(t, t0 + 0.5, 0.4)))
    for j, fl in enumerate(lay["checks"]):
        tj = t0 + 0.8 + j * 0.28
        R.place(img, R.check_icon(prog(t, tj, 0.5)), 170, 700 + j * 70, a, anchor="l")
        p = R.eo(prog(t, tj + 0.12, 0.4))
        if p > 0:
            R.place(img, fl, 232 + 40 * (1 - p), 700 + j * 70, a * p, anchor="l")
    e = R.eob(prog(t, t0 + 0.4, 0.8))
    scr = R.screen_cards(min(t - t0 + 8.0, 9.45), 8.0, lay["L"])
    R.put_phone(img, lay["frame"], scr, W / 2 + 20, 1300 + 200 * (1 - e), scale=0.56, rot=-4 - 6 * (1 - e), a=a * R.clamp(e * 2),
                yaw=-0.5 * (1 - e) - 0.04 * math.sin(t * 1.4))


def sc_cta(img, t, lay):
    t0 = 16.0
    a = R.env(t, t0, DUR + 1, 0.15, 0.2)
    f1 = R.f8(120)
    R.kinetic(img, R.text_img("Ti pret flokët.", f1, fill=R.TXT), "Ti pret flokët.", f1, W / 2, 520, t, t0 + 0.05, stagger=0.03, rise=70, a=a)
    s = "Postimet i ke gati."
    f2 = R.fit(s, R.f8i, 116, 960)
    g = R.shine(R.text_img(s, f2, grad=True, shift=t * 0.2), (t - t0 - 1.1) / 0.8)
    R.kinetic(img, g, s, f2, W / 2, 670, t, t0 + 0.45, stagger=0.03, rise=70, a=a, spin=True)
    p = R.eob(prog(t, t0 + 1.0, 0.45))
    R.place(img, lay["price"], W / 2, 845, a * R.clamp(p), scale=0.8 + 0.2 * R.clamp(p))
    R.place(img, lay["price_sub"], W / 2, 955, a * R.eo(prog(t, t0 + 1.2, 0.4)))
    ca = a * R.eo(prog(t, t0 + 1.5, 0.4))
    if ca:
        R.place(img, lay["tap"], W / 2, 1090, ca)
        ov = R.overlay()
        d = ImageDraw.Draw(ov)
        bob = 16 * math.sin((t - t0) * 2 * math.pi / 0.9)
        ay = 1160 + bob
        d.line([(W / 2, ay), (W / 2, ay + 70)], fill=R.SUN + (int(255 * ca),), width=9)
        d.line([(W / 2 - 30, ay + 42), (W / 2, ay + 74), (W / 2 + 30, ay + 42)], fill=R.SUN + (int(255 * ca),), width=9)
        img.alpha_composite(ov)
    # (y 1260-1480 left free for the link sticker)
    R.place(img, lay["brand"], W / 2, 1560, a * R.eo(prog(t, t0 + 1.8, 0.5)))


SCENES = [(sc_hook, 0.0, 2.95, CUTS[0])]
for i in range(3):
    s0 = CUTS[i]
    SCENES.append((sc_mistake(i, s0, CUTS[i + 1]), s0, CUTS[i + 1] + 0.45, CUTS[i + 1]))
SCENES += [(sc_solution, 12.0, 16.3, None), (sc_cta, 16.0, DUR + 1, None)]


def render(t, bg, lay):
    img = bg.copy()
    img.alpha_composite(R.with_alpha(lay["glow"], 0.35 + 0.35 * (0.5 + 0.5 * math.sin(t * 1.3))))
    R.dust(img, t)
    for fn, t0, t1, cut in SCENES:
        if not (t0 <= t < t1):
            continue
        if cut is not None and t >= cut - 0.08:
            k = R.eio(prog(t, cut - 0.08, 0.42))
            if k >= 0.999:
                continue
            layer = R.overlay()
            fn(layer, min(t, cut - 0.08), lay)
            img.alpha_composite(R.split(layer, k))
        else:
            fn(img, t, lay)
    for c in CUTS:
        R.cut_fx(img, t, c)
    fl = R.env(t, 12.0, 12.5, 0.03, 0.45)
    if fl:
        img.alpha_composite(Image.new("RGBA", (W, H), (255, 226, 170, int(110 * fl))))
    img.alpha_composite(lay["frame_o"])
    out = R.grain(img.convert("RGB"), t)
    g_ = min(1.0, R.eio((DUR - t) / 0.35))
    if g_ < 1:
        out = Image.blend(Image.new("RGB", (W, H), R.INK), out, g_)
    return out


def layers():
    L = R.T["sq"]
    lay = {"L": L, "frame": R.phone_frame(), "frame_o": R.gold_frame()}
    lay["kick"] = R.text_img(R.spaced("BERBER, NDALU NJË SEKONDË"), R.fi(30, "SemiBold"), fill=R.GOLD)
    lay["hook_sub"] = R.text_img("në Instagramin e berberisë", R.fi(44, "Medium"), fill=R.SOFT)
    lay["gab"] = R.text_img(R.spaced("GABIMI"), R.fi(32, "SemiBold"), fill=R.GOLD)
    lay["subs"] = [[R.text_img(ln, R.fi(40, "Medium"), fill=R.SOFT) for ln in R.wrap(m[2], R.fi(40, "Medium"), 880)] for m in MISTAKES]
    lay["zgj"] = R.text_img(R.spaced("ZGJIDHJA"), R.fi(32, "SemiBold"), fill=R.GOLD)
    lay["barber"] = R.text_img(R.spaced("BARBER"), R.fi(40, "SemiBold"), fill=R.TXT)
    lay["checks"] = [R.text_img(s, R.fi(40, "SemiBold"), fill=R.TXT) for s in
                     ("14 ditë postime gati në 10 sekonda", "Çfarë të filmosh, pamje pas pamjeje", "Caption + hashtag për kopjim")]
    lay["price"] = R.text_img("19 $", R.f8(110), grad=True, shift=0.1)
    lay["price_sub"] = R.text_img("një pagesë · pa abonim", R.fi(40, "Medium"), fill=R.SOFT)
    lay["tap"] = R.text_img("Prek linkun", R.f8(76), fill=R.TXT)
    lay["brand"] = R.text_img(R.spaced("CREATOR LAB · LUKA SHEHU"), R.fi(24, "SemiBold"), fill=R.GREY)
    yy, xx = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
    k = np.clip(1 - np.sqrt((xx - W / 8) ** 2 + ((yy - H / 8) * 0.8) ** 2) / (W / 4.5), 0, 1) ** 2
    glow = Image.new("RGBA", (W // 4, H // 4), R.GOLD + (0,))
    glow.putalpha(Image.fromarray((k * 70).astype(np.uint8)))
    lay["glow"] = glow.resize((W, H), Image.BICUBIC)
    return lay


# ---------------------------------------------------------------- music (original)
def music(path):
    sr = 44100
    n = int(sr * DUR)
    tt_all = np.arange(n) / sr
    out = np.zeros((n, 2))
    rng = np.random.default_rng(17)
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731
    beat = 60 / 96

    def add(x, at, g=1.0, pan=0.5):
        i = int(at * sr)
        if i >= n or i < 0:
            return
        j = min(n, i + len(x))
        seg = g * x[: j - i]
        out[i:j, 0] += seg * (1.25 - pan)
        out[i:j, 1] += seg * (0.25 + pan)

    def env_t(d):
        return np.arange(int(d * sr)) / sr

    def kick():
        t = env_t(0.45)
        return np.sin(2 * np.pi * np.cumsum(46 + 120 * np.exp(-t * 30)) / sr) * np.exp(-t * 7)

    def snare():
        t = env_t(0.25)
        return np.diff(rng.standard_normal(len(t)) * np.exp(-t * 20), prepend=0) * 0.6 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 28) * 0.4

    def hat():
        t = env_t(0.05)
        return np.diff(rng.standard_normal(len(t)) * np.exp(-t * 90), prepend=0)

    def keys(f, d=0.6):
        t = env_t(d)
        return sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (3 + 2.5 * h)) / h ** 1.3 for h in (1, 2, 3, 5))

    def boom():
        t = env_t(1.6)
        return np.sin(2 * np.pi * np.cumsum(38 + 100 * np.exp(-t * 9)) / sr) * np.exp(-t * 2.6) + rng.standard_normal(len(t)) * np.exp(-t * 7) * 0.2

    def snip():
        t = env_t(0.06)
        return np.diff(rng.standard_normal(len(t)) * np.exp(-t * 120), prepend=0) * 0.8 + \
            (np.sin(2 * np.pi * 3400 * t) * np.exp(-t * 70) + np.sin(2 * np.pi * 5100 * t) * np.exp(-t * 90) * 0.6) * 0.5

    def whoosh(d=0.5):
        t = env_t(d)
        x = rng.standard_normal(len(t))
        y = np.convolve(x, np.ones(9) / 9, mode="same") - np.convolve(x, np.ones(40) / 40, mode="same")
        return y * np.sin(np.pi * t / d) ** 2 * 0.9

    # dark minor groove for the mistakes, opens up to major for the solution
    minor = [[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 55, 59]]
    major = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    k, tb = 0, 0.0
    while tb < DUR - 0.5:
        sol = tb >= 12.0
        ch = (major if sol else minor)[int(tb / (beat * 4)) % 4]
        inbar = k % 4
        if tb > 0.4:
            if inbar in (0, 2) or (sol and inbar == 3 and k % 8 == 7):
                add(kick(), tb, 0.9)
            if inbar in (1, 3):
                add(snare(), tb, 0.35)
            add(hat(), tb + beat / 2, 0.09, 0.7)
            if inbar == 0:
                t = env_t(beat * 1.8)
                add(np.tanh(2 * np.sin(2 * np.pi * hz(ch[0] - 24) * t)) * np.exp(-t * 2), tb, 0.35)
        for nt in ch:
            add(keys(hz(nt + 12), 0.5), tb + beat / 2, 0.03 if not sol else 0.04, 0.35 + 0.1 * (nt % 3))
        tb += beat
        k += 1
    add(boom(), 0.05, 0.5)
    for c in CUTS:
        add(whoosh(), c - 0.5, 0.45)
        for j in range(3):
            add(snip(), c - 0.45 + j * 0.13, 0.28, 0.3 + 0.2 * j)
        add(boom(), c + 0.05, 0.45 if c < 12 else 0.8)
    for i, m in enumerate([72, 76, 79, 84]):
        add(keys(hz(m), 0.8), 12.15 + i * 0.09, 0.1)
        add(keys(hz(m), 0.8), 17.1 + i * 0.09, 0.08)
    mx = np.tanh(out * 1.35) / np.tanh(1.35)
    mx *= np.minimum(1, (DUR - tt_all) / 1.4)[:, None]
    mx /= np.abs(mx).max() / 0.89
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mx * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    bg = R.make_bg()
    lay = layers()
    if a.stills:
        for s in a.stills:
            render(s, bg, lay).save(os.path.join(HERE, f"_still_story_{s:04.1f}.png"))
        return
    out = os.path.join(HERE, "boom14_barber_story.mp4")
    wav = os.path.join(HERE, "_music_story.wav")
    music(wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(render(f / FPS, bg, lay).tobytes())
    p.stdin.close()
    p.wait()
    os.remove(wav)
    print("done:", out)


if __name__ == "__main__":
    main()
