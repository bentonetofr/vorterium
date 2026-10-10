"""Infectados do Vortable: peças de personagem que transformam o boneco em Espreitador, Trôpego e Baiacu.

Cada peça é um desenho por cima do corpo e da cabeça (a máscara de pixels vem das folhas do corpo e da cabeça), feito
em todos os quadros da caminhada. Corredor e Estalador usam peças que já existem (veias e fungo de Estalador).
O motor usa a folha "walk" também parado e correndo.
"""
from __future__ import annotations

import os

from PIL import Image

from .palettes import FUNGUS, FUNGUS_DEEP, FUNGUS_PALE
from .px import RGBA, fbm, rgb, rng, _hash
from .weapons import BODIES, FRAMES, SHEETS

Z_CREATURE = 124

ROT = [rgb('#1d231a'), rgb('#2a3324'), rgb('#3a4630'), rgb('#4d5b3f'), rgb('#68775a')]
SAC = [rgb('#6e5f34'), rgb('#9b8a52'), rgb('#c3b072'), rgb('#e0d193'), rgb('#f3ebbf')]
PLATE = [rgb('#241a12'), rgb('#3b2a1a'), rgb('#59402a'), rgb('#7a5a3a'), rgb('#9c7a52')]
VEIN = rgb('#161a14')


def union_mask(assets: str, body: str, row: int, col: int) -> Image.Image:
    """Corpo + cabeça do quadro (alfa)."""
    box = (col * 64, row * 64, col * 64 + 64, row * 64 + 64)
    folder = 'female' if body == 'female' else 'male'
    b = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA').crop(box)
    h = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', folder, 'walk.png')).convert('RGBA').crop(box)
    m = Image.new('L', (64, 64), 0)
    m.paste(255, mask=b.getchannel('A').point(lambda v: 255 if v > 40 else 0))
    m.paste(255, mask=h.getchannel('A').point(lambda v: 255 if v > 40 else 0))
    return m


def _inside(m: Image.Image, x: int, y: int) -> bool:
    return 0 <= x < 64 and 0 <= y < 64 and m.getpixel((x, y)) > 0


def _dot(img: Image.Image, m: Image.Image, x: int, y: int, c: RGBA) -> None:
    if _inside(m, x, y):
        img.putpixel((x, y), c)


# ── Espreitador: pele morta, veias escuras e um pouco de fungo ─────────

def stalker_frame(m: Image.Image, seed: int, row: int) -> Image.Image:
    out = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for y in range(64):
        for x in range(64):
            if m.getpixel((x, y)) == 0:
                continue
            v = fbm(x / 3.0, y / 3.0, seed, 3)
            if v > 0.6:                                              # carne apodrecida
                out.putpixel((x, y), ROT[1 + int((v - 0.6) * 9) % 3])
            elif v < 0.3 and _hash(x, y, seed) > 0.4:
                out.putpixel((x, y), ROT[3])
    r = rng(seed + row)
    for _ in range(9):                                               # veias escuras
        x, y = r.randint(18, 46), r.randint(14, 48)
        for k in range(r.randint(4, 9)):
            _dot(out, m, x, y, VEIN)
            x += r.choice((-1, 0, 1)); y += 1
    for (x, y) in ((22, 32), (41, 32), (26, 30), (38, 29)):          # tufos de fungo no ombro e no pescoço
        for dx, dy, c in ((0, 0, FUNGUS[2]), (1, 0, FUNGUS[3]), (0, -1, FUNGUS[4]), (-1, 0, FUNGUS_DEEP[2]), (0, 1, FUNGUS_DEEP[1])):
            _dot(out, m, x + dx, y + dy, c)
    for (x, y) in ((29, 17), (35, 19)):                              # e na cabeça
        _dot(out, m, x, y, FUNGUS[3]); _dot(out, m, x + 1, y, FUNGUS[4]); _dot(out, m, x, y + 1, FUNGUS_DEEP[2])
    return out


# ── Trôpego: inchado de bolsas de esporos ──────────────────────────────

SACS = [(24, 35, 3), (32, 33, 3), (40, 36, 3), (27, 41, 2), (35, 41, 3), (22, 31, 2), (42, 31, 2), (31, 17, 2), (36, 22, 1)]


def shambler_frame(m: Image.Image, seed: int, row: int) -> Image.Image:
    out = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for y in range(64):
        for x in range(64):
            if m.getpixel((x, y)) == 0:
                continue
            v = fbm(x / 2.6, y / 2.6, seed + 4, 2)
            if v > 0.62:
                out.putpixel((x, y), ROT[2 + int(v * 10) % 2])
    for (cx, cy, rad) in SACS:
        if not _inside(m, cx, cy):
            continue
        for dy in range(-rad - 1, rad + 2):
            for dx in range(-rad - 1, rad + 2):
                d = (dx * dx + dy * dy) ** 0.5
                if d <= rad + 0.4:
                    t = (dx + dy) / (2 * rad + 1)
                    c = SAC[3] if t < -0.35 else SAC[2] if t < 0.1 else SAC[1] if t < 0.5 else SAC[0]
                    if abs(dx) <= 1 and dy == -1 and rad >= 2:
                        c = SAC[4]
                    _dot(out, m, cx + dx, cy + dy, c)
                elif d <= rad + 1.4:
                    _dot(out, m, cx + dx, cy + dy, rgb('#2b2312'))
    return out


