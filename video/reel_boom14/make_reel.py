"""
Vertical promo reel (TikTok / Instagram Reels / X) for BOOM 14 · Kalendari që shkruan vetë.
1080×1920, 30 fps, ~18 s, original music. Two languages:

    python3 make_reel.py --lang sq   -> boom14_reel_sq.mp4
    python3 make_reel.py --lang en   -> boom14_reel_en.mp4
    python3 make_reel.py --lang sq --stills 1 4 8 ...

Layout keeps text inside the TikTok/Reels safe area (clear of the right-side buttons and the
bottom caption zone). No price and no promises of followers or sales.
"""
import argparse
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS, DUR = 1080, 1920, 30, 18.0
N = int(FPS * DUR)

INK = (20, 17, 28)
INK2 = (30, 26, 41)
CORAL = (255, 90, 95)
ORANGE = (255, 138, 61)
SUN = (255, 194, 60)
VIO = (123, 97, 255)
MINT = (43, 217, 168)
PAPER = (250, 247, 242)
LINE = (236, 230, 221)
GREY = (107, 100, 117)
WHITE = (255, 255, 255)

BRIC8 = os.path.join(HERE, "fonts", "Bricolage-latin-800.ttf")
BRIC6 = os.path.join(HERE, "fonts", "Bricolage-latin-600.ttf")
INTER = "/usr/share/fonts/opentype/inter/"


def f8(s):
    return ImageFont.truetype(BRIC8, s)


def f6(s):
    return ImageFont.truetype(BRIC6, s)


def fi(s, w="SemiBold"):
    return ImageFont.truetype(INTER + f"Inter-{w}.otf", s)


