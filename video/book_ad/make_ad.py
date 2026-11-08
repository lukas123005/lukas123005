"""
THE AI MONEY PLAYBOOK — cinematic vertical commercial (2160x3840, 24 fps, 40 s).

Everything is rendered procedurally: a small perspective-projection engine
turns the *real* cover (page 1 of the PDF) into a 3D hardcover with studio
lighting; AI network, workstation and holographic interfaces are CGI built
from the same engine. Audio comes from audio.py.

Usage:
    python3 make_ad.py BOOK.pdf VOICE_MODEL_DIR [--stills t1 t2 ...] [--workers 4]
"""
import math
import os
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# ------------------------------------------------------------------ setup
S = 2                       # design space 1080x1920 -> 4K
W, H = 1080 * S, 1920 * S
FPS = 24
DUR = 40.0
NF = int(DUR * FPS)
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get("AD_WORK", os.path.join(HERE, "_work"))
OUT = os.path.join(HERE, "ai_money_playbook_ad_4k.mp4")
OUT_HD = os.path.join(HERE, "ai_money_playbook_ad_1080p.mp4")

BLUE = (46, 140, 255)
ICE = (150, 205, 255)
GOLD = (214, 176, 110)
GOLD_HI = (245, 215, 150)
SILVER = (196, 201, 210)
WHITE = (246, 246, 248)

FI = "/usr/share/fonts/opentype/inter/"
FC = "/usr/share/fonts/truetype/crosextra/"
FM = "/usr/share/fonts/truetype/jetbrains-mono/" if os.path.isdir("/usr/share/fonts/truetype/jetbrains-mono/") else None


@lru_cache(None)
def font(name, size):
    base = FC if name.startswith("Caladea") else FI
    return ImageFont.truetype(base + name, int(size))


def mono(size):
    import glob
    c = glob.glob("/usr/share/fonts/**/JetBrainsMono-Regular.ttf", recursive=True)
    return ImageFont.truetype(c[0], int(size)) if c else font("Inter-Regular.otf", size)


# ------------------------------------------------------------------ math
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ei(t):
    t = clamp(t)
    return t ** 3


