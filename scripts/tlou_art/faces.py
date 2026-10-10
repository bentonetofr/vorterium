"""Peças de cabeça e rosto: máscara de gás, fungo (cordyceps), veias de infectado e sujeira.

Cada peça é desenhada em cada quadro da caminhada (4 direções × 9 quadros), ancorada na caixa da cabeça
lida da folha da cabeça: o desenho acompanha o balanço de 1 px da caminhada. Só a folha "walk" é gravada
(o motor usa a walk pra parado e correndo).
"""
from __future__ import annotations

import math
import os

from PIL import Image

from .palettes import FUNGUS, FUNGUS_DEEP, FUNGUS_PALE, GLASS
from .px import Cv, RGBA, fbm, rgb, rng, _hash
from .weapons import BODIES, FRAMES, SHEETS

Z_FACE = 118
Z_SKIN = 90

RUBBER = [rgb('#101214'), rgb('#1b1e21'), rgb('#292d31'), rgb('#3a4046'), rgb('#4f575e')]
OLIVE_TUBE = [rgb('#1f2418'), rgb('#343c27'), rgb('#4b5638'), rgb('#657249')]

SLOTS = [
    {'id': 'infection', 'label': 'Fungo (cordyceps)', 'group': 'Infecção'},
    {'id': 'grime', 'label': 'Sujeira e lama', 'group': 'Marcas'},
]


class HeadGeo:
    """Caixa da cabeça em cada quadro (x0, y0, x1, y1)."""

    def __init__(self, assets: str, body: str):
        folder = 'female' if body == 'female' else 'male'
        im = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', folder, 'walk.png')).convert('RGBA')
        self.box: dict[tuple[int, int], tuple[int, int, int, int]] = {}
        for r in range(4):
            for c in range(FRAMES):
                a = im.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64)).getchannel('A')
                bb = a.point(lambda v: 255 if v > 20 else 0).getbbox()
                self.box[(r, c)] = bb or (21, 15, 43, 36)


def sheet_from(draw, geo: HeadGeo, body: str) -> Image.Image:
    """Monta uma folha walk chamando `draw(cv, row, box)` em cada quadro."""
    out = Image.new('RGBA', (FRAMES * 64, 256), (0, 0, 0, 0))
    for r in range(4):
        for c in range(FRAMES):
            cv = Cv(64, 64)
            draw(cv, r, geo.box[(r, c)], c)
            out.alpha_composite(cv.im, (c * 64, r * 64))
    return out


# ── Máscara de gás ───────────────────────────────────────

