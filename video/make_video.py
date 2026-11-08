"""
Video promocionale profesionale për kufje — "AURA ONE".

Gjeneron çdo kuadër me Pillow/NumPy, sintetizon muzikë ambient dhe i bashkon
me ffmpeg në një MP4 1920x1080 @ 30fps.

Përdorimi:  python3 make_video.py   ->   kufjet_aura_one.mp4
"""
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
DUR = 30.0
N = int(DUR * FPS)
SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "kufjet_aura_one.mp4")
WAV = os.path.join(HERE, "_audio.wav")

FONT_DIR = "/usr/share/fonts/opentype/inter/"
GOLD = (214, 168, 98)
WHITE = (240, 238, 234)
GREY = (150, 150, 160)


def font(name, size):
    return ImageFont.truetype(FONT_DIR + name, size)


# ---------------------------------------------------------------- helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


def prog(t, start, dur):
    return clamp((t - start) / dur)


def fade(t, a, b, fin=0.6, fout=0.6):
    """Alpha 0..1 for an element visible on [a, b] with fades."""
    if t < a or t > b:
        return 0.0
    return min(ease_out((t - a) / fin), ease_out((b - t) / fout))


# ---------------------------------------------------------------- music
def make_music():
    n = int(DUR * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    bpm = 96
    beat = 60 / bpm
    bar = beat * 4

    def note(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    # Am9 - Fmaj7 - C - G6 (pad chords), 2 bars each
    chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69],
              [48, 55, 60, 64, 67], [55, 59, 62, 64, 67]]
    bass = [45, 41, 36, 43]
    seg = bar * 2
    for i in range(int(DUR / seg) + 1):
        s, e = i * seg, min((i + 1) * seg + 0.8, DUR)
        idx = (t >= s) & (t < e)
        tt = t[idx] - s
        env = np.minimum(1, tt / 1.2) * np.minimum(1, np.maximum(0, (e - s - tt)) / 0.8)
        ch = chords[i % 4]
        sig = np.zeros(idx.sum())
        for m in ch:
            f = note(m)
            for det in (-0.12, 0.0, 0.12):  # detuned saw-ish pad (few harmonics)
                ff = f * 2 ** (det / 12)
                for h in range(1, 5):
                    sig += np.sin(2 * np.pi * ff * h * tt + h) / (h * 1.6)
        out[idx] += 0.018 * sig * env
        # sub bass
        fb = note(bass[i % 4])
        out[idx] += 0.16 * np.sin(2 * np.pi * fb * tt) * env

    # drums start at 4s, softer at the very end
    kick_t = np.arange(0, 0.45, 1 / SR)
    kick = np.sin(2 * np.pi * (45 + 90 * np.exp(-kick_t * 25)) * kick_t) * np.exp(-kick_t * 7)
    hat_t = np.arange(0, 0.06, 1 / SR)
    rng = np.random.default_rng(3)
    hat = rng.standard_normal(len(hat_t)) * np.exp(-hat_t * 70)
    hat = np.diff(hat, prepend=0)  # crude high-pass
    clap_t = np.arange(0, 0.2, 1 / SR)
    clap = rng.standard_normal(len(clap_t)) * np.exp(-clap_t * 22)

    def add(sample, at, gain):
        i = int(at * SR)
        j = min(n, i + len(sample))
        if i < n:
            out[i:j] += gain * sample[: j - i]

    k = 0
    tb = 4.0
    while tb < DUR - 1.5:
        add(kick, tb, 0.55)
        add(hat, tb + beat / 2, 0.10)
        if k % 2 == 1:
            add(clap, tb, 0.10)
        tb += beat
        k += 1
    # riser into outro + final impact
    rt = np.arange(0, 2.0, 1 / SR)
    riser = rng.standard_normal(len(rt)) * (rt / 2.0) ** 2 * 0.08
    add(riser, 24.0, 1.0)
    add(kick, 26.0, 0.9)

    # simple stereo reverb-ish delay + soft limiting
    d = int(0.23 * SR)
    left = out.copy()
    right = out.copy()
    left[d:] += 0.3 * out[:-d]
    right[int(d * 1.3):] += 0.3 * out[: -int(d * 1.3)]
    st = np.stack([left, right], 1)
    st = np.tanh(st * 1.4) / np.tanh(1.4)
    # master fade in/out
    m = np.minimum(1, t / 1.0) * np.minimum(1, (DUR - t) / 2.0)
    st *= m[:, None] * 0.85
    pcm = (st * 32767).astype(np.int16)
    with wave.open(WAV, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return st.mean(1)


# ---------------------------------------------------------------- headphones artwork
def linear_grad(size, c1, c2, angle_deg=45):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle_deg)
    p = xx * math.cos(a) + yy * math.sin(a)
    p = (p - p.min()) / (p.max() - p.min() + 1e-6)
    c1 = np.array(c1, np.float32)
    c2 = np.array(c2, np.float32)
    img = c1[None, None] * (1 - p[..., None]) + c2[None, None] * p[..., None]
    return Image.fromarray(img.astype(np.uint8), "RGB")