# ── Baiacu: cheio de placas de fungo ───────────────────────────────

def _cells(seed: int, size: int = 5) -> list[tuple[float, float, float]]:
    """Pontos de uma grade com desvio (células de Voronoi): cada um vira uma placa."""
    pts = []
    for gy in range(-1, 64 // size + 2):
        for gx in range(-1, 64 // size + 2):
            pts.append((gx * size + _hash(gx, gy, seed) * size, gy * size + _hash(gx, gy, seed + 1) * size, _hash(gx, gy, seed + 2)))
    return pts


def bloater_frame(m: Image.Image, seed: int, row: int) -> Image.Image:
    out = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    pts = _cells(seed)
    for y in range(64):
        for x in range(64):
            if m.getpixel((x, y)) == 0:
                continue
            cover = 1.0 if y < 47 else 0.75 if y < 55 else 0.25
            ds = sorted(((x - px) ** 2 + (y - py) ** 2, t, px, py) for px, py, t in pts)
            d1, t1, px, py = ds[0]
            d2 = ds[1][0]
            if _hash(int(px), int(py), seed + 5) > cover + 0.0:
                continue                                             # sobra pele entre as placas nas pernas
            if (d2 ** 0.5) - (d1 ** 0.5) < 1.2:
                out.putpixel((x, y), PLATE[0])                      # fresta entre as placas
                continue
            light = 2.0 + (px - x) * 0.18 + (py - y) * 0.22 + (t1 - 0.5) * 2.0
            out.putpixel((x, y), PLATE[max(1, min(4, int(light)))])
    r = rng(seed + row)
    for _ in range(14):                                                # pústulas amareladas
        x, y = r.randint(20, 44), r.randint(14, 48)
        if _inside(m, x, y):
            out.putpixel((x, y), SAC[3]); _dot(out, m, x + 1, y, SAC[1]); _dot(out, m, x, y + 1, SAC[0])
    return out


FRAMES_FN = {
    'espreitador': (stalker_frame, 'Espreitador (pele morta e veias)'),
    'tropego': (shambler_frame, 'Trôpego (bolsas de esporos)'),
    'baiacu': (bloater_frame, 'Baiacu (placas de fungo)'),
}


def sheet(assets: str, body: str, fn, seed: int) -> Image.Image:
    out = Image.new('RGBA', (FRAMES * 64, 256), (0, 0, 0, 0))
    for r in range(4):
        for c in range(FRAMES):
            m = union_mask(assets, body, r, c)
            out.alpha_composite(fn(m, seed, r), (c * 64, r * 64))
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    items: list[dict] = []
    for slug, (fn, name) in FRAMES_FN.items():
        paths = {}
        for body in BODIES:
            rel = f'tlou/creatures/{slug}/{body}/'
            d = os.path.join(assets, SHEETS, rel)
            os.makedirs(d, exist_ok=True)
            sheet(assets, body, fn, 900 + len(slug)).save(os.path.join(d, 'walk.png'), optimize=True)
            paths[body] = rel
        items.append({'id': f'tlou/infection/{slug}', 'slot': 'infection', 'name': name,
                      'layers': [{'z': Z_CREATURE, 'paths': paths}], 'bodies': list(BODIES), 'anims': ['walk']})
    return [], items


def preview(assets: str, out: str, scale: int = 5) -> None:
    """Cada criatura de frente, de costas e de lado, por cima do corpo e da cabeça."""
    from PIL import ImageDraw
    body = 'male'
    bsheet = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA')
    hsheet = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', 'male', 'walk.png')).convert('RGBA')
    canvas = Image.new('RGBA', (4 * 64 * scale, len(FRAMES_FN) * (64 * scale + 14)), (74, 82, 66, 255))
    d = ImageDraw.Draw(canvas)
    for i, (slug, (fn, name)) in enumerate(FRAMES_FN.items()):
        sh = sheet(assets, body, fn, 900 + len(slug))
        for j, r in enumerate((2, 0, 1, 3)):
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            box = (2 * 64, r * 64, 3 * 64, r * 64 + 64)
            tile.alpha_composite(bsheet.crop(box)); tile.alpha_composite(hsheet.crop(box)); tile.alpha_composite(sh.crop(box))
            canvas.alpha_composite(tile.resize((64 * scale, 64 * scale), Image.NEAREST), (j * 64 * scale, i * (64 * scale + 14) + 14))
        d.text((2, i * (64 * scale + 14)), name, fill=(255, 255, 255, 255))
    canvas.save(out)
