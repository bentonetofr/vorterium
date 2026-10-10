"""Chapéus do pós-apocalipse: boné, gorro, capacete militar, boina e chapéu de aba larga.

Cada chapéu é desenhado em cada quadro da caminhada, ancorado na caixa da cabeça (como as peças de rosto), em várias cores
(variantes prontas: `<pasta>/walk/<variante>.png`). Linhas da folha: 0 = de costas, 1 = olhando pra esquerda, 2 = de frente,
3 = olhando pra direita.
"""
from __future__ import annotations

import os

from PIL import Image

from .faces import HeadGeo
from .garments import camo, reskin
from .palettes import CANVAS, OLIVE, PLASTIC_GREEN, TARP_BLUE, WOOD
from .px import Cv, RGBA, ramp, rgb, rng, _hash
from .weapons import BODIES, FRAMES, SHEETS

Z_HAT = 130

RAMPS: dict[str, list[RGBA]] = {
    'preto': ramp('#0b0b0d', '#17181b', '#25272b', '#383b41', '#4f545b'),
    'cinza': ramp('#1d1e20', '#303236', '#494c52', '#666a72', '#858a93'),
    'vermelho': ramp('#2a0d0b', '#4a1411', '#6d1d17', '#8f2a20', '#b33a2b'),
    'vinho': ramp('#1f0a10', '#391219', '#551a24', '#74252f', '#933641'),
    'azul': list(TARP_BLUE),
    'verde': list(PLASTIC_GREEN),
    'oliva': list(OLIVE),
    'caqui': list(CANVAS),
    'marrom': list(WOOD),
    'camuflado': list(OLIVE),
}


def _clip_below(cv: Cv, ymax: int) -> None:
    for y in range(ymax + 1, cv.h):
        for x in range(cv.w):
            cv.px(x, y, (0, 0, 0, 0))


def _dome(cv: Cv, x0: int, x1: int, ytop: int, ybot: int, rp: list[RGBA], seed: int, bulge: int = 2) -> None:
    """Cúpula: elipse que a gente corta embaixo."""
    w = x1 - x0 + 1
    cv.tex_ell(x0 - bulge, ytop, w + bulge * 2, (ybot - ytop) * 2, rp, seed, 2.5, 0.55)
    _clip_below(cv, ybot)
    cv.line(x0 - bulge + 2, ybot, x1 + bulge - 2, ybot, rp[0])


# ── Os desenhos ───────────────────────────────────────────