T = {
    "sq": {
        "hook1": "14 ditë postime",
        "hook2": "për Instagram.",
        "hook3": "Gati në 10 sekonda.",
        "s2": "Shkruaj vetëm emrin e biznesit",
        "biz": "Kafe Lulja", "city": "Tiranë", "type": "Kafene / bar",
        "l_name": "EMRI I BIZNESIT", "l_city": "QYTETI", "l_type": "LLOJI",
        "btn": "BOOM  Krijo 14 ditët e mia",
        "s3a": "14 ditë.", "s3b": "Reels, karusele, story.",
        "cards": [("REEL", "POV: sapo na zbulove"), ("KARUSEL", "3 gjëra që nuk i dinit"), ("REEL", "Prapaskenë ASMR"),
                  ("STORY", "Sondazh"), ("REEL", "Produkti yll"), ("FOTO", "Njihuni me ekipin")],
        "lab_sh": "PAMJET", "lab_on": "TEKSTI NË EKRAN", "lab_cap": "CAPTION",
        "shots": ["Kamera hyn nga dera", "Detaji më i bukur i vendit", "Kafeja nga afër"],
        "ons": "POV: sapo zbulove vendin tënd të ri në Tiranë",
        "cap": "Nëse jeni në Tiranë dhe nuk keni ardhur ende te Kafe Lulja... ky është shenja juaj.",
        "feat": ["Çfarë të filmosh, pamje pas pamjeje", "Teksti në ekran për çdo video", "Caption + hashtag gati",
                 "8 lloje biznesesh, 3 tone", "Festat shqiptare në kalendar"],
        "featT": "Për çdo ditë merr:",
        "s5a": "Kopjo.", "s5b": "Posto.", "s5c": "Gati.",
        "copied": "U kopjua ✓", "prog": "14 nga 14 postime të bëra",
        "end1": "BOOM 14", "end2": "Kalendari që shkruan vetë", "end3": "Për kafene, restorante, sallone,",
        "end4": "dyqane, palestra e më shumë", "cta": "Linku në bio", "brand": "CREATOR LAB · LUKA SHEHU",
    },
    "en": {
        "hook1": "14 days of",
        "hook2": "Instagram posts.",
        "hook3": "Ready in 10 seconds.",
        "s2": "Just type your business name",
        "biz": "Kafe Lulja", "city": "Tirana", "type": "Café / bar",
        "l_name": "BUSINESS NAME", "l_city": "CITY", "l_type": "TYPE",
        "btn": "BOOM  Create my 14 days",
        "s3a": "14 days.", "s3b": "Reels, carousels, stories.",
        "cards": [("REEL", "POV: you just found us"), ("CAROUSEL", "3 things you didn't know"), ("REEL", "Behind the scenes ASMR"),
                  ("STORY", "Poll"), ("REEL", "The star product"), ("PHOTO", "Meet the team")],
        "lab_sh": "SHOTS", "lab_on": "ON-SCREEN TEXT", "lab_cap": "CAPTION",
        "shots": ["Camera walks in the door", "The prettiest detail", "Coffee close-up"],
        "ons": "POV: you just found your new spot in Tirana",
        "cap": "Nëse jeni në Tiranë dhe nuk keni ardhur ende te Kafe Lulja... ky është shenja juaj.",
        "feat": ["What to film, shot by shot", "On-screen text for every video", "Captions + hashtags ready",
                 "8 business types, 3 tones", "Albanian holidays built in"],
        "featT": "Every day you get:",
        "s5a": "Copy.", "s5b": "Post.", "s5c": "Done.",
        "copied": "Copied ✓", "prog": "14 of 14 posts done",
        "end1": "BOOM 14", "end2": "The calendar that writes itself", "end3": "Captions in Albanian, made for",
        "end4": "Albanian-speaking businesses", "cta": "Link in bio", "brand": "CREATOR LAB · LUKA SHEHU",
    },
}


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def eob(t):  # ease out back (a little bounce)
    t = clamp(t)
    c = 1.7
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def eio(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def prog(t, a, d):
    return clamp((t - a) / d)


def env(t, a, b, fi_=0.35, fo=0.3):
    if t <= a or t >= b:
        return 0.0
    return min(eio((t - a) / fi_), eio((b - t) / fo))


GRAD_STOPS = [(0, CORAL), (0.35, ORANGE), (0.6, SUN), (1, VIO)]


def grad_img(w, h, shift=0.0):
    x = (np.linspace(0, 1, w)[None, :] + np.linspace(0, 0.25, h)[:, None] + shift) % 1.0
    out = np.zeros((h, w, 3), np.float32)
    for (p0, c0), (p1, c1) in zip(GRAD_STOPS, GRAD_STOPS[1:]):
        m = (x >= p0) & (x <= p1)
        k = ((x - p0) / (p1 - p0))[..., None]
        out = np.where(m[..., None], np.array(c0) * (1 - k) + np.array(c1) * k, out)
    return Image.fromarray(out.astype(np.uint8))


def text_img(s, font, fill=WHITE, grad=False, shift=0.0):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    bb = d.textbbox((0, 0), s, font=font)
    w, h = bb[2] - bb[0] + 8, bb[3] - bb[1] + 16
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).text((4 - bb[0], 8 - bb[1]), s, font=font, fill=255)
    if grad:
        im = grad_img(w, h, shift).convert("RGBA")
    else:
        im = Image.new("RGBA", (w, h), fill + (255,))
    im.putalpha(m)
    return im


def fit(s, maker, size, maxw=940):
    """Largest font size <= size whose text fits maxw (keeps text inside the safe area)."""
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    while size > 20 and d.textlength(s, font=maker(size)) > maxw:
        size -= 2
    return maker(size)


def place(img, lay, x, y, a=1.0, anchor="c", scale=1.0):
    if a <= 0.003:
        return
    if abs(scale - 1) > 0.002:
        lay = lay.resize((max(1, int(lay.width * scale)), max(1, int(lay.height * scale))), Image.LANCZOS)
    if a < 0.999:
        lay = lay.copy()
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a)))
    if anchor == "c":
        x -= lay.width / 2
    elif anchor == "r":
        x -= lay.width
    img.alpha_composite(lay, (int(x), int(y - lay.height / 2)))


def rr(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)


