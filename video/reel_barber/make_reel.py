"""
Vertical promo reel for BOOM 14 Barber · 14 ditë Instagram për berberinë.
1080x1920, 30 fps, 21 s, original music and sound design. Works on TikTok, Instagram Reels,
YouTube Shorts, Facebook Reels, Snapchat Spotlight and X.

    python3 make_reel.py --lang sq            -> boom14_barber_reel_sq.mp4
    python3 make_reel.py --lang en            -> boom14_barber_reel_en.mp4
    python3 make_reel.py --lang sq --stills 1 5 9 ...
    python3 make_reel.py --lang sq --cover    -> cover_sq.png (thumbnail)

Text stays inside the TikTok/Reels safe area (clear of the right-hand buttons and the bottom
caption zone). No prices and no promises of followers, clients or sales.
"""
import argparse
import importlib.util
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("boom14_base", os.path.join(HERE, "..", "reel_boom14", "make_reel.py"))
base = importlib.util.module_from_spec(_spec)  # shared helpers: text, easing, phone frame
_spec.loader.exec_module(base)
clamp, env, eo, eob, eio, f8, fi, fit = base.clamp, base.env, base.eo, base.eob, base.eio, base.f8, base.fi, base.fit
place, prog, rr, text_img, wrap, phone_frame, PW, PH = base.place, base.prog, base.rr, base.text_img, base.wrap, base.phone_frame, base.PW, base.PH

W, H, FPS, DUR = 1080, 1920, 30, 21.0
N = int(FPS * DUR)

# BOOM 14 Barber palette (from the product page)
INK = (20, 17, 28)
INK2 = (30, 26, 41)
RED = (230, 57, 70)
SALMON = (255, 107, 94)
SUN = (241, 194, 125)
BLUE = (58, 134, 255)
MINT = (43, 217, 168)
PAPER = (250, 247, 242)
LINE = (236, 230, 221)
GREY = (107, 100, 117)
WHITE = (255, 255, 255)
SOFT = (217, 212, 227)

base.GRAD_STOPS = [(0, RED), (0.4, SALMON), (0.55, SUN), (1, BLUE)]
grad_img = base.grad_img

PRESS = 7.55  # moment the BOOM button is hit

T = {
    "sq": {
        "kicker": "PËR BERBERË",
        "hook1": "Berber?",
        "hook2": "14 ditë Instagram",
        "hook3": "gati në 10 sekonda.",
        "pb1": "Çdo ditë e njëjta pyetje:",
        "pb2": "Çfarë të",
        "pb3": "postoj sot?",
        "chips": ["Fade?", "Para / pas?", "Story?", "Çmimet?", "Reel?", "Oferta?"],
        "s2": "Shkruaj emrin e berberisë",
        "s2b": "Shtyp BOOM",
        "form_t": "Berberia juaj",
        "biz": "Fade House", "city": "Tiranë", "cut": "skin fade me kontur",
        "l_name": "EMRI I BERBERISË", "l_city": "QYTETI", "l_cut": "PRERJA FIRMË", "l_tone": "TONI",
        "tones": ["Miqësor", "Elegant", "Lozonjar"],
        "btn": "BOOM  Krijo 14 ditët e mia",
        "s3a": "14 ditë.", "s3b": "Reels, karusele, story.",
        "res_t": "14 ditët e ",
        "cards": [("REEL", "POV: gjete berberin tënd"), ("REEL", "Transformimi: para → pas"),
                  ("KARUSEL", "Shërbimet dhe çmimet"), ("REEL", "ASMR: fade-i në slow motion"),
                  ("STORY", "Oraret e lira sot"), ("REEL", "Si ta kërkoni prerjen"),
                  ("FOTO", "Njihuni me berberin"), ("REEL", "Konturi: detaji që bën diferencën")],
        "dayN": 4,
        "lab_sh": "PAMJET", "lab_on": "TEKSTI NË EKRAN", "lab_cap": "CAPTION",
        "shots": ["Makineta ndizet, plan shumë i afërt", "Fade-i formohet, flokët bien në slow motion",
                  "Furça pastron qafën, rezultati nga afër"],
        "ons": "Zë lart: satisfying fade",
        "cap": "Zë lart. Ky është tingulli më i qetë i ditës. Skin fade me kontur nga Fade House.",
        "copy": "Kopjo caption", "copied": "U kopjua ✓", "variant": "Variant tjetër",
        "featT": "Për çdo ditë merr:",
        "feat": ["Çfarë të filmosh, pamje pas pamjeje", "Tekstin në ekran për çdo video", "Caption + hashtag gati",
                 "3 tone: miqësor, elegant, lozonjar", "Festat shqiptare në kalendar"],
        "s5a": "Filmo.", "s5b": "Kopjo.", "s5c": "Posto.",
        "prog": "14 nga 14 postime të bëra",
        "boom": "Berberia jote sapo bëri BOOM",
        "end1": "BOOM 14", "end1b": "BARBER",
        "end2": "14 ditë Instagram për berberinë",
        "end3": "Fade-e, kontura, transformime",
        "cta": "Linku në bio", "brand": "CREATOR LAB · LUKA SHEHU",
    },
    "en": {
        "kicker": "FOR BARBERS",
        "hook1": "Barber?",
        "hook2": "14 days of Instagram",
        "hook3": "ready in 10 seconds.",
        "pb1": "Every day, the same question:",
        "pb2": "What do I",
        "pb3": "post today?",
        "chips": ["Fade?", "Before / after?", "Story?", "Prices?", "Reel?", "Offer?"],
        "s2": "Type your barbershop name",
        "s2b": "Hit BOOM",
        "form_t": "Your barbershop",
        "biz": "Fade House", "city": "Tirana", "cut": "skin fade with line-up",
        "l_name": "BARBERSHOP NAME", "l_city": "CITY", "l_cut": "SIGNATURE CUT", "l_tone": "TONE",
        "tones": ["Friendly", "Elegant", "Playful"],
        "btn": "BOOM  Create my 14 days",
        "s3a": "14 days.", "s3b": "Reels, carousels, stories.",
        "res_t": "14 days of ",
        "cards": [("REEL", "POV: you found your barber"), ("REEL", "Transformation: before → after"),
                  ("CAROUSEL", "Services and prices"), ("REEL", "ASMR: slow-motion fade"),
                  ("STORY", "Free slots today"), ("REEL", "How to ask for your cut"),
                  ("PHOTO", "Meet the barber"), ("REEL", "The line-up: the detail that matters")],
        "dayN": 4,
        "lab_sh": "SHOTS", "lab_on": "ON-SCREEN TEXT", "lab_cap": "CAPTION",
        "shots": ["Clippers switch on, extreme close-up", "The fade takes shape, hair falls in slow motion",
                  "Brush cleans the neck, result up close"],
        "ons": "Sound on: satisfying fade",
        "cap": "Zë lart. Ky është tingulli më i qetë i ditës. Skin fade me kontur nga Fade House.",
        "copy": "Copy caption", "copied": "Copied ✓", "variant": "Another version",
        "featT": "Every day you get:",
        "feat": ["What to film, shot by shot", "On-screen text for every video", "Caption + hashtags ready",
                 "3 tones: friendly, elegant, playful", "Albanian holidays built in"],
        "s5a": "Film.", "s5b": "Copy.", "s5c": "Post.",
        "prog": "14 of 14 posts done",
        "boom": "Your barbershop just went BOOM",
        "end1": "BOOM 14", "end1b": "BARBER",
        "end2": "14 days of Instagram for barbers",
        "end3": "Captions in Albanian, for Albanian-speaking barbershops",
        "cta": "Link in bio", "brand": "CREATOR LAB · LUKA SHEHU",
    },
}


