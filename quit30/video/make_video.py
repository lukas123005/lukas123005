"""
English promo video for "Quit in 30 Days" (1080x1920, 30 fps, ~31 s).
Scenes follow the voiceover lines (vo/manifest.json, made by voice.py).

    python3 make_video.py            -> quit30_promo.mp4
    python3 make_video.py --stills 1 5 9
"""
import argparse
import importlib.util
import json
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("barber_reel", os.path.join(HERE, "..", "..", "video", "reel_barber", "make_reel.py"))
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)

W, H, FPS = 1080, 1920, 30
NAVY = (16, 35, 58)
NAVY2 = (24, 52, 83)
MINT = (47, 203, 142)
MINT_L = (227, 246, 236)
CORAL = (255, 122, 89)
WHITE = (255, 255, 255)
SOFT = (200, 218, 212)
R.base.GRAD_STOPS = [(0, (26, 158, 108)), (0.35, MINT), (0.55, (160, 240, 205)), (0.75, MINT), (1, (26, 158, 108))]

FD = os.path.join(HERE, "..", "fonts")
fr = lambda s: ImageFont.truetype(os.path.join(FD, "Fraunces-600-normal.ttf"), s)  # noqa: E731
fri = lambda s: ImageFont.truetype(os.path.join(FD, "Fraunces-600-italic.ttf"), s)  # noqa: E731
fi = R.fi
T = R.text_img
place, env, prog, eo, eob, eio, clamp = R.place, R.env, R.prog, R.eo, R.eob, R.eio, R.clamp

MAN = json.load(open(os.path.join(HERE, "vo", "manifest.json")))
GAP, LEAD = 0.42, 0.45
STARTS = []
t = LEAD
for ln in MAN["lines"]:
    STARTS.append(t)
    t += ln["dur"] + GAP
DUR = t + 1.6
N = int(DUR * FPS)


def S(i):
    return STARTS[i]


def E_(i):
    return STARTS[i] + MAN["lines"][i]["dur"]


PAGES = {k: Image.open(os.path.join(HERE, "pages", f"p{k}.png")).convert("RGBA") for k in (1, 2, 4, 5, 6, 10, 39, 42)}


def page_img(k, width, radius=18, shadow=True):
    p = PAGES[k]
    p = p.resize((width, int(p.height * width / p.width)), Image.LANCZOS)
    m = Image.new("L", p.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, p.width - 1, p.height - 1], radius=radius, fill=255)
    p.putalpha(m)
    if not shadow:
        return p
    c = Image.new("RGBA", (p.width + 120, p.height + 140), (0, 0, 0, 0))
    sh = Image.new("L", c.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([60, 80, p.width + 60, p.height + 80], radius=radius, fill=170)
    s = Image.new("RGBA", c.size, (0, 0, 0, 255))
    s.putalpha(sh.filter(ImageFilter.GaussianBlur(28)))
    c.alpha_composite(s)
    c.alpha_composite(p, (60, 50))
    return c


def make_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.ones((H, W, 3), np.float32) * np.array(NAVY, np.float32)

    def blob(cx, cy, r, col, a):
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        return (np.clip(1 - d, 0, 1) ** 2 * a)[..., None] * (np.array(col, np.float32) - base)

    img = base + blob(980, 260, 1000, MINT, 0.42) + blob(80, 1750, 900, CORAL, 0.28)
    img += np.random.default_rng(1).normal(0, 2.5, (H, W, 1))
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


_DOTS = None


def air(img, t):
    """Slow rising 'fresh air' bubbles."""
    global _DOTS
    if _DOTS is None:
        rng = np.random.default_rng(8)
        _DOTS = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(4, 16), rng.uniform(20, 60), rng.uniform(0, 6.3), rng.uniform(.08, .25))
                 for _ in range(40)]
    ov = R.overlay()
    d = ImageDraw.Draw(ov)
    for x, y, r, v, ph, a in _DOTS:
        yy = (y - v * t) % (H + 100) - 50
        xx = x + 18 * math.sin(t * .7 + ph)
        d.ellipse([xx - r, yy - r, xx + r, yy + r], outline=MINT_L + (int(255 * a),), width=2)
    img.alpha_composite(ov)