# ---------------------------------------------------------------- backgrounds
def make_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.ones((H, W, 3), np.float32) * np.array(INK, np.float32)

    def blob(cx, cy, r, col, a):
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        k = np.clip(1 - d, 0, 1) ** 2 * a
        return k[..., None] * (np.array(col, np.float32) - base)

    img = base + blob(980, 260, 900, VIO, 0.55) + blob(80, 1700, 820, CORAL, 0.45)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


# ---------------------------------------------------------------- phone UI
PW, PH = 640, 1240  # phone outer size


def phone_frame():
    fr = Image.new("RGBA", (PW + 80, PH + 80), (0, 0, 0, 0))
    sh = Image.new("L", fr.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([50, 70, PW + 40, PH + 60], radius=80, fill=190)
    fr.putalpha(0)
    shadow = Image.new("RGBA", fr.size, (0, 0, 0, 255))
    shadow.putalpha(sh.filter(ImageFilter.GaussianBlur(30)))
    fr.alpha_composite(shadow)
    d = ImageDraw.Draw(fr)
    rr(d, [40, 40, PW + 40, PH + 40], 78, fill=(7, 6, 11, 255), outline=(43, 38, 56, 255), width=4)
    return fr


def screen_form(t, L, typed_name, typed_city, press):
    """Form screen inside the phone (screen-space PW-40 × PH-40)."""
    sw, sh = PW - 40, PH - 40
    s = Image.new("RGBA", (sw, sh), PAPER + (255,))
    d = ImageDraw.Draw(s)
    d.text((40, 70), "Biznesi juaj" if L["l_name"].startswith("EMRI") else "Your business", font=f8(48), fill=INK)
    fields = [(L["l_name"], L["biz"][: typed_name]), (L["l_city"], L["city"][: typed_city]), (L["l_type"], L["type"])]
    for i, (lab, val) in enumerate(fields):
        y = 190 + i * 170
        d.text((40, y), lab, font=fi(22, "Bold"), fill=GREY)
        rr(d, [40, y + 38, sw - 40, y + 118], 22, fill=(255, 255, 255), outline=VIO if (i == 0 and typed_name < len(L["biz"])) or (i == 1 and 0 < typed_city < len(L["city"])) else LINE, width=3)
        d.text((66, y + 78), val, font=fi(34, "Medium"), fill=INK, anchor="lm")
        if (i == 0 and typed_name < len(L["biz"])) or (i == 1 and 0 < typed_city < len(L["city"])):
            if int(t * 3) % 2 == 0:
                x = 66 + d.textlength(val, font=fi(34, "Medium")) + 4
                d.rectangle([x, y + 58, x + 3, y + 98], fill=CORAL)
    # BOOM button
    by = 760
    sc = 1 - 0.06 * math.sin(math.pi * clamp(press))
    bw = (sw - 80) * sc
    bx = sw / 2 - bw / 2
    g = grad_img(int(bw), int(120 * sc), shift=t * 0.15).convert("RGBA")
    m = Image.new("L", g.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, g.width - 1, g.height - 1], radius=36, fill=255)
    s.paste(g, (int(bx), int(by)), m)
    d.text((sw / 2, by + 60 * sc), L["btn"], font=f8(int(34 * sc)), fill=WHITE, anchor="mm")
    # tap ripple
    if 0 < press < 1:
        r = 30 + 260 * eo(press)
        d.ellipse([sw / 2 - r, by + 60 - r, sw / 2 + r, by + 60 + r], outline=(255, 255, 255, int(200 * (1 - press))), width=6)
    return s