def paste_shape(base, mask, fill_img):
    layer = fill_img.convert("RGBA")
    layer.putalpha(mask)
    base.alpha_composite(layer)


def make_headphones(S=1400):
    """Front view of over-ear headphones, rendered at 2x then downsampled."""
    s = 2
    Z = S * s
    img = Image.new("RGBA", (Z, Z), (0, 0, 0, 0))

    def P(v):
        return int(v * s)

    cx, cy, R = 700, 760, 520
    # headband outer
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    d.arc([P(cx - R), P(cy - R), P(cx + R), P(cy + R)], 192, 348, fill=255, width=P(64))
    paste_shape(img, m, linear_grad((Z, Z), (90, 90, 98), (18, 18, 22), 80))
    # headband cushion (inner)
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    r2 = R - 52
    d.arc([P(cx - r2), P(cy - r2), P(cx + r2), P(cy + r2)], 212, 328, fill=255, width=P(34))
    paste_shape(img, m, linear_grad((Z, Z), (52, 48, 46), (22, 20, 20), 90))
    # gold stitch line on band
    d2 = ImageDraw.Draw(img)
    r3 = R - 30
    d2.arc([P(cx - r3), P(cy - r3), P(cx + r3), P(cy + r3)], 200, 340,
           fill=GOLD + (200,), width=P(3))

    half = Image.new("RGBA", (Z, Z), (0, 0, 0, 0))
    # slider (left side)
    a = math.radians(192)
    ex, ey = cx + R * math.cos(a), cy + R * math.sin(a)
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([P(ex - 14), P(ey - 20), P(ex + 18), P(ey + 230)], radius=P(12), fill=255)
    paste_shape(half, m, linear_grad((Z, Z), (225, 225, 230), (95, 95, 105), 0))
    # yoke
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    ccx, ccy = ex + 10, ey + 400
    d.arc([P(ccx - 150), P(ccy - 230), P(ccx + 150), P(ccy + 230)], 200, 340, fill=255, width=P(18))
    paste_shape(half, m, linear_grad((Z, Z), (200, 200, 208), (70, 70, 80), 30))
    # cushion (inner, towards center)
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([P(ccx + 40), P(ccy - 200), P(ccx + 120), P(ccy + 200)], radius=P(40), fill=255)
    paste_shape(half, m, linear_grad((Z, Z), (55, 50, 48), (15, 14, 14), 0))
    # cup shell
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([P(ccx - 135), P(ccy - 215), P(ccx + 75), P(ccy + 215)], fill=255)
    paste_shape(half, m, linear_grad((Z, Z), (70, 70, 78), (8, 8, 10), 60))
    # outer cap plate
    m = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([P(ccx - 150), P(ccy - 185), P(ccx - 20), P(ccy + 185)], fill=255)
    paste_shape(half, m, linear_grad((Z, Z), (110, 110, 120), (20, 20, 24), 70))
    # gold ring
    d = ImageDraw.Draw(half)
    d.ellipse([P(ccx - 150), P(ccy - 185), P(ccx - 20), P(ccy + 185)], outline=GOLD + (255,), width=P(5))
    # specular highlight
    hl = Image.new("L", (Z, Z), 0)
    d = ImageDraw.Draw(hl)
    d.ellipse([P(ccx - 125), P(ccy - 150), P(ccx - 85), P(ccy - 20)], fill=150)
    hl = hl.filter(ImageFilter.GaussianBlur(P(14)))
    white = Image.new("RGBA", (Z, Z), (255, 255, 255, 0))
    white.putalpha(hl)
    half.alpha_composite(white)
    # LED dot
    d = ImageDraw.Draw(half)
    d.ellipse([P(ccx - 32), P(ccy + 120), P(ccx - 22), P(ccy + 130)], fill=(120, 220, 255, 255))

    img.alpha_composite(half)
    img.alpha_composite(half.transpose(Image.FLIP_LEFT_RIGHT))
    img = img.resize((S, S), Image.LANCZOS)
    bbox = img.getbbox()
    return img.crop(bbox)


