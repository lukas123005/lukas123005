"""
SILVIA Beauty Studio — 18 s cinematic film (1920x1080, 2.39:1 letterbox) from the six
storyboard frames in frames/ (made by prep_frames.py).

Virtual camera moves over each frame (Lanczos, sub-pixel), cuts on the music's bar lines
(96 BPM, 2.5 s per bar) with short dissolves, light filmic finish, vignette and grain.

usage: python3 make_film.py preview OUTDIR
       python3 make_film.py render OUT.mp4 MUSIC.wav
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1920, 1080, 30
PH = 804                     # picture height inside the 2.39:1 letterbox
TOP = (H - PH) // 2
DUR = 18.0
BAR = 2.5
XF = 0.5
RNG = np.random.default_rng(3)

# camera a -> b : (centre x, centre y, viewport height) in frame px (frames are ~2505 x 936)
SHOTS = [
    dict(img="shot1.png", t0=0.0, t1=BAR + XF / 2, a=(1250, 470, 936), b=(1480, 430, 800)),        # entrance + logo
    dict(img="shot2.png", t0=BAR - XF / 2, t1=2 * BAR + XF / 2, a=(1420, 470, 900), b=(1300, 500, 840)),  # treatment room
    dict(img="shot3.png", t0=2 * BAR - XF / 2, t1=3 * BAR + XF / 2, a=(1250, 466, 933), b=(1320, 430, 780)),  # nail bar
    dict(img="shot4.png", t0=3 * BAR - XF / 2, t1=4 * BAR + XF / 2, a=(1150, 520, 860), b=(1360, 500, 810)),  # PMU detail
    dict(img="shot5.png", t0=4 * BAR - XF / 2, t1=5 * BAR + XF / 2, a=(1250, 490, 790), b=(1250, 468, 936)),  # rooms, pull back
    dict(img="shot6.png", t0=5 * BAR - XF / 2, t1=DUR, a=(1250, 468, 936), b=(1270, 478, 880)),             # signature
]


def ease(p):
    s = p * p * (3 - 2 * p)
    return 0.55 * p + 0.45 * s


def smooth(a, b, t):
    p = np.clip((t - a) / (b - a), 0, 1)
    return p * p * (3 - 2 * p)


def finish_source(img):
    """Light, consistent grade: the frames are already lit/graded, so only unify them."""
    x = img.astype(np.float32) / 255.0
    blur = cv2.GaussianBlur(x, (0, 0), 1.6)
    x = np.clip(x + 0.25 * (x - blur), 0, 1)                      # crispness after upscale
    x = np.clip((x - 0.02) / 0.98, 0, 1)                          # deeper black point
    s = x * x * (3 - 2 * x)
    x = x + 0.18 * (s - x)                                        # gentle S-curve
    lum = (x * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(2, keepdims=True)
    x = lum + (x - lum) * 0.95
    bright = np.clip(lum - 0.8, 0, 1) * x                         # soft halation on practicals
    x = x + cv2.GaussianBlur(bright, (0, 0), 18) * np.array([1.0, 0.85, 0.7], np.float32) * 0.8
    return np.clip(x, 0, 1).astype(np.float32)


_cache = {}


def source(name):
    if name not in _cache:
        im = cv2.cvtColor(cv2.imread(os.path.join(HERE, "frames", name)), cv2.COLOR_BGR2RGB)
        _cache[name] = finish_source(im)
    return _cache[name]


def camera(src, cx, cy, h):
    ih, iw = src.shape[:2]
    h = min(h, ih)
    w = h * W / PH
    if w > iw:
        w = iw
        h = w * PH / W
    cx = min(max(cx, w / 2), iw - w / 2)
    cy = min(max(cy, h / 2), ih - h / 2)
    s = h / PH
    M = np.array([[s, 0, cx - (W / 2) * s + (s - 1) / 2], [0, s, cy - (PH / 2) * s + (s - 1) / 2]], np.float32)
    return cv2.warpAffine(src, M, (W, PH), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REFLECT)


def shot_frame(sh, t):
    p = ease(np.clip((t - sh["t0"]) / (sh["t1"] - sh["t0"]), 0, 1))
    a, b = np.array(sh["a"], float), np.array(sh["b"], float)
    cx, cy = a[:2] + (b[:2] - a[:2]) * p
    h = math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * p)
    return camera(source(sh["img"]), cx, cy, h)


yy, xx = np.mgrid[0:PH, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - PH / 2) / (PH / 2)) ** 2 * 0.6)
VIGNETTE = (1 - 0.32 * np.clip(r - 0.45, 0, None) ** 1.5)[..., None].astype(np.float32)
del xx, yy, r


def picture(t):
    acc = np.zeros((PH, W, 3), np.float32)
    ws = 0.0
    for i, sh in enumerate(SHOTS):
        if t < sh["t0"] or t > sh["t1"]:
            continue
        w = 1.0
        if i > 0:
            w *= smooth(sh["t0"], sh["t0"] + XF, t)
        if i < len(SHOTS) - 1:
            w *= 1 - smooth(sh["t1"] - XF, sh["t1"], t)
        if w > 0:
            acc += w * shot_frame(sh, t)
            ws += w
    x = acc / max(ws, 1e-6)
    x *= VIGNETTE
    g = cv2.resize(RNG.standard_normal((PH // 2, W // 2)).astype(np.float32), (W, PH))
    x += g[..., None] * 0.012
    x *= smooth(0.0, 0.9, t) * (1 - smooth(DUR - 1.2, DUR, t))
    return x


def frame(t):
    out = np.zeros((H, W, 3), np.float32)
    out[TOP:TOP + PH] = picture(t)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


def preview(outdir):
    from PIL import Image
    os.makedirs(outdir, exist_ok=True)
    ts = [0.6, 2.4, 2.5, 4.0, 6.2, 8.8, 11.0, 12.5, 14.0, 17.0]
    tiles = [cv2.resize(frame(t), (480, 270), interpolation=cv2.INTER_AREA) for t in ts]
    rows = [np.concatenate(tiles[i:i + 5], 1) for i in range(0, 10, 5)]
    Image.fromarray(np.concatenate(rows, 0)).save(os.path.join(outdir, "silvia_contact.jpg"), quality=88)


def render(out, wav):
    n = int(DUR * FPS)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", wav, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "slow", "-b:v", "16M", "-maxrate", "22M", "-bufsize", "30M",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-tune", "film", "-movflags", "+faststart",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "aac", "-b:a", "256k", "-shortest", out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        pr.stdin.write(frame(i / FPS).tobytes())
    pr.stdin.close()
    pr.wait()


if __name__ == "__main__":
    preview(sys.argv[2]) if sys.argv[1] == "preview" else render(sys.argv[2], sys.argv[3])