def day_card(i, fmt, title, w=520):
    c = Image.new("RGBA", (w, 150), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    rr(d, [0, 0, w - 1, 149], 28, fill=(255, 255, 255), outline=LINE, width=2)
    rr(d, [0, 0, w - 1, 92], 28, fill=INK)
    d.rectangle([0, 60, w - 1, 92], fill=INK)
    g = grad_img(64, 64).convert("RGBA")
    m = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 63, 63], radius=18, fill=255)
    c.paste(g, (16, 14), m)
    d.text((48, 46), str(i), font=f8(38), fill=WHITE, anchor="mm")
    pill = 132
    rr(d, [w - pill - 14, 28, w - 14, 64], 18, fill=(62, 56, 78))
    d.text((w - pill / 2 - 14, 46), fmt, font=fi(17, "Bold"), fill=WHITE, anchor="mm")
    tf = fi(24, "Bold")
    while d.textlength(title, font=tf) > w - pill - 120 and len(title) > 4:
        title = title[:-2]
        if d.textlength(title + "…", font=tf) <= w - pill - 120:
            title += "…"
            break
    d.text((96, 46), title, font=tf, fill=WHITE, anchor="lm")
    for k in range(2):
        rr(d, [20, 108 + k * 18, w - 60 - k * 140, 118 + k * 18], 5, fill=LINE)
    return c


def screen_cards(t, t0, L):
    """Results screen: cards cascade in and the list scrolls."""
    sw, sh = PW - 40, PH - 40
    s = Image.new("RGBA", (sw, sh), PAPER + (255,))
    d = ImageDraw.Draw(s)
    title = ("14 ditët e " if L["l_name"].startswith("EMRI") else "14 days of ")
    d.text((40, 70), title, font=f8(44), fill=INK)
    x = 40 + d.textlength(title, font=f8(44))
    gt = text_img(L["biz"], f8(44), grad=True, shift=t * 0.1)
    s.alpha_composite(gt, (int(x), 62))
    rr(d, [40, 150, sw - 40, 166], 8, fill=LINE)
    k = eo(prog(t, t0 + 2.6, 1.6))
    rr(d, [40, 150, 40 + (sw - 80) * max(0.02, k), 166], 8, fill=MINT)
    scroll = 320 * eio(prog(t, t0 + 1.8, 2.2))
    for i, (fmt, ti) in enumerate(L["cards"]):
        p = eob(prog(t, t0 + 0.12 * i, 0.5))
        if p <= 0:
            continue
        card = day_card(i + 1, fmt, ti)
        y = 210 + i * 175 - scroll + (1 - p) * 120
        if -160 < y < sh:
            a = clamp(p)
            cc = card.copy()
            cc.putalpha(cc.getchannel("A").point(lambda v: int(v * a)))
            s.alpha_composite(cc, (40, int(y)))
    return s