def eio(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def eio5(t):  # smoother, "camera" easing
    t = clamp(t)
    return t ** 3 * (t * (6 * t - 15) + 10)


def prog(t, s, d):
    return clamp((t - s) / d)


def env(t, a, b, fi=0.5, fo=0.5):
    if t <= a or t >= b:
        return 0.0
    return min(eio((t - a) / fi) if fi > 0 else 1, eio((b - t) / fo) if fo > 0 else 1)


def lerp(a, b, p):
    return a + (b - a) * p


def rot(yaw=0.0, pitch=0.0, roll=0.0):
    y, p, r = map(math.radians, (yaw, pitch, roll))
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    Rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    return Rz @ Rx @ Ry


class Cam:
    def __init__(self, f, cx=W / 2, cy=H / 2):
        self.f, self.cx, self.cy = f, cx, cy

    def proj(self, P):
        P = np.atleast_2d(P)
        z = np.maximum(P[:, 2], 1e-3)
        return np.stack([self.cx + self.f * P[:, 0] / z, self.cy - self.f * P[:, 1] / z], 1)


def persp_coeffs(dst, src):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def warp_onto(layer, tex, quad, origin=(0, 0)):
    """Perspective-map RGBA texture `tex` (TL,TR,BR,BL) onto quad (screen coords) inside `layer`."""
    ox, oy = origin
    q = np.asarray(quad, float) - [ox, oy]
    x0, y0 = np.floor(q.min(0)).astype(int) - 1
    x1, y1 = np.ceil(q.max(0)).astype(int) + 1
    x0c, y0c = max(0, x0), max(0, y0)
    x1c, y1c = min(layer.width, x1), min(layer.height, y1)
    if x1c - x0c < 2 or y1c - y0c < 2:
        return
    tw, th = tex.size
    dst = [(px - x0c, py - y0c) for px, py in q]
    try:
        c = persp_coeffs(dst, [(0, 0), (tw, 0), (tw, th), (0, th)])
    except np.linalg.LinAlgError:
        return
    out = tex.transform((x1c - x0c, y1c - y0c), Image.PERSPECTIVE, c, Image.BICUBIC)
    layer.alpha_composite(out, (x0c, y0c))


# ------------------------------------------------------------------ compositing helpers
LUT_CACHE = {}


def alpha_lut(a):
    k = int(a * 255)
    if k not in LUT_CACHE:
        LUT_CACHE[k] = [int(v * k / 255) for v in range(256)]
    return LUT_CACHE[k]


def over(canvas, layer, pos=(0, 0), alpha=1.0):
    """Alpha-composite RGBA `layer` onto RGB `canvas`."""
    if alpha <= 0.002:
        return
    m = layer.getchannel("A")
    if alpha < 0.998:
        m = m.point(alpha_lut(alpha))
    canvas.paste(layer.convert("RGB"), (int(pos[0]), int(pos[1])), m)


def add(canvas, rgb, pos=(0, 0), gain=1.0):
    """Additive blend of an RGB light layer onto canvas."""
    if gain <= 0.002:
        return
    x, y = int(pos[0]), int(pos[1])
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(canvas.width, x + rgb.width), min(canvas.height, y + rgb.height)
    if x1 <= x0 or y1 <= y0:
        return
    src = rgb.crop((x0 - x, y0 - y, x1 - x, y1 - y))
    if gain < 0.998:
        src = src.point(alpha_lut(gain) * 3)
    reg = canvas.crop((x0, y0, x1, y1))
    canvas.paste(ImageChops.add(reg, src), (x0, y0))


def glow_of(layer, radius, gain=1.0, down=4):
    """Return an RGB glow image (same size as layer) for additive use."""
    w, h = layer.size
    sm = layer.resize((max(1, w // down), max(1, h // down)), Image.BILINEAR)
    bg = Image.new("RGB", sm.size, (0, 0, 0))
    bg.paste(sm.convert("RGB"), (0, 0), sm.getchannel("A"))
    bg = bg.filter(ImageFilter.GaussianBlur(radius / down))
    if gain != 1:
        bg = bg.point([min(255, int(v * gain)) for v in range(256)] * 3)
    return bg.resize((w, h), Image.BILINEAR)


def radial_sprite(size, color, power=2.0, sx=1.0, sy=1.0):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2) / sx) ** 2 + ((yy - h / 2) / (h / 2) / sy) ** 2)
    v = np.clip(1 - r, 0, 1) ** power
    return Image.fromarray((v[..., None] * np.array(color, np.float32)).clip(0, 255).astype(np.uint8))


# ------------------------------------------------------------------ typography
def grad_fill(size, top, bottom):
    w, h = size
    g = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    arr = np.array(top, np.float32) * (1 - g) + np.array(bottom, np.float32) * g
    return Image.fromarray(np.repeat(arr, w, 1).clip(0, 255).astype(np.uint8))


STYLES = {
    "silver": ((255, 255, 255), (170, 176, 188)),
    "white": (WHITE, WHITE),
    "gold": (GOLD_HI, (176, 136, 72)),
    "blue": ((170, 215, 255), BLUE),
    "grey": ((150, 154, 162), (150, 154, 162)),
}


@lru_cache(512)
def text_img(s, fname, size, style="silver", tracking=0.0):
    """Tight RGBA image of a single line of text with optional letter-spacing (em)."""
    f = font(fname, size)
    tr = tracking * size
    widths = [f.getlength(ch) for ch in s]
    total = sum(widths) + tr * (len(s) - 1)
    asc, desc = f.getmetrics()
    pad = int(size * 0.25)
    w, h = int(total + 2 * pad), int(asc + desc + 2 * pad)
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    x = pad
    for ch, cw in zip(s, widths):
        d.text((x, pad), ch, font=f, fill=255)
        x += cw + tr
    bb = m.getbbox() or (0, 0, 1, 1)
    m = m.crop((bb[0] - 2, 0, bb[2] + 2, h))
    top, bot = STYLES[style]
    fill = grad_fill(m.size, top, bot).convert("RGBA")
    fill.putalpha(m)
    return fill


def text_block(lines, gap=0.35):
    """lines: list of (text, font, size, style, tracking). Returns centred RGBA block."""
    imgs = [text_img(*ln) for ln in lines]
    sizes = [ln[2] for ln in lines]
    w = max(i.width for i in imgs)
    hs = [i.height for i in imgs]
    total = sum(hs) - sum(int(s * 0.25) for s in sizes[1:]) * 1 + int(sum(sizes[:-1]) * (gap - 0.25))
    out = Image.new("RGBA", (w, max(1, int(total + 4))), (0, 0, 0, 0))
    y = 0
    for k, im in enumerate(imgs):
        out.alpha_composite(im, ((w - im.width) // 2, int(y)))
        y += im.height - int(sizes[k] * 0.25) + int(sizes[k] * (gap - 0.25))
    return out


def show_text(canvas, img, cx, cy, t, t_in, t_out, fi=0.9, fo=0.6, rise=26, blur=10, align="c"):
    """Cinematic text entrance: blur-to-sharp, fade, gentle rise; mirrored exit."""
    a = env(t, t_in, t_out, fi, fo)
    if a <= 0.002:
        return
    p_in = eo(prog(t, t_in, fi * 1.3))
    p_out = eio(prog(t, t_out - fo, fo))
    dy = rise * S * (1 - p_in) - rise * 0.5 * S * p_out
    b = blur * S * ((1 - p_in) + p_out)
    im = img
    if b > 0.6:
        pad = int(b * 2)
        big = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
        big.alpha_composite(img, (pad, pad))
        im = big.filter(ImageFilter.GaussianBlur(b))
    x = cx - im.width / 2 if align == "c" else (cx if align == "l" else cx - im.width)
    over(canvas, im, (x, cy - im.height / 2 + dy), a)


# ------------------------------------------------------------------ assets
class Assets:
    def __init__(self, pdf):
        os.makedirs(WORK, exist_ok=True)
        png = os.path.join(WORK, "cover-1.png")
        if not os.path.exists(png):
            subprocess.run(["pdftoppm", "-r", "400", "-f", "1", "-l", "1", "-png", "-singlefile",
                            pdf, os.path.join(WORK, "cover-1")], check=True)
        cover = Image.open(png).convert("RGB")
        self.cover_full = cover
        # mip levels of the lit cover material
        self.levels = {}
        for hgt in (3300, 2400, 1700, 1200, 800, 420):
            w = int(round(hgt * cover.width / cover.height))
            im = cover.resize((w, hgt), Image.LANCZOS)
            arr = np.asarray(im).astype(np.float32) / 255
            # subtle matte-print grain
            rng = np.random.default_rng(hgt)
            arr = arr + rng.normal(0, 0.006, arr.shape[:2])[..., None]
            lum = arr.mean(2)
            goldish = np.clip((arr[..., 0] - arr[..., 2] - 0.08) * 5, 0, 1) * np.clip((lum - 0.15) * 4, 0, 1)
            white = np.clip((lum - 0.55) * 3, 0, 1)
            metal = np.clip(goldish + white, 0, 1)
            v = np.linspace(0, 1, hgt, dtype=np.float32)[:, None]
            u = np.linspace(0, 1, w, dtype=np.float32)[None, :]
            self.levels[hgt] = dict(base=arr.astype(np.float32), metal=metal.astype(np.float32), u=u, v=v)
        self.thumb = cover.resize((300, int(300 * cover.height / cover.width)), Image.LANCZOS)

        # side textures
        pw, ph = 80, 1200
        pages = np.ones((ph, pw, 3), np.float32) * np.array([226, 220, 206], np.float32)
        lines = (np.sin(np.arange(pw) * 2.9) * 0.5 + 0.5) * 18
        pages -= lines[None, :, None]
        pages[:, :4] = 25
        pages[:, -4:] = 25
        self.pages_side = Image.fromarray(pages.clip(0, 255).astype(np.uint8)).convert("RGBA")
        pages_top = np.ones((pw, 900, 3), np.float32) * np.array([226, 220, 206], np.float32)
        pages_top -= lines[:, None, None]
        pages_top[:4] = 25
        pages_top[-4:] = 25
        self.pages_top = Image.fromarray(pages_top.clip(0, 255).astype(np.uint8)).convert("RGBA")
        sp = Image.new("RGB", (pw, ph), (14, 14, 16))
        d = ImageDraw.Draw(sp)
        for y in (60, 70, ph - 70, ph - 60):
            d.line([(8, y), (pw - 8, y)], fill=(150, 120, 75), width=2)
        self.spine = sp.convert("RGBA")

        # background plates
        yy, xx = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
        xx /= W / 4
        yy /= H / 4
        vign = np.clip(1.25 - np.sqrt((xx - 0.5) ** 2 * 1.6 + (yy - 0.47) ** 2 * 0.9) * 1.6, 0, 1)
        self.vignette = Image.fromarray((vign ** 0.8 * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)

        def plate(c_center, c_edge, cy=0.45, spread=1.4):
            r = np.sqrt((xx - 0.5) ** 2 * 1.2 + (yy - cy) ** 2 * 0.7) * spread
            v = np.clip(1 - r, 0, 1) ** 2
            arr = np.array(c_edge, np.float32) + (np.array(c_center, np.float32) - np.array(c_edge, np.float32)) * v[..., None]
            return Image.fromarray(arr.clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)

        self.bg_void = plate((7, 9, 14), (2, 2, 3))
        self.bg_studio = plate((26, 26, 30), (3, 3, 4), 0.42, 1.25)
        self.bg_blue = plate((10, 22, 42), (2, 3, 6), 0.45, 1.3)
        # floor sheen for studio
        fl = np.zeros((H // 4, W // 4), np.float32)
        self.floor_cache = {}

        # light sprites
        self.spr_blue = radial_sprite((900 * S // 2, 900 * S // 2), (40, 110, 230), 2.2)
        self.spr_gold = radial_sprite((900 * S // 2, 900 * S // 2), (200, 150, 80), 2.2)
        self.spr_core = radial_sprite((260 * S // 2, 260 * S // 2), (170, 220, 255), 1.6)
        self.spr_dot = radial_sprite((24 * S, 24 * S), (170, 215, 255), 1.8)
        self.beam = self._beam()

        rng = np.random.default_rng(3)
        self.grain = [Image.fromarray(np.clip(8 + rng.normal(0, 2.4, (H // 2, W // 2)), 0, 255).astype(np.uint8))
                      .resize((W, H), Image.NEAREST).convert("RGB") for _ in range(6)]

        self._network()
        self.cards = [self._card(i) for i in range(7)]
        self.panels = [self._panel(i) for i in range(3)]
        self.kbd = self._keyboard()

    # --- volumetric beam (top spotlight)
    def _beam(self):
        w, h = 1000 * S // 2, 1900 * S // 2
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        u = (xx - w / 2) / (w / 2)
        v = yy / h
        width = 0.12 + 0.88 * v
        cone = np.clip(1 - np.abs(u) / width, 0, 1) ** 1.8
        fall = (1 - v) ** 0.6 * np.clip(v * 6, 0, 1)
        val = cone * fall
        col = np.array([1.0, 0.86, 0.62], np.float32)
        return Image.fromarray((val[..., None] * col * 120).clip(0, 255).astype(np.uint8)).resize((w * 2, h * 2),
                                                                                                    Image.BICUBIC)

    # --- AI network nodes
    def _network(self):
        rng = np.random.default_rng(42)
        n = 260
        P = rng.normal(0, 1, (n, 3)) * [1.25, 1.55, 1.25]
        r = np.linalg.norm(P / [1.25, 1.55, 1.25], axis=1)
        P = P[r < 2.6]
        r = r[r < 2.6]
        self.net_P = P
        self.net_t = 0.5 + 2.3 * (r / r.max()) ** 1.3 + rng.uniform(0, 0.35, len(P))
        D = np.linalg.norm(P[:, None] - P[None], axis=2)
        edges = set()
        for i in range(len(P)):
            for j in np.argsort(D[i])[1:4]:
                edges.add((min(i, j), max(i, j)))
        self.net_E = sorted(edges)
        self.net_phase = rng.random(len(self.net_E))
        self.dust = rng.uniform(-6, 6, (420, 3)) * [1, 1.6, 1] + [0, 0, 6]
        self.dust_a = rng.uniform(0.15, 0.7, len(self.dust))

    # --- holographic glass panel base
    def glass(self, w, h, label=None, accent=BLUE):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        g = np.zeros((h, w, 4), np.float32)
        yy = np.linspace(0, 1, h)[:, None]
        g[..., 0] = 14 + 10 * (1 - yy)
        g[..., 1] = 22 + 18 * (1 - yy)
        g[..., 2] = 38 + 34 * (1 - yy)
        g[..., 3] = 150
        base = Image.fromarray(g.astype(np.uint8), "RGBA")
        m = Image.new("L", (w, h), 0)
        r = int(min(w, h) * 0.05)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
        im.paste(base, (0, 0), m)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([1, 1, w - 2, h - 2], radius=r, outline=accent + (210,), width=max(2, w // 300))
        d.rounded_rectangle([8, 8, w - 9, h - 9], radius=r - 6, outline=(255, 255, 255, 28), width=1)
        # top sheen
        sheen = Image.new("L", (w, h), 0)
        ImageDraw.Draw(sheen).polygon([(0, 0), (w * 0.55, 0), (w * 0.25, h * 0.45), (0, h * 0.45)], fill=22)
        sheen = sheen.filter(ImageFilter.GaussianBlur(w // 25))
        white = Image.new("RGBA", (w, h), (255, 255, 255, 0))
        white.putalpha(ImageChops.multiply(sheen, m))
        im.alpha_composite(white)
        if label:
            f = font("Inter-SemiBold.otf", h * 0.034)
            d.text((w * 0.07, h * 0.06), label, font=f, fill=ICE + (230,))
            d.ellipse([w * 0.93 - h * 0.012, h * 0.075 - h * 0.012, w * 0.93 + h * 0.012, h * 0.075 + h * 0.012],
                      fill=BLUE + (255,))
        return im

    # --- topic cards for scene 4
    def _card(self, i):
        w, h = 1500, 1875
        im = self.glass(w, h)
        d = ImageDraw.Draw(im)
        k = w / 1200
        F = lambda n, s: font(n, s * k)  # noqa: E731
        titles = ["MASTER AI TOOLS", "WRITE POWERFUL PROMPTS", "CREATE DIGITAL PRODUCTS",
                  "SELL ON WHOP", "BUILD AN ONLINE BUSINESS", "BUILD YOUR PERSONAL BRAND",
                  "YOUR 30-DAY ACTION PLAN"]
        d.text((90 * k, 92 * k), f"0{i + 1}", font=F("Inter-Medium.otf", 30), fill=BLUE + (255,))
        d.text((90 * k, 140 * k), titles[i], font=F("InterDisplay-SemiBold.otf", 58 if len(titles[i]) < 20 else 50),
               fill=WHITE + (255,))
        d.line([(90 * k, 230 * k), (1110 * k, 230 * k)], fill=(255, 255, 255, 40), width=2)
        c0 = 300 * k
        if i == 0:  # tool grid with generic glyphs
            for gy in range(3):
                for gx in range(3):
                    x = 120 * k + gx * 330 * k
                    y = c0 + gy * 330 * k
                    d.rounded_rectangle([x, y, x + 290 * k, y + 290 * k], radius=40 * k, fill=(20, 34, 60, 230),
                                        outline=(90, 150, 230, 160), width=3)
                    cx, cy, r = x + 145 * k, y + 145 * k, 62 * k
                    g = gy * 3 + gx
                    col = ICE + (255,)
                    if g == 0:
                        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=int(6 * k))
                        d.ellipse([cx - 14 * k, cy - 14 * k, cx + 14 * k, cy + 14 * k], fill=col)
                    elif g == 1:
                        for j in range(4):
                            d.line([(cx - r, cy - r + j * 40 * k), (cx + r - j * 25 * k, cy - r + j * 40 * k)], fill=col, width=int(8 * k))
                    elif g == 2:
                        d.rectangle([cx - r, cy - r * 0.75, cx + r, cy + r * 0.75], outline=col, width=int(6 * k))
                        d.polygon([(cx - r * 0.7, cy + r * 0.6), (cx - r * 0.1, cy - r * 0.2), (cx + r * 0.6, cy + r * 0.6)], fill=col)
                    elif g == 3:
                        d.rounded_rectangle([cx - r, cy - r * 0.7, cx + r, cy + r * 0.7], radius=12 * k, outline=col, width=int(6 * k))
                        d.polygon([(cx - 20 * k, cy - 30 * k), (cx - 20 * k, cy + 30 * k), (cx + 30 * k, cy)], fill=col)
                    elif g == 4:
                        for j in range(7):
                            hh = [30, 60, 90, 50, 80, 40, 20][j] * k
                            xx_ = cx - r + j * 21 * k
                            d.line([(xx_, cy - hh / 2), (xx_, cy + hh / 2)], fill=col, width=int(9 * k))
                    elif g == 5:
                        pts = [(cx + r * math.cos(a) * (1 if j % 2 == 0 else 0.42), cy + r * math.sin(a) * (1 if j % 2 == 0 else 0.42))
                               for j, a in enumerate(np.linspace(-math.pi / 2, 1.5 * math.pi, 9)[:-1])]
                        d.polygon(pts, fill=col)
                    elif g == 6:
                        d.polygon([(cx, cy - r), (cx + r, cy - r * 0.4), (cx + r, cy + r * 0.5), (cx, cy + r), (cx - r, cy + r * 0.5), (cx - r, cy - r * 0.4)], outline=col, width=int(6 * k))
                    elif g == 7:
                        for j, hh in enumerate([0.4, 0.7, 0.55, 1.0]):
                            xx_ = cx - r + j * 36 * k
                            d.rectangle([xx_, cy + r - hh * 2 * r, xx_ + 24 * k, cy + r], fill=col)
                    else:
                        d.arc([cx - r, cy - r, cx + r, cy + r], 30, 330, fill=col, width=int(8 * k))
                        d.text((cx, cy), "AI", font=F("InterDisplay-SemiBold.otf", 50), fill=col, anchor="mm")
        elif i == 1:  # prompt box
            d.rounded_rectangle([110 * k, c0, 1090 * k, c0 + 640 * k], radius=34 * k, fill=(10, 16, 28, 235),
                                outline=(90, 150, 230, 170), width=3)
            d.text((160 * k, c0 + 60 * k), "PROMPT", font=F("Inter-SemiBold.otf", 28), fill=BLUE + (255,))
            txt = ["Act as an expert marketer.", "Write a launch plan for my", "first digital product, with", "clear steps for each week."]
            for j, ln in enumerate(txt):
                d.text((160 * k, c0 + (140 + j * 92) * k), ln, font=mono(44 * k), fill=WHITE + (255,))
            d.rectangle([160 * k + mono(44 * k).getlength(txt[-1]) + 10 * k, c0 + 418 * k, 160 * k + mono(44 * k).getlength(txt[-1]) + 34 * k, c0 + 470 * k], fill=BLUE + (255,))
            d.rounded_rectangle([640 * k, c0 + 720 * k, 1090 * k, c0 + 840 * k], radius=60 * k, fill=BLUE + (255,))
            d.text((865 * k, c0 + 780 * k), "Generate", font=F("Inter-SemiBold.otf", 44), fill=WHITE + (255,), anchor="mm")
            for j in range(4):
                d.rounded_rectangle([110 * k, c0 + (930 + j * 70) * k, (1090 - [0, 120, 260, 420][j]) * k, c0 + (960 + j * 70) * k],
                                    radius=14 * k, fill=(120, 150, 200, 70))
        elif i == 2:  # product mockups
            labels = ["E-BOOK", "TEMPLATE", "MINI COURSE"]
            for j in range(3):
                x = 110 * k + j * 335 * k
                y = c0 + 60 * k + (j % 2) * 80 * k
                d.rounded_rectangle([x, y, x + 300 * k, y + 420 * k], radius=22 * k, fill=(18, 26, 44, 240),
                                    outline=(220, 180, 110, 200) if j == 0 else (90, 150, 230, 170), width=3)
                if j == 0:
                    th = self_thumb = None  # noqa: F841
                d.rectangle([x + 30 * k, y + 40 * k, x + 270 * k, y + 220 * k], fill=(36, 60, 104, 255) if j else (30, 28, 26, 255))
                for q in range(3):
                    d.rounded_rectangle([x + 30 * k, y + (250 + q * 42) * k, x + (270 - q * 50) * k, y + (268 + q * 42) * k], radius=8 * k,
                                        fill=(160, 180, 220, 110))
                d.text((x + 150 * k, y + 480 * k), labels[j], font=F("Inter-SemiBold.otf", 32), fill=ICE + (255,), anchor="mm")
            d.rounded_rectangle([110 * k, c0 + 700 * k, 1090 * k, c0 + 760 * k], radius=30 * k, fill=(30, 44, 70, 255))
            d.rounded_rectangle([110 * k, c0 + 700 * k, 900 * k, c0 + 760 * k], radius=30 * k, fill=BLUE + (255,))
            d.text((110 * k, c0 + 800 * k), "Exporting to PDF…", font=F("Inter-Medium.otf", 36), fill=(180, 190, 210, 255))
        elif i == 3:  # store card on Whop
            d.rounded_rectangle([110 * k, c0, 1090 * k, c0 + 1150 * k], radius=36 * k, fill=(12, 16, 26, 245),
                                outline=(90, 150, 230, 160), width=3)
            d.text((160 * k, c0 + 50 * k), "Your store on Whop", font=F("Inter-SemiBold.otf", 38), fill=ICE + (255,))
            th = self.thumb.resize((int(330 * k), int(330 * k * self.thumb.height / self.thumb.width)), Image.LANCZOS)
            im.paste(th, (int(160 * k), int(c0 + 140 * k)))
            d.text((560 * k, c0 + 170 * k), "THE AI MONEY", font=font("Caladea-Regular.ttf", 52 * k), fill=WHITE + (255,))
            d.text((560 * k, c0 + 232 * k), "PLAYBOOK", font=font("Caladea-Regular.ttf", 52 * k), fill=WHITE + (255,))
            d.text((560 * k, c0 + 312 * k), "Digital book · PDF", font=F("Inter-Regular.otf", 32), fill=(170, 180, 200, 255))
            d.text((560 * k, c0 + 400 * k), "€9", font=font("Caladea-Regular.ttf", 96 * k), fill=GOLD_HI + (255,))
            d.rounded_rectangle([560 * k, c0 + 540 * k, 1040 * k, c0 + 640 * k], radius=50 * k, fill=BLUE + (255,))
            d.text((800 * k, c0 + 590 * k), "Get it now", font=F("Inter-SemiBold.otf", 40), fill=WHITE + (255,), anchor="mm")
            for j in range(3):
                d.rounded_rectangle([160 * k, c0 + (780 + j * 70) * k, (1040 - j * 160) * k, c0 + (808 + j * 70) * k], radius=14 * k,
                                    fill=(120, 150, 200, 60))
        elif i == 4:  # business workflow
            nodes = ["Idea", "Product", "Store", "Audience", "Customers"]
            for j, nm in enumerate(nodes):
                y = c0 + 40 * k + j * 250 * k
                x = 200 * k if j % 2 == 0 else 560 * k
                d.rounded_rectangle([x, y, x + 440 * k, y + 150 * k], radius=75 * k, fill=(16, 28, 52, 245),
                                    outline=BLUE + (220,), width=4)
                d.ellipse([x + 40 * k, y + 50 * k, x + 90 * k, y + 100 * k], fill=BLUE + (255,))
                d.text((x + 120 * k, y + 75 * k), nm, font=F("InterDisplay-Medium.otf", 54), fill=WHITE + (255,), anchor="lm")
                if j < len(nodes) - 1:
                    x2 = 560 * k if j % 2 == 0 else 200 * k
                    d.line([(x + 220 * k, y + 150 * k), (x2 + 220 * k, y + 250 * k)], fill=ICE + (180,), width=int(5 * k))
        elif i == 5:  # personal brand
            cx, cy = 600 * k, c0 + 190 * k
            d.ellipse([cx - 150 * k, cy - 150 * k, cx + 150 * k, cy + 150 * k], fill=(24, 40, 72, 255), outline=GOLD + (255,), width=int(6 * k))
            d.text((cx, cy), "LS", font=font("Caladea-Regular.ttf", 120 * k), fill=WHITE + (255,), anchor="mm")
            d.text((cx, cy + 230 * k), "Luka Shehu", font=F("InterDisplay-SemiBold.otf", 60), fill=WHITE + (255,), anchor="mm")
            d.text((cx, cy + 300 * k), "Creator Lab", font=font("Caladea-Italic.ttf", 44 * k), fill=GOLD_HI + (255,), anchor="mm")
            for j in range(6):
                x = 140 * k + (j % 3) * 315 * k
                y = c0 + 560 * k + (j // 3) * 315 * k
                arr = np.zeros((int(290 * k), int(290 * k), 3), np.uint8)
                gg = np.linspace(0, 1, arr.shape[0])[:, None]
                c1 = np.array([[30, 60, 120], [60, 40, 20], [20, 30, 50], [80, 60, 30], [20, 70, 140], [40, 40, 60]][j])
                arr[:] = (c1 * (0.6 + 0.6 * gg[..., None]) + 10).clip(0, 255).astype(np.uint8)[:, :]
                tile = Image.fromarray(arr)
                mm = Image.new("L", tile.size, 0)
                ImageDraw.Draw(mm).rounded_rectangle([0, 0, tile.width - 1, tile.height - 1], radius=int(26 * k), fill=255)
                im.paste(tile, (int(x), int(y)), mm)
                d.polygon([(x + 120 * k, y + 105 * k), (x + 120 * k, y + 185 * k), (x + 185 * k, y + 145 * k)], fill=(255, 255, 255, 200))
        elif i == 6:  # 30-day plan calendar (checks animate at render time)
            self.cal_origin = (150 * k, c0 + 40 * k, 180 * k)
            for j in range(30):
                x = 150 * k + (j % 5) * 180 * k
                y = c0 + 40 * k + (j // 5) * 180 * k
                d.rounded_rectangle([x, y, x + 150 * k, y + 150 * k], radius=26 * k, fill=(16, 26, 46, 240),
                                    outline=(90, 150, 230, 120), width=3)
                d.text((x + 22 * k, y + 18 * k), str(j + 1), font=F("Inter-Medium.otf", 32), fill=(170, 190, 220, 255))
        return im

    def _panel(self, i):
        if i == 0:
            w, h = 1300, 900
            im = self.glass(w, h, "WORKFLOW")
            d = ImageDraw.Draw(im)
            names = ["Idea", "Prompt", "Product", "Launch"]
            for j, nm in enumerate(names):
                x = 90 + j * 290
                y = 380 + (j % 2) * 140
                d.rounded_rectangle([x, y, x + 240, y + 110], radius=55, fill=(18, 32, 60, 240), outline=BLUE + (230,), width=4)
                d.text((x + 120, y + 55), nm, font=font("InterDisplay-Medium.otf", 44), fill=WHITE + (255,), anchor="mm")
                if j < 3:
                    y2 = 380 + ((j + 1) % 2) * 140
                    d.line([(x + 240, y + 55), (x + 290, y2 + 55)], fill=ICE + (200,), width=5)
            return im
        if i == 1:
            w, h = 1000, 1300
            im = self.glass(w, h, "DIGITAL PRODUCT")
            d = ImageDraw.Draw(im)
            th = self.thumb.resize((420, int(420 * self.thumb.height / self.thumb.width)), Image.LANCZOS)
            im.paste(th, (290, 170))
            d.rounded_rectangle([90, 1000, 910, 1050], radius=25, fill=(30, 44, 70, 255))
            d.rounded_rectangle([90, 1000, 910, 1050], radius=25, fill=BLUE + (255,))
            d.text((90, 1090), "Ready to publish", font=font("Inter-Medium.otf", 44), fill=(190, 200, 220, 255))
            return im
        w, h = 1500, 560
        im = self.glass(w, h, "AI ASSISTANT")
        d = ImageDraw.Draw(im)
        d.text((90, 210), "› Generate a product outline", font=mono(56), fill=WHITE + (255,))
        for j in range(3):
            d.rounded_rectangle([90, 330 + j * 60, 1410 - j * 260, 360 + j * 60], radius=15, fill=(120, 160, 220, 90))
        return im

    def _keyboard(self):
        w, h = 1500, 1000
        im = Image.new("RGBA", (w, h), (40, 41, 46, 255))
        arr = np.asarray(im).astype(np.float32)
        g = np.linspace(1.12, 0.85, h)[:, None, None]
        arr[..., :3] *= g
        im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA")
        d = ImageDraw.Draw(im)
        kx0, ky0 = 120, 70
        kw = (w - 240) / 14
        for r in range(5):
            for c in range(14):
                x = kx0 + c * kw
                y = ky0 + r * 86
                d.rounded_rectangle([x + 5, y + 5, x + kw - 5, y + 78], radius=10, fill=(16, 16, 19, 255))
        d.rounded_rectangle([kx0 + 2 * kw, ky0 + 5 * 86 + 6, kx0 + 11 * kw, ky0 + 5 * 86 + 80], radius=10, fill=(16, 16, 19, 255))
        d.rounded_rectangle([w / 2 - 300, 620, w / 2 + 300, 960], radius=24, fill=(48, 49, 55, 255), outline=(70, 72, 80, 255), width=3)
        return im


A = None  # global assets (per process)


# ------------------------------------------------------------------ book engine
def cover_texture(level_h, light):
    """Lit cover texture for this frame. light: dict(band, angle, width, blue, gold, title, exposure)."""
    L = A.levels[level_h]
    base, metal, u, v = L["base"], L["metal"], L["u"], L["v"]
    ang = light.get("angle", 0.6)
    d = (u * math.cos(ang) + v * math.sin(ang)) - light.get("band", 0.5)
    spec = np.exp(-(d / light.get("width", 0.16)) ** 2)
    mix = np.clip(u * 1.2 - 0.1, 0, 1)
    col_b = np.array(BLUE, np.float32) / 255
    col_g = np.array(GOLD_HI, np.float32) / 255
    color = (col_b[None, None] * (1 - mix[..., None]) * light.get("blue", 0.6)
             + col_g[None, None] * mix[..., None] * light.get("gold", 0.6))
    shine = spec[..., None] * color * (0.05 + 0.95 * metal[..., None])
    out = base * light.get("exposure", 1.0) * (0.88 + 0.12 * (1 - v))[..., None] + shine * light.get("spec", 1.0)
    tl = light.get("title", 0.0)
    if tl > 0:
        g = np.exp(-((v - 0.72) / 0.11) ** 2) * np.exp(-((u - 0.5) / 0.55) ** 2)
        out = out + (g * metal * tl)[..., None] * (np.array(GOLD_HI, np.float32) / 255) * 0.55 \
            + (g * tl * 0.035)[..., None] * (np.array(GOLD, np.float32) / 255)
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).convert("RGBA")
    return img


def shade_tex(tex, k):
    if abs(k - 1) < 0.01:
        return tex
    lut = [min(255, int(v * k)) for v in range(256)]
    r, g, b, a = tex.split()
    return Image.merge("RGBA", (r.point(lut), g.point(lut), b.point(lut), a))


BOOK_W, BOOK_H, BOOK_T = 1.0, 1.0 * 1169 / 827, 0.085


def book_faces(R, C):
    w, h, t = BOOK_W / 2, BOOK_H / 2, BOOK_T / 2
    raw = {
        "front": ([(-w, h, -t), (w, h, -t), (w, -h, -t), (-w, -h, -t)], (0, 0, -1)),
        "spine": ([(-w, h, t), (-w, h, -t), (-w, -h, -t), (-w, -h, t)], (-1, 0, 0)),
        "pages": ([(w * 0.985, h * 0.985, -t * 0.9), (w * 0.985, h * 0.985, t * 0.9), (w * 0.985, -h * 0.985, t * 0.9),
                   (w * 0.985, -h * 0.985, -t * 0.9)], (1, 0, 0)),
        "top": ([(-w, h * 0.985, t * 0.9), (w * 0.985, h * 0.985, t * 0.9), (w * 0.985, h * 0.985, -t * 0.9),
                 (-w, h * 0.985, -t * 0.9)], (0, 1, 0)),
        "bottom": ([(-w, -h * 0.985, -t * 0.9), (w * 0.985, -h * 0.985, -t * 0.9), (w * 0.985, -h * 0.985, t * 0.9),
                    (-w, -h * 0.985, t * 0.9)], (0, -1, 0)),
    }
    out = []
    for name, (pts, n) in raw.items():
        P = (R @ np.array(pts, float).T).T + C
        nn = R @ np.array(n, float)
        if np.dot(nn, P.mean(0)) < 0:
            out.append((name, P, nn))
    out.sort(key=lambda f: -f[1][:, 2].mean())
    return out


def render_book(canvas, cam, yaw, pitch, C, light, alpha=1.0, reflect=0.22, rim=0.6, roll=0.0, floor_glow=None):
    R = rot(yaw, pitch, roll)
    C = np.array(C, float)
    faces = book_faces(R, C)
    allpts = np.concatenate([cam.proj(f[1]) for f in faces])
    x0, y0 = np.floor(allpts.min(0)).astype(int) - 6
    x1, y1 = np.ceil(allpts.max(0)).astype(int) + 6
    lw, lh = x1 - x0, y1 - y0
    if lw < 4 or lh < 4:
        return None
    layer = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    ldir = np.array([0.5, 0.6, -0.6])
    ldir /= np.linalg.norm(ldir)
    front_q = None
    for name, P, nn in faces:
        q = cam.proj(P)
        if name == "front":
            hpx = np.linalg.norm(q[0] - q[3])
            lv = min((lv for lv in A.levels if lv >= hpx * 1.05), default=max(A.levels))
            tex = cover_texture(lv, light)
            front_q = q
        else:
            k = 0.35 + 0.65 * max(0, float(np.dot(nn, ldir)))
            tex = {"spine": A.spine, "pages": A.pages_side, "top": A.pages_top, "bottom": A.pages_top}[name]
            tex = shade_tex(tex, k * light.get("exposure", 1.0))
        warp_onto(layer, tex, q, (x0, y0))
    if front_q is not None and rim > 0:
        d = ImageDraw.Draw(layer)
        q = front_q - [x0, y0]
        e = light.get("exposure", 1.0)
        d.line([tuple(q[0]), tuple(q[3])], fill=ICE + (int(120 * rim * e),), width=S * 2)
        d.line([tuple(q[0]), tuple(q[1])], fill=(255, 255, 255, int(70 * rim * e)), width=S)
        d.line([tuple(q[1]), tuple(q[2])], fill=GOLD_HI + (int(110 * rim * e),), width=S * 2)
    # reflection on glossy floor
    if reflect > 0:
        bottom_y = allpts[:, 1].max()
        ref = layer.transpose(Image.FLIP_TOP_BOTTOM)
        fade = Image.linear_gradient("L").resize(ref.size)
        fade = fade.point([int(255 * (1 - v / 255) ** 2.2 * reflect) for v in range(256)])
        fade = fade.transpose(Image.FLIP_TOP_BOTTOM).transpose(Image.FLIP_TOP_BOTTOM)
        a = ImageChops.multiply(ref.getchannel("A"), fade)
        ref.putalpha(a)
        ref = ref.resize((ref.width // 2, ref.height // 2)).filter(ImageFilter.GaussianBlur(2)).resize(ref.size)
        over(canvas, ref, (x0, 2 * bottom_y - y1 + 2 * S), alpha)
    over(canvas, layer, (x0, y0), alpha)
    return (x0, y0, x1, y1), layer


# ------------------------------------------------------------------ generic 3D quads (panels, laptop)
def draw_quads(canvas, cam, quads, alpha=1.0, glow=0.0):
    """quads: list of (P(4x3), tex RGBA, opacity). Sorted back-to-front."""
    quads = sorted(quads, key=lambda q: -q[0][:, 2].mean())
    for P, tex, op in quads:
        if op <= 0.003 or (P[:, 2] < 0.3).any():
            continue
        q = cam.proj(P)
        x0, y0 = np.floor(q.min(0)).astype(int) - 2
        x1, y1 = np.ceil(q.max(0)).astype(int) + 2
        x0, y0 = max(x0, -W), max(y0, -H)
        x1, y1 = min(x1, 2 * W), min(y1, 2 * H)
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        warp_onto(lay, tex, q, (x0, y0))
        if glow > 0:
            add(canvas, glow_of(lay, 40 * S, 1.0), (x0, y0), glow * op * alpha)
        over(canvas, lay, (x0, y0), op * alpha)


def quad_at(center, w, h, R):
    c = np.array(center, float)
    pts = np.array([(-w / 2, h / 2, 0), (w / 2, h / 2, 0), (w / 2, -h / 2, 0), (-w / 2, -h / 2, 0)], float)
    return (R @ pts.T).T + c


# ------------------------------------------------------------------ scenes
def scene1(canvas, t):
    """THE FUTURE — AI network forms in darkness, camera pushes in."""
    a_scene = env(t, 0.0, 5.55, 0.01, 0.55)
    if a_scene <= 0:
        return
    cam = Cam(0.9 * H, W / 2, H * 0.43)
    push = eio5(prog(t, 0.0, 5.6))
    fly = ei(prog(t, 4.5, 1.1))
    cz = 7.8 - 2.4 * push - 3.6 * fly
    yaw = 0.18 * t
    R = rot(math.degrees(yaw) * 0.6, 8 - 3 * push)
    P = (R @ A.net_P.T).T + [0, 0, cz]
    vis = P[:, 2] > 0.25
    sp = cam.proj(P)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    # dust
    Dp = A.dust.copy()
    Dp[:, 2] -= 2.4 * push + 3.6 * fly
    Dp[:, 1] += 0.05 * t
    dvis = Dp[:, 2] > 0.3
    ds = cam.proj(Dp)
    fa = eio(prog(t, 0.2, 2.0))
    for (x, y), z, a, v in zip(ds, Dp[:, 2], A.dust_a, dvis):
        if not v or x < 0 or x > W or y < 0 or y > H:
            continue
        r = max(1, 3.2 * S / z)
        d.ellipse([x - r, y - r, x + r, y + r], fill=ICE + (int(140 * a * fa * min(1, 6 / z)),))
    # edges
    for (i, j), ph in zip(A.net_E, A.net_phase):
        if not (vis[i] and vis[j]):
            continue
        ts = max(A.net_t[i], A.net_t[j]) + 0.1
        p = eo(prog(t, ts, 0.5))
        if p <= 0:
            continue
        z = (P[i, 2] + P[j, 2]) / 2
        depth = clamp(1.6 - z / 7.5, 0.25, 1)
        x1_, y1_ = sp[i]
        x2_, y2_ = sp[i] + (sp[j] - sp[i]) * p
        d.line([(x1_, y1_), (x2_, y2_)], fill=(70, 150, 255, int(150 * depth)), width=max(1, int(1.6 * S * depth)))
        if p >= 1:
            k = (t * 0.45 + ph) % 1.0
            if k < 0.35:
                kk = k / 0.35
                px, py = sp[i] + (sp[j] - sp[i]) * kk
                r = 2.2 * S * depth
                d.ellipse([px - r, py - r, px + r, py + r], fill=(220, 240, 255, int(255 * depth)))
    # nodes
    for k in np.argsort(-P[:, 2]):
        if not vis[k]:
            continue
        p = eo(prog(t, A.net_t[k], 0.5))
        if p <= 0:
            continue
        z = P[k, 2]
        depth = clamp(1.7 - z / 7.0, 0.3, 1.2)
        r = (2.0 + 6.0 * depth) * S * (0.4 + 0.6 * p) * (6.0 / max(z, 1.0)) ** 0.5
        x, y = sp[k]
        d.ellipse([x - r, y - r, x + r, y + r], fill=(160, 210, 255, int(255 * p * min(1, depth))))
        d.ellipse([x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45], fill=(255, 255, 255, int(255 * p)))
    g = glow_of(lay, 26 * S, 2.2, 8)
    canvas_bg = A.bg_void
    canvas.paste(canvas_bg)
    core = A.spr_core.resize((A.spr_core.width * 4, A.spr_core.height * 4))
    cpos = cam.proj(np.array([[0, 0, cz]]))[0]
    add(canvas, core, (cpos[0] - core.width / 2, cpos[1] - core.height / 2), 0.55 * eio(prog(t, 1.0, 3.0)) * a_scene)
    add(canvas, g, (0, 0), a_scene)
    over(canvas, lay, (0, 0), a_scene)

    txt = text_block([("THE WORLD IS CHANGING.", "InterDisplay-Medium.otf", 50 * S, "silver", 0.14)])
    show_text(canvas, txt, W / 2, H * 0.745, t, 2.3, 5.2, fi=1.1, fo=0.5)


def laptop_quads(R, C, screen_tex):
    """Laptop as textured quads: base top, base front, lid (screen)."""
    bw, bd, bt = 3.0, 2.05, 0.09
    lid_h = 2.0
    ang = math.radians(108)
    up = np.array([0, math.sin(ang), -math.cos(ang)])  # tilted back
    q = []

    def T(pts):
        return (R @ np.array(pts, float).T).T + C

    base_top = T([(-bw / 2, 0, bd / 2), (bw / 2, 0, bd / 2), (bw / 2, 0, -bd / 2), (-bw / 2, 0, -bd / 2)])
    base_front = T([(-bw / 2, 0, -bd / 2), (bw / 2, 0, -bd / 2), (bw / 2, -bt, -bd / 2), (-bw / 2, -bt, -bd / 2)])
    hinge_l = np.array([-bw / 2, 0, bd / 2])
    hinge_r = np.array([bw / 2, 0, bd / 2])
    lid = T([hinge_l + up * lid_h, hinge_r + up * lid_h, hinge_r, hinge_l])
    q.append((base_top, A.kbd, 1.0))
    q.append((base_front, Image.new("RGBA", (16, 4), (70, 72, 80, 255)), 1.0))
    q.append((lid, screen_tex, 1.0))
    return q


def screen_ui(t):
    w, h = 1600, 1066
    im = Image.new("RGBA", (w, h), (8, 8, 10, 255))
    d = ImageDraw.Draw(im)
    m = 34
    d.rectangle([m, m, w - m, h - m], fill=(11, 14, 22, 255))
    d.rectangle([m, m, m + 300, h - m], fill=(15, 19, 30, 255))
    for j in range(6):
        d.rounded_rectangle([m + 30, m + 120 + j * 70, m + 270, m + 150 + j * 70], radius=12,
                            fill=(40, 60, 100, 255) if j == 0 else (28, 34, 50, 255))
    d.text((m + 30, m + 50), "AI Workspace", font=font("Inter-SemiBold.otf", 32), fill=ICE + (255,))
    prompt = "Create a 30-day plan to launch my first digital product."
    n = int(len(prompt) * eio(prog(t, 5.9, 2.2)))
    d.rounded_rectangle([m + 360, m + 60, w - m - 40, m + 200], radius=26, fill=(30, 52, 96, 255))
    f = font("Inter-Medium.otf", 34)
    words = prompt[:n]
    cut = prompt.rfind(" ", 0, 34)
    line1 = words[:cut]
    line2 = words[cut + 1:] if n > cut else ""
    d.text((m + 400, m + 92), line1, font=f, fill=WHITE + (255,))
    d.text((m + 400, m + 140), line2, font=f, fill=WHITE + (255,))
    if n < len(prompt) and int(t * 3) % 2 == 0:
        cx = m + 400 + f.getlength(line2 if line2 else line1)
        cy = m + 140 if line2 else m + 92
        d.rectangle([cx + 4, cy, cx + 8, cy + 38], fill=WHITE + (255,))
    steps = ["Week 1 — Choose your niche and idea", "Week 2 — Build the product with AI",
             "Week 3 — Set up your store", "Week 4 — Launch and share your story"]
    for j, s in enumerate(steps):
        a = eo(prog(t, 8.3 + j * 0.35, 0.4))
        if a <= 0:
            continue
        y = m + 260 + j * 150
        d.rounded_rectangle([m + 360, y, w - m - 40, y + 120], radius=22, fill=(18, 24, 38, int(255 * a)),
                            outline=(60, 110, 200, int(200 * a)), width=2)
        d.ellipse([m + 395, y + 42, m + 431, y + 78], fill=BLUE + (int(255 * a),))
        d.text((m + 460, y + 60), s, font=font("Inter-Medium.otf", 36), fill=WHITE + (int(255 * a),), anchor="lm")
    # light glare
    return im


def scene2(canvas, t):
    """THE OPPORTUNITY — modern AI workstation with holographic interfaces."""
    a_s = env(t, 5.0, 11.05, 0.55, 0.35)
    if a_s <= 0:
        return
    canvas.paste(Image.blend(canvas, A.bg_blue, a_s))
    p = eio5(prog(t, 5.0, 6.2))
    cam = Cam(1.0 * H, W / 2, H * 0.50)
    yaw = lerp(-24, 14, p)
    pitch = lerp(-24, -17, p)
    dist = lerp(9.6, 7.9, p)
    R = rot(yaw, pitch)
    C = np.array([0.0, -0.9, dist])
    # soft light behind
    add(canvas, A.spr_blue.resize((A.spr_blue.width * 3, A.spr_blue.height * 3)),
        (W / 2 - A.spr_blue.width * 1.5, H * 0.42 - A.spr_blue.height * 1.5), 0.55 * a_s)
    quads = laptop_quads(R, C, screen_ui(t))
    # laptop layer + reflection
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for P, tex, op in sorted(quads, key=lambda q: -q[0][:, 2].mean()):
        warp_onto(lay, tex, cam.proj(P))
    bb = lay.getbbox()
    if bb:
        crop = lay.crop(bb)
        ref = crop.transpose(Image.FLIP_TOP_BOTTOM)
        fade = Image.linear_gradient("L").resize(ref.size).point([int((1 - v / 255) ** 2 * 60) for v in range(256)])
        ref.putalpha(ImageChops.multiply(ref.getchannel("A"), fade))
        over(canvas, ref, (bb[0], bb[3] - 4 * S), a_s)
        # screen glow
        add(canvas, glow_of(crop, 60 * S, 0.9, 8), (bb[0], bb[1]), 0.6 * a_s)
        over(canvas, crop, (bb[0], bb[1]), a_s)
    # holographic panels floating above
    bob = lambda k: 0.06 * math.sin(t * 1.3 + k)  # noqa: E731
    panels = []
    specs = [(0, (-1.4, 2.45, -0.4), 1.6, 1.11, 24, 6.0),
             (1, (1.45, 2.3, 0.0), 1.1, 1.43, -24, 6.6),
             (2, (0.05, 3.45, 0.9), 2.1, 0.79, 0, 7.2)]
    for k, (cx, cy, cz), pw, ph, py, ts in specs:
        op = eo(prog(t, ts, 0.8)) * a_s
        rise = (1 - eo(prog(t, ts, 1.0))) * -0.35
        Rl = rot(yaw + py, pitch * 0.4)
        center = R @ np.array([cx, cy + bob(k) + rise, cz]) + C
        panels.append((quad_at(center, pw, ph, Rl), A.panels[k], op * 0.95))
    draw_quads(canvas, cam, panels, 1.0, glow=0.35)

    txt = text_block([("THE BIGGEST OPPORTUNITY", "InterDisplay-Medium.otf", 52 * S, "silver", 0.10),
                      ("IS LEARNING HOW TO USE AI.", "InterDisplay-Medium.otf", 52 * S, "blue", 0.10)], gap=0.5)
    show_text(canvas, txt, W / 2, H * 0.835, t, 6.4, 10.9, fi=1.0, fo=0.45)


def scene3(canvas, t):
    """THE BOOK REVEAL."""
    a_s = env(t, 11.0, 19.1, 0.05, 0.35)
    if a_s <= 0:
        return
    canvas.paste(Image.blend(canvas, A.bg_studio, a_s * 0.75))
    p = eio5(prog(t, 11.1, 8.0))
    expo = eio(prog(t, 11.15, 1.6))
    cam = Cam(1.55 * H, W / 2, H * 0.44)
    yaw = lerp(-62, 18, p)
    pitch = lerp(-13, -6, p)
    dist = lerp(8.4, 6.0, p)
    roll = lerp(-4, 1.5, p)
    # beams + rim lights
    add(canvas, A.beam, (W / 2 - A.beam.width / 2, -H * 0.06), 0.55 * expo * a_s)
    sb = A.spr_blue.resize((A.spr_blue.width * 3, A.spr_blue.height * 3))
    add(canvas, sb, (W * 0.12 - sb.width / 2, H * 0.40 - sb.height / 2), 0.55 * expo * a_s)
    sg = A.spr_gold.resize((A.spr_gold.width * 3, A.spr_gold.height * 3))
    add(canvas, sg, (W * 0.90 - sg.width / 2, H * 0.48 - sg.height / 2), 0.45 * expo * a_s)
    light = dict(band=lerp(-0.4, 1.5, prog(t, 11.4, 6.5)), angle=0.75, width=0.2,
                 blue=0.9, gold=0.9, exposure=0.15 + 0.85 * expo, spec=1.2 * expo, title=0.25 * expo)
    render_book(canvas, cam, yaw, pitch, (0, 0.05, dist), light, a_s, reflect=0.2 * expo, rim=expo, roll=roll)
    # anamorphic flare at the impact
    fl = env(t, 11.1, 12.6, 0.12, 1.2)
    if fl > 0:
        streak = radial_sprite((1400 * S // 2, 40 * S // 2), (90, 160, 255), 1.5).resize((1400 * S, 40 * S))
        add(canvas, streak, (W / 2 - 700 * S, H * 0.44 - 20 * S), fl * 0.9)
    txt = text_block([("ONE PLAYBOOK.", "Caladea-Regular.ttf", 92 * S, "silver", 0.04),
                      ("A WORLD OF POSSIBILITIES.", "InterDisplay-Medium.otf", 42 * S, "gold", 0.22)], gap=0.7)
    show_text(canvas, txt, W / 2, H * 0.86, t, 14.9, 18.95, fi=1.1, fo=0.4)


CARD_T = [19.0, 20.5, 22.4, 23.9, 25.3, 26.6, 27.8, 29.0]


def grid_floor(canvas, t, a):
    lay = Image.new("RGBA", (W, H // 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cam = Cam(1.0 * H, W / 2, -H * 0.02)
    y_floor = -2.6
    off = (t * 1.6) % 1.0
    for k in range(0, 26):
        z = 3 + k - off
        a1 = cam.proj(np.array([[-12, y_floor, z]]))[0]
        a2 = cam.proj(np.array([[12, y_floor, z]]))[0]
        al = int(80 * clamp(1 - z / 26) * a)
        d.line([tuple(a1), tuple(a2)], fill=(60, 130, 255, al), width=S)
    for xg in np.arange(-12, 12.1, 1.0):
        a1 = cam.proj(np.array([[xg, y_floor, 2.5]]))[0]
        a2 = cam.proj(np.array([[xg, y_floor, 30]]))[0]
        d.line([tuple(a1), tuple(a2)], fill=(60, 130, 255, int(55 * a)), width=S)
    add(canvas, glow_of(lay, 14 * S, 1.6, 4), (0, H // 2), 0.8)
    over(canvas, lay, (0, H // 2))


def scene4(canvas, t):
    """WHAT YOU WILL LEARN — holographic topic cards."""
    a_s = env(t, 18.85, 29.15, 0.3, 0.25)
    if a_s <= 0:
        return
    canvas.paste(Image.blend(canvas, A.bg_blue, a_s))
    grid_floor(canvas, t, a_s)
    sb = A.spr_blue.resize((A.spr_blue.width * 3, A.spr_blue.height * 3))
    add(canvas, sb, (W / 2 - sb.width / 2, H * 0.42 - sb.height / 2), 0.5 * a_s)
    cam = Cam(1.05 * H, W / 2, H * 0.44)
    quads = []
    for i in range(7):
        s, e = CARD_T[i], CARD_T[i + 1]
        if t < s - 0.3 or t > e + 0.3:
            continue
        u_in = eo(prog(t, s - 0.3, 0.55))
        u_out = ei(prog(t, e - 0.25, 0.55))
        hold = prog(t, s, e - s)
        x = 4.2 * (1 - u_in) - 4.6 * u_out
        z = 7.0 + 1.2 * (1 - u_in) + 1.5 * u_out - 0.35 * hold
        yaw = -38 * (1 - u_in) + 34 * u_out + lerp(-4, 4, hold)
        op = min(u_in, 1 - u_out) * a_s
        tex = A.cards[i]
        if i == 6:  # animate the 30-day checklist
            tex = tex.copy()
            d = ImageDraw.Draw(tex)
            ox, oy, step = A.cal_origin
            k = 1500 / 1200
            n = int(30 * eio(prog(t, s + 0.1, e - s - 0.2)))
            for j in range(n):
                xx = ox + (j % 5) * step
                yy = oy + (j // 5) * step
                d.rounded_rectangle([xx, yy, xx + 150 * k, yy + 150 * k], radius=26 * k, fill=(30, 90, 200, 255))
                d.line([(xx + 42 * k, yy + 80 * k), (xx + 68 * k, yy + 106 * k), (xx + 112 * k, yy + 52 * k)],
                       fill=WHITE + (255,), width=int(10 * k))
        quads.append((quad_at((x, 0.15, z), 2.4, 3.0, rot(yaw, -3)), tex, op))
    draw_quads(canvas, cam, quads, 1.0, glow=0.3)

    lines = [("LEARN AI.", 19.25, 22.3, "silver"),
             ("CREATE DIGITAL PRODUCTS.", 22.5, 25.25, "silver"),
             ("BUILD YOUR ONLINE BUSINESS.", 25.4, 29.0, "silver")]
    for s_, a, b, st in lines:
        if s_ == "BUILD YOUR ONLINE BUSINESS.":
            img = text_block([("BUILD YOUR", "InterDisplay-SemiBold.otf", 64 * S, "silver", 0.08),
                              ("ONLINE BUSINESS.", "InterDisplay-SemiBold.otf", 64 * S, "blue", 0.08)], gap=0.45)
        elif s_ == "CREATE DIGITAL PRODUCTS.":
            img = text_block([("CREATE", "InterDisplay-SemiBold.otf", 64 * S, "silver", 0.08),
                              ("DIGITAL PRODUCTS.", "InterDisplay-SemiBold.otf", 64 * S, "blue", 0.08)], gap=0.45)
        else:
            img = text_block([(s_, "InterDisplay-SemiBold.otf", 96 * S, "silver", 0.10)])
        show_text(canvas, img, W / 2, H * 0.865, t, a, b, fi=0.6, fo=0.3, rise=20, blur=8)


def scene5(canvas, t):
    """FINAL PRODUCT SHOT."""
    a_s = env(t, 28.9, 36.15, 0.35, 0.4)
    if a_s <= 0:
        return
    canvas.paste(Image.blend(canvas, A.bg_studio, a_s))
    p = eio5(prog(t, 29.0, 7.2))
    cam = Cam(2.05 * H, W / 2, H * 0.40)
    yaw = lerp(-15, -4, p)
    pitch = lerp(-6, -3, p)
    dist = lerp(8.2, 7.05, p)
    gold = eio(prog(t, 29.6, 2.5))
    add(canvas, A.beam, (W / 2 - A.beam.width / 2, -H * 0.12), (0.5 + 0.4 * gold) * a_s)
    sb = A.spr_blue.resize((A.spr_blue.width * 3, A.spr_blue.height * 3))
    add(canvas, sb, (W * 0.08 - sb.width / 2, H * 0.40 - sb.height / 2), 0.3 * a_s)
    light = dict(band=lerp(0.1, 1.2, prog(t, 29.2, 6.5)), angle=0.9, width=0.24, blue=0.35, gold=0.6,
                 exposure=1.0, spec=0.6, title=0.9 * gold)
    render_book(canvas, cam, yaw, pitch, (0, 0.02, dist), light, a_s, reflect=0.24, rim=0.5)

    blk = text_block([("THE AI MONEY PLAYBOOK", "Caladea-Regular.ttf", 74 * S, "white", 0.03),
                      ("BY LUKA SHEHU", "Inter-Medium.otf", 28 * S, "silver", 0.35),
                      ("CREATOR LAB", "Inter-Medium.otf", 24 * S, "gold", 0.45)], gap=0.85)
    show_text(canvas, blk, W / 2, H * 0.865, t, 30.0, 36.0, fi=1.0, fo=0.45, rise=18)
    tag = text_block([("YOUR JOURNEY STARTS HERE.", "InterDisplay-Medium.otf", 46 * S, "gold", 0.16)])
    show_text(canvas, tag, W / 2, H * 0.775, t, 32.1, 36.0, fi=1.0, fo=0.45, rise=14)


def scene6(canvas, t):
    """CALL TO ACTION."""
    a_s = env(t, 35.95, 40.0, 0.45, 0.85)
    if a_s <= 0:
        return
    canvas.paste(Image.blend(canvas, A.bg_void, a_s))
    p = eio5(prog(t, 36.0, 4.0))
    cam = Cam(2.05 * H, W / 2, H * 0.5)
    dist = lerp(8.9, 8.5, p)
    xw = (W * 0.27 - W / 2) * dist / cam.f
    sg = A.spr_gold.resize((A.spr_gold.width * 2, A.spr_gold.height * 2))
    add(canvas, sg, (W * 0.27 - sg.width / 2, H * 0.5 - sg.height / 2), 0.35 * a_s)
    light = dict(band=lerp(0.2, 1.0, p), angle=0.9, width=0.25, blue=0.3, gold=0.6, exposure=1.0, spec=0.6,
                 title=0.7)
    render_book(canvas, cam, lerp(24, 20, p), -3, (xw, 0, dist), light, a_s, reflect=0.2, rim=0.5)
    x = W * 0.555
    cta = text_block([("GET YOUR", "Caladea-Regular.ttf", 70 * S, "white", 0.02),
                      ("COPY TODAY", "Caladea-Regular.ttf", 70 * S, "white", 0.02)], gap=0.4)
    show_text(canvas, cta, x, H * 0.43, t, 36.3, 40.5, fi=0.9, fo=0.1, rise=16, align="l")
    only = text_img("ONLY", "Inter-Medium.otf", 30 * S, "silver", 0.45)
    show_text(canvas, only, x + 4 * S, H * 0.53, t, 36.8, 40.5, fi=0.8, fo=0.1, rise=10, align="l")
    price = text_img("€9", "Caladea-Regular.ttf", 170 * S, "gold", 0.0)
    show_text(canvas, price, x - 4 * S, H * 0.59, t, 37.0, 40.5, fi=0.9, fo=0.1, rise=14, align="l")
    d = ImageDraw.Draw(canvas)
    lw = 240 * S * eo(prog(t, 36.6, 1.0))
    if lw > 1:
        col = tuple(int(c * a_s) for c in GOLD)
        d.line([(x + 4 * S, H * 0.497), (x + 4 * S + lw, H * 0.497)], fill=col, width=S * 2)


def render(t):
    canvas = Image.new("RGB", (W, H), (0, 0, 0))
    canvas.paste(A.bg_void)
    if t < 5.6:
        scene1(canvas, t)
    if 4.95 < t < 11.1:
        scene2(canvas, t)
    if 10.95 < t < 19.15:
        scene3(canvas, t)
    if 18.8 < t < 29.2:
        scene4(canvas, t)
    if 28.85 < t < 36.2:
        scene5(canvas, t)
    if t > 35.9:
        scene6(canvas, t)
    # finishing: vignette, grain, fade in/out
    canvas = ImageChops.multiply(canvas, Image.merge("RGB", [A.vignette] * 3))
    canvas = ImageChops.add(canvas, A.grain[int(t * FPS) % 6], 1.0, -8)
    g = min(eio(t / 0.6), eio((DUR - t) / 0.9))
    if g < 1:
        canvas = Image.blend(Image.new("RGB", (W, H)), canvas, max(0.0, g))
    return canvas


# ------------------------------------------------------------------ driver
def init_worker(pdf):
    global A
    A = Assets(pdf)


def render_segment(args):
    k, f0, f1 = args
    path = os.path.join(WORK, f"seg_{k:02d}.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
           "-pix_fmt", "yuv420p", "-x264-params", "keyint=48", path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(render(f / FPS).tobytes())
        if (f - f0) % 24 == 0:
            print(f"  seg {k}: {f - f0}/{f1 - f0}", flush=True)
    p.stdin.close()
    p.wait()
    return path


def main():
    pdf, vdir = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    os.makedirs(WORK, exist_ok=True)
    if args and args[0] == "--stills":
        init_worker(pdf)
        for ts in map(float, args[1:]):
            im = render(ts)
            im.resize((W // 4, H // 4), Image.LANCZOS).save(os.path.join(WORK, f"still_{ts:05.2f}.png"))
            im.save(os.path.join(WORK, f"still_full_{ts:05.2f}.png"))
        return
    workers = int(args[args.index("--workers") + 1]) if "--workers" in args else os.cpu_count()

    sys.path.insert(0, HERE)
    import audio
    wav = os.path.join(WORK, "mix.wav")
    print("Audio…", flush=True)
    timing = audio.build(wav, vdir)
    print(timing)

    nseg = workers * 3
    bounds = np.linspace(0, NF, nseg + 1).astype(int)
    jobs = [(k, bounds[k], bounds[k + 1]) for k in range(nseg)]
    with Pool(workers, initializer=init_worker, initargs=(pdf,)) as pool:
        segs = pool.map(render_segment, jobs, chunksize=1)
    lst = os.path.join(WORK, "segs.txt")
    with open(lst, "w") as fh:
        fh.writelines(f"file '{s}'\n" for s in segs)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", wav,
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "-shortest", OUT],
                   check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", OUT, "-vf", "scale=1080:1920:flags=lanczos",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                    "-c:a", "copy", "-movflags", "+faststart", OUT_HD], check=True)
    print("Done:", OUT, OUT_HD)


if __name__ == "__main__":
    main()
