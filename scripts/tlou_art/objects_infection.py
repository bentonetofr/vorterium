"""Objetos: a infecção. Fungo (cordyceps) nas paredes e no chão, casulos, bulbos e nuvens de esporos."""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

from .objects_ruins import jag, moss_patch
from .palettes import *  # noqa: F403
from .px import Cv, rgb, rng, scatter
from .sheet import Sheet, solid

CAT = 'Apocalipse: Infecção'
TAGS = ['pós-apocalipse', 'fungo', 'cordyceps', 'infecção']


# ── Peças de fungo ───────────────────────────────────────

def plate(cv: Cv, cx: int, cy: int, w: int, h: int, seed: int, tilt: int = 0) -> None:
    """Uma 'prateleira' de fungo (meia-lua com anéis de crescimento)."""
    r = rng(seed)
    for ring in range(3):
        k = 1 - ring * 0.28
        rw, rh = int(w * k), int(h * k)
        tone = FUNGUS[min(4, 2 + ring)] if ring < 2 else FUNGUS_PALE[3]
        if ring == 0:
            tone = FUNGUS_DEEP[2]
        cv.d.pieslice([cx - rw // 2, cy - rh, cx + rw // 2, cy + rh], 180, 360, fill=tone)
    # bordinha clara e brilho
    cv.d.arc([cx - w // 2, cy - h, cx + w // 2, cy + h], 195, 345, fill=FUNGUS_PALE[3])
    for _ in range(max(1, w // 6)):
        x = cx + r.randint(-w // 3, w // 3)
        y = cy - r.randint(1, max(2, h // 2))
        cv.px(x, y, FUNGUS_PALE[4])
    cv.line(cx - w // 2 + 1, cy, cx + w // 2 - 1, cy, FUNGUS_DEEP[0])


def tendril(cv: Cv, x: float, y: float, ang: float, ln: int, seed: int, depth: int = 0, thick: int = 1) -> None:
    r = rng(seed)
    for i in range(ln):
        ang += r.uniform(-0.35, 0.35)
        x += math.cos(ang)
        y += math.sin(ang)
        tone = FUNGUS_DEEP[1] if i % 3 else FUNGUS[2]
        cv.px(round(x), round(y), tone)
        if thick > 1:
            cv.px(round(x) + 1, round(y), FUNGUS_DEEP[2])
        if depth < 2 and i > 3 and r.random() < 0.13:
            tendril(cv, x, y, ang + r.choice((-0.9, 0.9)), max(3, ln // 2 - i // 2), seed + i * 7, depth + 1)
    if r.random() < 0.7:
        cv.px(round(x), round(y), FUNGUS_PALE[4])      # pontinha clara (esporo)


def pods(cv: Cv, r, n: int, area: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = area
    for _ in range(n):
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        cv.px(x, y, FUNGUS_PALE[3]); cv.px(x + 1, y, FUNGUS_PALE[4]); cv.px(x, y + 1, FUNGUS[1])


# ── Chão ─────────────────────────────────────────────────

def mycelium(seed: int, w: int = 48, h: int = 28) -> Cv:
    cv = Cv(w, h)
    r = rng(seed)
    cv.tex_poly(jag(w / 2, h / 2, w / 2 - 5, h / 2 - 4, 13, 0.3, seed),
                [rgb('#241a12'), rgb('#33241a'), rgb('#473322')], seed, 2.5, 0.3, 0.3)
    for k in range(7):
        a = r.uniform(0, math.tau)
        tendril(cv, w / 2 + math.cos(a) * 4, h / 2 + math.sin(a) * 3, a, r.randint(8, w // 2 - 2), seed + k * 11)
    pods(cv, r, 7, (6, 5, w - 7, h - 6))
    cv.finish(outline=False)
    return cv


def tendril_floor(seed: int = 60) -> Cv:
    cv = Cv(72, 40)
    r = rng(seed)
    cx, cy = 14, 22
    for k in range(9):
        a = r.uniform(-0.9, 0.9)
        tendril(cv, cx, cy + r.randint(-3, 3), a, r.randint(24, 56), seed + k * 13, 0, 2)
    cv.ell(8, 17, 12, 10, FUNGUS_DEEP[2])
    cv.ell(10, 18, 8, 7, FUNGUS[2])
    cv.px(13, 20, FUNGUS_PALE[4])
    pods(cv, r, 12, (18, 8, 66, 34))
    cv.finish(outline=False)
    return cv


def fungal_body(seed: int = 70) -> Cv:
    """Um vulto tomado pelo fungo, caído no chão."""
    cv = Cv(64, 32)
    cv.tex_poly([(6, 18), (16, 12), (40, 12), (58, 17), (58, 24), (12, 26)], rgb('#3b3128') and [rgb('#2b231c'), rgb('#3c3128'), rgb('#52443a')], seed, 3, 0.4)
    cv.ell(2, 12, 14, 12, rgb('#4a3d33'))                               # cabeça
    r = rng(seed)
    for k in range(7):
        plate(cv, 16 + k * 7 + r.randint(-1, 1), 17 + r.randint(-1, 3), r.randint(9, 15), r.randint(5, 8), seed + k, 0)
    for k in range(3):
        tendril(cv, 6 + r.randint(0, 6), 18, r.uniform(-2.5, -0.6), 9, seed + 40 + k)
    cv.finish(shadow=(32, 29, 58, 6))
    return cv


# ── Parede e teto ────────────────────────────────────────

def wall_growth(seed: int, w: int = 44, h: int = 50, density: int = 7) -> Cv:
    cv = Cv(w, h)
    r = rng(seed)
    base_y = h - 6
    # miolo escuro de onde cresce
    mass = [rgb('#241a12'), rgb('#33241a'), rgb('#473322')]
    cv.tex_poly(jag(w / 2, base_y - 8, w / 2 - 4, h / 2 - 8, 11, 0.32, seed), mass, seed, 2.5, 0.3)
    cv.tex_poly(jag(w / 2, base_y - 2, w / 2 - 2, 7, 9, 0.3, seed + 3), mass, seed + 1, 2.5, 0.3)      # base mais larga
    for k in range(density):
        px_ = r.randint(8, w - 8)
        py_ = r.randint(10, base_y - 2)
        plate(cv, px_, py_, r.randint(10, 17), r.randint(6, 9), seed + k * 5)
    for k in range(4):
        tendril(cv, r.randint(8, w - 8), base_y, r.uniform(-2.4, -0.7), r.randint(10, 22), seed + 90 + k)
    pods(cv, r, 8, (6, 10, w - 7, base_y))
    cv.finish(outline=True)
    return cv


def ceiling_growth(seed: int = 80) -> Cv:
    cv = Cv(84, 52)
    r = rng(seed)
    cv.tex_poly([(0, 0), (84, 0), (84, 8), (60, 12), (42, 9), (20, 13), (0, 8)], [rgb('#241a12'), rgb('#33241a'), rgb('#473322')], seed, 2.5, 0.3)
    for k in range(9):
        x = r.randint(4, 80)
        tendril(cv, x, 8, math.pi / 2 + r.uniform(-0.5, 0.5), r.randint(14, 40), seed + k * 17)
    for k in range(6):
        plate(cv, r.randint(8, 76), r.randint(6, 14), r.randint(10, 16), r.randint(5, 8), seed + 50 + k)
    pods(cv, r, 10, (4, 12, 80, 44))
    cv.finish(outline=False)
    return cv


# ── De pé ────────────────────────────────────────────────

def cocoon(seed: int = 90, pulse: int = 0) -> Cv:
    cv = Cv(36, 60)
    h = 40 + pulse
    cv.tex_ell(7, 54 - h, 22, h, FUNGUS_PALE, seed, 3, 0.55)
    r = rng(seed)
    for k in range(6):                     # faixas de fungo enroladas
        y = 54 - h + 6 + k * (h // 7)
        cv.line(8 + r.randint(0, 2), y, 27 - r.randint(0, 2), y + r.randint(-2, 2), FUNGUS[1], 2)
    for k in range(5):
        plate(cv, r.randint(10, 26), r.randint(54 - h + 6, 50), r.randint(8, 12), r.randint(4, 6), seed + k)
    cv.ell(14, 54 - h + 2, 6, 3, FUNGUS_PALE[4])
    for k in range(4):
        tendril(cv, r.randint(10, 26), 52, r.uniform(-2.8, -0.3), 9, seed + 20 + k)
    cv.finish(shadow=(18, 55, 28, 5))
    return cv


def bracket_log(seed: int = 100, kind: int = 0) -> Cv:
    cv = Cv(36, 30)
    r = rng(seed)
    cv.tex_rect(4, 14, 28, 12, WOOD, seed, 2.5, 0.5)
    cv.ell(2, 14, 6, 12, WOOD[3]); cv.ell(4, 16, 3, 8, WOOD[1])
    for k in range(3 + kind):
        plate(cv, r.randint(12, 30), r.randint(12, 16), r.randint(9, 14), r.randint(5, 8), seed + k)
    cv.finish(shadow=(18, 27, 32, 5))
    return cv


def spore_pod(seed: int = 110, frame: int = 0, frames: int = 4) -> Cv:
    """Bulbo de esporos. Cada quadro solta uma baforada que sobe."""
    cv = Cv(40, 64)
    r = rng(seed)
    grow = [0, 1, 2, 1][frame % 4]
    cv.tex_poly([(14, 52), (18, 36 - grow), (22, 36 - grow), (26, 52)], FUNGUS_DEEP, seed, 2, 0.4)     # haste
    cv.tex_ell(8 - grow // 2, 22 - grow, 24 + grow, 20 + grow, FUNGUS, seed + 1, 2.5, 0.5)            # bulbo
    cv.ell(15, 25 - grow, 8, 5, FUNGUS_PALE[3])
    for k in range(5):
        plate(cv, r.randint(8, 32), 50 + r.randint(0, 2), r.randint(8, 12), r.randint(4, 6), seed + k)
    cv.finish(shadow=(20, 56, 32, 6))
    # baforada (translúcida, sobe conforme o quadro)
    layer = Image.new('RGBA', (cv.w, cv.h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for k in range(7):
        t = (frame / frames + k / 7) % 1.0
        x = 20 + math.sin(t * 6 + k) * (4 + t * 8)
        y = 24 - t * 22
        rad = 1 + t * 3
        alpha = int(150 * (1 - t))
        ld.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(238, 228, 196, alpha))
    cv.im.alpha_composite(layer)
    cv.d = ImageDraw.Draw(cv.im)
    return cv


def fungal_tree(seed: int = 120) -> Cv:
    cv = Cv(72, 120)
    r = rng(seed)
    cv.tex_poly([(28, 112), (31, 60), (30, 30), (40, 30), (41, 60), (46, 112)], WOOD, seed, 3, 0.5)
    for (x0, y0, x1, y1) in ((35, 44, 14, 20), (36, 38, 58, 14), (34, 62, 12, 50), (38, 70, 62, 52), (35, 28, 30, 6), (36, 28, 44, 4)):
        cv.line(x0, y0, x1, y1, WOOD[1], 3)
        cv.line(x0, y0, x1, y1, WOOD[2], 1)
    for k in range(9):
        plate(cv, r.randint(28, 46), r.randint(44, 104), r.randint(9, 15), r.randint(5, 8), seed + k)
    for k in range(5):
        tendril(cv, r.randint(30, 44), r.randint(80, 108), r.uniform(-2.9, -0.3), r.randint(10, 22), seed + 60 + k)
    moss_patch(cv, 24, 100, 26, 12, seed + 3, 0.3)
    cv.finish(shadow=(36, 114, 40, 7))
    return cv


# ── Esporos no ar ───────────────────────────────────────

def spore_cloud(frame: int, frames: int = 6, w: int = 96, h: int = 64, seed: int = 130) -> Cv:
    cv = Cv(w, h)
    r = rng(seed)
    blobs = [(r.uniform(14, w - 14), r.uniform(12, h - 12), r.uniform(9, 18), r.uniform(0, math.tau)) for _ in range(16)]
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for (bx, by, br, ph) in blobs:
        t = frame / frames * math.tau
        x = bx + math.sin(t + ph) * 5
        y = by + math.cos(t * 0.8 + ph) * 3
        rr = br * (1 + 0.08 * math.sin(t * 1.3 + ph))
        blob = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(blob).ellipse([x - rr, y - rr * 0.7, x + rr, y + rr * 0.7], fill=(226, 214, 176, 34))
        layer.alpha_composite(blob)
    # grãos de esporo mais nítidos
    d = ImageDraw.Draw(layer)
    for k in range(36):
        t = (frame / frames + k * 0.173) % 1.0
        x = (k * 37 % w) + math.sin(t * 6.28 + k) * 4
        y = (k * 53 % h) - t * 6
        d.point((int(x) % w, int(y) % h), fill=(246, 238, 208, 170))
    cv.im = layer
    cv.d = ImageDraw.Draw(cv.im)
    return cv


def spore_wisps(frame: int, frames: int = 4, seed: int = 140) -> Cv:
    cv = Cv(40, 40)
    layer = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = rng(seed)
    for k in range(22):
        bx, by = r.uniform(4, 36), r.uniform(8, 36)
        t = (frame / frames + k * 0.11) % 1.0
        x = bx + math.sin(t * 6.28 + k) * 3
        y = by - t * 10
        d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(240, 232, 200, int(190 * (1 - t))))
    cv.im = layer
    cv.d = ImageDraw.Draw(cv.im)
    return cv


def build(sh: Sheet) -> None:
    # chão
    for i, (w, h) in enumerate(((48, 28), (40, 24), (56, 32))):
        sh.add(mycelium(150 + i * 7, w, h), f'micelio-{i + 1}', f'Micélio no chão {i + 1}', CAT, ['micélio', 'chão'] + TAGS, kind='floor', sort=0,
               group='micelio-1' if i else None, variant=f'Variação {i + 1}' if i else None)
    sh.add(tendril_floor(), 'tentaculos-chao', 'Tentáculos de fungo no chão', CAT, ['tentáculos', 'chão'] + TAGS, kind='floor', sort=0)
    sh.add(fungal_body(), 'corpo-fungo', 'Corpo tomado pelo fungo', CAT, ['corpo', 'infectado', 'chão'] + TAGS, solids=[], sort=2)
    # parede e teto
    for i, (w, h, d) in enumerate(((44, 50, 7), (40, 46, 5), (60, 58, 11))):
        sh.add(wall_growth(170 + i * 9, w, h, d), f'cordyceps-parede-{i + 1}', f'Cordyceps na parede {i + 1}', CAT, ['parede', 'cordyceps'] + TAGS, kind='wall', sort=0,
               group='cordyceps-parede-1' if i else None, variant=f'Variação {i + 1}' if i else None)
    sh.add(ceiling_growth(), 'fungo-teto', 'Fungo pendurado no teto', CAT, ['teto', 'cordyceps', 'tentáculos'] + TAGS, kind='over', sort=0)
    # de pé
    sh.add([cocoon(190, 0), cocoon(190, 1), cocoon(190, 2), cocoon(190, 1)], 'casulo', 'Casulo fúngico', CAT, ['casulo', 'infectado'] + TAGS,
           solids=[solid(10, 10)], sort=3, fps=2)
    sh.add(bracket_log(200, 0), 'tronco-fungo-1', 'Tronco com fungo 1', CAT, ['tronco', 'cogumelo'] + TAGS, solids=[solid(14, 6)], sort=3)
    sh.add(bracket_log(205, 2), 'tronco-fungo-2', 'Tronco com fungo 2', CAT, ['tronco', 'cogumelo'] + TAGS, solids=[solid(14, 6)], sort=3,
           group='tronco-fungo-1', variant='Mais fungo')
    sh.add([spore_pod(210, f) for f in range(4)], 'bulbo-esporos', 'Bulbo de esporos', CAT, ['bulbo', 'esporos'] + TAGS,
           solids=[solid(8, 6)], sort=4, fps=4)
    sh.add(fungal_tree(), 'arvore-fungo', 'Árvore morta tomada pelo fungo', CAT, ['árvore', 'cordyceps'] + TAGS, solids=[solid(7, 5)], sort=4)
    # no ar
    sh.add([spore_cloud(f) for f in range(6)], 'nuvem-esporos', 'Nuvem de esporos', CAT, ['esporos', 'nuvem', 'ar'] + TAGS, kind='over', sort=0, fps=3)
    sh.add([spore_wisps(f) for f in range(4)], 'esporos-flutuando', 'Esporos flutuando', CAT, ['esporos', 'ar'] + TAGS, kind='over', sort=0, fps=4)