# ---------------------------------------------------------------- background
def make_background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx = (xx - W * 0.5) / W
    dy = (yy - H * 0.45) / H
    r = np.sqrt(dx * dx * 1.0 + dy * dy * 1.6)
    v = np.clip(1 - r * 1.6, 0, 1) ** 1.8
    base = np.array([9, 9, 12], np.float32)
    glow = np.array([46, 42, 52], np.float32)
    img = base + (glow - base) * v[..., None]
    # film grain baked (static, subtle)
    rng = np.random.default_rng(1)
    img += rng.normal(0, 1.6, img.shape[:2])[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


# particles (bokeh dust)
rng = np.random.default_rng(7)
PARTS = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(1, 3.5),
          rng.uniform(-12, 12), rng.uniform(-25, -6), rng.uniform(0.15, 0.6)) for _ in range(70)]


def draw_particles(img, t, alpha):
    if alpha <= 0:
        return
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x, y, r, vx, vy, a in PARTS:
        px = (x + vx * t) % W
        py = (y + vy * t) % H
        tw = 0.6 + 0.4 * math.sin(t * 1.3 + x)
        c = GOLD + (int(255 * a * tw * alpha),)
        d.ellipse([px - r, py - r, px + r, py + r], fill=c)
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1.2)))


# ---------------------------------------------------------------- text
def draw_text(img, xy, text, fnt, color, alpha, anchor="mm", tracking=0, dy=0):
    if alpha <= 0.003:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    y += dy
    col = color + (int(255 * clamp(alpha)),)
    if tracking == 0:
        d.text((x, y), text, font=fnt, fill=col, anchor=anchor)
    else:
        widths = [d.textlength(ch, font=fnt) for ch in text]
        total = sum(widths) + tracking * (len(text) - 1)
        if anchor[0] == "m":
            cx = x - total / 2
        elif anchor[0] == "r":
            cx = x - total
        else:
            cx = x
        for ch, w_ in zip(text, widths):
            d.text((cx, y), ch, font=fnt, fill=col, anchor="l" + anchor[1])
            cx += w_ + tracking
    img.alpha_composite(layer)


# ---------------------------------------------------------------- composition
F_BRAND = font("InterDisplay-Bold.otf", 150)
F_BRAND_S = font("InterDisplay-Bold.otf", 64)
F_SUB = font("InterDisplay-Light.otf", 40)
F_SMALL = font("Inter-Medium.otf", 24)
F_FEAT = font("InterDisplay-SemiBold.otf", 78)
F_FEAT_S = font("InterDisplay-Light.otf", 32)
F_TAG = font("InterDisplay-Light.otf", 70)

FEATURES = [
    ("40 orë", "Bateri që zgjat gjithë javën"),
    ("ANC Pro", "Anulim aktiv i zhurmës"),
    ("Hi‑Res", "Audio me rezolucion të lartë"),
    ("Bluetooth 5.4", "Lidhje e qëndrueshme, pa vonesë"),
]


