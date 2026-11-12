"""
Mid fade step-by-step guide lines animated on the client's photo (1080x1920, 30 fps, ~30 s).

    python3 make_midfade.py            -> midfade_vijat.mp4
    python3 make_midfade.py --stills 5 10 14 19 23 28

Steps (as described by the barber):
  1. Zero line ("vija e zeros")
  2. Two fingers above zero: 1.5, lever closed
  3. Halfway / one finger above zero: 0.5, lever closed
  4. Blend: 1.5 and 0.5 lines with the lever open
  5. Blend the zero line: 0.3 · 0.2 · clipper
"""
import argparse
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS, DUR = 1080, 1920, 30, 30.0
N = int(FPS * DUR)
INTER = "/usr/share/fonts/opentype/inter/"


def fnt(size, w="Bold"):
    return ImageFont.truetype(INTER + f"Inter-{w}.otf", size)


WHITE = (255, 255, 255)
ZERO_C = (255, 255, 255)
MID_C = (64, 224, 170)     # 0.5
TOP_C = (245, 196, 92)     # 1.5
INK = (14, 14, 16)

# guide lines in photo coordinates (traced on the client's head, back -> front)
ZERO = [(452, 1012), (520, 990), (600, 974), (700, 964), (800, 955), (880, 944), (915, 948)]
MID = [(452, 950), (520, 928), (600, 913), (700, 903), (800, 893), (880, 884), (912, 890)]
TOP = [(452, 890), (520, 868), (600, 855), (700, 845), (800, 836), (880, 828), (910, 834)]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def eio(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def eob(t):
    t = clamp(t)
    c = 1.7
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def prog(t, a, d):
    return clamp((t - a) / d)


def env(t, a, b, fi=.3, fo=.3):
    if t <= a or t >= b:
        return 0.0
    return min(eio((t - a) / fi), eio((b - t) / fo))


def spline(pts, n=160):
    """Catmull-Rom through the points, returns n evenly spaced samples."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(20):
            s = k / 20
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * s + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * s * s
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * s ** 3) for j in range(2)))
    out.append(pts[-1])
    a = np.array(out)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(a, axis=0).T))]
    u = np.linspace(0, seg[-1], n)
    return np.c_[np.interp(u, seg, a[:, 0]), np.interp(u, seg, a[:, 1])]


LINES = {"zero": spline(ZERO), "mid": spline(MID), "top": spline(TOP)}

# ---------------------------------------------------------------- timeline
T_ZOOM = (2.2, 1.3)
S1, S2, S3 = 3.6, 8.0, 12.6          # draw zero, 1.5, 0.5
HOLD = 16.8
E1, E2 = 18.0, 20.0                  # erase 1.5, 0.5 (lever open)
E3 = 22.2                            # erase zero (0.3 · 0.2 · clipper)
OUT = 26.2                           # zoom out + final card


def camera(t):
    """Crop window (photo coords) for time t: wide shot -> close-up on the fade -> wide."""
    wide = (756, 1130, 1.0)      # center x, center y, zoom
    close = (700, 925, 1.42)
    k = eio(prog(t, *T_ZOOM)) * (1 - eio(prog(t, OUT, 1.2)))
    cx = wide[0] + (close[0] - wide[0]) * k
    cy = wide[1] + (close[1] - wide[1]) * k
    z = wide[2] + (close[2] - wide[2]) * k
    z *= 1 + 0.015 * math.sin(t * .6)          # slow breathing push
    return cx, cy, z


PHOTO = None


def frame_photo(t):
    cx, cy, z = camera(t)
    sw = 900 / z
    sh = sw * H / W
    box = (cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2)
    img = PHOTO.transform((W, H), Image.EXTENT, box, Image.BICUBIC)
    sx = W / sw

    def to_v(pt):
        return ((pt[0] - box[0]) * sx, (pt[1] - box[1]) * sx)
    return img.convert("RGBA"), to_v, sx


def draw_line(ov, glow, pts, a0, a1, col, width, alpha=1.0, dash=False):
    """Draws the part of the polyline between fractions a0..a1."""
    n = len(pts)
    i0, i1 = int(a0 * (n - 1)), int(a1 * (n - 1))
    if i1 - i0 < 1 or alpha <= 0:
        return
    seg = [tuple(p) for p in pts[i0:i1 + 1]]
    d = ImageDraw.Draw(ov)
    g = ImageDraw.Draw(glow)
    if dash:
        for k in range(0, len(seg) - 1, 6):
            d.line(seg[k:k + 4], fill=col + (int(255 * alpha),), width=width, joint="curve")
    else:
        d.line(seg, fill=col + (int(255 * alpha),), width=width, joint="curve")
    g.line(seg, fill=col + (int(170 * alpha),), width=width * 4, joint="curve")


def clipper_icon(open_lever=False, scale=1.0):
    w, h = int(70 * scale), int(150 * scale)
    c = Image.new("RGBA", (w + 20, h + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle([10, 30 * scale + 10, w + 10, h + 10], radius=int(26 * scale), fill=(28, 28, 32), outline=(200, 200, 205), width=3)
    d.rounded_rectangle([14, 10, w + 6, 34 * scale + 10], radius=6, fill=(215, 215, 220))
    for k in range(7):
        x = 18 + k * (w - 16) / 6
        d.line([(x, 8), (x, 18)], fill=(170, 170, 175), width=2)
    lx = w + 10 if open_lever else w + 2
    d.line([(w + 8, 70 * scale), (lx + 14 * open_lever, 52 * scale)], fill=(245, 196, 92), width=6)
    return c


def pill(text, bg, fg, size=34, pad=(22, 10)):
    f = fnt(size, "ExtraBold")
    dd = ImageDraw.Draw(Image.new("L", (1, 1)))
    bb = dd.textbbox((0, 0), text, font=f)
    c = Image.new("RGBA", (bb[2] - bb[0] + pad[0] * 2, bb[3] - bb[1] + pad[1] * 2 + 6), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle([0, 0, c.width - 1, c.height - 1], radius=c.height // 2, fill=bg)
    d.text((pad[0] - bb[0], pad[1] - bb[1] + 3), text, font=f, fill=fg)
    return c


def paste(img, layer, x, y, a=1.0, anchor="c"):
    if a <= 0.003:
        return
    if a < .999:
        layer = layer.copy()
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
    if anchor == "c":
        x -= layer.width / 2
    elif anchor == "r":
        x -= layer.width
    img.alpha_composite(layer, (int(x), int(y - layer.height / 2)))


def caption(img, step, title, sub, col, t, t0, t1):
    a = env(t, t0, t1, .35, .3)
    if not a:
        return
    k = eob(prog(t, t0, .5))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    y0 = 1430 + 60 * (1 - k)
    d.rounded_rectangle([60, y0, W - 60, y0 + 250], radius=34, fill=(12, 12, 14, int(225 * a)))
    d.rounded_rectangle([60, y0, 74, y0 + 250], radius=7, fill=col + (int(255 * a),))
    d.ellipse([104, y0 + 40, 184, y0 + 120], fill=col + (int(255 * a),))
    d.text((144, y0 + 80), str(step), font=fnt(46, "ExtraBold"), fill=INK + (int(255 * a),), anchor="mm")
    d.text((212, y0 + 80), title, font=fnt(50, "ExtraBold"), fill=WHITE + (int(255 * a),), anchor="lm")
    d.text((104, y0 + 182), sub, font=fnt(44, "SemiBold"), fill=col + (int(255 * a),), anchor="lm")
    img.alpha_composite(ov)


def fingers(img, to_v, sx, n, x_src, base_pts, t, t0, a):
    """n stacked 'finger' bars measuring up from the zero line."""
    if a <= 0:
        return
    xs = np.array(base_pts)[:, 0]
    i = int(np.argmin(np.abs(xs - x_src)))
    bx, by = base_pts[i]
    fw = 62  # one finger in photo px
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for k in range(n):
        p = eob(prog(t, t0 + k * .35, .4))
        if p <= 0:
            continue
        top = by - fw * (k + 1) + 4
        bot = by - fw * k - 4
        x0, y0 = to_v((bx - 70, top))
        x1, y1 = to_v((bx + 70, bot))
        cyy = (y0 + y1) / 2
        hh = (y1 - y0) / 2 * p
        d.rounded_rectangle([x0, cyy - hh, x1, cyy + hh], radius=int(22 * sx / 1.75),
                            fill=(255, 214, 190, int(150 * a)), outline=(255, 255, 255, int(230 * a)), width=3)
    img.alpha_composite(ov)
    lx, ly = to_v((bx + 80, by - fw * n / 2))
    paste(img, pill(f"{n} gisht" if n == 1 else f"{n} gishta", WHITE, INK, 32), lx + 10, ly, a * eob(prog(t, t0 + .3, .4)), anchor="l")


def particles(img, x, y, t, col, a):
    if a <= 0:
        return
    rng = np.random.default_rng(int(t * 30))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for _ in range(14):
        dx, dy = rng.normal(0, 26), rng.uniform(4, 60)
        r = rng.uniform(1.5, 4)
        d.ellipse([x + dx - r, y + dy - r, x + dx + r, y + dy + r], fill=col + (int(200 * a * rng.uniform(.4, 1)),))
    img.alpha_composite(ov)


def render(t):
    img, to_v, sx = frame_photo(t)
    # soft vignette + darken bottom for captions
    img.alpha_composite(VIGN)
    vlines = {k: np.array([to_v(p) for p in v]) for k, v in LINES.items()}
    lw = max(4, int(3.2 * sx))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    heads = []  # (x, y, open_lever, col) for the clipper icon

    def line_state(name, t_draw, t_erase, dur_d=2.4, dur_e=1.6):
        """returns visible range [a0, a1] in fractions"""
        d = eio(prog(t, t_draw, dur_d))
        e = eio(prog(t, t_erase, dur_e))
        return e, d

    spec = [("top", S2 + .9, E1, TOP_C, False), ("mid", S3 + .7, E2, MID_C, False), ("zero", S1 + .4, E3 + .3, ZERO_C, False)]
    for name, td, te, col, _ in spec:
        dur_e = 2.6 if name == "zero" else 1.6
        a0, a1 = line_state(name, td, te, 2.4, dur_e)
        pts = vlines[name]
        if a1 > a0:
            draw_line(ov, glow, pts, a0, a1, col, lw)
        # clipper rides the line while drawing / erasing
        if 0 < a1 < 1 and t < te:
            p = pts[int(a1 * (len(pts) - 1))]
            heads.append((p[0], p[1], False, col))
        if 0 < a0 < 1:
            p = pts[int(a0 * (len(pts) - 1))]
            heads.append((p[0], p[1], True, col))
            particles(img, p[0], p[1], t, (40, 32, 28), 1.0)
        # value labels at the front end of each line
        lab = {"zero": "0", "mid": "0.5", "top": "1.5"}[name]
        la = clamp(prog(t, td + 2.0, .35)) * (1 - clamp(prog(t, te, .4)))
        if la > 0:
            st = pts[0]
            paste(img, pill(lab, col, INK, 36), st[0] - 18, st[1], la * eob(prog(t, td + 2.0, .4)), anchor="r")
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
    img.alpha_composite(ov)

    # finger measurements
    fa2 = env(t, S2, S2 + 2.6, .2, .4)
    fingers(img, to_v, sx, 2, 640, ZERO, t, S2 + .1, fa2)
    fa3 = env(t, S3, S3 + 2.3, .2, .4)
    fingers(img, to_v, sx, 1, 740, ZERO, t, S3 + .1, fa3)

    for x, y, op, col in heads:
        ic = clipper_icon(open_lever=op, scale=1.15)
        paste(img, ic, x + 8, y - ic.height / 2 + 18, 1.0)

    # titles + captions
    a = env(t, 0, T_ZOOM[0] + .6, .2, .4)
    if a:
        k = eob(prog(t, .1, .6))
        paste(img, pill("MID FADE", (12, 12, 14), WHITE, 92, (46, 22)), W / 2, 230 + 30 * (1 - k), a)
        paste(img, pill("Vijat · hap pas hapi", TOP_C, INK, 44), W / 2, 380, a * eo(prog(t, .5, .4)))
    caption(img, 1, "Vija e zeros", "Fillo nga vija e zeros", ZERO_C, t, S1, S2 - .1)
    caption(img, 2, "Dy gishta sipër zeros", "1.5 · leve mbyllur", TOP_C, t, S2, S3 - .1)
    caption(img, 3, "Në mes · 1 gisht sipër", "0.5 · leve mbyllur", MID_C, t, S3, HOLD + .9)
    caption(img, 4, "Fshi vijat", "1.5 dhe 0.5 · leve hapur", TOP_C, t, E1 - .6, E3 - .1)
    caption(img, 5, "Fshi vijën e zeros", "0.3 · 0.2 · kliper", ZERO_C, t, E3, OUT + .3)
    # lever state badge during erase
    if E1 <= t < E3:
        paste(img, pill("LEVE HAPUR", MID_C, INK, 30), W / 2, 260, env(t, E1, E3, .3, .3))
    elif S2 <= t < HOLD + .8:
        paste(img, pill("LEVE MBYLLUR", TOP_C, INK, 30), W / 2, 260, env(t, S2, HOLD + .8, .3, .3))
    elif E3 <= t < OUT:
        steps = ["0.3", "0.2", "kliper"]
        i = min(2, int((t - E3) / 1.0))
        paste(img, pill(steps[i], WHITE, INK, 40), W / 2, 260, env(t, E3, OUT, .3, .3))

    # final card
    a = env(t, OUT + .8, DUR + 1, .4, .4)
    if a:
        k = eob(prog(t, OUT + .8, .6))
        paste(img, pill("MID FADE  ✓", (12, 12, 14), WHITE, 90, (50, 24)), W / 2, 1540 + 40 * (1 - k), a)
        paste(img, pill("@barber_luka__", TOP_C, INK, 42), W / 2, 1690, a * eo(prog(t, OUT + 1.3, .4)))

    out = img.convert("RGB")
    g = min(1.0, eio((DUR - t) / .5), eio(t / .4))
    if g < 1:
        out = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), out, g)
    return out


def make_vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W * .75)) ** 2 + ((yy - H * .45) / (H * .62)) ** 2)
    a = np.clip(d - .55, 0, 1) * 160
    a += np.clip((yy - 1280) / 500, 0, 1) * 120
    a += np.clip((420 - yy) / 420, 0, 1) * 90
    v = np.zeros((H, W, 4), np.uint8)
    v[..., 3] = np.clip(a, 0, 230).astype(np.uint8)
    return Image.fromarray(v, "RGBA")


def music(path):
    sr = 44100
    n = int(DUR * sr)
    tt = np.arange(n) / sr
    out = np.zeros((n, 2))
    rng = np.random.default_rng(3)
    beat = 60 / 100
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731

    def add(x, at, g, pan=.5):
        i = int(at * sr)
        if i >= n:
            return
        j = min(n, i + len(x))
        out[i:j, 0] += g * x[:j - i] * (1.2 - pan)
        out[i:j, 1] += g * x[:j - i] * (.2 + pan)

    def kick():
        t_ = np.arange(int(.4 * sr)) / sr
        return np.sin(2 * np.pi * np.cumsum(48 + 110 * np.exp(-t_ * 30)) / sr) * np.exp(-t_ * 8)

    def hat():
        t_ = np.arange(int(.05 * sr)) / sr
        return np.diff(rng.standard_normal(len(t_)) * np.exp(-t_ * 90), prepend=0)

    def keys(f, d=.5):
        t_ = np.arange(int(d * sr)) / sr
        return sum(np.sin(2 * np.pi * f * h * t_) * np.exp(-t_ * (4 + 2 * h)) / h for h in (1, 2, 3))

    def clipper(d):
        t_ = np.arange(int(d * sr)) / sr
        hum = np.sign(np.sin(2 * np.pi * 118 * t_)) * .22 + np.sin(2 * np.pi * 236 * t_) * .3
        rat = rng.standard_normal(len(t_)) * (.5 + .5 * np.sin(2 * np.pi * 118 * t_)) * .16
        return (hum + rat) * np.minimum(1, t_ / .05) * np.minimum(1, (d - t_) / .12)

    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
    k, tb = 0, 0.0
    while tb < DUR - .5:
        ch = chords[int(tb / (beat * 4)) % 4]
        if tb > 1.0:
            if k % 2 == 0:
                add(kick(), tb, .55)
            add(hat(), tb + beat / 2, .07, .7)
        for j, nt in enumerate(ch):
            add(keys(hz(nt + 12)), tb + j * beat / 3, .035, .3 + .15 * j)
        tb += beat
        k += 1
    for s in (S1 + .4, S2 + .9, S3 + .7):
        add(clipper(2.4), s, .16)
    for s, d in ((E1, 1.6), (E2, 1.6), (E3 + .3, 2.6)):
        add(clipper(d), s, .2)
    for i, m in enumerate([72, 76, 79, 84]):
        add(keys(hz(m), .8), OUT + .8 + i * .08, .1)
    mx = np.tanh(out * 1.3)
    mx *= np.minimum(1, (DUR - tt) / 1.5)[:, None]
    mx /= np.abs(mx).max() / .9
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mx * 32767).astype(np.int16).tobytes())


def main():
    global PHOTO, VIGN
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    PHOTO = Image.open(os.path.join(HERE, "client.jpg")).convert("RGB")
    VIGN = make_vignette()
    if a.stills:
        for s in a.stills:
            render(s).save(os.path.join(HERE, f"_still_{s:04.1f}.png"))
        return
    out = os.path.join(HERE, "midfade_vijat.mp4")
    wav = os.path.join(HERE, "_music.wav")
    music(wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(render(f / FPS).tobytes())
    p.stdin.close()
    p.wait()
    os.remove(wav)
    print("done:", out)


if __name__ == "__main__":
    main()