def screen_detail(t, t0, L):
    """One day expanded: shots, on-screen text, caption, then 'Copied' toast."""
    sw, sh = PW - 40, PH - 40
    s = Image.new("RGBA", (sw, sh), PAPER + (255,))
    d = ImageDraw.Draw(s)
    card = day_card(1, L["cards"][0][0], L["cards"][0][1], w=sw - 80)
    s.alpha_composite(card.crop((0, 0, card.width, 93)), (40, 80))
    rr(d, [40, 150, sw - 40, 1100], 0, fill=(255, 255, 255))
    y = 200
    d.text((70, y), L["lab_sh"], font=fi(20, "Bold"), fill=VIO)
    for i, sh_ in enumerate(L["shots"]):
        a = eo(prog(t, t0 + 0.15 * i, 0.4))
        yy = y + 50 + i * 58
        rr(d, [70, yy - 2, 104, yy + 32], 9, fill=PAPER, outline=LINE)
        d.text((87, yy + 15), str(i + 1), font=fi(18, "Bold"), fill=INK, anchor="mm")
        d.text((122, yy + 15), sh_, font=fi(26, "Medium"), fill=INK + (int(255 * a),), anchor="lm")
    y = 470
    d.text((70, y), L["lab_on"], font=fi(20, "Bold"), fill=VIO)
    ons_lines = wrap(L["ons"], f8(30), sw - 160)
    for i, ln in enumerate(ons_lines):
        bb = d.textbbox((0, 0), ln, font=f8(30))
        rr(d, [66, y + 44 + i * 50, 66 + bb[2] + 16, y + 88 + i * 50], 8, fill=SUN)
        d.text((74, y + 66 + i * 50), ln, font=f8(30), fill=INK, anchor="lm")
    y = 470 + 60 + len(ons_lines) * 50 + 30
    d.text((70, y), L["lab_cap"], font=fi(20, "Bold"), fill=VIO)
    cap_lines = wrap(L["cap"], fi(25, "Regular"), sw - 180)
    rr(d, [66, y + 40, sw - 66, y + 64 + len(cap_lines) * 36], 18, fill=PAPER, outline=LINE)
    n = int(len(L["cap"]) * eo(prog(t, t0 + 0.6, 1.2)))
    shown, cnt = [], 0
    for ln in cap_lines:
        take = max(0, min(len(ln), n - cnt))
        shown.append(ln[:take])
        cnt += len(ln) + 1
    for i, ln in enumerate(shown):
        d.text((88, y + 56 + i * 36), ln, font=fi(25, "Regular"), fill=INK)
    # copy button + toast
    by = y + 90 + len(cap_lines) * 36
    press = prog(t, t0 + 2.0, 0.3)
    rr(d, [66, by, 400, by + 66], 33, fill=MINT if press >= 1 else INK)
    d.text((233, by + 33), L["copied"] if press >= 1 else ("Kopjo caption" if L["l_name"].startswith("EMRI") else "Copy caption"),
           font=fi(24, "Bold"), fill=INK if press >= 1 else WHITE, anchor="mm")
    ta = env(t, t0 + 2.1, t0 + 4.0, 0.2, 0.3)
    if ta:
        tw = 300
        ty = sh - 140 + 40 * (1 - eo(prog(t, t0 + 2.1, 0.3)))
        rr(d, [sw / 2 - tw / 2, ty, sw / 2 + tw / 2, ty + 70], 35, fill=INK + (int(255 * ta),))
        d.text((sw / 2, ty + 35), L["copied"], font=fi(26, "Bold"), fill=WHITE + (int(255 * ta),), anchor="mm")
    return s


def wrap(text, font, maxw):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    out, line = [], ""
    for w_ in text.split():
        test = (line + " " + w_).strip()
        if d.textlength(test, font=font) > maxw and line:
            out.append(line)
            line = w_
        else:
            line = test
    out.append(line)
    return out


def put_phone(img, frame, screen, cx, cy, scale=1.0, rot=0.0, a=1.0):
    ph = frame.copy()
    m = Image.new("L", screen.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, screen.width - 1, screen.height - 1], radius=58, fill=255)
    ph.paste(screen, (60, 60), m)
    if abs(rot) > 0.01:
        ph = ph.rotate(rot, resample=Image.BICUBIC, expand=True)
    place(img, ph, cx, cy, a, scale=scale)


