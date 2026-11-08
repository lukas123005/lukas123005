"""
Video promocionale vertikale (1080x1920) për laptopin nga fotoja.

Përdorimi:
    python3 laptop_video.py FOTO.jpg            -> laptop_thinkpad.mp4
    python3 laptop_video.py FOTO.jpg --stills 5 10 ...   (kuadro provë)
"""
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# ------------------------------------------------------------ settings
TITLE_1 = "ThinkPad"
TITLE_2 = "X1 Yoga"
TAGLINE = "Performancë. Elegancë. Fleksibilitet."
OUTRO = "Gati për ty."
SPECS = [
    'Ekran 14" me prekje',
    "Intel Core i7 vPro",
    "Menteshë 360°",
    "Stilolaps aktiv",
    "Lexues gjurmësh gishtash",
    "Karikim USB‑C",
]

W, H = 1080, 1920
FPS = 30
DUR = 32.0
N = int(DUR * FPS)
SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "laptop_thinkpad.mp4")
WAV = os.path.join(HERE, "_laptop_audio.wav")

RED = (226, 35, 26)
WHITE = (242, 242, 240)
GREY = (160, 160, 168)
FD = "/usr/share/fonts/opentype/inter/"


def font(n, s):
    return ImageFont.truetype(FD + n, s)


F_BIG = font("InterDisplay-Bold.otf", 150)
F_BIG2 = font("InterDisplay-Light.otf", 120)
F_SMALL = font("Inter-SemiBold.otf", 26)
F_HEAD = font("InterDisplay-SemiBold.otf", 84)
F_SUB = font("InterDisplay-Light.otf", 42)
F_SPEC = font("InterDisplay-Medium.otf", 50)
F_TAG = font("InterDisplay-Light.otf", 50)

# Geometry measured on the source photo (1449x2576)
SCREEN_QUAD = [(283, 968), (976, 899), (1087, 1255), (369, 1411)]  # TL TR BR BL
LAPTOP_POLY = [(258, 936), (984, 846), (1104, 1300), (1449, 1585), (1449, 1610),
               (596, 1918), (388, 1492), (366, 1442)]
PAD = 600  # padding around the photo so Ken Burns crops never run out


# ------------------------------------------------------------ easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def eio(t):
    t = clamp(t)
    return 3 * t * t - 2 * t ** 3


def prog(t, s, d):
    return clamp((t - s) / d)


def fade(t, a, b, fi=0.5, fo=0.5):
    if t < a or t > b:
        return 0.0
    return min(eo((t - a) / fi), eo((b - t) / fo))