def gas_mask(cv: Cv, row: int, box, col: int) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    top = y0
    lens = [GLASS[0], GLASS[1], GLASS[2], GLASS[3]]

    def lens_at(x: int, y: int, w: int, h: int) -> None:
        cv.ell(x - 1, y - 1, w + 2, h + 2, RUBBER[1])
        cv.ell(x, y, w, h, GLASS[1])
        cv.ell(x + 1, y + 1, w - 2, h - 2, GLASS[2])
        cv.px(x + 1, y + 1, rgb('#d9ecec')); cv.px(x + 2, y + 1, GLASS[3])

    if row == 2:                                              # de frente
        cv.poly([(x0 + 2, top + 6), (x1 - 2, top + 6), (x1 - 1, top + 12), (x1 - 4, y1 - 1), (cx, y1 + 1), (x0 + 4, y1 - 1), (x0 + 1, top + 12)], RUBBER[2])
        cv.rect(x0 + 2, top + 6, x1 - x0 - 3, 1, RUBBER[4])
        lens_at(cx - 9, top + 8, 7, 6)
        lens_at(cx + 2, top + 8, 7, 6)
        cv.ell(cx - 3, top + 14, 7, 6, RUBBER[1])             # filtro
        cv.ell(cx - 2, top + 15, 5, 4, OLIVE_TUBE[2]); cv.px(cx, top + 16, OLIVE_TUBE[3])
        for k in range(3):
            cv.px(cx - 1 + k, top + 18, RUBBER[0])
        cv.line(x0 - 1, top + 9, x0 + 2, top + 9, RUBBER[0]); cv.line(x1 - 1, top + 9, x1 + 2, top + 9, RUBBER[0])   # tiras
    elif row == 0:                                            # de costas: só as tiras
        cv.rect(x0, top + 8, x1 - x0, 2, RUBBER[1])
        cv.rect(cx - 1, top + 2, 2, 7, RUBBER[1])
        cv.px(cx - 1, top + 8, RUBBER[4]); cv.px(cx, top + 5, RUBBER[3])
    else:                                                     # de lado
        sign = -1 if row == 1 else 1                           # esquerda olha pra x menor
        fx = x0 if sign < 0 else x1                            # a frente do rosto
        inward = -sign                                         # pra dentro da cabeça

        def px_(dx: int) -> int:
            return fx + inward * dx
        cv.poly([(px_(0), top + 7), (px_(8), top + 6), (px_(11), top + 11), (px_(8), y1), (px_(1), y1 - 1)], RUBBER[2])
        lens_at(min(px_(1), px_(6)), top + 8, 6, 6)
        cv.ell(min(px_(-3), px_(2)), top + 14, 6, 6, RUBBER[1])  # filtro saltando pra frente
        cv.ell(min(px_(-2), px_(1)), top + 15, 4, 4, OLIVE_TUBE[2])
        cv.line(px_(8), top + 9, px_(18), top + 9, RUBBER[0])    # tira em volta da cabeça
        cv.line(px_(8), top + 10, px_(18), top + 10, RUBBER[1])


# ── Fungo (cordyceps) ────────────────────────────────────

