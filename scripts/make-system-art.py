"""Artes dos cartões de sistema da criação de campanha (public/sistemas/*.webp), desenhadas por código (só Pillow).

Cada arte é uma cena 1000x640 no clima do sistema, desenhada em dobro de resolução e reduzida (bordas suaves), com luz, névoa,
grão e vinheta. Terra Devastada usa uma captura do mundo em pixel art do próprio Vortable (public/sistemas/terra-devastada.webp
já gerada à parte; este script não mexe nela se existir e não houver --all).

Uso:  python scripts/make-system-art.py [genérico|dnd|altherium|vampiro|--all]
"""
from __future__ import annotations

import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from tlou_art.px import fbm, vnoise  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sistemas')
W, H = 1000, 640
S = 2                                           # supersampling
FONT_PATHS = ['C:/Windows/Fonts/georgiab.ttf', 'C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/timesbd.ttf']
RUNE_FONTS = ['C:/Windows/Fonts/seguihis.ttf', 'C:/Windows/Fonts/seguisym.ttf']


def hexc(h: str, a: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def font(size: int) -> ImageFont.ImageFont:
    for p in FONT_PATHS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rune_font(size: int) -> ImageFont.ImageFont:
    for p in RUNE_FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return font(size)


def gradient(w: int, h: int, stops: list[tuple[float, str]]) -> Image.Image:
    """Degradê vertical: [(posição 0..1, cor)]."""
    im = Image.new('RGBA', (w, h))
    px = im.load()
    cols = [(p, hexc(c)) for p, c in stops]
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(cols) - 1):
            if cols[i][0] <= t <= cols[i + 1][0]:
                u = (t - cols[i][0]) / max(1e-6, cols[i + 1][0] - cols[i][0])
                c = lerp(cols[i][1], cols[i + 1][1], u)
                break
        else:
            c = cols[-1][1] if t > cols[-1][0] else cols[0][1]
        for x in range(w):
            px[x, y] = c
    return im


def glow(base: Image.Image, cx: float, cy: float, r: float, color: str, strength: float = 1.0, blur: float | None = None) -> None:
    layer = Image.new('L', base.size, 0)
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(255 * min(1, strength)))
    layer = layer.filter(ImageFilter.GaussianBlur(blur if blur is not None else r * 0.6))
    col = Image.new('RGBA', base.size, hexc(color))
    col.putalpha(layer)
    base.alpha_composite(col)


def ridge(w: int, base: float, amp: float, scale: float, seed: int, octaves: int = 4, step: int = 4) -> list[tuple[float, float]]:
    pts = []
    for x in range(0, w + step, step):
        pts.append((x, base - amp * (fbm(x / scale, seed * 0.37, seed, octaves) - 0.5) * 2))
    return pts


def silhouette(im: Image.Image, pts: list[tuple[float, float]], color: str, bottom: float | None = None) -> None:
    d = ImageDraw.Draw(im)
    b = bottom if bottom is not None else im.height
    d.polygon(pts + [(pts[-1][0], b), (pts[0][0], b)], fill=hexc(color))


def mist(im: Image.Image, y: float, height: float, color: str, alpha: int, seed: int) -> None:
    layer = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    for _ in range(26):
        cx = rnd.uniform(-100, im.width + 100)
        cy = y + rnd.uniform(-height / 2, height / 2)
        rx, ry = rnd.uniform(160, 420), rnd.uniform(18, 60)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rnd.randint(40, 130))
    layer = layer.filter(ImageFilter.GaussianBlur(40))
    layer = layer.point(lambda v: int(v * alpha / 255))
    col = Image.new('RGBA', im.size, hexc(color))
    col.putalpha(layer)
    im.alpha_composite(col)


def stars(im: Image.Image, n: int, ymax: float, seed: int, color: str = '#ffffff') -> None:
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(n):
        x, y = rnd.uniform(0, im.width), rnd.uniform(0, ymax)
        r = rnd.choice([1, 1, 1, 2, 2, 3]) * S / 2
        a = rnd.randint(90, 230)
        c = hexc(color, a)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)