def place(img, hp, cx, cy, scale, alpha, glow=None):
    if alpha <= 0:
        return
    w, h = hp.size
    im = hp.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)
    if glow is not None and glow > 0:
        g = Image.new("RGBA", im.size, GOLD + (0,))
        g.putalpha(im.getchannel("A").point(lambda v: int(v * 0.55 * glow)))
        g = g.resize((im.width // 4, im.height // 4)).filter(ImageFilter.GaussianBlur(10)).resize(im.size)
        img.alpha_composite(g, (int(cx - im.width / 2), int(cy - im.height / 2)))
    if alpha < 1:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        im.putalpha(a)
    img.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def light_sweep(img, t, start, dur, alpha=1.0):
    p = prog(t, start, dur)
    if p <= 0 or p >= 1:
        return
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    x = -400 + p * (W + 800)
    d.polygon([(x, 0), (x + 160, 0), (x - 240, H), (x - 400, H)], fill=int(40 * alpha * math.sin(p * math.pi)))
    layer = layer.filter(ImageFilter.GaussianBlur(60))
    white = Image.new("RGBA", (W, H), (255, 245, 230, 0))
    white.putalpha(layer)
    img.alpha_composite(white)


def spectrum_ring(img, audio, t, cx, cy, radius, alpha):
    if alpha <= 0:
        return
    i = int(t * SR)
    win = audio[max(0, i - 2048): i]
    if len(win) < 2048:
        win = np.pad(win, (2048 - len(win), 0))
    spec = np.abs(np.fft.rfft(win * np.hanning(2048)))[2:200]
    bands = 96
    edges = np.geomspace(1, len(spec), bands + 1).astype(int)
    vals = np.array([spec[edges[k]:max(edges[k] + 1, edges[k + 1])].mean() for k in range(bands)])
    vals = np.log1p(vals * 4) / 3.0
    vals = np.clip(vals, 0, 1.4)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for k in range(bands * 2):
        v = vals[k if k < bands else 2 * bands - 1 - k]
        ang = -math.pi / 2 + k / (bands * 2) * 2 * math.pi
        L = 8 + 70 * v
        x1, y1 = cx + radius * math.cos(ang), cy + radius * math.sin(ang)
        x2, y2 = cx + (radius + L) * math.cos(ang), cy + (radius + L) * math.sin(ang)
        mix = clamp(v - 0.5)
        col = tuple(int(GOLD[c] * (1 - mix) + WHITE[c] * mix) for c in range(3))
        d.line([(x1, y1), (x2, y2)], fill=col + (int(230 * alpha),), width=4)
    glow = layer.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(glow)
    img.alpha_composite(layer)


def render(t, bg, hp, audio):
    img = Image.fromarray(bg).convert("RGBA")
    draw_particles(img, t, fade(t, 0.5, DUR, 2.0, 1.5))

    # ---- Scene 1 (0–4.2s): brand intro
    a1 = fade(t, 0.3, 4.2, 0.8, 0.6)
    if a1 > 0:
        lw = 520 * ease_out(prog(t, 0.3, 1.4))
        d = ImageDraw.Draw(img)
        d.line([(W / 2 - lw, H / 2 + 105), (W / 2 + lw, H / 2 + 105)], fill=GOLD + (int(255 * a1),), width=2)
        track = 60 - 40 * ease_out(prog(t, 0.6, 3.0))
        draw_text(img, (W / 2, H / 2 - 10), "AURA ONE", F_BRAND, WHITE, a1 * ease_out(prog(t, 0.6, 1.0)),
                  tracking=track)
        draw_text(img, (W / 2, H / 2 - 150), "PREZANTOJMË", F_SMALL, GOLD,
                  a1 * ease_out(prog(t, 1.0, 0.8)), tracking=12)
        draw_text(img, (W / 2, H / 2 + 165), "Tingulli, i ripërcaktuar.", F_SUB, GREY,
                  a1 * ease_out(prog(t, 1.6, 0.9)), dy=20 * (1 - ease_out(prog(t, 1.6, 0.9))))

    # ---- headphone motion across scenes 2–5
    if t >= 3.8:
        a_in = ease_out(prog(t, 3.8, 1.4))
        # position: center (scene2) -> left (scene3) -> center (scene4/5)
        to_left = ease_in_out(prog(t, 9.4, 1.0))
        back = ease_in_out(prog(t, 21.4, 1.0))
        outro = ease_in_out(prog(t, 25.8, 1.0))
        k = to_left * (1 - back)
        cx = W / 2 + (W * 0.30 - W / 2) * k
        cy = H * 0.43 + 8 * math.sin(t * 1.1) - (H * 0.43 - H * 0.37) * outro  # gentle float
        sc = 0.56 - 0.04 * k - 0.04 * back - 0.12 * outro
        alpha = a_in * (1 - ease_out(prog(t, 29.0, 0.9)))
        glow = 0.35 + 0.65 * fade(t, 22.0, 26.2, 0.8, 0.8)
        place(img, hp, cx, cy, sc * (0.9 + 0.1 * a_in), alpha, glow=glow)

        # Scene 4 spectrum ring (22–26.2s)
        a4 = fade(t, 22.0, 26.2, 0.8, 0.6)
        spectrum_ring(img, audio, t, cx, cy, 345, a4)

    light_sweep(img, t, 5.0, 2.2)
    light_sweep(img, t, 26.4, 1.8, 0.8)

    # ---- Scene 2 (4–9.6s): headline
    a2 = fade(t, 5.2, 9.4, 0.8, 0.5)
    if a2 > 0:
        draw_text(img, (W / 2, H - 150), "Dizajn i ri. Tingull i pastër.", F_TAG, WHITE, a2,
                  dy=24 * (1 - ease_out(prog(t, 5.2, 1.0))))
        draw_text(img, (W / 2, H - 85), "KUFJE ME ANULIM AKTIV TË ZHURMËS", F_SMALL, GOLD, a2 * 0.9, tracking=8)

    # ---- Scene 3 (10–21.6s): feature list on the right
    a3 = fade(t, 10.2, 21.6, 0.5, 0.7)
    if a3 > 0:
        x0 = W * 0.56
        draw_text(img, (x0, 180), "SPECIFIKIMET", F_SMALL, GOLD, a3 * ease_out(prog(t, 10.2, 0.8)),
                  anchor="lm", tracking=10)
        for i, (big, small) in enumerate(FEATURES):
            st = 10.6 + i * 2.4
            p = ease_out(prog(t, st, 0.9))
            y = 290 + i * 190
            ai = a3 * p
            d = ImageDraw.Draw(img)
            d.line([(x0, y - 52), (x0 + 560 * p, y - 52)], fill=(255, 255, 255, int(40 * ai)), width=1)
            draw_text(img, (x0 + 40 * (1 - p), y), big, F_FEAT, WHITE, ai, anchor="lm")
            draw_text(img, (x0 + 40 * (1 - p), y + 62), small, F_FEAT_S, GREY, ai, anchor="lm")
            # number
            draw_text(img, (x0 - 50, y - 18), f"0{i + 1}", F_SMALL, GOLD, ai * 0.8, anchor="lm")

    # ---- Scene 4 text
    a4t = fade(t, 22.6, 26.0, 0.8, 0.5)
    if a4t > 0:
        draw_text(img, (W / 2, H - 90), "Dëgjo çdo detaj.", F_SUB, WHITE, a4t,
                  dy=20 * (1 - ease_out(prog(t, 22.6, 1.0))))

    # ---- Scene 5 (26–30s): outro
    a5 = fade(t, 26.6, DUR, 0.9, 1.0)
    if a5 > 0:
        draw_text(img, (W / 2, H * 0.66), "AURA ONE", F_BRAND_S, WHITE, a5, tracking=22)
        d = ImageDraw.Draw(img)
        lw = 180 * ease_out(prog(t, 27.0, 1.0))
        d.line([(W / 2 - lw, H * 0.66 + 58), (W / 2 + lw, H * 0.66 + 58)], fill=GOLD + (int(255 * a5),), width=2)
        draw_text(img, (W / 2, H * 0.66 + 110), "Tani në dispozicion", F_SUB, GREY,
                  a5 * ease_out(prog(t, 27.4, 0.8)))

    # letterbox bars for a cinematic look
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 54], fill=(0, 0, 0, 255))
    d.rectangle([0, H - 54, W, H], fill=(0, 0, 0, 255))

    # global fade from/to black
    g = min(ease_out(t / 0.6), ease_out((DUR - t) / 0.7))
    out = img.convert("RGB")
    if g < 1:
        out = Image.blend(Image.new("RGB", (W, H)), out, g)
    return out


def main():
    print("Sintetizoj muzikën…")
    audio = make_music()
    print("Përgatis grafikat…")
    bg = make_background()
    hp = make_headphones()
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", WAV,
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        t = f / FPS
        proc.stdin.write(render(t, bg, hp, audio).tobytes())
        if f % 60 == 0:
            print(f"  kuadri {f}/{N}")
    proc.stdin.close()
    proc.wait()
    os.remove(WAV)
    print("Gati:", OUT)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--stills":
        # quick preview frames
        audio = make_music()
        bg = make_background()
        hp = make_headphones()
        for ts in map(float, sys.argv[2:]):
            render(ts, bg, hp, audio).save(os.path.join(HERE, f"_still_{ts:05.1f}.png"))
    else:
        main()