# ---------------------------------------------------------------- look
def pole_img(w, h, off, alpha=255):
    """Animated barber-pole stripes (red / white / blue / white), diagonal."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    period = 4 * 26.0
    u = ((xx + yy + off) % period) / period
    cols = np.array([RED, WHITE, BLUE, WHITE], np.float32)
    idx = (u * 4).astype(int) % 4
    out = cols[idx]
    im = Image.fromarray(out.astype(np.uint8)).convert("RGBA")
    im.putalpha(alpha)
    return im


def make_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base_ = np.ones((H, W, 3), np.float32) * np.array(INK, np.float32)

    def blob(cx, cy, r, col, a):
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        k = np.clip(1 - d, 0, 1) ** 2 * a
        return k[..., None] * (np.array(col, np.float32) - base_)

    img = base_ + blob(1000, 220, 950, BLUE, 0.5) + blob(60, 1720, 880, RED, 0.45)
    rng = np.random.default_rng(7)
    img += rng.normal(0, 3.2, (H, W, 1))  # fine film grain, baked once
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


GRAIN = None


def grain(img, t):
    """Moving grain so flat colour never looks static."""
    global GRAIN
    if GRAIN is None:
        rng = np.random.default_rng(3)
        GRAIN = [Image.fromarray(np.clip(128 + rng.normal(0, 9, (H // 2, W // 2)), 0, 255).astype(np.uint8)).resize((W, H))
                 for _ in range(4)]
    g = GRAIN[int(t * FPS) % 4]
    return Image.blend(img, Image.merge("RGB", (g, g, g)), 0.035)


def icon_pole(h=70):
    """Small barber-pole logo mark."""
    w = int(h * 0.42)
    c = Image.new("RGBA", (w + 8, h + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    st = pole_img(w, h - 8, 0)
    m = Image.new("L", st.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 9], radius=w // 2, fill=255)
    c.paste(st, (4, 15), m)
    rr(d, [0, 2, w + 7, 16], 6, fill=SOFT)
    rr(d, [0, h + 6, w + 7, h + 20], 6, fill=SOFT)
    return c


# ---------------------------------------------------------------- phone screens
SW, SH = PW - 40, PH - 40


def blank():
    s = Image.new("RGBA", (SW, SH), PAPER + (255,))
    return s, ImageDraw.Draw(s)


def caret(d, x, y, t, h=40):
    if int(t * 3) % 2 == 0:
        d.rectangle([x, y, x + 3, y + h], fill=RED)


def screen_form(t, L):
    s, d = blank()
    st = pole_img(SW, 10, t * 120)
    s.alpha_composite(st, (0, 0))
    d.text((40, 60), L["form_t"], font=f8(50), fill=INK)
    tn = int(len(L["biz"]) * prog(t, 4.95, 0.85))
    tc = int(len(L["city"]) * prog(t, 5.9, 0.45))
    tk = int(len(L["cut"]) * prog(t, 6.45, 0.6))
    fields = [(L["l_name"], L["biz"], tn, 4.95), (L["l_city"], L["city"], tc, 5.9), (L["l_cut"], L["cut"], tk, 6.45)]
    vf = fi(32, "Medium")
    for i, (lab, full, n, t0) in enumerate(fields):
        y = 168 + i * 152
        active = t0 <= t and n < len(full)
        d.text((40, y), lab, font=fi(21, "Bold"), fill=GREY)
        rr(d, [40, y + 34, SW - 40, y + 110], 20, fill=WHITE, outline=BLUE if active else LINE, width=3)
        val = full[:n]
        d.text((64, y + 72), val, font=vf, fill=INK, anchor="lm")
        if active:
            caret(d, 64 + d.textlength(val, font=vf) + 4, y + 54, t, 36)
    # tone selector
    y = 168 + 3 * 152
    d.text((40, y), L["l_tone"], font=fi(21, "Bold"), fill=GREY)
    bw = (SW - 80 - 24) / 3
    sel = 0 if t < 7.05 else 2  # picks "playful" just before BOOM
    for i, tn_ in enumerate(L["tones"]):
        x0 = 40 + i * (bw + 12)
        on = i == sel
        rr(d, [x0, y + 34, x0 + bw, y + 100], 18, fill=INK if on else PAPER, outline=INK if on else LINE, width=3)
        d.text((x0 + bw / 2, y + 67), tn_, font=fi(25, "SemiBold"), fill=WHITE if on else INK, anchor="mm")
    if 6.95 < t < 7.25:  # tap on tone
        k = prog(t, 6.95, 0.3)
        cx = 40 + 2 * (bw + 12) + bw / 2
        r = 20 + 60 * eo(k)
        d.ellipse([cx - r, y + 67 - r, cx + r, y + 67 + r], outline=BLUE + (int(220 * (1 - k)),), width=5)
    # BOOM button
    by = 880
    press = prog(t, PRESS - 0.1, 0.45)
    sc = 1 - 0.06 * math.sin(math.pi * clamp(press))
    bwid = (SW - 80) * sc
    g = grad_img(int(bwid), int(116 * sc), shift=t * 0.15).convert("RGBA")
    m = Image.new("L", g.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, g.width - 1, g.height - 1], radius=34, fill=255)
    s.paste(g, (int(SW / 2 - bwid / 2), int(by + 58 * (1 - sc))), m)
    d.text((SW / 2, by + 58), L["btn"], font=fit(L["btn"], f8, int(34 * sc), bwid - 50), fill=WHITE, anchor="mm")
    if 0 < press < 1:
        r = 30 + 280 * eo(press)
        d.ellipse([SW / 2 - r, by + 58 - r, SW / 2 + r, by + 58 + r], outline=(255, 255, 255, int(220 * (1 - press))), width=6)
    # finger
    fa = env(t, 6.75, PRESS + 0.35, 0.15, 0.2)
    if fa:
        tx = 40 + 2 * (bw + 12) + bw / 2 if t < 7.2 else SW / 2 + 40
        ty = y + 80 if t < 7.2 else by + 80
        if 7.2 <= t < PRESS - 0.1:  # glide to the button
            k = eio(prog(t, 7.2, PRESS - 0.1 - 7.2))
            tx = (40 + 2 * (bw + 12) + bw / 2) * (1 - k) + (SW / 2 + 40) * k
            ty = (y + 80) * (1 - k) + (by + 80) * k
        d.ellipse([tx - 34, ty - 34, tx + 34, ty + 34], fill=(20, 17, 28, int(70 * fa)), outline=(255, 255, 255, int(200 * fa)), width=4)
    return s


def day_card(i, fmt, title, w=520, done=False):
    c = Image.new("RGBA", (w, 150), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    rr(d, [0, 0, w - 1, 149], 28, fill=WHITE, outline=MINT if done else LINE, width=4 if done else 2)
    rr(d, [0, 0, w - 1, 92], 28, fill=INK)
    d.rectangle([0, 60, w - 1, 92], fill=INK)
    g = grad_img(64, 64).convert("RGBA")
    m = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 63, 63], radius=18, fill=255)
    c.paste(g, (16, 14), m)
    d.text((48, 46), str(i), font=f8(38), fill=WHITE, anchor="mm")
    pill = 112
    rr(d, [w - pill - 14, 28, w - 14, 64], 18, fill=(62, 56, 78))
    d.text((w - pill / 2 - 14, 46), fmt, font=fi(17, "Bold"), fill=WHITE, anchor="mm")
    tf = fi(22, "Bold")
    room = w - pill - 120
    if d.textlength(title, font=tf) > room:
        while len(title) > 4 and d.textlength(title + "…", font=tf) > room:
            title = title[:-1]
        title = title.rstrip() + "…"
    d.text((96, 46), title, font=tf, fill=WHITE, anchor="lm")
    for k in range(2):
        rr(d, [20, 108 + k * 18, w - 60 - k * 140, 118 + k * 18], 5, fill=LINE)
    return c


def screen_cards(t, t0, L):
    s, d = blank()
    s.alpha_composite(pole_img(SW, 10, t * 120), (0, 0))
    d.text((40, 60), L["res_t"], font=f8(42), fill=INK)
    x = 40 + d.textlength(L["res_t"], font=f8(42))
    s.alpha_composite(text_img(L["biz"], f8(42), grad=True, shift=t * 0.1), (int(x), 52))
    rr(d, [40, 140, SW - 40, 156], 8, fill=LINE)
    k = eo(prog(t, t0 + 2.4, 1.2))
    rr(d, [40, 140, 40 + (SW - 80) * max(0.03, k * 0.5), 156], 8, fill=MINT)
    scroll = 560 * eio(prog(t, t0 + 1.5, 2.2))
    for i, (fmt, ti) in enumerate(L["cards"]):
        p = eob(prog(t, t0 + 0.11 * i, 0.5))
        if p <= 0:
            continue
        y = 196 + i * 172 - scroll + (1 - p) * 120
        if -160 < y < SH:
            card = day_card(i + 1, fmt, ti, done=(i < 4 and k > 0.2 + i * 0.15))
            a = clamp(p)
            card.putalpha(card.getchannel("A").point(lambda v: int(v * a)))
            s.alpha_composite(card, (40, int(y)))
    return s


def screen_detail(t, t0, L):
    s, d = blank()
    s.alpha_composite(pole_img(SW, 10, t * 120), (0, 0))
    n = L["dayN"]
    fmt, ti = L["cards"][n - 1]
    card = day_card(n, fmt, ti, w=SW - 80)
    s.alpha_composite(card.crop((0, 0, card.width, 93)), (40, 60))
    rr(d, [40, 130, SW - 40, SH - 40], 0, fill=WHITE)
    y = 178
    d.text((66, y), L["lab_sh"], font=fi(20, "Bold"), fill=BLUE)
    yy = y + 44
    sf = fi(24, "Medium")
    for i, sh_ in enumerate(L["shots"]):
        a = eo(prog(t, t0 + 0.18 * i, 0.4))
        rr(d, [66, yy, 100, yy + 34], 9, fill=PAPER, outline=LINE)
        d.text((83, yy + 17), str(i + 1), font=fi(18, "Bold"), fill=INK, anchor="mm")
        for j, ln in enumerate(wrap(sh_, sf, SW - 200)):
            d.text((118, yy + 17 + j * 32), ln, font=sf, fill=INK + (int(255 * a),), anchor="lm")
        yy += 32 * len(wrap(sh_, sf, SW - 200)) + 24
    y = yy + 14
    d.text((66, y), L["lab_on"], font=fi(20, "Bold"), fill=BLUE)
    of = f8(30)
    ons_lines = wrap(L["ons"], of, SW - 170)
    pa = eob(prog(t, t0 + 0.55, 0.4))
    for i, ln in enumerate(ons_lines):
        bb = d.textbbox((0, 0), ln, font=of)
        if pa > 0:
            rr(d, [62, y + 42 + i * 50, 62 + (bb[2] + 18) * clamp(pa), y + 86 + i * 50], 8, fill=SUN)
            if pa > 0.6:
                d.text((71, y + 64 + i * 50), ln, font=of, fill=INK, anchor="lm")
    y = y + 60 + len(ons_lines) * 50 + 24
    d.text((66, y), L["lab_cap"], font=fi(20, "Bold"), fill=BLUE)
    cf = fi(24, "Regular")
    cap_lines = wrap(L["cap"], cf, SW - 176)
    rr(d, [62, y + 38, SW - 62, y + 62 + len(cap_lines) * 34], 18, fill=PAPER, outline=LINE)
    nn = int(len(L["cap"]) * eo(prog(t, t0 + 0.8, 1.2)))
    cnt = 0
    for i, ln in enumerate(cap_lines):
        take = max(0, min(len(ln), nn - cnt))
        d.text((84, y + 52 + i * 34), ln[:take], font=cf, fill=INK)
        cnt += len(ln) + 1
    d.text((84, y + 70 + len(cap_lines) * 34), "#fadehouse #barbershop #fade", font=fi(21, "SemiBold"), fill=BLUE)
    by = y + 120 + len(cap_lines) * 34
    press = prog(t, t0 + 2.2, 0.25)
    bwid = 300
    rr(d, [62, by, 62 + bwid, by + 62], 31, fill=MINT if press >= 1 else INK)
    d.text((62 + bwid / 2, by + 31), L["copied"] if press >= 1 else L["copy"], font=fi(23, "Bold"),
           fill=INK if press >= 1 else WHITE, anchor="mm")
    rr(d, [62 + bwid + 14, by, SW - 62, by + 62], 31, fill=PAPER, outline=LINE, width=2)
    d.text(((62 + bwid + 14 + SW - 62) / 2, by + 31), L["variant"], font=fit(L["variant"], lambda z: fi(z, "Bold"), 22, SW - 62 - bwid - 120),
           fill=INK, anchor="mm")
    if 0 < press < 1:
        r = 20 + 120 * eo(press)
        d.ellipse([62 + bwid / 2 - r, by + 31 - r, 62 + bwid / 2 + r, by + 31 + r], outline=(43, 217, 168, int(220 * (1 - press))), width=5)
    ta = env(t, t0 + 2.3, t0 + 3.9, 0.2, 0.3)
    if ta:
        tw = 290
        ty = SH - 150 + 40 * (1 - eo(prog(t, t0 + 2.3, 0.3)))
        rr(d, [SW / 2 - tw / 2, ty, SW / 2 + tw / 2, ty + 70], 35, fill=INK + (int(255 * ta),))
        d.text((SW / 2, ty + 35), L["copied"], font=fi(26, "Bold"), fill=WHITE + (int(255 * ta),), anchor="mm")
    return s


def put_phone(img, frame, screen, cx, cy, scale=1.0, rot=0.0, a=1.0):
    ph = frame.copy()
    m = Image.new("L", screen.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, screen.width - 1, screen.height - 1], radius=58, fill=255)
    ph.paste(screen, (60, 60), m)
    # glass highlight
    hl = Image.new("RGBA", ph.size, (0, 0, 0, 0))
    ImageDraw.Draw(hl).polygon([(60, 60), (360, 60), (60, 520)], fill=(255, 255, 255, 18))
    ph.alpha_composite(hl)
    if abs(rot) > 0.01:
        ph = ph.rotate(rot, resample=Image.BICUBIC, expand=True)
    place(img, ph, cx, cy, a, scale=scale)


# ---------------------------------------------------------------- music + sound design (original)
def music(path):
    sr = 44100
    n = int(sr * DUR)
    t = np.arange(n) / sr
    out = np.zeros((n, 2))
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731
    bpm = 120
    beat = 60 / bpm
    rng = np.random.default_rng(11)

    def add(x, at, g=1.0, pan=0.5):
        i = int(at * sr)
        if i >= n or i < 0:
            return
        j = min(n, i + len(x))
        seg = g * x[: j - i]
        out[i:j, 0] += seg * (1.25 - pan)
        out[i:j, 1] += seg * (0.25 + pan)

    def kick():
        tt = np.arange(int(0.42 * sr)) / sr
        return np.sin(2 * np.pi * np.cumsum(48 + 130 * np.exp(-tt * 32)) / sr) * np.exp(-tt * 7.5)

    def snare():
        tt = np.arange(int(0.22 * sr)) / sr
        x = rng.standard_normal(len(tt)) * np.exp(-tt * 22)
        tone = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.5
        return np.diff(x, prepend=0) * 0.6 + tone

    def hat(open_=False):
        tt = np.arange(int((0.16 if open_ else 0.05) * sr)) / sr
        return np.diff(rng.standard_normal(len(tt)) * np.exp(-tt * (25 if open_ else 90)), prepend=0)

    def keys(f, dur=0.5):
        tt = np.arange(int(dur * sr)) / sr
        return sum(np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (4 + 2.5 * h)) / h ** 1.3 for h in (1, 2, 3, 5))

    def bass808(f, dur):
        tt = np.arange(int(dur * sr)) / sr
        x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-tt * 40))) / sr)
        return np.tanh(2.2 * x) * np.exp(-tt * 1.8) * np.minimum(1, (dur - tt) / 0.03)

    def clipper(dur):
        """Hair-clipper buzz (motor hum + blade rattle), for the ASMR moment."""
        tt = np.arange(int(dur * sr)) / sr
        hum = np.sign(np.sin(2 * np.pi * 118 * tt)) * 0.25 + np.sin(2 * np.pi * 236 * tt) * 0.3
        rattle = rng.standard_normal(len(tt)) * (0.5 + 0.5 * np.sin(2 * np.pi * 118 * tt)) * 0.18
        e = np.minimum(1, tt / 0.06) * np.minimum(1, (dur - tt) / 0.15)
        return (hum + rattle) * e

    def boom():
        tt = np.arange(int(1.8 * sr)) / sr
        sub = np.sin(2 * np.pi * np.cumsum(38 + 100 * np.exp(-tt * 9)) / sr) * np.exp(-tt * 2.4)
        return sub + rng.standard_normal(len(tt)) * np.exp(-tt * 6) * 0.25

    def whoosh(dur=0.45):
        tt = np.arange(int(dur * sr)) / sr
        x = rng.standard_normal(len(tt))
        # crude band-pass sweep via moving average of different widths
        env_ = np.sin(np.pi * tt / dur) ** 2
        y = np.convolve(x, np.ones(9) / 9, mode="same") - np.convolve(x, np.ones(40) / 40, mode="same")
        return y * env_ * 0.9

    def tick():
        tt = np.arange(int(0.03 * sr)) / sr
        return np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 160)

    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]]  # Am7 Fmaj7 Cmaj7 G7
    drop = 2.0
    k, tb = 0, 0.0
    while tb < DUR - 0.6:
        bar = int(tb / (beat * 4)) % 4
        inbar = k % 4
        hush = 7.0 < tb < PRESS  # tension before the BOOM
        if tb >= drop and not hush:
            if inbar == 0 or (inbar == 2 and k % 8 != 6):
                add(kick(), tb, 0.95)
            if inbar == 3 and k % 8 == 7:
                add(kick(), tb + beat / 2, 0.6)
            if inbar in (1, 3):
                add(snare(), tb, 0.4)
            for s_ in range(2):
                add(hat(), tb + s_ * beat / 2 + beat / 4, 0.1, 0.72)
            if inbar == 2:
                add(hat(True), tb + beat / 2, 0.06, 0.3)
            if inbar == 0:
                add(bass808(hz(chords[bar][0] - 24), beat * 1.8), tb, 0.42)
        # chord stabs on the off-beats
        if tb >= drop or tb < 0.1 or inbar in (0, 2):
            for nt in chords[bar][:3 if tb < drop else 4]:
                add(keys(hz(nt + 12), 0.4), tb + beat / 2, 0.035, 0.35 + 0.1 * (nt % 3))
        tb += beat
        k += 1
    # intro: tight hit on "Berber?" and pole tick
    add(boom(), 0.05, 0.55)
    # riser before BOOM, the BOOM, then whooshes on scene changes
    tt = np.arange(int(1.4 * sr)) / sr
    add(rng.standard_normal(len(tt)) * (tt / 1.4) ** 2.2 * 0.3 + np.sin(2 * np.pi * np.cumsum(200 + 600 * (tt / 1.4) ** 2) / sr) * (tt / 1.4) ** 2 * 0.12,
        PRESS - 1.4, 1.0)
    add(boom(), PRESS, 1.1)
    for at in (2.35, 4.45, 11.6, 15.4, 18.0):
        add(whoosh(), at - 0.2, 0.55)
    # typing ticks
    for t0, ln, d_ in ((4.95, 10, 0.85), (5.9, 6, 0.45), (6.45, 19, 0.6)):
        for i in range(ln):
            add(tick(), t0 + d_ * i / ln, 0.05, 0.4 + 0.2 * (i % 2))
    # card pops, clipper during ASMR detail, copy chime, success chime
    for i in range(8):
        add(keys(hz(79 + (i % 4) * 2), 0.14), 8.0 + 0.11 * i, 0.05, 0.5)
    add(clipper(2.2), 12.0, 0.13, 0.55)
    for i, m in enumerate([76, 83]):
        add(keys(hz(m), 0.4), 13.95 + i * 0.07, 0.08)
    for i, m in enumerate([72, 76, 79, 84]):
        add(keys(hz(m), 0.7), 16.6 + i * 0.09, 0.1)
    mx = np.tanh(out * 1.35) / np.tanh(1.35)
    mx *= np.minimum(1, (DUR - t) / 1.4)[:, None]
    mx /= np.abs(mx).max() / 0.89
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mx * 32767).astype(np.int16).tobytes())


# ---------------------------------------------------------------- the film
def overlay():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def render(t, bg, frame, L, lay):
    img = bg.copy()
    # camera shake on BOOM
    shake = env(t, PRESS, PRESS + 0.5, 0.02, 0.45)

    # barber pole edge bars (top + bottom of safe area), always moving
    pa = 1 - env(t, 18.2, DUR + 1, 0.3, 0.1) * 0
    top = pole_img(W, 14, t * 160)
    img.alpha_composite(top, (0, 0))

    # 1 · HOOK (0 – 2.4)
    a = env(t, 0.0, 2.45, 0.08, 0.22)
    if a:
        p = [eob(prog(t, 0.0 + 0.22 * i, 0.42)) for i in range(4)]
        place(img, lay["kicker"], W / 2, 520, a * eo(prog(t, 0.0, 0.35)))
        g = text_img(L["hook1"], f8(230), grad=True, shift=t * 0.25)
        place(img, g, W / 2, 720, a * clamp(p[0]), scale=1.25 - 0.25 * clamp(p[0]))
        place(img, lay["h2"], W / 2, 930 + 40 * (1 - p[1]), a * clamp(p[1]))
        place(img, lay["h3"], W / 2, 1040 + 40 * (1 - p[2]), a * clamp(p[2]))
        place(img, lay["pole_icon"], W / 2, 1230, a * clamp(p[3]), scale=0.8 + 0.2 * clamp(p[3]))

    # 2 · PROBLEM (2.4 – 4.6)
    a2 = env(t, 2.35, 4.55, 0.2, 0.2)
    if a2:
        place(img, lay["pb1"], W / 2, 560, a2 * eo(prog(t, 2.4, 0.35)))
        p = eob(prog(t, 2.6, 0.45))
        place(img, lay["pb2"], W / 2, 740, a2 * clamp(p), scale=0.85 + 0.15 * clamp(p))
        g = text_img(L["pb3"], fit(L["pb3"], f8, 150, 900), grad=True, shift=t * 0.2)
        p2 = eob(prog(t, 2.8, 0.45))
        place(img, g, W / 2, 900, a2 * clamp(p2), scale=0.85 + 0.15 * clamp(p2))
        spots = [(230, 1130, -6), (720, 1110, 5), (420, 1260, 3), (800, 1290, -4), (240, 1400, 4), (600, 1440, -3)]
        for i, (cx, cy, rot) in enumerate(spots):
            k = eob(prog(t, 3.0 + 0.12 * i, 0.4))
            if k <= 0:
                continue
            ch = lay["chips"][i]
            bob = 8 * math.sin(t * 3 + i)
            place(img, ch.rotate(rot, resample=Image.BICUBIC, expand=True), cx, cy + bob + (1 - k) * 60, a2 * clamp(k), scale=0.7 + 0.3 * clamp(k))

    # 3 · FORM + BOOM (4.5 – 8.0)
    a3 = env(t, 4.5, 8.05, 0.25, 0.15)
    if a3:
        place(img, lay["s2"] if t < 6.9 else lay["s2b"], W / 2, 250, a3 * (eo(prog(t, 4.55, 0.3)) if t < 6.9 else eo(prog(t, 6.9, 0.25))))
        scr = screen_form(t, L)
        put_phone(img, frame, scr, W / 2 - 30, 1050 + 90 * (1 - eo(prog(t, 4.5, 0.55))), scale=0.8, rot=3, a=a3)
        fl = env(t, PRESS, PRESS + 0.6, 0.04, 0.5)
        if fl:
            img.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(170 * fl))))

    # 4 · 14 DAYS CASCADE (7.9 – 11.7)
    a4 = env(t, 7.9, 11.75, 0.15, 0.22)
    if a4:
        p = eob(prog(t, 7.95, 0.45))
        place(img, lay["s3a"], W / 2, 250, a4 * clamp(p), scale=0.8 + 0.2 * clamp(p))
        place(img, lay["s3b"], W / 2, 360, a4 * eo(prog(t, 8.15, 0.4)))
        scr = screen_cards(t, 8.0, L)
        put_phone(img, frame, scr, W / 2 - 30, 1110, scale=0.78 * (1.1 - 0.1 * eob(prog(t, 7.9, 0.5))), rot=-3, a=a4)

    # 5 · ONE DAY IN DETAIL + FEATURES (11.6 – 15.5)
    a5 = env(t, 11.6, 15.5, 0.22, 0.22)
    if a5:
        scr = screen_detail(t, 11.8, L)
        put_phone(img, frame, scr, W / 2 + 10, 1185 + 60 * (1 - eo(prog(t, 11.6, 0.5))), scale=0.72, rot=2, a=a5)
        place(img, lay["featT"], 80, 210, a5 * eo(prog(t, 11.65, 0.3)), anchor="l")
        for i, fl_ in enumerate(lay["feat"]):
            p = eob(prog(t, 11.85 + i * 0.3, 0.4))
            place(img, fl_, 80 + 60 * (1 - clamp(p)), 300 + i * 76, a5 * clamp(p), anchor="l")

    # 6 · FILM. COPY. POST. + 14/14 (15.4 – 18.1)
    a6 = env(t, 15.4, 18.15, 0.18, 0.22)
    if a6:
        for i, key in enumerate(["s5a", "s5b", "s5c"]):
            p = eob(prog(t, 15.45 + i * 0.3, 0.38))
            lay_ = lay[key] if key != "s5c" else text_img(L["s5c"], f8(180), grad=True, shift=t * 0.2)
            place(img, lay_, W / 2, 560 + i * 200 + 30 * (1 - clamp(p)), a6 * clamp(p), scale=0.8 + 0.2 * clamp(p))
        ov = overlay()
        d = ImageDraw.Draw(ov)
        bx, by, bw = 170, 1250, 740
        rr(d, [bx, by, bx + bw, by + 26], 13, fill=(255, 255, 255, int(40 * a6)))
        k = eo(prog(t, 15.9, 1.0))
        if k > 0:
            g = grad_img(int(bw * k) + 1, 26, shift=t * 0.2).convert("RGBA")
            m = Image.new("L", g.size, 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, g.width - 1, 25], radius=13, fill=int(255 * a6))
            ov.paste(g, (bx, by), m)
        img.alpha_composite(ov)
        place(img, lay["prog"], W / 2, 1330, a6 * eo(prog(t, 16.6, 0.35)))
        place(img, lay["boom"], W / 2, 1410, a6 * eob(prog(t, 16.8, 0.4)))

    # 7 · END CARD (18.0 – 21)
    a7 = env(t, 18.0, DUR + 1, 0.3, 0.3)
    if a7:
        p = eob(prog(t, 18.0, 0.55))
        place(img, lay["pole_big"], W / 2, 470, a7 * clamp(p), scale=0.7 + 0.3 * clamp(p))
        g = text_img(L["end1"], f8(176), grad=True, shift=t * 0.15)
        place(img, g, W / 2, 700, a7 * clamp(p), scale=0.85 + 0.15 * clamp(p))
        place(img, lay["end1b"], W / 2, 850, a7 * eo(prog(t, 18.2, 0.4)))
        place(img, lay["end2"], W / 2, 960, a7 * eo(prog(t, 18.4, 0.4)))
        place(img, lay["end3"], W / 2, 1030, a7 * eo(prog(t, 18.55, 0.4)))
        ca = a7 * eo(prog(t, 18.75, 0.4))
        if ca:
            ov = overlay()
            d = ImageDraw.Draw(ov)
            pw_ = 580
            py = 1190
            pulse = 1 + 0.03 * math.sin((t - 18.75) * 2 * math.pi / 0.8)
            g = grad_img(int(pw_ * pulse), int(130 * pulse), shift=t * 0.2).convert("RGBA")
            m = Image.new("L", g.size, 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, g.width - 1, g.height - 1], radius=g.height // 2, fill=int(255 * ca))
            ov.paste(g, (int(W / 2 - g.width / 2), int(py + 65 - g.height / 2)), m)
            d.text((W / 2, py + 65), L["cta"], font=fit(L["cta"], f8, 64, pw_ - 80), fill=(255, 255, 255, int(255 * ca)), anchor="mm")
            bob = 12 * math.sin((t - 18.75) * 2 * math.pi / 0.9)
            ay = py + 200 + bob
            d.line([(W / 2, ay - 20), (W / 2, ay + 50)], fill=SUN + (int(255 * ca),), width=8)
            d.line([(W / 2 - 26, ay + 24), (W / 2, ay + 52), (W / 2 + 26, ay + 24)], fill=SUN + (int(255 * ca),), width=8)
            img.alpha_composite(ov)
        place(img, lay["brand"], W / 2, 1500, a7 * eo(prog(t, 19.0, 0.5)))

    if shake:
        dx = int(18 * shake * math.sin(t * 90))
        dy = int(14 * shake * math.cos(t * 77))
        img = Image.fromarray(np.roll(np.roll(np.asarray(img), dx, axis=1), dy, axis=0))
    out = grain(img.convert("RGB"), t)
    g_ = min(1.0, eio((DUR - t) / 0.35))
    if g_ < 1:
        out = Image.blend(Image.new("RGB", (W, H), INK), out, g_)
    return out


def chip(s):
    tf = fi(40, "Bold")
    t_ = text_img(s, tf, fill=INK)
    c = Image.new("RGBA", (t_.width + 56, 84), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    rr(d, [0, 0, c.width - 1, 83], 42, fill=WHITE)
    c.alpha_composite(t_, (28, int(42 - t_.height / 2)))
    return c


def build_layers(L):
    lay = {}
    lay["kicker"] = text_img(L["kicker"], f8(44), fill=SUN)
    lay["h2"] = text_img(L["hook2"], fit(L["hook2"], f8, 100, 920))
    lay["h3"] = text_img(L["hook3"], fit(L["hook3"], f8, 84, 920), fill=SOFT)
    lay["pole_icon"] = icon_pole(150)
    lay["pole_big"] = icon_pole(190)
    lay["pb1"] = text_img(L["pb1"], fit(L["pb1"], lambda z: fi(z, "SemiBold"), 52, 900), fill=SOFT)
    lay["pb2"] = text_img(L["pb2"], f8(150))
    lay["chips"] = [chip(c) for c in L["chips"]]
    lay["s2"] = text_img(L["s2"], fit(L["s2"], f8, 66, 900))
    lay["s2b"] = text_img(L["s2b"], f8(90), fill=SUN)
    lay["s3a"] = text_img(L["s3a"], f8(110), fill=SUN)
    lay["s3b"] = text_img(L["s3b"], fit(L["s3b"], f8, 66, 900))
    lay["featT"] = text_img(L["featT"], f8(58), fill=SUN)
    feat = []
    for s in L["feat"]:
        t_ = text_img(s, fit(s, lambda z: fi(z, "SemiBold"), 40, 840))
        c = Image.new("RGBA", (t_.width + 70, max(t_.height, 50)), (0, 0, 0, 0))
        d = ImageDraw.Draw(c)
        d.ellipse([0, c.height / 2 - 20, 40, c.height / 2 + 20], fill=MINT)
        d.line([(10, c.height / 2), (18, c.height / 2 + 9), (31, c.height / 2 - 8)], fill=INK, width=5)
        c.alpha_composite(t_, (60, int(c.height / 2 - t_.height / 2)))
        feat.append(c)
    lay["feat"] = feat
    lay["s5a"] = text_img(L["s5a"], f8(180))
    lay["s5b"] = text_img(L["s5b"], f8(180))
    lay["prog"] = text_img(L["prog"], fi(38, "SemiBold"), fill=SOFT)
    lay["boom"] = text_img(L["boom"], fit(L["boom"], f8, 58, 900), fill=SUN)
    lay["end1b"] = text_img(L["end1b"], f8(96))
    lay["end2"] = text_img(L["end2"], fit(L["end2"], f8, 56, 900))
    lay["end3"] = text_img(L["end3"], fit(L["end3"], lambda z: fi(z, "Medium"), 38, 880), fill=SOFT)
    lay["brand"] = text_img(L["brand"], fi(28, "SemiBold"), fill=(160, 152, 175))
    return lay


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["sq", "en"], default="sq")
    ap.add_argument("--stills", nargs="*", type=float)
    ap.add_argument("--cover", action="store_true")
    a = ap.parse_args()
    L = T[a.lang]
    bg = make_bg()
    frame = phone_frame()
    lay = build_layers(L)
    if a.cover:
        render(19.6, bg, frame, L, lay).save(os.path.join(HERE, f"cover_{a.lang}.png"))
        return
    if a.stills:
        for s in a.stills:
            render(s, bg, frame, L, lay).save(os.path.join(HERE, f"_still_{a.lang}_{s:04.1f}.png"))
        return
    out = os.path.join(HERE, f"boom14_barber_reel_{a.lang}.mp4")
    wav = os.path.join(HERE, f"_music_{a.lang}.wav")
    music(wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
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
