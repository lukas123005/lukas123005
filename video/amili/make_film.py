"""
AMILI Beauty Studio — luxury cinematic film built from the studio's own photographs.

Every frame is the original photograph: the camera is a virtual one that moves over
each image with sub-pixel Lanczos sampling (push-ins, tracks, tilts), with a
filmic grade, soft halation on the practical lights, vignette and fine grain.
Nothing is generated or invented inside the pictures.

usage:
  python3 make_film.py preview OUTDIR      # contact sheet of first/last frame of every shot
  python3 make_film.py render  OUT.mp4 AUDIO.wav
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
DUR = 42.0
RNG = np.random.default_rng(7)


def P(name):
    return os.path.join(HERE, "photos", name)


# ----------------------------------------------------------------------------- shots
# a / b = virtual camera at start / end: (centre x, centre y, viewport height) in source px
# source photographs are 1512 x 2016.
SHOTS = [
    # 1. Arrival — the reed diffuser and blush sofa: scent, softness, calm.
    dict(img="03_lounge_sofa.jpg", t0=0.0, t1=5.2, a=(1150, 1290, 1350), b=(1215, 1270, 1120)),
    # 2. Reveal — through the curtains into the treatment room.
    dict(img="02_room_through_curtains.jpg", t0=4.4, t1=9.8, a=(760, 1010, 2016), b=(700, 960, 1660)),
    # 3. The treatment room — slow lateral track across the wall.
    dict(img="01_treatment_room.jpg", t0=9.0, t1=14.4, a=(560, 1150, 1780), b=(960, 1080, 1700)),
    # 4. Detail — the bed under the magnifier lamp, tilting down its length.
    dict(img="07_bed_detail.jpg", t0=13.6, t1=18.2, a=(720, 820, 1500), b=(820, 1240, 1440)),
    # 5. Precision — permanent make-up instruments and pigments.
    dict(img="08_pmu_cart.jpg", t0=17.4, t1=21.6, a=(820, 760, 1050), b=(900, 790, 900)),
    # 6. The nail atelier — push toward the halo lamp.
    dict(img="04_nail_desk.jpg", t0=20.8, t1=26.2, a=(760, 1010, 2016), b=(640, 960, 1600)),
    # 7. Overhead — the pair of shell chairs, rising to the lamp.
    dict(img="05_nail_desk_top.jpg", t0=25.4, t1=30.4, a=(760, 1150, 1760), b=(760, 880, 1560)),
    # 8. Signature — the entrance and the AMILI mark on the glass.
    dict(img="06_entrance_logo.jpg", t0=29.6, t1=DUR, a=(620, 1080, 1950), b=(1240, 520, 1150)),
]
XF = 0.8  # cross-dissolve length (shots overlap by this much)


def ease(p):
    """Mostly-constant velocity with soft start/stop — reads as a real dolly."""
    s = p * p * (3 - 2 * p)
    return 0.55 * p + 0.45 * s


# ----------------------------------------------------------------------------- grade
def grade(img):
    """Filmic grade on a float32 RGB image (0..1). Static per photo, so done once."""
    x = img.astype(np.float32) / 255.0
    # gentle clarity
    blur = cv2.GaussianBlur(x, (0, 0), 2.2)
    x = np.clip(x + 0.35 * (x - blur), 0, 1)
    # white balance: a touch warmer, creamier whites
    x = x * np.array([1.015, 1.0, 0.965], np.float32)
    # black point / white point
    x = np.clip((x - 0.035) / (0.985 - 0.035), 0, 1)
    # S-curve for rich contrast and deep shadows
    s = x * x * (3 - 2 * x)
    x = x + 0.42 * (s - x)
    x = np.power(np.clip(x, 0, 1), 1.06)
    # saturation: slightly restrained, more elegant than the phone's punchy rendering
    lum = (x * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(2, keepdims=True)
    x = lum + (x - lum) * 0.88
    # split tone: warm-umber shadows, champagne highlights
    sh = (1 - lum) ** 3
    hi = lum ** 3
    x = x + sh * np.array([0.012, 0.0, -0.006], np.float32) + hi * np.array([0.012, 0.006, -0.012], np.float32)
    # highlight roll-off
    x = np.where(x > 0.82, 0.82 + (x - 0.82) / (1 + (x - 0.82) / 0.2), x)
    # halation: practical lamps bloom softly, warm
    lum = (x * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(2, keepdims=True)
    bright = np.clip(lum - 0.78, 0, 1) * x
    glow = cv2.GaussianBlur(bright, (0, 0), 28) + 0.6 * cv2.GaussianBlur(bright, (0, 0), 8)
    x = x + glow * np.array([1.0, 0.86, 0.72], np.float32) * 0.9
    return np.clip(x, 0, 1).astype(np.float32)


_cache = {}


def source(name):
    if name not in _cache:
        im = cv2.cvtColor(cv2.imread(P(name), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
        _cache[name] = grade(im)
    return _cache[name]


def camera(src, cx, cy, h):
    ih, iw = src.shape[:2]
    h = min(h, ih)
    w = h * W / H
    if w > iw:
        w = iw
        h = w * H / W
    cx = min(max(cx, w / 2), iw - w / 2)
    cy = min(max(cy, h / 2), ih - h / 2)
    s = h / H
    M = np.array([[s, 0, cx - (W / 2) * s + (s - 1) / 2], [0, s, cy - (H / 2) * s + (s - 1) / 2]], np.float32)
    return cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REFLECT)


def shot_frame(sh, t):
    span = sh["t1"] - sh["t0"]
    p = ease(np.clip((t - sh["t0"]) / span, 0, 1))
    a, b = np.array(sh["a"], float), np.array(sh["b"], float)
    # zoom interpolated in log space so push-ins feel linear to the eye
    cx, cy = a[:2] + (b[:2] - a[:2]) * p
    h = math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * p)
    return camera(source(sh["img"]), cx, cy, h)


# ----------------------------------------------------------------------------- finish
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2)
VIGNETTE = (1 - 0.30 * np.clip(r - 0.35, 0, None) ** 1.6)[..., None].astype(np.float32)
del xx, yy, r


def finish(x):
    x = x * VIGNETTE
    g = RNG.standard_normal((H // 2, W // 2)).astype(np.float32)
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
    lum = x.mean(2, keepdims=True)
    x = x + g[..., None] * 0.016 * (0.4 + 0.6 * (1 - np.abs(lum - 0.5) * 2))
    return x


# ----------------------------------------------------------------------------- type
FONT_SERIF = os.path.join(HERE, "fonts", "CormorantGaramond.ttf")
FONT_ITALIC = os.path.join(HERE, "fonts", "CormorantGaramond-Italic.ttf")
FONT_SANS = os.path.join(HERE, "fonts", "Montserrat.ttf")
GOLD = (214, 186, 140)
IVORY = (246, 238, 228)


def font(path, size, wght):
    f = ImageFont.truetype(path, size)
    f.set_variation_by_axes([wght])
    return f


def tracked(draw, cx, y, text, f, fill, tracking):
    widths = [f.getlength(c) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for c, wdt in zip(text, widths):
        draw.text((x, y), c, font=f, fill=fill)
        x += wdt + tracking


def smooth(a, b, t):
    p = np.clip((t - a) / (b - a), 0, 1)
    return p * p * (3 - 2 * p)


def title_layer(t):
    """End signature: AMILI / Beauty Studio / services. Returns RGBA float or None."""
    T0 = 34.4
    if t < T0:
        return None
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cy = 860
    # wordmark: tracking slowly opens as it fades up
    a1 = smooth(T0, T0 + 1.6, t)
    tr = 34 + 14 * smooth(T0, DUR, t)
    tracked(d, W / 2, cy - 40 - 18 * (1 - a1), "AMILI", font(FONT_SERIF, 150, 400), IVORY + (int(255 * a1),), tr)
    # hairline rule draws outward
    a2 = smooth(T0 + 0.9, T0 + 2.2, t)
    half = 150 * a2
    d.line([(W / 2 - half, cy + 160), (W / 2 + half, cy + 160)], fill=GOLD + (int(220 * a2),), width=2)
    a3 = smooth(T0 + 1.2, T0 + 2.6, t)
    tracked(d, W / 2, cy + 185, "Beauty Studio", font(FONT_ITALIC, 66, 400), GOLD + (int(255 * a3),), 3)
    a4 = smooth(T0 + 2.2, T0 + 3.6, t)
    f = font(FONT_SANS, 23, 300)
    tracked(d, W / 2, cy + 330, "MICROBLADING  ·  BROWS  ·  NAILS", f, IVORY + (int(200 * a4),), 6)
    tracked(d, W / 2, cy + 375, "HYDROFACIAL  ·  MASSAGE  ·  DEPILIM", f, IVORY + (int(200 * a4),), 6)
    return np.asarray(img).astype(np.float32) / 255.0


# ----------------------------------------------------------------------------- compose
def frame(t):
    acc = np.zeros((H, W, 3), np.float32)
    wsum = 0.0
    for i, sh in enumerate(SHOTS):
        if t < sh["t0"] or t > sh["t1"]:
            continue
        w = 1.0
        if i > 0:
            w *= smooth(sh["t0"], sh["t0"] + XF, t)
        if i < len(SHOTS) - 1:
            w *= 1 - smooth(sh["t1"] - XF, sh["t1"], t)
        if w <= 0:
            continue
        acc += w * shot_frame(sh, t)
        wsum += w
    x = acc / max(wsum, 1e-6)
    # final shot settles into darkness behind the signature
    k = smooth(34.0, 36.6, t)
    if k > 0:
        blur = cv2.GaussianBlur(x, (0, 0), 1 + 10 * k)
        x = blur * (1 - 0.78 * k)
    # open from black, close to black
    x = x * smooth(0.0, 1.8, t) * (1 - smooth(DUR - 1.4, DUR, t))
    x = finish(x)
    tl = title_layer(t)
    if tl is not None:
        a = tl[..., 3:4] * (1 - smooth(DUR - 1.4, DUR, t))
        x = x * (1 - a) + tl[..., :3] * a
    return np.clip(x, 0, 1)


def to8(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def preview(outdir):
    os.makedirs(outdir, exist_ok=True)
    tiles = []
    for i, sh in enumerate(SHOTS):
        for t in (sh["t0"] + 0.01, sh["t1"] - 0.01):
            f = shot_frame(sh, t)
            tiles.append(cv2.resize(to8(finish(f)), (270, 480), interpolation=cv2.INTER_AREA))
    rows = [np.concatenate(tiles[i:i + 8], 1) for i in range(0, len(tiles), 8)]
    Image.fromarray(np.concatenate(rows, 0)).save(os.path.join(outdir, "contact.jpg"), quality=88)
    for t in (2.0, 5.0, 23.0, 33.0, 38.5):
        Image.fromarray(to8(frame(t))).save(os.path.join(outdir, f"f_{t:05.1f}.jpg"), quality=90)


def render(out, wav):
    n = int(DUR * FPS)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", wav, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-tune", "film", "-movflags", "+faststart",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "aac", "-b:a", "256k", "-shortest", out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        pr.stdin.write(to8(frame(i / FPS)).tobytes())
        if i % 60 == 0:
            print(f"frame {i}/{n}", flush=True)
    pr.stdin.close()
    pr.wait()


if __name__ == "__main__":
    if sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        render(sys.argv[2], sys.argv[3])
