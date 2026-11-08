"""
Instagram Story (9:16, 1080×1920, 30 fps, ~14 s) for "The AI Money Playbook".
Black + gold (#B8975A), white serif type, soft fades, gold lines that draw themselves.
Original synthesized music (no copyright). No price, no income promises.

    python3 make_story.py                 -> story_ai_money_playbook.mp4
    python3 make_story.py --lang "Në gjuhën shqipe"   (alternative language line)
"""
import argparse
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
COVER = os.path.join(ROOT, "ai-playbook-site", "public", "textures", "cover.jpg")

W, H, FPS, DUR = 1080, 1920, 30, 14.0
N = int(FPS * DUR)
SAFE_TOP, SAFE_BOT = 250, H - 250
GOLD = (184, 151, 90)
GOLD_HI = (222, 192, 132)
WHITE = (246, 244, 240)
GREY = (170, 168, 162)
F = "/usr/share/fonts/truetype/crosextra/"
I = "/usr/share/fonts/opentype/inter/"


def font(path, size):
    return ImageFont.truetype(path, size)


SERIF_B = lambda s: font(F + "Caladea-Bold.ttf", s)  # noqa: E731
SERIF = lambda s: font(F + "Caladea-Regular.ttf", s)  # noqa: E731
SANS = lambda s: font(I + "Inter-Medium.otf", s)  # noqa: E731


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def eio(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def prog(t, a, d):
    return clamp((t - a) / d)


def env(t, a, b, fi=0.6, fo=0.5):
    if t <= a or t >= b:
        return 0.0
    return min(eio((t - a) / fi), eio((b - t) / fo))


# ---------------------------------------------------------------- assets
def background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.42) / H) ** 2 * 0.8)
    v = np.clip(1 - r * 1.7, 0, 1) ** 2
    img = 6 + 16 * v
    rng = np.random.default_rng(3)
    img = img + rng.normal(0, 1.2, img.shape)
    arr = np.stack([img * 1.02, img, img * 0.96], -1)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")


def cover_card(height):
    c = Image.open(COVER).convert("RGB")
    w = int(height * c.width / c.height)
    c = c.resize((w, height), Image.LANCZOS)
    pad = 120
    card = Image.new("RGBA", (w + 2 * pad, height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("L", card.size, 0)
    ImageDraw.Draw(sh).rectangle([pad + 10, pad + 34, pad + w + 10, pad + height + 34], fill=200)
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    shadow = Image.new("RGBA", card.size, (0, 0, 0, 255))
    shadow.putalpha(sh)
    card.alpha_composite(shadow)
    # thin gold edge glow
    glow = Image.new("L", card.size, 0)
    ImageDraw.Draw(glow).rectangle([pad - 2, pad - 2, pad + w + 2, pad + height + 2], outline=110, width=4)
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    g = Image.new("RGBA", card.size, GOLD + (0,))
    g.putalpha(glow)
    card.alpha_composite(g)
    card.paste(c, (pad, pad))
    return card


def text_layer(lines, width=W):
    """lines: [(text, font, color, spacing_after)] centred; returns RGBA tight block."""
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    heights = []
    for t, f, c, sp in lines:
        bb = d0.textbbox((0, 0), t, font=f)
        heights.append(bb[3] - bb[1] + sp)
    h = sum(heights) + 40
    lay = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    y = 20
    for (t, f, c, sp), hh in zip(lines, heights):
        d.text((width / 2, y), t, font=f, fill=c, anchor="ma")
        y += hh
    return lay


def wrap(text, f, maxw):
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    words, line, out = text.split(), "", []
    for w_ in words:
        test = (line + " " + w_).strip()
        if d.textlength(test, font=f) > maxw and line:
            out.append(line)
            line = w_
        else:
            line = test
    out.append(line)
    return out


def place(img, layer, cx, cy, alpha, scale=1.0, dy=0):
    if alpha <= 0.003:
        return
    if abs(scale - 1) > 0.001:
        layer = layer.resize((max(1, int(layer.width * scale)), max(1, int(layer.height * scale))), Image.LANCZOS)
    if alpha < 0.999:
        a = layer.getchannel("A").point(lambda v: int(v * alpha))
        layer = layer.copy()
        layer.putalpha(a)
    img.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2 + dy)))


def gold_line(d, x0, y, length, p, alpha=1.0, width=3):
    if p <= 0:
        return
    d.line([(x0, y), (x0 + length * p, y)], fill=GOLD + (int(255 * alpha),), width=width)