def shelf(cv: Cv, cx: int, cy: int, w: int, h: int, flip_dir: int = 1) -> None:
    for ring in range(3):
        k = 1 - ring * 0.3
        rw, rh = max(2, int(w * k)), max(2, int(h * k))
        tone = FUNGUS_DEEP[2] if ring == 0 else FUNGUS[min(4, 2 + ring)]
        cv.d.pieslice([cx - rw // 2, cy - rh, cx + rw // 2, cy + rh], 180, 360, fill=tone)
    cv.d.arc([cx - w // 2, cy - h, cx + w // 2, cy + h], 195, 345, fill=FUNGUS_PALE[3])
    cv.line(cx - w // 2 + 1, cy, cx + w // 2 - 1, cy, FUNGUS_DEEP[0])


def fungus_head(cv: Cv, row: int, box, col: int) -> None:
    """Estalador: placas de fungo em volta da cabeça e o rosto coberto."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    r = rng(7 + row)
    if row == 2:
        cv.poly([(x0 + 3, y0 + 7), (x1 - 3, y0 + 7), (x1 - 1, y0 + 14), (x1 - 4, y1 - 1), (x0 + 4, y1 - 1), (x0 + 1, y0 + 14)], FUNGUS_PALE[2])
        cv.tex_ell(x0 + 4, y0 + 8, x1 - x0 - 8, y1 - y0 - 10, FUNGUS_PALE, 5, 2.5, 0.4)
        for k in range(3):                                  # rachaduras no tecido
            xx = cx - 6 + k * 6
            cv.line(xx, y0 + 9, xx + r.randint(-1, 1), y0 + 18, FUNGUS_DEEP[1])
        cv.rect(cx - 4, y1 - 4, 8, 2, FUNGUS_DEEP[1])        # boca costurada
    elif row == 0:
        cv.tex_ell(x0 + 1, y0 + 2, x1 - x0 - 2, y1 - y0 - 4, FUNGUS_DEEP, 9, 2.5, 0.3)
    else:
        inward = 1 if row == 1 else -1
        fx = x0 if row == 1 else x1
        cv.poly([(fx, y0 + 7), (fx + inward * 9, y0 + 7), (fx + inward * 10, y1 - 2), (fx + inward * 1, y1 - 1)], FUNGUS_PALE[2])
    # placas em arco: topo e laterais
    spots = [(x0 + 3, y0 + 9), (cx, y0 + 4), (x1 - 3, y0 + 9), (x0, y0 + 16), (x1, y0 + 16), (x0 + 2, y1 - 2), (x1 - 2, y1 - 2)]
    for k, (sx, sy) in enumerate(spots):
        shelf(cv, sx, sy + 3, r.randint(7, 10), r.randint(4, 5))
    for _ in range(5):
        cv.px(r.randint(x0, x1), r.randint(y0 + 6, y1 - 2), FUNGUS_PALE[4])


def fungus_partial(cv: Cv, row: int, box, col: int) -> None:
    """Fungo só de um lado da cabeça e no ombro."""
    x0, y0, x1, y1 = box
    r = rng(21 + row)
    side = x0 if row in (2, 1) else x1
    sx = 1 if side == x0 else -1
    for k, (dx, dy, w, h) in enumerate(((2, 6, 9, 5), (4, 12, 8, 4), (0, 17, 8, 4))):
        shelf(cv, side + sx * dx, y0 + dy + 3, w, h)
    shelf(cv, side + sx * 5, y1 + 6, 10, 5)                   # ombro
    shelf(cv, side + sx * 11, y1 + 9, 8, 4)
    for _ in range(3):
        cv.px(side + sx * r.randint(0, 8), y0 + r.randint(6, 20), FUNGUS_PALE[4])


def dark_veins(cv: Cv, row: int, box, col: int) -> None:
    """Infectado recente: olheiras fundas e veias escuras no rosto (translúcidas)."""
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    ink = rgb('#2a1224', 140)
    vein = rgb('#3a1630', 170)
    if row == 2:
        cv.ell(cx - 9, y0 + 10, 7, 5, ink); cv.ell(cx + 2, y0 + 10, 7, 5, ink)
        for (xa, ya, xb, yb) in ((cx - 8, y0 + 15, cx - 11, y0 + 20), (cx + 8, y0 + 15, cx + 11, y0 + 20), (cx - 1, y0 + 5, cx - 3, y0 + 10), (cx + 3, y0 + 5, cx + 5, y0 + 10)):
            cv.line(xa, ya, xb, yb, vein)
    elif row in (1, 3):
        inward = 1 if row == 1 else -1
        fx = x0 if row == 1 else x1
        cv.ell(min(fx + inward * 1, fx + inward * 6), y0 + 10, 6, 5, ink)
        cv.line(fx + inward * 2, y0 + 15, fx + inward * 5, y0 + 21, vein)
        cv.line(fx + inward * 7, y0 + 7, fx + inward * 9, y0 + 13, vein)


# ── Sujeira e lama (sobre o corpo) ──────────────────────

def grime_sheet(assets: str, body: str, variant: str) -> Image.Image:
    base = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA')
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    cfg = {'leve': (0.64, 0.7, '#3d2f22', 120), 'pesada': (0.5, 0.8, '#2f2318', 165), 'lama': (0.4, 0.9, '#4a3820', 190)}[variant]
    thr, mud_low, col, alpha = cfg
    colr = rgb(col, alpha)
    seed = {'leve': 11, 'pesada': 23, 'lama': 37}[variant]
    W, H = base.size
    for y in range(H):
        for x in range(W):
            if base.getpixel((x, y))[3] < 60:
                continue
            fy = y % 64
            v = fbm(x / 3.0, y / 3.0, seed, 3)
            low = 1.0 - max(0.0, (fy - 36) / 28.0)              # mais sujo perto dos pés (y alto)
            if v > thr + (low * 0.18) - (0.12 if fy > 52 else 0):
                out.putpixel((x, y), colr)
            elif _hash(x, y, seed + 5) > 0.97:
                out.putpixel((x, y), rgb('#1e1710', alpha))
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    geos = {b: HeadGeo(assets, b) for b in BODIES}
    items: list[dict] = []

    def head_item(iid: str, slot: str, name: str, fn, subdir: str, z: int = Z_FACE) -> None:
        paths = {}
        for body in BODIES:
            rel = f'tlou/faces/{subdir}/{body}/'
            d = os.path.join(assets, SHEETS, rel)
            os.makedirs(d, exist_ok=True)
            sheet_from(fn, geos[body], body).save(os.path.join(d, 'walk.png'), optimize=True)
            paths[body] = rel
        items.append({'id': iid, 'slot': slot, 'name': name, 'layers': [{'z': z, 'paths': paths}],
                      'bodies': list(BODIES), 'anims': ['walk']})

    head_item('tlou/mask/mascara-gas', 'mask', 'Máscara de gás', gas_mask, 'mascara-gas')
    head_item('tlou/infection/estalador', 'infection', 'Fungo de Estalador (cabeça coberta)', fungus_head, 'estalador', 122)
    head_item('tlou/infection/fungo-parcial', 'infection', 'Fungo parcial (cabeça e ombro)', fungus_partial, 'fungo-parcial', 122)
    head_item('tlou/infection/veias', 'infection', 'Infectado recente (veias e olheiras)', dark_veins, 'veias', 117)

    # sujeira: três graus, como variantes (arquivos <dir>/walk/<variante>.png)
    variants = ['leve', 'pesada', 'lama']
    paths = {}
    for body in BODIES:
        rel = f'tlou/grime/{body}/'
        d = os.path.join(assets, SHEETS, rel, 'walk')
        os.makedirs(d, exist_ok=True)
        for v in variants:
            grime_sheet(assets, body, v).save(os.path.join(d, f'{v}.png'), optimize=True)
        paths[body] = rel
    items.append({'id': 'tlou/grime/sujeira', 'slot': 'grime', 'name': 'Sujeira e lama', 'layers': [{'z': Z_SKIN, 'paths': paths}],
                  'bodies': list(BODIES), 'anims': ['walk'], 'variants': variants})
    return SLOTS, items


def preview(assets: str, out: str, body: str = 'male', scale: int = 6) -> None:
    """Cabeças de frente, de costas e de lado com cada peça, sobre a cabeça lisa."""
    geo = HeadGeo(assets, body)
    head = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', 'female' if body == 'female' else 'male', 'walk.png')).convert('RGBA')
    bodysheet = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA')
    cases = [('máscara de gás', gas_mask), ('Estalador', fungus_head), ('fungo parcial', fungus_partial), ('veias', dark_veins)]
    from PIL import ImageDraw
    W = 4 * 64 * scale
    canvas = Image.new('RGBA', (W, (len(cases) + 3) * 64 * scale // 1 + 20), (74, 82, 66, 255))
    d = ImageDraw.Draw(canvas)
    for i, (label, fn) in enumerate(cases):
        sheet = sheet_from(fn, geo, body)
        for j, r in enumerate((2, 0, 1, 3)):
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            box = (2 * 64, r * 64, 3 * 64, r * 64 + 64)
            tile.alpha_composite(bodysheet.crop(box)); tile.alpha_composite(head.crop(box)); tile.alpha_composite(sheet.crop(box))
            canvas.alpha_composite(tile.resize((64 * scale, 64 * scale), Image.NEAREST), (j * 64 * scale, i * 64 * scale + 14))
        d.text((2, i * 64 * scale), label, fill=(255, 255, 255, 255))
    # sujeira
    for k, v in enumerate(('leve', 'pesada', 'lama')):
        g = grime_sheet(assets, body, v)
        i = len(cases) + k
        for j, r in enumerate((2, 0, 1, 3)):
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            box = (2 * 64, r * 64, 3 * 64, r * 64 + 64)
            tile.alpha_composite(bodysheet.crop(box)); tile.alpha_composite(head.crop(box)); tile.alpha_composite(g.crop(box))
            canvas.alpha_composite(tile.resize((64 * scale, 64 * scale), Image.NEAREST), (j * 64 * scale, i * 64 * scale + 14))
        d.text((2, i * 64 * scale), f'sujeira: {v}', fill=(255, 255, 255, 255))
    canvas.save(out)