def finish(im: Image.Image, name: str, vignette: float = 0.55, grain: int = 14, tint: str | None = None) -> None:
    im = im.resize((W, H), Image.LANCZOS)
    # grão
    noise = Image.effect_noise((W, H), 28).convert('L')
    noise = noise.point(lambda v: int(abs(v - 128) * grain / 14))
    grainl = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    grainl.putalpha(noise)
    im.alpha_composite(grainl)
    # vinheta
    v = Image.new('L', (W, H), 0)
    ImageDraw.Draw(v).ellipse([-W * 0.25, -H * 0.3, W * 1.25, H * 1.3], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new('RGBA', (W, H), (0, 0, 0, int(255 * vignette)))
    dark.putalpha(ImageChops.invert(v).point(lambda a: int(a * vignette)))
    im.alpha_composite(dark)
    if tint:
        t = Image.new('RGBA', (W, H), hexc(tint, 26))
        im.alpha_composite(t)
    os.makedirs(OUT, exist_ok=True)
    im.convert('RGB').save(os.path.join(OUT, name), 'WEBP', quality=84, method=6)
    print('arte pronta:', name)


def canvas(stops: list[tuple[float, str]]) -> Image.Image:
    return gradient(W * S, H * S, stops)


# ── Genérico: um d20 dourado brilhando entre dados ───────────────

def d20(im: Image.Image, cx: float, cy: float, R: float, rot: float, base: str) -> None:
    d = ImageDraw.Draw(im)

    def at(angle_deg: float, r: float):
        a = rot + math.radians(angle_deg)
        return (cx + r * math.cos(a), cy - r * math.sin(a))

    V = [at(90 + 60 * k, R) for k in range(6)]
    I = [at(90 + 120 * j, R * 0.5) for j in range(3)]
    bc = hexc(base)

    def tone(face, bias=0.0):
        mx = sum(p[0] for p in face) / len(face)
        my = sum(p[1] for p in face) / len(face)
        light = ((cx - mx) * -0.6 + (cy - my) * 0.8) / R          # luz vinda de cima à esquerda
        t = max(0.08, min(0.95, 0.5 + light * 0.45 + bias))
        return lerp(hexc('#2e1d06'), lerp(bc, hexc('#fff0b8'), 0.55), t)

    faces = [[I[0], I[1], I[2]]]
    for j in range(3):
        faces.append([I[j], I[(j + 1) % 3], V[(2 * j + 1) % 6]])
        faces.append([I[j], V[(2 * j) % 6], V[(2 * j + 1) % 6]])
        faces.append([I[j], V[(2 * j) % 6], V[(2 * j - 1) % 6]])
    edge = hexc('#2a1a05')
    d.polygon(V, fill=hexc('#2e1d06'))
    for k, face in enumerate(faces):
        d.polygon(face, fill=tone(face, 0.16 if k == 0 else 0.0))
        d.line(face + [face[0]], fill=edge, width=4)
    d.line(V + [V[0]], fill=edge, width=6)
    f = font(int(R * 0.34))
    txt = '20'
    tw = d.textlength(txt, font=f)
    d.text((cx - tw / 2 + 2, cy - R * 0.17 + 3), txt, font=f, fill=hexc('#2a1a05', 170))
    d.text((cx - tw / 2, cy - R * 0.17), txt, font=f, fill=hexc('#fff3c4'))


def die6(im: Image.Image, cx: float, cy: float, size: float, rot: float, base: str, pips: int) -> None:
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    h = size / 2
    d.rounded_rectangle([cx - h, cy - h, cx + h, cy + h], radius=size * 0.18, fill=hexc(base), outline=hexc('#1a1206'), width=4)
    d.rounded_rectangle([cx - h + 5, cy - h + 5, cx + h - 5, cy - h + size * 0.16], radius=size * 0.1, fill=hexc('#ffffff', 46))
    pos = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)], 4: [(-1, -1), (1, -1), (-1, 1), (1, 1)], 5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)], 6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}[pips]
    for px, py in pos:
        x, y = cx + px * size * 0.26, cy + py * size * 0.26
        r = size * 0.07
        d.ellipse([x - r, y - r, x + r, y + r], fill=hexc('#14100a'))
    layer = layer.rotate(math.degrees(rot), center=(cx, cy), resample=Image.BICUBIC)
    sh = layer.filter(ImageFilter.GaussianBlur(14))
    sh = Image.composite(Image.new('RGBA', im.size, (0, 0, 0, 150)), Image.new('RGBA', im.size, (0, 0, 0, 0)), sh.split()[3])
    im.alpha_composite(sh, (10, 14))
    im.alpha_composite(layer)