def check(d, x, y, s, p, alpha):
    """Gold circle + check that draws itself."""
    if p <= 0:
        return
    a = int(255 * alpha)
    d.arc([x - s, y - s, x + s, y + s], -90, -90 + 360 * eo(p * 1.4), fill=GOLD + (a,), width=4)
    q = clamp((p - 0.35) / 0.65)
    pts = [(x - s * 0.45, y + s * 0.02), (x - s * 0.1, y + s * 0.38), (x + s * 0.5, y - s * 0.32)]
    if q > 0:
        k = q * 2
        if k <= 1:
            d.line([pts[0], (pts[0][0] + (pts[1][0] - pts[0][0]) * k, pts[0][1] + (pts[1][1] - pts[0][1]) * k)], fill=GOLD_HI + (a,), width=6)
        else:
            k -= 1
            d.line([pts[0], pts[1]], fill=GOLD_HI + (a,), width=6)
            d.line([pts[1], (pts[1][0] + (pts[2][0] - pts[1][0]) * k, pts[1][1] + (pts[2][1] - pts[1][1]) * k)], fill=GOLD_HI + (a,), width=6)


# ---------------------------------------------------------------- music (original)
def music(path):
    sr = 44100
    n = int(sr * DUR)
    t = np.arange(n) / sr
    out = np.zeros(n)
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731
    chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
    bar = 60 / 84 * 4
    for i in range(int(DUR / bar) + 1):
        s = i * bar
        idx = (t >= s) & (t < s + bar + 0.8)
        tt = t[idx] - s
        e = np.minimum(1, tt / 0.8) * np.exp(-np.maximum(0, tt - bar) * 3)
        for m in chords[i % 4]:
            out[idx] += 0.022 * np.sin(2 * np.pi * hz(m) * tt) * e
        out[idx] += 0.05 * np.sin(2 * np.pi * hz(chords[i % 4][0] - 24) * tt) * e
    # soft felt-piano notes
    beat = 60 / 84
    for k in range(int(DUR / beat)):
        if k % 4 == 3:
            continue
        at = k * beat
        ch = chords[int(at / bar) % 4]
        m = ch[[0, 2, 1, 3][k % 4]] + 12
        i0 = int(at * sr)
        tt = np.arange(int(1.8 * sr)) / sr
        note = sum(np.sin(2 * np.pi * hz(m) * h * tt) * np.exp(-tt * (2.5 + h)) / h for h in (1, 2, 3))
        j = min(n, i0 + len(note))
        out[i0:j] += 0.06 * note[: j - i0]
    # gentle low swell at the cover reveal + soft tick on each checkmark
    for at in (3.4, 4.4, 5.4):
        i0 = int(at * sr)
        tt = np.arange(int(0.25 * sr)) / sr
        tick = np.sin(2 * np.pi * 1760 * tt) * np.exp(-tt * 30) * 0.05
        out[i0:i0 + len(tick)] += tick
    # simple stereo delay
    d = int(0.28 * sr)
    L = out.copy()
    R = out.copy()
    L[d:] += 0.28 * out[:-d]
    R[int(d * 1.3):] += 0.28 * out[: -int(d * 1.3)]
    st = np.stack([L, R], 1)
    st *= (np.minimum(1, t / 0.8) * np.minimum(1, (DUR - t) / 1.4))[:, None]
    st = np.tanh(st * 1.6) / np.tanh(1.6)
    st /= np.abs(st).max() / 0.8
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((st * 32767).astype(np.int16).tobytes())


# ---------------------------------------------------------------- frames
def build_layers(lang_line):
    L = {}
    L["q"] = text_layer([(ln, SERIF_B(64), WHITE, 18) for ln in wrap("Do të fillosh me AI, por s'di nga?", SERIF_B(64), 960)])
    L["items"] = [text_layer([(s, SERIF_B(54), WHITE, 0)]) for s in ("100 prompte gati", "Plan 30-ditor", "Nga zeroja te produkti yt i parë")]
    L["no"] = text_layer([(ln, SERIF_B(66), WHITE, 16) for ln in wrap("Pa programim. Pa premtime boshe.", SERIF_B(66), 860)])
    L["lang"] = text_layer([(lang_line, SANS(40), GOLD_HI, 0)])
    L["cta"] = text_layer([("Merre tani", SERIF_B(96), WHITE, 0)])
    L["brand"] = text_layer([("THE AI MONEY PLAYBOOK", SANS(28), GREY, 0)])
    return L