# ---------------------------------------------------------------- music (original)
def music(path, booms):
    sr = 44100
    n = int(sr * DUR)
    t = np.arange(n) / sr
    out = np.zeros((n, 2))
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731
    bpm = 112
    beat = 60 / bpm
    rng = np.random.default_rng(4)

    def add(x, at, g=1.0, pan=0.5):
        i = int(at * sr)
        if i >= n:
            return
        j = min(n, i + len(x))
        out[i:j, 0] += g * x[: j - i] * (1 - pan) * 2 * 0.5 + g * x[: j - i] * 0.25
        out[i:j, 1] += g * x[: j - i] * pan * 2 * 0.5 + g * x[: j - i] * 0.25

    def kick():
        tt = np.arange(int(0.4 * sr)) / sr
        return np.sin(2 * np.pi * np.cumsum(50 + 120 * np.exp(-tt * 30)) / sr) * np.exp(-tt * 8)

    def clap():
        tt = np.arange(int(0.18 * sr)) / sr
        x = rng.standard_normal(len(tt)) * np.exp(-tt * 25)
        return np.diff(x, prepend=0) * 0.7

    def hat():
        tt = np.arange(int(0.05 * sr)) / sr
        return np.diff(rng.standard_normal(len(tt)) * np.exp(-tt * 90), prepend=0)

    def pluck(f, dur=0.35):
        tt = np.arange(int(dur * sr)) / sr
        return sum(np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (6 + 3 * h)) / h for h in (1, 2, 3, 4))

    def boom():
        tt = np.arange(int(1.6 * sr)) / sr
        sub = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-tt * 9)) / sr) * np.exp(-tt * 2.6)
        nz = rng.standard_normal(len(tt)) * np.exp(-tt * 6) * 0.25
        return sub + nz

    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
    start = 2.2  # beat drops after the hook
    k = 0
    tb = 0.0
    while tb < DUR - 0.8:
        bar = int(tb / (beat * 4)) % 4
        if tb >= start:
            if k % 4 in (0, 2):
                add(kick(), tb, 0.9)
            if k % 4 in (1, 3):
                add(clap(), tb, 0.35)
            add(hat(), tb + beat / 2, 0.12, 0.7)
            add(hat(), tb + beat * 0.75, 0.06, 0.3)
            # bass on the off-beat
            tt = np.arange(int(beat / 2 * sr)) / sr
            b = np.sin(2 * np.pi * hz(chords[bar][0] - 24) * tt) * np.exp(-tt * 5)
            add(b, tb + beat / 2, 0.35)
        # plucky chord arps throughout (quieter in the hook)
        for s in range(2):
            m = chords[bar][(k * 2 + s) % 3] + 12
            add(pluck(hz(m)), tb + s * beat / 2, 0.09 if tb >= start else 0.06, 0.35 + 0.3 * s)
        tb += beat
        k += 1
    # riser into the BOOM press, then the boom
    for at in booms:
        tt = np.arange(int(1.0 * sr)) / sr
        r = rng.standard_normal(len(tt)) * (tt / 1.0) ** 2 * 0.25
        add(r, at - 1.0, 1.0)
        add(boom(), at, 1.0)
    # soft pops for cards and the success chime
    for i in range(6):
        add(pluck(hz(84 + i), 0.12), 5.65 + 0.12 * i, 0.08, 0.5)
    for i, m in enumerate([72, 76, 79, 84]):
        add(pluck(hz(m), 0.6), 13.2 + i * 0.08, 0.12, 0.5)
    mx = np.tanh(out * 1.3) / np.tanh(1.3)
    mx *= np.minimum(1, (DUR - t) / 1.2)[:, None]
    mx /= np.abs(mx).max() / 0.89
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mx * 32767).astype(np.int16).tobytes())