def kin(img, s, font, cx, cy, t, t0, fill=WHITE, grad=False, a=1.0, rise=70, stagger=.03, spin=False):
    lay = T(s, font, fill=fill, grad=grad, shift=t * .2)
    if grad:
        lay = R.shine(lay, (t - t0 - .6) / .8)
    R.kinetic(img, lay, s, font, cx, cy, t, t0, stagger=stagger, dur=.45, rise=rise, a=a, spin=spin)


def pill(text, bg, fg, size=40, pad=(34, 18)):
    tl = T(text, fi(size, "Bold"), fill=fg)
    c = Image.new("RGBA", (tl.width + pad[0] * 2, tl.height + pad[1] * 2), (0, 0, 0, 0))
    ImageDraw.Draw(c).rounded_rectangle([0, 0, c.width - 1, c.height - 1], radius=c.height // 2, fill=bg)
    c.alpha_composite(tl, (pad[0], pad[1]))
    return c


def cigarette(p):
    """A cigarette that snaps in two (p 0..1)."""
    c = Image.new("RGBA", (700, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    k = eo(p)
    gap = 60 * k
    rot = 14 * k
    left = Image.new("RGBA", (360, 100), (0, 0, 0, 0))
    ImageDraw.Draw(left).rounded_rectangle([10, 30, 350, 70], radius=10, fill=(245, 241, 232))
    ImageDraw.Draw(left).rounded_rectangle([10, 30, 110, 70], radius=10, fill=(233, 160, 92))
    right = Image.new("RGBA", (360, 100), (0, 0, 0, 0))
    ImageDraw.Draw(right).rounded_rectangle([10, 30, 300, 70], radius=10, fill=(245, 241, 232))
    ImageDraw.Draw(right).rounded_rectangle([280, 30, 320, 70], radius=8, fill=(120, 120, 120))
    ImageDraw.Draw(right).ellipse([300, 34, 336, 66], fill=(255, 122, 89, int(255 * (1 - k))))
    lt = left.rotate(rot, resample=Image.BICUBIC, expand=True)
    rt = right.rotate(-rot, resample=Image.BICUBIC, expand=True)
    c.alpha_composite(lt, (int(10 - gap), int(130 - lt.height / 2)))
    c.alpha_composite(rt, (int(340 + gap), int(130 - rt.height / 2)))
    return c


def breath(img, t, cx, cy, a):
    """Calm breathing rings: fresh air, a new start."""
    if a <= 0:
        return
    ov = R.overlay()
    d = ImageDraw.Draw(ov)
    for j in range(4):
        ph = ((t * .45 + j / 4) % 1.0)
        r = 120 + 200 * ph
        al = int(200 * a * (1 - ph))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=MINT + (al,), width=6)
    core = 112 + 10 * math.sin(t * 2.6)
    d.ellipse([cx - core, cy - core, cx + core, cy + core], fill=MINT + (int(230 * a),))
    img.alpha_composite(ov)
    place(img, T("breathe", fri(44), fill=NAVY), cx, cy, a)


def jar(fill, t):
    c = Image.new("RGBA", (420, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle([60, 40, 360, 80], radius=12, fill=(200, 210, 220))
    body = [40, 90, 380, 500]
    h = (body[3] - body[1] - 20) * clamp(fill)
    if h > 2:
        m = Image.new("L", c.size, 0)
        ImageDraw.Draw(m).rounded_rectangle(body, radius=50, fill=255)
        coins = Image.new("RGBA", c.size, (0, 0, 0, 0))
        cd = ImageDraw.Draw(coins)
        cd.rectangle([40, body[3] - 10 - h, 380, 500], fill=(242, 196, 70))
        for j in range(int(h // 26) + 1):
            y = body[3] - 20 - j * 26
            for x in range(60 + (j % 2) * 30, 370, 60):
                if y > body[3] - 10 - h:
                    cd.ellipse([x - 24, y - 10, x + 24, y + 10], fill=(255, 216, 102), outline=(201, 145, 20), width=3)
        coins.putalpha(Image.fromarray(np.minimum(np.asarray(coins.getchannel("A")), np.asarray(m))))
        c.alpha_composite(coins)
    d.rounded_rectangle(body, radius=50, outline=(230, 240, 245), width=8)
    d.line([(90, 140), (90, 300)], fill=(255, 255, 255, 120), width=10)
    return c


# ---------------------------------------------------------------- scenes
def scenes(img, t, lay):
    # 0 hook
    a = env(t, 0, S(1) + .1, .05, .25)
    if a:
        kin(img, "Tried to quit", fr(130), W / 2, 700, t, S(0), a=a)
        kin(img, "before?", fri(170), W / 2, 870, t, S(0) + .45, grad=True, a=a, spin=True)
        breath(img, t, W / 2, 1220, a * clamp(prog(t, S(0) + .3, .4)))
    # 1 not starting over
    a = env(t, S(1) - .05, S(2) + .1, .2, .25)
    if a:
        kin(img, "You're not", fr(110), W / 2, 700, t, S(1), a=a)
        kin(img, "starting over.", fr(110), W / 2, 830, t, S(1) + .25, a=a)
        kin(img, "You're starting", fr(96), W / 2, 1040, t, S(1) + 1.15, fill=SOFT, a=a)
        kin(img, "smarter.", fri(170), W / 2, 1200, t, S(1) + 1.45, grad=True, a=a, spin=True)
    # 2 the book, one page a day
    a = env(t, S(2) - .05, S(3) + .1, .25, .25)
    if a:
        e = eob(prog(t, S(2), .8))
        cov = R.perspective(lay["cover"], -.25 * (1 - e) + .04 * math.sin(t))
        place(img, cov.rotate(-4 * (1 - e), resample=Image.BICUBIC, expand=True), W / 2, 1060 + 160 * (1 - e), a * clamp(e * 2), scale=.9 + .1 * e)
        kin(img, "One page a day.", fr(84), W / 2, 330, t, S(2) + .9, a=a)
    # 3 paper + real-life task (Day 1 page with callouts)
    a = env(t, S(3) - .05, S(4) + .1, .25, .25)
    if a:
        e = eob(prog(t, S(3), .7))
        place(img, lay["day1"], W / 2 + 200 * (1 - e), 1080, a * clamp(e * 2))
        place(img, pill("1 writing task", (71, 102, 224), WHITE), W / 2, 280, a * eob(prog(t, S(3) + .2, .4)))
        place(img, pill("1 real-life task", MINT, NAVY), W / 2, 400, a * eob(prog(t, S(3) + 1.4, .4)))
    # 4 save box
    a = env(t, S(4) - .05, S(5) + .1, .25, .25)
    if a:
        kin(img, "Save Box", fr(120), W / 2, 380, t, S(4), a=a)
        kin(img, "watch your money grow", fri(70), W / 2, 500, t, S(4) + .5, grad=True, a=a)
        f = eo(prog(t, S(4) + .3, 2.4))
        place(img, jar(f, t), W / 2, 1100, a * eo(prog(t, S(4), .4)))
        day = 1 + int(29 * f)
        place(img, T(f"Day {day}", fr(70), fill=WHITE), W / 2, 1460, a)
        for j in range(6):  # falling coins
            tc = (t - S(4) - .3 - j * .38)
            if 0 < tc < .6:
                y = 760 + 300 * (tc / .6) ** 2
                ov = R.overlay()
                ImageDraw.Draw(ov).ellipse([W / 2 - 40 + (j % 3 - 1) * 60, y - 14, W / 2 + 40 + (j % 3 - 1) * 60, y + 14],
                                           fill=(255, 216, 102), outline=(201, 145, 20), width=4)
                img.alpha_composite(ov)
    # 5 craving plan
    a = env(t, S(5) - .05, S(6) + .1, .25, .25)
    if a:
        e = eob(prog(t, S(5), .7))
        place(img, lay["sos"], W / 2, 1150 + 200 * (1 - e), a * clamp(e * 2), scale=.95 + .05 * e)
        kin(img, "A plan for", fr(96), W / 2, 300, t, S(5), a=a)
        kin(img, "every craving.", fri(110), W / 2, 420, t, S(5) + .3, grad=True, a=a)
        place(img, pill("It passes in minutes", CORAL, WHITE, 38), W / 2, 560, a * eob(prog(t, S(5) + 1.9, .4)))
    # 6 facts
    a = env(t, S(6) - .05, S(7) + .1, .25, .25)
    if a:
        e = eob(prog(t, S(6), .7))
        place(img, lay["timeline"], W / 2, 1180 + 200 * (1 - e), a * clamp(e * 2))
        kin(img, "30 real facts", fr(110), W / 2, 300, t, S(6), a=a)
        place(img, pill("World Health Organization · CDC", (255, 255, 255), NAVY, 34), W / 2, 450, a * eob(prog(t, S(6) + 1.2, .4)))
    # 7 day 30 sport test
    a = env(t, S(7) - .05, S(8) + .1, .25, .25)
    if a:
        e = eob(prog(t, S(7), .7))
        place(img, lay["day30"], W / 2 - 120, 1150 + 150 * (1 - e), a * clamp(e * 2), scale=.92)
        place(img, lay["cert"], W / 2 + 210, 1280 + 200 * (1 - eob(prog(t, S(7) + .9, .7))), a * clamp(prog(t, S(7) + .9, .3)), scale=.7)
        kin(img, "Day 30:", fr(100), W / 2, 290, t, S(7), a=a)
        kin(img, "the Sport Test.", fri(110), W / 2, 420, t, S(7) + .35, grad=True, a=a)
    # 8 thirty days thirty pages
    a = env(t, S(8) - .05, S(9) + .1, .2, .25)
    if a:
        kin(img, "30 days.", fr(150), W / 2, 680, t, S(8), a=a)
        kin(img, "30 pages.", fr(150), W / 2, 860, t, S(8) + .55, a=a)
        kin(img, "One fresh start.", fri(118), W / 2, 1060, t, S(8) + 1.15, grad=True, a=a, spin=True)
        k = eo(prog(t, S(8) + 1.5, 1.0))  # 30 dots filling
        ov = R.overlay()
        d = ImageDraw.Draw(ov)
        for j in range(30):
            x = 190 + (j % 10) * 78
            y = 1260 + (j // 10) * 78
            on = j < int(30 * k)
            d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=MINT + (int(255 * a),) if on else None, outline=(255, 255, 255, int(110 * a)), width=3)
        img.alpha_composite(ov)
    # 9 CTA
    a = env(t, S(9) - .05, DUR + 1, .25, .3)
    if a:
        e = eob(prog(t, S(9), .7))
        place(img, lay["cover_s"], W / 2, 860 + 120 * (1 - e), a * clamp(e * 2), scale=.85 + .15 * e)
        btn = pill("Get your copy", MINT, NAVY, 54, (56, 26))
        place(img, R.shine(btn, ((t - S(9) - .9) % 1.8) / 1.0, width=.12, strength=.5), W / 2, 1450, a * eob(prog(t, S(9) + .5, .4)),
              scale=1 + .03 * math.sin((t - S(9)) * 7))
        place(img, T("Link in bio", fi(46, "SemiBold"), fill=WHITE), W / 2, 1560, a * eo(prog(t, S(9) + .9, .4)))
        place(img, T("General information, not medical advice.", fi(26, "Medium"), fill=(150, 170, 180)), W / 2, 1640, a * eo(prog(t, S(9) + 1.2, .5)))


def render(t, bg, lay):
    img = bg.copy()
    air(img, t)
    scenes(img, t, lay)
    out = R.grain(img.convert("RGB"), t)
    g = min(1.0, eio((DUR - t) / .4))
    if g < 1:
        out = Image.blend(Image.new("RGB", (W, H), NAVY), out, g)
    return out


def layers():
    return {"cover": page_img(1, 700), "cover_s": page_img(1, 560), "day1": page_img(10, 760), "sos": page_img(6, 740),
            "timeline": page_img(4, 760), "day30": page_img(39, 640), "cert": page_img(42, 520)}


def music(path):
    sr = 44100
    n = int(DUR * sr)
    tt = np.arange(n) / sr
    out = np.zeros((n, 2))
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731
    beat = 60 / 92
    rng = np.random.default_rng(4)

    def add(x, at, g, pan=.5):
        i = int(at * sr)
        if i >= n:
            return
        j = min(n, i + len(x))
        out[i:j, 0] += g * x[:j - i] * (1.2 - pan)
        out[i:j, 1] += g * x[:j - i] * (.2 + pan)

    def tone(f, d, dec=3.0):
        t_ = np.arange(int(d * sr)) / sr
        return sum(np.sin(2 * np.pi * f * h * t_) * np.exp(-t_ * (dec + h)) / h for h in (1, 2, 3))

    def kick():
        t_ = np.arange(int(.35 * sr)) / sr
        return np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-t_ * 30)) / sr) * np.exp(-t_ * 9)

    def hat():
        t_ = np.arange(int(.04 * sr)) / sr
        return np.diff(rng.standard_normal(len(t_)) * np.exp(-t_ * 100), prepend=0)

    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]
    k, tb = 0, 0.0
    lift = S(8)
    while tb < DUR - .5:
        ch = chords[int(tb / (beat * 4)) % 4]
        if tb > S(1):
            if k % 4 == 0 or (tb > lift and k % 2 == 0):
                add(kick(), tb, .5)
            add(hat(), tb + beat / 2, .05, .7)
        for j, nt in enumerate(ch):
            add(tone(hz(nt + 12), .7), tb + j * beat / 4, .03, .3 + .12 * j)
        if k % 4 == 0:
            add(tone(hz(ch[0] - 12), beat * 4, 1.0), tb, .12)
        tb += beat
        k += 1
    mx = np.tanh(out * 1.2)
    mx /= np.abs(mx).max()
    # voice
    vo = np.zeros(n)
    for ln, st in zip(MAN["lines"], STARTS):
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(HERE, ln["file"]), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                             capture_output=True, check=True).stdout
        v = np.frombuffer(raw, np.float32).astype(np.float64)
        i = int(st * sr)
        vo[i:i + len(v)] += v[:n - i]
    vo /= np.abs(vo).max() + 1e-9
    envv = np.convolve(np.abs(vo), np.ones(int(.3 * sr)) / (.3 * sr), mode="same")
    duck = 1 - .6 * np.clip(envv / (envv.max() * .2 + 1e-9), 0, 1)
    fade = np.minimum(1, (DUR - tt) / 1.5)
    mix = mx * .38 * duck[:, None] * fade[:, None] + vo[:, None] * .95
    mix /= np.abs(mix).max() / .92
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    bg, lay = make_bg(), layers()
    if a.stills:
        for s in a.stills:
            render(s, bg, lay).save(os.path.join(HERE, f"_still_{s:05.1f}.png"))
        return
    out = os.path.join(HERE, "quit30_promo.mp4")
    wav = os.path.join(HERE, "_mix.wav")
    music(wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(render(f / FPS, bg, lay).tobytes())
    p.stdin.close()
    p.wait()
    os.remove(wav)
    print("done:", out, round(DUR, 1), "s")


if __name__ == "__main__":
    main()