def cap(cv: Cv, row: int, box, rp: list[RGBA], seed: int) -> None:
    x0, y0, x1, y1 = box
    h = y1 - y0
    yb = y0 + int(h * 0.40)
    _dome(cv, x0, x1, y0 - 4, yb, rp, seed)
    cv.line(x0 + 2, y0 - 2, x1 - 2, y0 - 2, rp[4])
    if row == 2:                                              # de frente: a aba cobre a testa
        cv.poly([(x0 + 1, yb - 1), (x1 - 1, yb - 1), (x1 + 1, yb + 3), (x0 - 1, yb + 3)], rp[1])
        cv.line(x0, yb + 2, x1, yb + 2, rp[0]); cv.line(x0 + 2, yb, x1 - 2, yb, rp[3])
    elif row == 0:                                            # de costas: o ajuste atrás
        cv.rect((x0 + x1) // 2 - 3, yb - 2, 6, 3, rp[0]); cv.px((x0 + x1) // 2 - 1, yb - 1, rp[2])
    else:                                                     # de lado: a aba sai pela frente
        sign = -1 if row == 1 else 1
        fx = x0 if sign < 0 else x1
        pts = [(fx, yb - 2), (fx + sign * 8, yb), (fx + sign * 7, yb + 2), (fx - sign * 1, yb + 2)]
        cv.poly(pts, rp[1]); cv.line(fx, yb + 2, fx + sign * 7, yb + 2, rp[0]); cv.line(fx, yb - 1, fx + sign * 6, yb, rp[3])


def beanie(cv: Cv, row: int, box, rp: list[RGBA], seed: int) -> None:
    x0, y0, x1, y1 = box
    h = y1 - y0
    yb = y0 + int(h * 0.40)
    _dome(cv, x0, x1, y0 - 5, yb, rp, seed, 2)
    for x in range(x0 - 1, x1 + 2, 3):                        # fios da lã
        cv.line(x, y0 - 3, x - 1, yb - 4, rp[1])
    cv.rect(x0 - 2, yb - 3, x1 - x0 + 5, 4, rp[3])             # a dobra
    for x in range(x0 - 2, x1 + 3, 2):
        cv.px(x, yb - 2, rp[2]); cv.px(x + 1, yb, rp[2])
    cv.line(x0 - 2, yb + 1, x1 + 2, yb + 1, rp[0])
    cv.ell((x0 + x1) // 2 - 2, y0 - 8, 5, 5, rp[4]); cv.px((x0 + x1) // 2 - 1, y0 - 7, rp[4])      # pompom


def helmet(cv: Cv, row: int, box, rp: list[RGBA], seed: int) -> None:
    x0, y0, x1, y1 = box
    h = y1 - y0
    yb = y0 + int(h * 0.50)
    _dome(cv, x0, x1, y0 - 5, yb, rp, seed, 3)
    cv.line(x0 - 1, yb - 1, x1 + 1, yb - 1, rp[4])             # aro
    cv.line(x0 - 2, yb, x1 + 2, yb, rp[0])
    cv.line(x0 + 3, y0 - 3, x1 - 3, y0 - 3, rp[4]); cv.px(x0 + 4, y0 - 2, rp[4])
    r = rng(seed + row)
    for _ in range(5):                                         # amassados
        cv.px(r.randint(x0, x1), r.randint(y0 - 2, yb - 3), rp[1])
    if row == 2:                                              # jugular dos dois lados
        cv.line(x0, yb + 1, x0 + 1, y1 - 2, rp[1]); cv.line(x1, yb + 1, x1 - 1, y1 - 2, rp[1])
    elif row in (1, 3):
        sign = -1 if row == 1 else 1
        fx = x0 if sign < 0 else x1
        cv.line(fx - sign * 6, yb + 1, fx - sign * 7, y1 - 1, rp[1])
        cv.line(fx - sign * 6, y1 - 1, fx - sign * 1, y1 - 3, rp[1])


def beret(cv: Cv, row: int, box, rp: list[RGBA], seed: int) -> None:
    x0, y0, x1, y1 = box
    h = y1 - y0
    yb = y0 + int(h * 0.30)
    tilt = -2 if row in (1, 2) else 2
    cv.tex_ell(x0 - 3 + tilt, y0 - 3, x1 - x0 + 8, 11, rp, seed, 2.5, 0.55)
    cv.line(x0 - 1, yb + 4, x1 + 1, yb + 4, rp[0])
    cv.rect(x0 - 1, yb + 2, x1 - x0 + 3, 2, rp[1])             # a faixa
    cv.px((x0 + x1) // 2 + tilt, y0 - 4, rp[1]); cv.px((x0 + x1) // 2 + tilt, y0 - 5, rp[2])
    cv.line(x0 + 3 + tilt, y0 - 1, x0 + 8 + tilt, y0 - 2, rp[4])


def wide_hat(cv: Cv, row: int, box, rp: list[RGBA], seed: int) -> None:
    x0, y0, x1, y1 = box
    ycrown = y0 - 2
    cv.tex_ell(x0, y0 - 8, x1 - x0 + 1, 12, rp, seed, 2.5, 0.5)                   # copa
    cv.rect(x0 + 1, y0 - 2, x1 - x0 - 1, 2, rp[0])                               # fita
    cv.tex_ell(x0 - 6, ycrown + 1, x1 - x0 + 13, 8, rp, seed + 2, 3, 0.55)       # aba
    cv.line(x0 - 5, ycrown + 5, x1 + 5, ycrown + 5, rp[0])
    cv.line(x0 - 3, ycrown + 2, x1 + 3, ycrown + 2, rp[4])
    cv.line((x0 + x1) // 2 - 1, y0 - 7, (x0 + x1) // 2 + 1, y0 - 7, rp[1])      # vinco na copa


HATS = [
    ('bone', 'Boné', cap, ['preto', 'vermelho', 'azul', 'oliva', 'caqui', 'camuflado']),
    ('gorro', 'Gorro de lã', beanie, ['preto', 'cinza', 'vermelho', 'verde', 'azul']),
    ('capacete', 'Capacete militar', helmet, ['oliva', 'preto', 'camuflado']),
    ('boina', 'Boina', beret, ['preto', 'oliva', 'vinho']),
    ('chapeu', 'Chapéu de aba larga', wide_hat, ['marrom', 'preto', 'caqui']),
]


def _sheet(geo: HeadGeo, fn, variant: str, seed: int) -> Image.Image:
    rp = RAMPS[variant]
    out = Image.new('RGBA', (FRAMES * 64, 256), (0, 0, 0, 0))
    for r in range(4):
        for c in range(FRAMES):
            cv = Cv(64, 64)
            fn(cv, r, geo.box[(r, c)], rp, seed)
            cv.outline()
            out.alpha_composite(cv.im, (c * 64, r * 64))
    if variant == 'camuflado':
        pat = camo('#4b5a2f', '#2a331c', '#3a4726', '#6a7a45', seed + 3)
        out = reskin(out, pat, 0.12, 0.62)
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    geos = {b: HeadGeo(assets, b) for b in BODIES}
    items: list[dict] = []
    for slug, name, fn, variants in HATS:
        paths = {}
        for body in BODIES:
            rel = f'tlou/hats/{slug}/{body}/'
            d = os.path.join(assets, SHEETS, rel, 'walk')
            os.makedirs(d, exist_ok=True)
            for v in variants:
                _sheet(geos[body], fn, v, 41 + len(slug)).save(os.path.join(d, f'{v}.png'), optimize=True)
            paths[body] = rel
        items.append({'id': f'tlou/hat/{slug}', 'slot': 'hat', 'name': name, 'layers': [{'z': Z_HAT, 'paths': paths}],
                      'bodies': list(BODIES), 'anims': ['walk'], 'variants': variants})
    return [], items


def preview(assets: str, out: str, scale: int = 4) -> None:
    from PIL import ImageDraw
    body = 'male'
    geo = HeadGeo(assets, body)
    bsheet = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA')
    hsheet = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', 'male', 'walk.png')).convert('RGBA')
    rows = [(slug, name, fn, v) for slug, name, fn, variants in HATS for v in variants]
    cols = 4
    cell = 64 * scale
    canvas = Image.new('RGBA', (cols * cell, len(rows) * (cell + 12)), (74, 82, 66, 255))
    d = ImageDraw.Draw(canvas)
    for i, (slug, name, fn, v) in enumerate(rows):
        sh = _sheet(geo, fn, v, 41 + len(slug))
        for j, r in enumerate((2, 0, 1, 3)):
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            box = (2 * 64, r * 64, 3 * 64, r * 64 + 64)
            tile.alpha_composite(bsheet.crop(box)); tile.alpha_composite(hsheet.crop(box)); tile.alpha_composite(sh.crop(box))
            canvas.alpha_composite(tile.resize((cell, cell), Image.NEAREST), (j * cell, i * (cell + 12) + 12))
        d.text((2, i * (cell + 12)), f'{name} ({v})', fill=(255, 255, 255, 255))
    canvas.save(out)