# ---------------------------------------------------------------- the film
def render(t, bg, frame, L, lay):
    img = bg.copy()
    # subtle drifting glow so the background lives
    sh = 0.04 * math.sin(t * 0.7)
    _ = sh

    # 1 · HOOK (0–2.3)
    a = env(t, 0.0, 2.35, 0.15, 0.25)
    if a:
        p = [eob(prog(t, 0.05 + 0.18 * i, 0.45)) for i in range(3)]
        place(img, lay["h1"], W / 2, 700 + 40 * (1 - p[0]), a * clamp(p[0]), scale=0.9 + 0.1 * clamp(p[0]))
        place(img, lay["h2"], W / 2, 840 + 40 * (1 - p[1]), a * clamp(p[1]), scale=0.9 + 0.1 * clamp(p[1]))
        g = text_img(L["hook3"], fit(L["hook3"], f8, 108), grad=True, shift=t * 0.2)
        place(img, g, W / 2, 1010 + 40 * (1 - p[2]), a * clamp(p[2]), scale=0.85 + 0.15 * clamp(p[2]))
        place(img, lay["badge"], W / 2, 520, a * eo(prog(t, 0.0, 0.4)))

    # 2 · TYPE THE NAME + BOOM (2.2–5.6)
    a2 = env(t, 2.2, 5.65, 0.3, 0.2)
    if a2:
        place(img, lay["s2"], W / 2, 300, a2)
        tn = int(len(L["biz"]) * prog(t, 2.6, 0.9))
        tc = int(len(L["city"]) * prog(t, 3.6, 0.6))
        press = prog(t, 4.75, 0.45)
        scr = screen_form(t, L, tn, tc, press)
        put_phone(img, frame, scr, W / 2 - 40, 1060 + 80 * (1 - eo(prog(t, 2.2, 0.5))), scale=0.82, rot=3, a=a2)
        # flash on BOOM
        fl = env(t, 4.85, 5.6, 0.05, 0.6)
        if fl:
            ov = Image.new("RGBA", (W, H), (255, 255, 255, int(150 * fl)))
            img.alpha_composite(ov)

    # 3 · 14 DAYS CASCADE (5.6–9.6)
    a3 = env(t, 5.55, 9.7, 0.2, 0.25)
    if a3:
        place(img, lay["s3a"], W / 2, 270, a3 * eo(prog(t, 5.6, 0.4)))
        place(img, lay["s3b"], W / 2, 370, a3 * eo(prog(t, 5.8, 0.4)))
        scr = screen_cards(t, 5.65, L)
        put_phone(img, frame, scr, W / 2 - 40, 1120, scale=0.8 * (1.08 - 0.08 * eob(prog(t, 5.55, 0.5))), rot=-3, a=a3)

    # 4 · ONE DAY IN DETAIL + FEATURES (9.6–13.0)
    a4 = env(t, 9.6, 13.1, 0.25, 0.25)
    if a4:
        scr = screen_detail(t, 9.75, L)
        put_phone(img, frame, scr, W / 2, 1290, scale=0.6, rot=2, a=a4)
        place(img, lay["featT"], 80, 240, a4, anchor="l")
        for i, fl_ in enumerate(lay["feat"]):
            p = eob(prog(t, 9.9 + i * 0.32, 0.4))
            place(img, fl_, 80 + 60 * (1 - clamp(p)), 330 + i * 78, a4 * clamp(p), anchor="l")

    # 5 · COPY. POST. DONE. + 14/14 (13.0–15.3)
    a5 = env(t, 13.0, 15.4, 0.2, 0.25)
    if a5:
        for i, key in enumerate(["s5a", "s5b", "s5c"]):
            p = eob(prog(t, 13.05 + i * 0.28, 0.4))
            lay_ = lay[key] if key != "s5c" else text_img(L["s5c"], f8(170), grad=True, shift=t * 0.2)
            place(img, lay_, W / 2, 620 + i * 200 + 30 * (1 - clamp(p)), a5 * clamp(p), scale=0.8 + 0.2 * clamp(p))
        # progress bar to 14/14
        bx, by, bw = 170, 1340, 740
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        rr(d, [bx, by, bx + bw, by + 26], 13, fill=(255, 255, 255, int(40 * a5)))
        k = eo(prog(t, 13.3, 1.2))
        if k > 0:
            g = grad_img(int(bw * k) + 1, 26, shift=t * 0.2).convert("RGBA")
            m = Image.new("L", g.size, 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, g.width - 1, 25], radius=13, fill=int(255 * a5))
            ov.paste(g, (bx, by), m)
        img.alpha_composite(ov)
        place(img, lay["prog"], W / 2, 1420, a5 * eo(prog(t, 14.3, 0.4)))

    # 6 · END CARD (15.3–18)
    a6 = env(t, 15.3, DUR + 1, 0.3, 0.3)
    if a6:
        p = eob(prog(t, 15.3, 0.6))
        g = text_img(L["end1"], f8(190), grad=True, shift=t * 0.15)
        place(img, g, W / 2, 640, a6 * clamp(p), scale=0.8 + 0.2 * clamp(p))
        place(img, lay["end2"], W / 2, 800, a6 * eo(prog(t, 15.6, 0.4)))
        place(img, lay["end3"], W / 2, 905, a6 * eo(prog(t, 15.85, 0.4)))
        place(img, lay["end4"], W / 2, 960, a6 * eo(prog(t, 15.95, 0.4)))
        # CTA pill + bouncing arrow
        ca = a6 * eo(prog(t, 16.1, 0.4))
        if ca:
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(ov)
            pw_ = 560
            py = 1150
            g = grad_img(pw_, 130, shift=t * 0.2).convert("RGBA")
            m = Image.new("L", g.size, 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, pw_ - 1, 129], radius=65, fill=int(255 * ca))
            ov.paste(g, (int(W / 2 - pw_ / 2), py), m)
            d.text((W / 2, py + 65), L["cta"], font=f8(64), fill=(255, 255, 255, int(255 * ca)), anchor="mm")
            bob = 12 * math.sin((t - 16.1) * 2 * math.pi / 0.9)
            ay = py - 70 + bob
            d.line([(W / 2, ay - 50), (W / 2, ay + 20)], fill=SUN + (int(255 * ca),), width=8)
            d.line([(W / 2 - 26, ay - 24), (W / 2, ay - 52), (W / 2 + 26, ay - 24)], fill=SUN + (int(255 * ca),), width=8)
            img.alpha_composite(ov)
        place(img, lay["brand"], W / 2, 1420, a6 * eo(prog(t, 16.4, 0.5)))

    out = img.convert("RGB")
    g_ = min(1.0, eio((DUR - t) / 0.35))
    if g_ < 1:
        out = Image.blend(Image.new("RGB", (W, H), INK), out, g_)
    return out