def art_generic() -> None:
    im = canvas([(0, '#0a1620'), (0.55, '#10303a'), (1, '#0a1a1c')])
    # círculo de runas ao fundo
    d = ImageDraw.Draw(im)
    cx, cy = W * S * 0.5, H * S * 0.52
    for r, w, a in ((520, 4, 60), (440, 2, 45), (360, 3, 50)):
        d.ellipse([cx - r * S / 2 * 1.6, cy - r * S / 2 * 1.6, cx + r * S / 2 * 1.6, cy + r * S / 2 * 1.6], outline=hexc('#d9b45a', a), width=w * S // 2)
    f = rune_font(46 * S)
    for i, ch in enumerate('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'):
        a = i / 24 * math.tau
        rr = 400 * S * 0.8
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        d.text((x - 20 * S, y - 28 * S), ch, font=f, fill=hexc('#d9b45a', 70))
    glow(im, cx, cy, 300 * S, '#e0b040', 0.55, 150 * S)
    glow(im, cx, cy, 160 * S, '#fff0b8', 0.5, 80 * S)
    die6(im, W * S * 0.17, H * S * 0.72, 150 * S, math.radians(-18), '#b8872a', 5)
    die6(im, W * S * 0.84, H * S * 0.26, 120 * S, math.radians(22), '#c9a24a', 6)
    die6(im, W * S * 0.80, H * S * 0.78, 90 * S, math.radians(-30), '#9a6e22', 3)
    d20(im, cx, cy, 190 * S, math.radians(8), '#d4a53a')
    stars(im, 90, H * S, 3, '#ffe9a8')
    mist(im, H * S * 0.95, 160 * S, '#1c5560', 110, 5)
    finish(im, 'generico.webp', 0.5, 12)


# ── D&D: castelo, pôr do sol e um dragão ─────────────────────────

def dragon(im: Image.Image, cx: float, cy: float, s: float, color: str) -> None:
    d = ImageDraw.Draw(im)
    c = hexc(color)
    def P(pts):
        return [(cx + x * s, cy + y * s) for x, y in pts]
    # asas (membrana com dedos)
    for sign in (1,):
        wing = [(-10, -6), (-60, -78), (-96, -70), (-84, -52), (-118, -44), (-100, -26), (-132, -12), (-96, -2), (-60, 8), (-20, 6)]
        d.polygon(P(wing), fill=c)
        wing2 = [(14, -8), (62, -90), (104, -84), (90, -62), (128, -54), (108, -34), (142, -18), (102, -8), (60, 4), (22, 6)]
        d.polygon(P(wing2), fill=c)
    # corpo, pescoço, cabeça e cauda
    body = [(-24, 0), (-8, -10), (22, -10), (40, -2), (88, 14), (150, 40), (160, 46), (144, 48), (84, 28), (36, 14), (6, 18), (-24, 12)]
    d.polygon(P(body), fill=c)
    neck = [(-20, 0), (-34, -14), (-58, -26), (-78, -34), (-86, -30), (-84, -24), (-62, -14), (-40, 4)]
    d.polygon(P(neck), fill=c)
    head = [(-86, -34), (-110, -34), (-124, -26), (-110, -22), (-98, -20), (-86, -24)]
    d.polygon(P(head), fill=c)
    d.polygon(P([(-90, -36), (-102, -50), (-96, -36)]), fill=c)      # chifre
    d.polygon(P([(-82, -34), (-90, -52), (-80, -36)]), fill=c)
    # patas
    d.polygon(P([(-6, 8), (-14, 26), (-6, 28), (2, 12)]), fill=c)
    d.polygon(P([(24, 10), (22, 28), (30, 28), (34, 12)]), fill=c)
    # ponta da cauda
    d.polygon(P([(160, 46), (180, 36), (176, 52), (166, 56)]), fill=c)


def castle(im: Image.Image, x: float, base: float, s: float, color: str, lit: str) -> None:
    d = ImageDraw.Draw(im)
    c = hexc(color)
    def box(x0, y0, x1, y1):
        d.rectangle([x + x0 * s, base + y0 * s, x + x1 * s, base + y1 * s], fill=c)
    def tower(cx, w, h, roof):
        box(cx - w / 2, -h, cx + w / 2, 0)
        d.polygon([(x + (cx - w / 2 - 3) * s, base - h * s), (x + (cx + w / 2 + 3) * s, base - h * s), (x + cx * s, base - (h + roof) * s)], fill=c)
        for i in range(-1, 2):
            box(cx + i * w / 3 - 2, -h - 4, cx + i * w / 3 + 2, -h)
    box(-70, -60, 70, 0)
    tower(-70, 24, 120, 40)
    tower(70, 24, 110, 38)
    tower(0, 34, 160, 55)
    tower(-35, 18, 90, 26)
    tower(35, 18, 95, 28)
    wl = hexc(lit)
    for wx, wy in ((0, -120), (0, -90), (-35, -60), (35, -66), (-70, -80), (70, -75), (-20, -30), (20, -30), (-48, -20), (48, -20)):
        d.rectangle([x + (wx - 3) * s, base + (wy - 5) * s, x + (wx + 3) * s, base + (wy + 5) * s], fill=wl)


def art_dnd() -> None:
    im = canvas([(0, '#241238'), (0.35, '#8c2f3c'), (0.62, '#e8803a'), (0.8, '#ffc66a'), (1, '#2a1426')])
    cx, cy = W * S * 0.68, H * S * 0.46
    glow(im, cx, cy, 340 * S, '#ffb450', 0.9, 160 * S)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - 78 * S, cy - 78 * S, cx + 78 * S, cy + 78 * S], fill=hexc('#fff1c8'))
    glow(im, cx, cy, 120 * S, '#fff6dc', 0.9, 50 * S)
    stars(im, 60, H * S * 0.3, 11, '#ffe7c8')
    # nuvens longas
    for i, (yy, a) in enumerate(((0.28, 70), (0.4, 90), (0.52, 60))):
        layer = Image.new('L', im.size, 0)
        dl = ImageDraw.Draw(layer)
        rnd = random.Random(20 + i)
        for _ in range(9):
            x = rnd.uniform(-100, W * S)
            dl.ellipse([x, H * S * yy - 10 * S, x + rnd.uniform(300, 700) * S / 2, H * S * yy + rnd.uniform(10, 24) * S], fill=a)
        layer = layer.filter(ImageFilter.GaussianBlur(14 * S))
        col = Image.new('RGBA', im.size, hexc('#3a1630'))
        col.putalpha(layer)
        im.alpha_composite(col)
    dragon(im, W * S * 0.60, H * S * 0.34, 1.55 * S, '#1b0d20')
    silhouette(im, ridge(W * S, H * S * 0.66, 70 * S, 180 * S, 2, 4, 8), '#4a1f3a')
    mist(im, H * S * 0.7, 80 * S, '#e07a52', 100, 4)
    far = ridge(W * S, H * S * 0.72, 90 * S, 140 * S, 7, 4, 8)
    silhouette(im, far, '#2d1230')
    castle(im, W * S * 0.28, H * S * 0.705, 2.0 * S, '#1a0a1d', '#ffd27a')
    silhouette(im, ridge(W * S, H * S * 0.84, 60 * S, 100 * S, 9, 4, 8), '#150816')
    # pinheiros em primeiro plano
    d = ImageDraw.Draw(im)
    rnd = random.Random(33)
    for x in list(range(-20, W * S, 60 * S // 2)):
        h = rnd.uniform(70, 150) * S
        y = H * S * 0.88 + rnd.uniform(-10, 18) * S
        for k in range(4):
            wk = (h * 0.32) * (1 - k * 0.2)
            d.polygon([(x - wk, y - k * h * 0.22), (x + wk, y - k * h * 0.22), (x, y - (k + 1.3) * h * 0.26)], fill=hexc('#0d0510'))
    d.rectangle([0, H * S * 0.9, W * S, H * S], fill=hexc('#0d0510'))
    finish(im, 'dnd5e.webp', 0.5, 12)


# ── Altherium: o norte gelado dos Skalds ─────────────────────────

def aurora(im: Image.Image, seed: int) -> None:
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    for band, (col, y0, amp) in enumerate((('#38f0b0', 0.22, 70), ('#5aa8ff', 0.30, 60), ('#b070ff', 0.18, 50))):
        c = hexc(col)
        for x in range(0, W * S, 4):
            t = x / (W * S)
            yc = H * S * y0 + math.sin(t * 6 + band * 1.7 + seed) * amp * S + math.sin(t * 15 + band) * 14 * S
            hgt = (130 + 90 * vnoise(t * 8, band * 3.1, seed)) * S
            for k in range(0, int(hgt), 6):
                a = int(70 * (1 - k / hgt) ** 1.6 * (0.55 + 0.45 * vnoise(t * 30, band, seed + 5)))
                d.line([(x, yc - k), (x, yc - k - 6)], fill=c[:3] + (a,), width=4)
    layer = layer.filter(ImageFilter.GaussianBlur(10 * S))
    im.alpha_composite(layer)


def pine(d: ImageDraw.ImageDraw, x: float, y: float, h: float, color: str) -> None:
    c = hexc(color)
    for k in range(5):
        wk = h * 0.30 * (1 - k * 0.16)
        d.polygon([(x - wk, y - k * h * 0.2), (x + wk, y - k * h * 0.2), (x, y - (k + 1.5) * h * 0.22)], fill=c)
    d.rectangle([x - h * 0.03, y, x + h * 0.03, y + h * 0.1], fill=c)


def art_altherium() -> None:
    im = canvas([(0, '#050b1d'), (0.45, '#0e2146'), (0.78, '#25446b'), (1, '#6a8fb5')])
    stars(im, 220, H * S * 0.6, 5, '#e6f0ff')
    aurora(im, 4)
    mx, my = W * S * 0.78, H * S * 0.2
    glow(im, mx, my, 150 * S, '#bcd8ff', 0.55, 70 * S)
    ImageDraw.Draw(im).ellipse([mx - 46 * S, my - 46 * S, mx + 46 * S, my + 46 * S], fill=hexc('#eef6ff'))
    ImageDraw.Draw(im).ellipse([mx - 30 * S, my - 36 * S, mx + 36 * S, my + 30 * S], fill=hexc('#dbe9fb'))
    # círculo de runas tênue no céu
    d = ImageDraw.Draw(im)
    f = rune_font(40 * S)
    rcx, rcy = W * S * 0.3, H * S * 0.3
    d.ellipse([rcx - 150 * S, rcy - 150 * S, rcx + 150 * S, rcy + 150 * S], outline=hexc('#cfe4ff', 60), width=2 * S)
    for i, ch in enumerate('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ'):
        a = i / 16 * math.tau
        d.text((rcx + math.cos(a) * 124 * S - 12 * S, rcy + math.sin(a) * 124 * S - 18 * S), ch, font=f, fill=hexc('#cfe4ff', 80))
    # montanhas nevadas em camadas (a neve é a rocha clara por baixo; a rocha escura desce em dentes por cima)
    for i, (base, amp, col, snow) in enumerate(((0.6, 190, '#1c2d52', '#9db8dc'), (0.7, 150, '#162540', '#6f8fba'), (0.8, 90, '#0f1c33', None))):
        pts = ridge(W * S, H * S * base, amp * S, (190 - i * 30) * S, 10 + i, 5, 6)
        if snow:
            silhouette(im, pts, snow)
            dark = [(x, y + (26 + 70 * vnoise(x / (40 * S), i * 3.3, 7)) * S) for x, y in pts]
            silhouette(im, dark, col)
        else:
            silhouette(im, pts, col)
        mist(im, H * S * (base + 0.06), 60 * S, '#a9c6ee', 70, 40 + i)
    # lago/gelo com reflexo
    d = ImageDraw.Draw(im)
    d.rectangle([0, H * S * 0.9, W * S, H * S], fill=hexc('#0a1426'))
    refl = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(refl).rectangle([0, H * S * 0.9, W * S, H * S], fill=hexc('#5aa8ff', 28))
    im.alpha_composite(refl)
    rnd = random.Random(71)
    for x in range(0, W * S, 28 * S):
        h = rnd.uniform(90, 190) * S
        pine(d, x + rnd.uniform(-10, 10) * S, H * S * 0.93 + rnd.uniform(-8, 12) * S, h, '#050b16')
    d.rectangle([0, H * S * 0.97, W * S, H * S], fill=hexc('#040910'))
    finish(im, 'altherium.webp', 0.55, 12)


# ── Vampiro: lua de sangue sobre uma catedral gótica ─────────────

def cathedral(im: Image.Image, x: float, base: float, s: float, color: str, lit: str) -> None:
    d = ImageDraw.Draw(im)
    c = hexc(color)
    def spire(cx, w, h, roof):
        d.rectangle([x + (cx - w / 2) * s, base - h * s, x + (cx + w / 2) * s, base], fill=c)
        d.polygon([(x + (cx - w / 2 - 2) * s, base - h * s), (x + (cx + w / 2 + 2) * s, base - h * s), (x + cx * s, base - (h + roof) * s)], fill=c)
        d.polygon([(x + (cx - 3) * s, base - (h + roof) * s), (x + cx * s, base - (h + roof + 14) * s), (x + (cx + 3) * s, base - (h + roof) * s)], fill=c)
    d.rectangle([x - 95 * s, base - 80 * s, x + 95 * s, base], fill=c)
    d.polygon([(x - 95 * s, base - 80 * s), (x, base - 150 * s), (x + 95 * s, base - 80 * s)], fill=c)
    spire(-82, 26, 150, 90)
    spire(82, 26, 150, 90)
    spire(-38, 16, 110, 70)
    spire(38, 16, 110, 70)
    spire(0, 22, 175, 110)
    # janelas ogivais acesas e o rosácea
    wl = hexc(lit)
    for wx, wy in ((-82, -110), (82, -110), (0, -140), (-38, -70), (38, -70)):
        d.polygon([(x + (wx - 5) * s, base + wy * s), (x + (wx + 5) * s, base + wy * s), (x + (wx + 5) * s, base + (wy - 14) * s), (x + wx * s, base + (wy - 24) * s), (x + (wx - 5) * s, base + (wy - 14) * s)], fill=wl)
    d.ellipse([x - 22 * s, base - 76 * s, x + 22 * s, base - 32 * s], fill=wl)
    d.line([(x - 22 * s, base - 54 * s), (x + 22 * s, base - 54 * s)], fill=c, width=3 * S)
    d.line([(x, base - 76 * s), (x, base - 32 * s)], fill=c, width=3 * S)


def bat(d: ImageDraw.ImageDraw, x: float, y: float, s: float, flap: float) -> None:
    c = hexc('#0b0508')
    w = 1.0 + 0.25 * flap
    d.polygon([(x, y), (x - 26 * s * w, y - 14 * s * w), (x - 44 * s * w, y - 4 * s), (x - 34 * s * w, y + 4 * s), (x - 20 * s * w, y + 2 * s), (x - 8 * s, y + 8 * s), (x, y + 10 * s),
               (x + 8 * s, y + 8 * s), (x + 20 * s * w, y + 2 * s), (x + 34 * s * w, y + 4 * s), (x + 44 * s * w, y - 4 * s), (x + 26 * s * w, y - 14 * s * w)], fill=c)
    d.polygon([(x - 5 * s, y - 2 * s), (x - 4 * s, y - 12 * s), (x - 1 * s, y - 3 * s)], fill=c)
    d.polygon([(x + 5 * s, y - 2 * s), (x + 4 * s, y - 12 * s), (x + 1 * s, y - 3 * s)], fill=c)


def art_vampiro() -> None:
    im = canvas([(0, '#0a0410'), (0.5, '#2a0a1c'), (0.8, '#521424'), (1, '#12060c')])
    stars(im, 70, H * S * 0.5, 8, '#ffd9d0')
    mx, my = W * S * 0.7, H * S * 0.34
    glow(im, mx, my, 330 * S, '#d8284a', 0.75, 160 * S)
    d = ImageDraw.Draw(im)
    d.ellipse([mx - 120 * S, my - 120 * S, mx + 120 * S, my + 120 * S], fill=hexc('#c4223f'))
    d.ellipse([mx - 108 * S, my - 112 * S, mx + 100 * S, my + 100 * S], fill=hexc('#e2384f'))
    # crateras sutis
    rnd = random.Random(9)
    for _ in range(12):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(0, 90 * S)
        cr = rnd.uniform(6, 20) * S
        d.ellipse([mx + math.cos(a) * r - cr, my + math.sin(a) * r - cr, mx + math.cos(a) * r + cr, my + math.sin(a) * r + cr], fill=hexc('#b61c38', 150))
    glow(im, mx - 30 * S, my - 30 * S, 80 * S, '#ff8a8a', 0.35, 50 * S)
    for i in range(3):
        layer = Image.new('L', im.size, 0)
        dl = ImageDraw.Draw(layer)
        rnd = random.Random(30 + i)
        y = H * S * (0.26 + 0.1 * i)
        for _ in range(7):
            x = rnd.uniform(-100, W * S)
            dl.ellipse([x, y - 8 * S, x + rnd.uniform(220, 520) * S / 2, y + rnd.uniform(8, 16) * S], fill=80)
        layer = layer.filter(ImageFilter.GaussianBlur(12 * S))
        col = Image.new('RGBA', im.size, hexc('#14040c'))
        col.putalpha(layer)
        im.alpha_composite(col)
    silhouette(im, ridge(W * S, H * S * 0.72, 40 * S, 200 * S, 14, 4, 8), '#1f0814')
    cathedral(im, W * S * 0.32, H * S * 0.82, 2.3 * S, '#0c0409', '#ffb454')
    mist(im, H * S * 0.84, 90 * S, '#a02a42', 120, 12)
    silhouette(im, ridge(W * S, H * S * 0.9, 24 * S, 120 * S, 15, 4, 8), '#090307')
    d = ImageDraw.Draw(im)
    # grades de ferro e árvores secas
    for x in range(0, W * S, 38 * S // 2):
        d.line([(x, H * S * 0.9), (x, H * S * 0.98)], fill=hexc('#050205'), width=3 * S)
        d.polygon([(x - 4 * S, H * S * 0.9), (x, H * S * 0.9 - 14 * S), (x + 4 * S, H * S * 0.9)], fill=hexc('#050205'))
    d.line([(0, H * S * 0.93), (W * S, H * S * 0.93)], fill=hexc('#050205'), width=4 * S)
    d.rectangle([0, H * S * 0.97, W * S, H * S], fill=hexc('#050205'))
    rnd = random.Random(44)
    for i in range(9):
        bat(d, rnd.uniform(0.35, 0.95) * W * S, rnd.uniform(0.1, 0.5) * H * S, rnd.uniform(0.7, 1.7) * S, rnd.uniform(-1, 1))
    finish(im, 'vampiro.webp', 0.55, 12)


ART = {'generico': art_generic, 'dnd': art_dnd, 'altherium': art_altherium, 'vampiro': art_vampiro}

if __name__ == '__main__':
    which = [a for a in sys.argv[1:] if not a.startswith('--')]
    for key, fn in ART.items():
        if not which or key in which:
            fn()