# ------------------------------------------------------------ music
def make_music():
    n = int(DUR * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    beat = 60 / 104
    seg = beat * 8

    def hz(m):
        return 440 * 2 ** ((m - 69) / 12)

    chords = [[50, 57, 60, 64, 69], [46, 53, 57, 62, 65], [43, 50, 55, 58, 62], [45, 52, 57, 61, 64]]
    for i in range(int(DUR / seg) + 1):
        s, e = i * seg, min((i + 1) * seg + 0.6, DUR)
        idx = (t >= s) & (t < e)
        tt = t[idx] - s
        env = np.minimum(1, tt / 0.9) * np.minimum(1, np.maximum(0, e - s - tt) / 0.6)
        sig = np.zeros(idx.sum())
        for m in chords[i % 4][1:]:
            for det in (-0.1, 0, 0.1):
                f = hz(m) * 2 ** (det / 12)
                for h in range(1, 4):
                    sig += np.sin(2 * np.pi * f * h * tt + h) / (h * 1.5)
        out[idx] += 0.016 * sig * env
        out[idx] += 0.17 * np.sin(2 * np.pi * hz(chords[i % 4][0] - 12) * tt) * env
        # plucked arpeggio
        for j in range(8):
            st = j * beat
            m = chords[i % 4][1 + (j * 2) % 4] + 12
            pi = (tt >= st)
            dt = tt[pi] - st
            out[np.where(idx)[0][pi]] += 0.05 * np.sin(2 * np.pi * hz(m) * dt) * np.exp(-dt * 5)

    rng = np.random.default_rng(5)
    kt = np.arange(0, 0.45, 1 / SR)
    kick = np.sin(2 * np.pi * (48 + 95 * np.exp(-kt * 26)) * kt) * np.exp(-kt * 7)
    ht = np.arange(0, 0.05, 1 / SR)
    hat = np.diff(rng.standard_normal(len(ht)) * np.exp(-ht * 80), prepend=0)
    ct = np.arange(0, 0.18, 1 / SR)
    clap = rng.standard_normal(len(ct)) * np.exp(-ct * 24)

    def add(x, at, g):
        i = int(at * SR)
        j = min(n, i + len(x))
        if i < n:
            out[i:j] += g * x[:j - i]

    tb, k = 3.0, 0
    while tb < DUR - 2.5:
        add(kick, tb, 0.55)
        add(hat, tb + beat / 2, 0.09)
        if k % 2:
            add(clap, tb, 0.09)
        tb += beat
        k += 1
    rt = np.arange(0, 1.6, 1 / SR)
    add(rng.standard_normal(len(rt)) * (rt / 1.6) ** 2 * 0.07, 26.4, 1)
    add(kick, 28.0, 0.9)

    d = int(0.21 * SR)
    L, R = out.copy(), out.copy()
    L[d:] += 0.3 * out[:-d]
    R[int(d * 1.35):] += 0.3 * out[:-int(d * 1.35)]
    st = np.tanh(np.stack([L, R], 1) * 1.4) / np.tanh(1.4)
    st *= (np.minimum(1, t / 0.8) * np.minimum(1, (DUR - t) / 2.2))[:, None] * 0.85
    with wave.open(WAV, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())


# ------------------------------------------------------------ photo prep
def perspective_coeffs(dst, src):
    """Coefficients for Image.transform: maps output (dst) points to input (src)."""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def screen_content(on, glow):
    """What the laptop displays (1280x800)."""
    sw, sh = 1280, 800
    yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
    r = np.sqrt(((xx - sw * 0.8) / sw) ** 2 + ((yy - sh * 0.95) / sh) ** 2)
    g = np.clip(1 - r * 1.5, 0, 1) ** 2 * (0.6 + 0.4 * glow)
    base = np.array([10, 10, 14], np.float32)
    img = base + np.array([150, 20, 16], np.float32) * g[..., None]
    r2 = np.sqrt(((xx - sw * 0.15) / sw) ** 2 + ((yy - sh * 0.05) / sh) ** 2)
    img += np.array([30, 30, 40], np.float32) * np.clip(1 - r2 * 2, 0, 1)[..., None]
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(im)
    d.text((sw / 2, sh / 2 - 40), TITLE_2, font=font("InterDisplay-Bold.otf", 150), fill=WHITE, anchor="mm")
    d.text((sw / 2, sh / 2 + 70), TITLE_1.upper(), font=font("Inter-SemiBold.otf", 34), fill=RED, anchor="mm")
    d.line([(sw / 2 - 90, sh / 2 + 115), (sw / 2 + 90, sh / 2 + 115)], fill=(255, 255, 255, 90), width=2)
    out = Image.new("RGB", (sw, sh), (4, 4, 6))
    return Image.blend(out, im.convert("RGB"), on)


class Photo:
    def __init__(self, path):
        src = Image.open(path).convert("RGB")
        # colour grade: a touch more contrast, slightly cooler and deeper
        g = ImageEnhance.Contrast(src).enhance(1.12)
        g = ImageEnhance.Color(g).enhance(0.92)
        arr = np.asarray(g).astype(np.float32)
        arr *= np.array([0.97, 0.99, 1.04])
        arr = 255 * (arr / 255) ** 1.08
        self.graded = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        self.size = src.size
        # laptop mask
        m = Image.new("L", src.size, 0)
        ImageDraw.Draw(m).polygon(LAPTOP_POLY, fill=255)
        self.mask = m.filter(ImageFilter.GaussianBlur(5))
        # dark, blurred surroundings
        bg = self.graded.resize((src.width // 8, src.height // 8)).filter(ImageFilter.GaussianBlur(6))
        bg = bg.resize(src.size, Image.BICUBIC)
        self.bg = ImageEnhance.Brightness(ImageEnhance.Color(bg).enhance(0.4)).enhance(0.22)
        # screen geometry
        sw, sh = 1280, 800
        self.coeffs = perspective_coeffs(SCREEN_QUAD, [(0, 0), (sw, 0), (sw, sh), (0, sh)])
        sm = Image.new("L", src.size, 0)
        ImageDraw.Draw(sm).polygon(SCREEN_QUAD, fill=255)
        self.smask = sm.filter(ImageFilter.GaussianBlur(1.2))
        xs = [p[0] for p in SCREEN_QUAD]
        ys = [p[1] for p in SCREEN_QUAD]
        self.sbox = (min(xs) - 4, min(ys) - 4, max(xs) + 4, max(ys) + 4)
        self.cache = {}

    def with_screen(self, base, on, glow):
        key = (id(base), round(on, 2), round(glow, 2))
        if key in self.cache:
            return self.cache[key]
        sc = screen_content(on, glow)
        warped = sc.transform(self.size, Image.PERSPECTIVE, self.coeffs, Image.BICUBIC)
        wcrop = warped.crop(self.sbox)
        out = base.copy()
        out.paste(wcrop, self.sbox[:2], self.smask.crop(self.sbox))
        if len(self.cache) > 40:
            self.cache.clear()
        self.cache[key] = out
        return out

    def hero(self, on, glow):
        lap = self.with_screen(self.graded, on, glow)
        return Image.composite(lap, self.bg, self.mask)

    def detail(self, on, glow):
        return self.with_screen(self.graded, on, glow)


def padded(img):
    p = Image.new("RGB", (img.width + 2 * PAD, img.height + 2 * PAD), (0, 0, 0))
    p.paste(img, (PAD, PAD))
    return p


# ------------------------------------------------------------ layout helpers
VIEW = (0, 300, 1080, 1380)  # where the photo shot sits on the 1080x1920 canvas
VW, VH = VIEW[2] - VIEW[0], VIEW[3] - VIEW[1]
_fm = Image.new("L", (VW, VH), 0)
_d = ImageDraw.Draw(_fm)
_d.rectangle([60, 60, VW - 60, VH - 60], fill=255)
VIEW_MASK = _fm.filter(ImageFilter.GaussianBlur(55))


def shot(src_padded, cx, cy, w):
    """Crop a VW:VH window centred at (cx, cy) in photo coords, width w."""
    h = w * VH / VW
    box = (cx - w / 2 + PAD, cy - h / 2 + PAD, cx + w / 2 + PAD, cy + h / 2 + PAD)
    return src_padded.resize((VW, VH), Image.BICUBIC, box=box)


def text(img, xy, s, f, col, a, anchor="mm", tracking=0, dy=0):
    if a <= 0.003:
        return
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x, y = xy[0], xy[1] + dy
    c = col + (int(255 * clamp(a)),)
    if not tracking:
        d.text((x, y), s, font=f, fill=c, anchor=anchor)
    else:
        ws = [d.textlength(ch, font=f) for ch in s]
        tot = sum(ws) + tracking * (len(s) - 1)
        cx = x - tot / 2 if anchor[0] == "m" else x
        for ch, w_ in zip(s, ws):
            d.text((cx, y), ch, font=f, fill=c, anchor="l" + anchor[1])
            cx += w_ + tracking
    img.alpha_composite(lay)


# Shots: (start, end, kind, (cx, cy, w) start, (cx, cy, w) end, headline, sub)
SHOTS = [
    (3.0, 9.0, "hero", (850, 1390, 1350), (850, 1370, 1180), None, None),
    (8.6, 12.0, "detail", (820, 1520, 640), (870, 1525, 500), "Tastierë legjendare", "Me TrackPoint të famshëm"),
    (11.6, 15.0, "detail", (690, 1820, 560), (688, 1828, 430), "Intel Core i7 vPro", "Fuqi për punë profesionale"),
    (14.6, 18.0, "detail", (1010, 1290, 700), (1050, 1320, 560), "Menteshë 360°", "Laptop, tablet, prezantim"),
    (17.6, 21.0, "detail", (360, 1400, 620), (345, 1460, 500), "Stilolaps aktiv", "Shkruaj e vizato në ekran"),
    (20.6, 24.0, "detail", (1150, 1540, 600), (1190, 1560, 480), "Lexues gjurmësh", "Hyrje e shpejtë dhe e sigurt"),
    (23.6, 32.0, "hero", (850, 1380, 1250), (850, 1390, 1400), None, None),
]


def render(t, ph, srcs):
    img = Image.new("RGBA", (W, H), (7, 7, 9, 255))
    on = eo(prog(t, 4.2, 1.2))
    glow = 0.5 + 0.5 * math.sin(t * 1.4)

    # ---- photo shots with crossfades
    for (s, e, kind, a, b, head, sub) in SHOTS:
        alpha = fade(t, s, e, 0.45, 0.45 if e < DUR else 1.4)
        if t > 30.6:
            alpha *= 1 - eo(prog(t, 30.6, 1.2))
        if alpha <= 0:
            continue
        p = eio(prog(t, s, e - s))
        cx, cy, w = (a[i] + (b[i] - a[i]) * p for i in range(3))
        base = srcs[(kind, round(on, 2), round(glow, 1))] if (kind, round(on, 2), round(glow, 1)) in srcs else None
        if base is None:
            pic = ph.hero(on, glow) if kind == "hero" else ph.detail(on, glow)
            base = padded(pic)
            srcs.clear() if len(srcs) > 6 else None
            srcs[(kind, round(on, 2), round(glow, 1))] = base
        frame = shot(base, cx, cy, w).convert("RGBA")
        m = VIEW_MASK.point(lambda v: int(v * alpha))
        frame.putalpha(m)
        img.alpha_composite(frame, (VIEW[0], VIEW[1]))
        if head:
            ta = fade(t, s + 0.35, e - 0.1, 0.6, 0.4)
            pp = eo(prog(t, s + 0.35, 0.8))
            text(img, (W / 2, 1480), head, F_HEAD, WHITE, ta, dy=30 * (1 - pp))
            text(img, (W / 2, 1572), sub, F_SUB, GREY, ta * eo(prog(t, s + 0.6, 0.6)), dy=20 * (1 - pp))
            d = ImageDraw.Draw(img)
            lw = 60 * pp
            d.line([(W / 2 - lw, 1640), (W / 2 + lw, 1640)], fill=RED + (int(255 * ta),), width=4)

    # ---- intro (0–3.3s)
    a = fade(t, 0.2, 3.3, 0.7, 0.5)
    if a:
        text(img, (W / 2, 790), "PREZANTOJMË", F_SMALL, RED, a * eo(prog(t, 0.5, 0.7)), tracking=12)
        tr = 30 - 26 * eo(prog(t, 0.4, 2.6))
        text(img, (W / 2, 920), TITLE_1, F_BIG, WHITE, a * eo(prog(t, 0.4, 0.8)), tracking=tr)
        text(img, (W / 2, 1060), TITLE_2, F_BIG2, WHITE, a * eo(prog(t, 0.8, 0.8)),
             dy=25 * (1 - eo(prog(t, 0.8, 0.9))))
        d = ImageDraw.Draw(img)
        lw = 200 * eo(prog(t, 1.0, 1.2))
        d.rectangle([W / 2 - lw, 1150, W / 2 + lw, 1153], fill=RED + (int(255 * a),))

    # ---- hero tagline
    a = fade(t, 5.0, 8.6, 0.8, 0.4)
    if a:
        text(img, (W / 2, 1500), TAGLINE, F_TAG, WHITE, a, dy=24 * (1 - eo(prog(t, 5.0, 1.0))))

    # ---- spec list (24–28.4s)
    a = fade(t, 24.2, 28.4, 0.4, 0.5)
    if a:
        text(img, (W / 2, 1440), "SPECIFIKIMET", F_SMALL, RED, a, tracking=10)
        cols = [(W * 0.27, 0), (W * 0.73, 1)]
        for i, s in enumerate(SPECS):
            p = eo(prog(t, 24.4 + i * 0.25, 0.6))
            col = i % 2
            row = i // 2
            x = cols[col][0]
            y = 1530 + row * 90
            text(img, (x, y), s, font("InterDisplay-Medium.otf", 38), WHITE, a * p, dy=16 * (1 - p))

    # ---- outro (28–32s)
    a = fade(t, 28.4, DUR, 0.8, 1.0)
    if a:
        text(img, (W / 2, 1490), f"{TITLE_1} {TITLE_2}", F_HEAD, WHITE, a, dy=24 * (1 - eo(prog(t, 28.4, 1))))
        d = ImageDraw.Draw(img)
        lw = 120 * eo(prog(t, 28.8, 1))
        d.rectangle([W / 2 - lw, 1560, W / 2 + lw, 1563], fill=RED + (int(255 * a),))
        text(img, (W / 2, 1625), OUTRO, F_SUB, GREY, a * eo(prog(t, 29.2, 0.8)))

    # ---- persistent brand bar
    a = fade(t, 3.4, 28.2, 0.8, 0.6)
    if a:
        text(img, (W / 2, 170), f"{TITLE_1.upper()}  ·  {TITLE_2.upper()}", F_SMALL, WHITE, a * 0.75, tracking=8)
        d = ImageDraw.Draw(img)
        d.rectangle([W / 2 - 18, 210, W / 2 + 18, 213], fill=RED + (int(255 * a),))
        # progress bar
        pr = clamp((t - 3.4) / (28.2 - 3.4))
        d.rectangle([90, 1800, W - 90, 1801], fill=(255, 255, 255, int(40 * a)))
        d.rectangle([90, 1799, 90 + (W - 180) * pr, 1802], fill=RED + (int(220 * a),))

    out = img.convert("RGB")
    g = min(eo(t / 0.5), eo((DUR - t) / 0.6))
    if g < 1:
        out = Image.blend(Image.new("RGB", (W, H)), out, g)
    return out


def main():
    photo = sys.argv[1]
    ph = Photo(photo)
    srcs = {}
    if len(sys.argv) > 2 and sys.argv[2] == "--stills":
        for ts in map(float, sys.argv[3:]):
            render(ts, ph, srcs).save(os.path.join(HERE, f"_lstill_{ts:05.1f}.png"))
        return
    print("Sintetizoj muzikën…")
    make_music()
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", WAV,
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        proc.stdin.write(render(f / FPS, ph, srcs).tobytes())
        if f % 60 == 0:
            print(f"  kuadri {f}/{N}", flush=True)
    proc.stdin.close()
    proc.wait()
    os.remove(WAV)
    print("Gati:", OUT)


if __name__ == "__main__":
    main()