def build_layers(L):
    lay = {}
    lay["badge"] = text_img("BOOM 14", f8(46), fill=SUN)
    lay["h1"] = text_img(L["hook1"], fit(L["hook1"], f8, 118))
    lay["h2"] = text_img(L["hook2"], fit(L["hook2"], f8, 118))
    lay["s2"] = text_img(L["s2"], fit(L["s2"], f8, 64, 900))
    lay["s3a"] = text_img(L["s3a"], f8(100), fill=SUN)
    lay["s3b"] = text_img(L["s3b"], fit(L["s3b"], f8, 66, 900))
    lay["featT"] = text_img(L["featT"], f8(58), fill=SUN)
    feat = []
    for s in L["feat"]:
        t_ = text_img(s, fi(40, "SemiBold"))
        c = Image.new("RGBA", (t_.width + 70, max(t_.height, 50)), (0, 0, 0, 0))
        d = ImageDraw.Draw(c)
        d.ellipse([0, c.height / 2 - 20, 40, c.height / 2 + 20], fill=MINT)
        d.line([(10, c.height / 2), (18, c.height / 2 + 9), (31, c.height / 2 - 8)], fill=INK, width=5)
        c.alpha_composite(t_, (60, int(c.height / 2 - t_.height / 2)))
        feat.append(c)
    lay["feat"] = feat
    lay["s5a"] = text_img(L["s5a"], f8(170))
    lay["s5b"] = text_img(L["s5b"], f8(170))
    lay["prog"] = text_img(L["prog"], fi(38, "SemiBold"), fill=(217, 212, 227))
    lay["end2"] = text_img(L["end2"], fit(L["end2"], f8, 64, 900))
    lay["end3"] = text_img(L["end3"], fi(38, "Medium"), fill=(217, 212, 227))
    lay["end4"] = text_img(L["end4"], fi(38, "Medium"), fill=(217, 212, 227))
    lay["brand"] = text_img(L["brand"], fi(28, "SemiBold"), fill=(160, 152, 175))
    return lay


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["sq", "en"], default="sq")
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    L = T[a.lang]
    bg = make_bg()
    frame = phone_frame()
    lay = build_layers(L)
    if a.stills:
        for s in a.stills:
            render(s, bg, frame, L, lay).save(os.path.join(HERE, f"_still_{a.lang}_{s:04.1f}.png"))
        return
    out = os.path.join(HERE, f"boom14_reel_{a.lang}.mp4")
    wav = os.path.join(HERE, f"_music_{a.lang}.wav")
    music(wav, booms=[4.85])
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(render(f / FPS, bg, frame, L, lay).tobytes())
    p.stdin.close()
    p.wait()
    os.remove(wav)
    print("done:", out)


if __name__ == "__main__":
    main()