def render(t, bg, card_big, L):
    img = bg.copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))  # lines/checks are drawn here, then blended
    d = ImageDraw.Draw(ov)

    # brand line at the top of the safe zone (whole story)
    place(img, L["brand"], W / 2, SAFE_TOP + 30, env(t, 0.6, DUR, 1.0, 0.8) * 0.9)

    # --- cover: big reveal (0-3) then rests smaller above the copy (3-10), returns for the CTA
    a_cover = env(t, 0.05, 10.2, 1.1, 0.6)
    if a_cover:
        z = 0.92 + 0.08 * eo(prog(t, 0, 3.0))
        shrink = eio(prog(t, 2.8, 0.9))
        s = z * (1 - 0.42 * shrink)
        cy = 860 - 260 * shrink
        place(img, card_big, W / 2, cy, a_cover, scale=s)
    a_cover2 = env(t, 10.0, DUR, 0.8, 0.6)
    if a_cover2:
        s = 0.62 + 0.03 * eo(prog(t, 10, 4))
        place(img, card_big, W / 2, 760, a_cover2, scale=s)

    # --- 1 · question (0.6-3.2)
    a = env(t, 0.7, 3.3, 0.8, 0.45)
    place(img, L["q"], W / 2, 1480, a, dy=24 * (1 - eo(prog(t, 0.7, 1.0))), scale=0.97 + 0.03 * eo(prog(t, 0.7, 1.4)))
    gold_line(d, W / 2 - 120, 1600, 240, eo(prog(t, 1.2, 1.0)), a)

    # --- 2 · three benefits with gold checks (3.3-7.1)
    a2 = env(t, 3.3, 7.1, 0.4, 0.45)
    for i, lay in enumerate(L["items"]):
        st = 3.4 + i * 1.0
        p = prog(t, st, 0.9)
        ai = a2 * eo(p)
        y = 1050 + i * 170
        x_text = 250
        check(d, 180, y, 34, p, a2)
        if ai > 0:
            lay2 = lay.crop(lay.getbbox())
            place(img, lay2, x_text + lay2.width / 2 + 30 * (1 - eo(p)), y, ai)
        gold_line(d, 140, y + 80, 800, eo(prog(t, st + 0.2, 0.9)), a2 * 0.5, width=1)

    # --- 3 · no code, no empty promises (7.2-10.0)
    a3 = env(t, 7.2, 10.0, 0.7, 0.45)
    place(img, L["no"], W / 2, 1180, a3, dy=24 * (1 - eo(prog(t, 7.2, 1.0))), scale=0.97 + 0.03 * eo(prog(t, 7.2, 1.4)))
    gold_line(d, W / 2 - 160, 1320, 320, eo(prog(t, 7.7, 1.0)), a3)
    place(img, L["lang"], W / 2, 1400, env(t, 8.0, 10.0, 0.7, 0.45))

    # --- 4 · CTA with a bobbing gold arrow (10.2-14); bottom area left clear for the link sticker
    a4 = env(t, 10.3, DUR, 0.7, 0.5)
    place(img, L["cta"], W / 2, 1230, a4, dy=20 * (1 - eo(prog(t, 10.3, 1.0))))
    if a4:
        bob = 14 * math.sin((t - 10.3) * 2 * math.pi / 1.1)
        ax, ay = W / 2, 1345 + bob
        col = GOLD_HI + (int(255 * a4),)
        d.line([(ax, ay), (ax, ay + 90)], fill=col, width=6)
        d.line([(ax - 30, ay + 60), (ax, ay + 92), (ax + 30, ay + 60)], fill=col, width=6, joint="curve")

    img.alpha_composite(ov)
    out = img.convert("RGB")
    g = min(eio(t / 0.4), eio((DUR - t) / 0.5))
    if g < 1:
        out = Image.blend(Image.new("RGB", (W, H)), out, g)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="Shqip + anglisht")
    ap.add_argument("--out", default=os.path.join(HERE, "story_ai_money_playbook.mp4"))
    ap.add_argument("--stills", nargs="*", type=float)
    args = ap.parse_args()
    bg = background()
    card = cover_card(1000)
    L = build_layers(args.lang)
    if args.stills:
        for s in args.stills:
            render(s, bg, card, L).save(os.path.join(HERE, f"_still_{s:04.1f}.png"))
        return
    wav = os.path.join(HERE, "_story.wav")
    music(wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
           "-shortest", "-movflags", "+faststart", args.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(render(f / FPS, bg, card, L).tobytes())
    p.stdin.close()
    p.wait()
    os.remove(wav)
    print("done:", args.out)


if __name__ == "__main__":
    main()
