"""
Whop product cover for BOOM 14 Barber in the black-and-gold reel style.
Whop writes the product title over the lower-left of the card, so the left side stays clean
and the visual (phone with the 14 days) sits on the right.

    python3 make_whop_cover.py  -> whop_cover.png (1920x1080) + whop_cover_square.png (1080x1080)
"""
import importlib.util
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("barber_reel", os.path.join(HERE, "make_reel.py"))
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)


def background(w, h, glow_x):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = np.ones((h, w, 3), np.float32) * np.array(R.INK, np.float32)

    def blob(cx, cy, r, col, a):
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        return (np.clip(1 - d, 0, 1) ** 2 * a)[..., None] * (np.array(col, np.float32) - base)

    img = base + blob(glow_x, h * 0.35, w * 0.6, (130, 96, 46), 0.75) + blob(w * 0.1, h * 1.05, w * 0.5, R.RED, 0.35)
    vig = np.clip(np.sqrt(((xx - w / 2) / (w * 0.7)) ** 2 + ((yy - h / 2) / (h * 0.75)) ** 2), 0, 1)
    img *= (1 - 0.5 * vig ** 2.2)[..., None]
    img += np.random.default_rng(2).normal(0, 2.5, (h, w, 1))
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


def bokeh(img, n, seed, area):
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = area
    for _ in range(n):
        r = int(rng.choice([5, 8, 14, 22]))
        s = Image.new("L", (r * 6, r * 6), 0)
        ImageDraw.Draw(s).ellipse([r * 2, r * 2, r * 4, r * 4], fill=int(255 * rng.uniform(0.2, 0.55)))
        s = s.filter(ImageFilter.GaussianBlur(r * 0.6))
        sp = Image.new("RGBA", s.size, R.GOLD_L + (0,))
        sp.putalpha(s)
        img.alpha_composite(sp, (int(rng.uniform(x0, x1)) - s.width // 2, int(rng.uniform(y0, y1)) - s.height // 2))


def corners(img, m, col_a=230):
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.rectangle([m, m, w - m, h - m], outline=R.GOLD + (50,), width=2)
    L = 60
    for (x, y, sx, sy) in ((m, m, 1, 1), (w - m, m, -1, 1), (m, h - m, 1, -1), (w - m, h - m, -1, -1)):
        d.line([(x, y), (x + sx * L, y)], fill=R.GOLD + (col_a,), width=4)
        d.line([(x, y), (x, y + sy * L)], fill=R.GOLD + (col_a,), width=4)


def phone(L, t=9.45):
    """Phone with the 14-day results screen, cards already in."""
    scr = R.screen_cards(t, 8.0, L)
    frame = R.phone_frame()
    ph = frame.copy()
    m = Image.new("L", scr.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, scr.width - 1, scr.height - 1], radius=58, fill=255)
    ph.paste(scr, (60, 60), m)
    hl = Image.new("RGBA", ph.size, (0, 0, 0, 0))
    ImageDraw.Draw(hl).polygon([(60, 60), (380, 60), (60, 560)], fill=(255, 245, 225, 20))
    ph.alpha_composite(hl)
    return R.perspective(ph, -0.12).rotate(-6, resample=Image.BICUBIC, expand=True)


def badge(text, size=30):
    t = R.text_img(R.spaced(text), R.fi(size, "SemiBold"), fill=R.INK)
    b = Image.new("RGBA", (t.width + 60, t.height + 26), (0, 0, 0, 0))
    g = R.grad_img(b.width, b.height, 0.1).convert("RGBA")
    mk = Image.new("L", b.size, 0)
    ImageDraw.Draw(mk).rounded_rectangle([0, 0, b.width - 1, b.height - 1], radius=b.height // 2, fill=255)
    b.paste(g, (0, 0), mk)
    b.alpha_composite(t, (30, 13))
    return b


def wide(L):
    W, H = 1920, 1080
    img = background(W, H, glow_x=1380)
    bokeh(img, 26, 4, (900, 40, 1880, 1040))
    ph = phone(L)
    sc = 0.64
    ph = ph.resize((int(ph.width * sc), int(ph.height * sc)), Image.LANCZOS)
    img.alpha_composite(ph, (1330 - ph.width // 2, 590 - ph.height // 2))
    pole = R.icon_pole(170, 30)
    img.alpha_composite(pole, (960 - pole.width // 2, 420))
    # one quiet line of brand text, top-left (Whop puts the title lower down)
    img.alpha_composite(R.text_img(R.spaced("BOOM 14 BARBER"), R.fi(30, "SemiBold"), fill=R.GOLD), (96, 92))
    bd = badge("GATI NË 10 SEKONDA", 24)
    img.alpha_composite(bd, (W - 96 - bd.width, 92))
    corners(img, 44)
    return img.convert("RGB")


def square(L):
    S = 1080
    img = background(S, S, glow_x=640)
    bokeh(img, 20, 9, (40, 40, 1040, 1040))
    ph = phone(L)
    sc = 0.5
    ph = ph.resize((int(ph.width * sc), int(ph.height * sc)), Image.LANCZOS)
    img.alpha_composite(ph, (800 - ph.width // 2, 640 - ph.height // 2))
    big = R.text_img("BOOM 14", R.f8(120), grad=True, shift=0.15)
    img.alpha_composite(big, (90, 110))
    img.alpha_composite(R.text_img(R.spaced("BARBER"), R.fi(40, "SemiBold"), fill=R.TXT), (100, 290))
    lines = ["14 ditë postime", "për berberinë,", "gati në 10 sekonda."]
    for i, ln in enumerate(lines):
        img.alpha_composite(R.text_img(ln, R.f8(46), fill=R.SOFT), (96, 400 + i * 64))
    pole = R.icon_pole(150, 30)
    img.alpha_composite(pole, (110, 650))
    corners(img, 36)
    return img.convert("RGB")


if __name__ == "__main__":
    L = R.T["sq"]
    wide(L).save(os.path.join(HERE, "whop_cover.png"))
    square(L).save(os.path.join(HERE, "whop_cover_square.png"))
    print("ok")
