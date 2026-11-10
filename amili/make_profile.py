"""Instagram profile pictures for Amili Beauty Studio (1080x1080, circle-safe).

    python3 make_profile.py  -> amili_profile_logo.png, amili_profile_foto.png, _preview.png
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = lambda n, s: ImageFont.truetype(os.path.join(HERE, "fonts", n), s)  # noqa: E731
S = 1080
WINE = (106, 22, 44)
ROSE_GOLD = (196, 140, 120)


def pink_bg():
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    light = np.array([252, 238, 240], np.float32)
    deep = np.array([238, 150, 172], np.float32)
    d = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2) / 0.72
    k = np.clip(d, 0, 1) ** 1.6
    k = np.clip(k + 0.12 * np.sin((xx + yy) * 7), 0, 1)  # soft diagonal sheen like the poster
    img = light * (1 - k[..., None]) + deep * k[..., None]
    return Image.fromarray(img.astype(np.uint8)).convert("RGBA")


def spaced_text(d, xy, s, font, fill, track):
    w = sum(d.textlength(c, font=font) for c in s) + track * (len(s) - 1)
    x = xy[0] - w / 2
    for c in s:
        d.text((x, xy[1]), c, font=font, fill=fill, anchor="ls")
        x += d.textlength(c, font=font) + track


def logo():
    img = pink_bg()
    d = ImageDraw.Draw(img)
    # thin rose-gold ring just inside the circle crop
    d.ellipse([70, 70, S - 70, S - 70], outline=ROSE_GOLD + (200,), width=3)
    spaced_text(d, (S / 2, 560), "AMILI", F("Cormorant-600.ttf", 262), WINE, 28)
    d.text((S / 2, 700), "Beauty Studio", font=F("GreatVibes.ttf", 140), fill=WINE, anchor="ms")
    # line + heart
    y = 790
    d.line([(330, y), (500, y)], fill=WINE, width=3)
    d.line([(580, y), (750, y)], fill=WINE, width=3)
    hx, hy, r = S / 2, y - 6, 15
    d.ellipse([hx - 2 * r, hy - r, hx, hy + r], outline=WINE, width=3)
    d.ellipse([hx, hy - r, hx + 2 * r, hy + r], outline=WINE, width=3)
    d.polygon([(hx - 2 * r + 1, hy + 4), (hx + 2 * r - 1, hy + 4), (hx, hy + 2.3 * r)], fill=img.getpixel((int(hx), int(hy + 10))))
    d.line([(hx - 2 * r + 2, hy + 5), (hx, hy + 2.3 * r)], fill=WINE, width=3)
    d.line([(hx + 2 * r - 2, hy + 5), (hx, hy + 2.3 * r)], fill=WINE, width=3)
    return img.convert("RGB")


def foto():
    src = Image.open(os.path.join(HERE, "poster.jpg")).convert("RGB")
    sx, sy = src.width / 967, src.height / 1041
    cx, cy, r = 548 * sx, 552 * sy, 284 * min(sx, sy)
    crop = src.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).resize((S, S), Image.LANCZOS)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    img = pink_bg()
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255)
    img.paste(crop, (0, 0), m)
    d = ImageDraw.Draw(img)
    d.ellipse([10, 10, S - 10, S - 10], outline=(244, 214, 205, 255), width=14)
    d.ellipse([22, 22, S - 22, S - 22], outline=ROSE_GOLD + (255,), width=3)
    return img.convert("RGB")


def combo():
    """Photo on top, AMILI + Beauty Studio on a pink band at the bottom, all inside the circle."""
    src = Image.open(os.path.join(HERE, "poster.jpg")).convert("RGB")
    sx, sy = src.width / 967, src.height / 1041
    x0, x1, y0 = 255 * sx, 865 * sx, 262 * sy
    w = x1 - x0
    crop = src.crop((int(x0), int(y0), int(x1), int(y0 + w))).resize((S, S), Image.LANCZOS)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    img = pink_bg()
    img.paste(crop, (0, -95))
    # pink band with a soft fade into the photo
    band = pink_bg()
    fade = np.zeros((S, S), np.float32)
    yy = np.arange(S, dtype=np.float32)[:, None]
    fade[:] = np.clip((yy - 560) / 210, 0, 1) ** 1.4
    band.putalpha(Image.fromarray((fade * 255).astype(np.uint8)))
    img.alpha_composite(band)
    d = ImageDraw.Draw(img)
    spaced_text(d, (S / 2, 860), "AMILI", F("Cormorant-600.ttf", 200), WINE, 22)
    d.text((S / 2, 968), "Beauty Studio", font=F("GreatVibes.ttf", 104), fill=WINE, anchor="ms")
    out = pink_bg()
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255)
    out.paste(img, (0, 0), m)
    d = ImageDraw.Draw(out)
    d.ellipse([10, 10, S - 10, S - 10], outline=(244, 214, 205, 255), width=14)
    d.ellipse([22, 22, S - 22, S - 22], outline=ROSE_GOLD + (255,), width=3)
    return out.convert("RGB")


if __name__ == "__main__":
    a, b = logo(), foto()
    c = combo()
    c.save(os.path.join(HERE, "amili_profile_foto_logo.png"))
    a = c  # preview the combined version next to the photo one
    a.save(os.path.join(HERE, "amili_profile_logo.png"))
    b.save(os.path.join(HERE, "amili_profile_foto.png"))
    # preview: how Instagram shows them (circle, large and small)
    pv = Image.new("RGB", (1000, 560), (255, 255, 255))
    m = Image.new("L", (440, 440), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 439, 439], fill=255)
    for i, im in enumerate((a, b)):
        pv.paste(im.resize((440, 440), Image.LANCZOS), (40 + i * 500, 20), m)
        sm = Image.new("L", (110, 110), 0)
        ImageDraw.Draw(sm).ellipse([0, 0, 109, 109], fill=255)
        pv.paste(im.resize((110, 110), Image.LANCZOS), (205 + i * 500, 450), sm)
    pv.save(os.path.join(HERE, "_preview.png"))
    print("ok")
