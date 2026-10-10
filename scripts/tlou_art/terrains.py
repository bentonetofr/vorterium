"""Terrenos do pós-apocalipse: texturas de 32×32 que repetem sem emenda (o motor monta as bordas)."""
from __future__ import annotations

import os

from PIL import Image

from .palettes import *  # noqa: F403
from .px import RGBA, fbm, rgb, rng, _hash
from .sheet import PACK_ID, load_json, save_json

CAT = 'Apocalipse'
T = 32


def base(rp: list[RGBA], seed: int, scale: int = 4, octaves: int = 3, grain: float = 0.22, bias: float = 0.0) -> Image.Image:
    """Ruído sem emenda mapeado numa rampa de cores."""
    img = Image.new('RGBA', (T, T))
    n = len(rp)
    period = T // scale
    for y in range(T):
        for x in range(T):
            v = fbm(x / scale, y / scale, seed, octaves, period)
            v += (_hash(x, y, seed + 7) - 0.5) * grain + bias
            img.putpixel((x, y), rp[max(0, min(n - 1, int(v * n)))])
    return img


def dot(img: Image.Image, x: int, y: int, c: RGBA) -> None:
    img.putpixel((x % T, y % T), c)


def crack(img: Image.Image, r, c: RGBA, ln: int = 22, branch: bool = True) -> None:
    x, y = r.randint(0, T - 1), r.randint(0, T - 1)
    dx, dy = r.choice((-1, 1)), r.choice((-1, 1))
    for i in range(ln):
        dot(img, x, y, c)
        if r.random() < 0.5:
            x += dx
        if r.random() < 0.5 or i % 3 == 0:
            y += dy
        if r.random() < 0.18:
            dx = r.choice((-1, 0, 1)) or dx
        if branch and r.random() < 0.06 and ln > 6:
            crack(img, r, c, ln // 3, False)


def specks(img: Image.Image, r, n: int, colors: list[RGBA]) -> None:
    for _ in range(n):
        dot(img, r.randint(0, T - 1), r.randint(0, T - 1), r.choice(colors))


def blades(img: Image.Image, r, n: int, rp: list[RGBA], ln: tuple[int, int] = (2, 4)) -> None:
    for _ in range(n):
        x, y = r.randint(0, T - 1), r.randint(0, T - 1)
        for i in range(r.randint(*ln)):
            dot(img, x + (i // 2) * r.choice((-1, 0, 1)), y - i, rp[min(len(rp) - 1, 1 + i)])


def patch_mix(img: Image.Image, other: Image.Image, seed: int, threshold: float, scale: int = 6) -> None:
    period = T // scale if T % scale == 0 else T // 4
    for y in range(T):
        for x in range(T):
            if fbm(x / scale, y / scale, seed + 301, 2, period) > threshold:
                img.putpixel((x, y), other.getpixel((x, y)))


# ── Tiles ────────────────────────────────────────────────

ROAD = ramp('#323c49', '#363f4d', '#3a4553', '#3e4958', '#434f5e')          # asfalto liso, azul-acinzentado
ROAD_SPECK = [rgb('#4c596a'), rgb('#556377')]
ROAD_CRACK = rgb('#1f262e')
GRASS = ramp('#1f4a1a', '#2e6a22', '#3f8a2c', '#58aa3a', '#7cc454')           # mato vivo, bem verde
STONE = ramp('#7d8993', '#8f9ba4', '#a1acb4', '#b3bcc3', '#c4cbd0')
JOINT = rgb('#4f5a63')


def thick_crack(img: Image.Image, r, c: RGBA, ln: int = 20, branch: bool = True) -> None:
    """Rachadura de 2 px, como nos desenhos limpos."""
    x, y = r.randint(0, T - 1), r.randint(0, T - 1)
    dx, dy = r.choice((-1, 1)), r.choice((-1, 1))
    for i in range(ln):
        dot(img, x, y, c); dot(img, x + 1, y, c)
        if r.random() < 0.6:
            x += dx
        if r.random() < 0.55 or i % 3 == 0:
            y += dy
        if r.random() < 0.2:
            dx = r.choice((-1, 0, 1)) or dx
        if branch and r.random() < 0.07 and ln > 6:
            thick_crack(img, r, c, ln // 3, False)


def tuft(img: Image.Image, x: int, y: int, r) -> None:
    """Tufo de mato: três a cinco folhas pontudas saindo de uma rachadura."""
    for k in range(r.randint(3, 5)):
        h = r.randint(2, 5)
        lean = r.choice((-1, 0, 1))
        for i in range(h):
            dot(img, x + k - 2 + (i * lean) // 2, y - i, GRASS[min(4, 1 + i)])
        dot(img, x + k - 2, y + 1, GRASS[0])


def asphalt(seed: int = 1) -> Image.Image:
    img = base(ROAD, seed, 8, 2, 0.1)
    r = rng(seed)
    specks(img, r, 9, ROAD_SPECK)
    specks(img, r, 6, [rgb('#2a323d')])
    return img


def asphalt_cracked(seed: int = 2) -> Image.Image:
    img = base(ROAD, seed, 8, 2, 0.1)
    r = rng(seed)
    specks(img, r, 8, ROAD_SPECK)
    for _ in range(2):
        thick_crack(img, r, ROAD_CRACK, 22)
    for _ in range(2):
        tuft(img, r.randint(2, T - 3), r.randint(6, T - 2), r)
    return img


def asphalt_moss(seed: int = 3) -> Image.Image:
    img = base(ROAD, seed, 8, 2, 0.1)
    patch_mix(img, base(GRASS, seed + 5, 4, 2, 0.3), seed, 0.6)
    r = rng(seed)
    blades(img, r, 10, GRASS, (2, 4))
    return img


def sidewalk(seed: int = 4) -> Image.Image:
    """Lajotas de pedra clara com juntas escuras e mato nas frestas."""
    img = Image.new('RGBA', (T, T))
    r = rng(seed)
    for sy in range(2):
        for sx in range(2):
            tone = STONE[1 + r.randint(0, 2)]
            for y in range(16):
                for x in range(16):
                    c = tone
                    if _hash(sx * 16 + x, sy * 16 + y, seed) > 0.93:
                        c = STONE[max(0, STONE.index(tone) - 1)]
                    img.putpixel((sx * 16 + x, sy * 16 + y), c)
            for i in range(16):                                    # luz em cima e à esquerda, junta embaixo e à direita
                dot(img, sx * 16 + i, sy * 16 + 1, STONE[4]); dot(img, sx * 16 + 1, sy * 16 + i, STONE[4])
                dot(img, sx * 16 + i, sy * 16, JOINT); dot(img, sx * 16, sy * 16 + i, JOINT)
    for _ in range(2):
        thick_crack(img, r, JOINT, 9, False)
    x, y = r.choice((0, 16)) + r.randint(1, 14), r.choice((0, 16))
    tuft(img, x, y + 1, r)
    return img


def concrete(seed: int = 5) -> Image.Image:
    rp = ramp('#5c6775', '#606b7a', '#657080', '#6a7585', '#707b8b')
    img = base(rp, seed, 8, 2, 0.1)
    r = rng(seed)
    thick_crack(img, r, rgb('#3d4753'), 14)
    patch_mix(img, base([rgb('#4b5562'), rgb('#525c6a'), rgb('#5a6472')], seed + 9, 8, 2, 0.12), seed, 0.62, 8)   # manchas
    specks(img, r, 8, [rgb('#7b8696'), rgb('#4f5967')])
    return img


def rubble_ground(seed: int = 6) -> Image.Image:
    img = base(CONCRETE_DARK, seed, 4, 2, 0.3)
    r = rng(seed)
    for _ in range(22):
        cx, cy = r.randint(0, T - 1), r.randint(0, T - 1)
        w, h = r.randint(2, 5), r.randint(2, 4)
        rp = r.choice((CONCRETE, CONCRETE_DARK, BRICK))
        for yy in range(h):
            for xx in range(w):
                t = (xx + yy) / (w + h)
                dot(img, cx + xx, cy + yy, rp[min(4, int((1 - t) * 4) + r.randint(0, 1))])
    specks(img, r, 14, [rgb('#0d0c0a')])
    return img


def dirt(seed: int = 7) -> Image.Image:
    rp = ramp('#2a2016', '#3b2d1e', '#4d3b27', '#614a32', '#78603f')
    img = base(rp, seed, 4, 3, 0.28)
    r = rng(seed)
    specks(img, r, 22, [rp[4], rp[0], rgb('#8b8576')])
    return img


def mud(seed: int = 8) -> Image.Image:
    rp = ramp('#1c150e', '#281d13', '#352719', '#46341f', '#5a452a')
    img = base(rp, seed, 4, 3, 0.2)
    r = rng(seed)
    for _ in range(5):                                         # brilho de água
        x, y = r.randint(0, T - 5), r.randint(0, T - 1)
        for k in range(r.randint(2, 4)):
            dot(img, x + k, y, rgb('#6f8386'))
    specks(img, r, 10, [rp[4]])
    return img


def grass_dry(seed: int = 9) -> Image.Image:
    img = base(MOSS_DRY, seed, 4, 3, 0.25, -0.08)
    r = rng(seed)
    blades(img, r, 55, MOSS_DRY, (2, 4))
    specks(img, r, 8, [LEAF_DEAD[2]])
    return img


def grass_overgrown(seed: int = 10) -> Image.Image:
    img = base(MOSS, seed, 4, 3, 0.25)
    r = rng(seed)
    blades(img, r, 70, MOSS, (2, 5))
    specks(img, r, 6, [rgb('#d8d3b0'), rgb('#e6c84a')])         # florzinhas de mato
    return img


def mycelium_ground(seed: int = 11) -> Image.Image:
    rp = ramp('#120c08', '#1b1209', '#26190f', '#33231a', '#443022')
    img = base(rp, seed, 4, 3, 0.25)
    r = rng(seed)
    for _ in range(8):
        crack(img, r, FUNGUS[1], 18)          # fios escuros
    for _ in range(3):
        crack(img, r, FUNGUS_PALE[2], 10, False)   # fios claros
    for _ in range(4):
        x, y = r.randint(0, T - 2), r.randint(0, T - 2)
        dot(img, x, y, FUNGUS_PALE[4]); dot(img, x + 1, y, FUNGUS_PALE[3]); dot(img, x, y + 1, FUNGUS[2])
    return img


def hospital_tile(seed: int = 12) -> Image.Image:
    rp = ramp('#6d776f', '#7f8a82', '#929e95', '#a5b1a8', '#b9c4bb')
    img = Image.new('RGBA', (T, T))
    r = rng(seed)
    for ty in range(2):
        for tx in range(2):
            tone = rp[2 + ((tx + ty) % 2) + r.randint(-1, 0)]
            for y in range(16):
                for x in range(16):
                    v = _hash(tx * 16 + x, ty * 16 + y, seed) - 0.5
                    c = tone if v > -0.3 else rp[max(0, rp.index(tone) - 1)]
                    img.putpixel((tx * 16 + x, ty * 16 + y), c)
    for i in range(T):
        dot(img, i, 0, rgb('#444b46')); dot(img, 0, i, rgb('#444b46'))
        dot(img, i, 16, rgb('#444b46')); dot(img, 16, i, rgb('#444b46'))
    patch_mix(img, base([rgb('#4b4f3a'), rgb('#5a5b44'), rgb('#6a6a50')], seed + 3, 8, 2, 0.25), seed, 0.64, 8)   # sujeira
    crack(img, r, rgb('#2e332f'), 10)
    specks(img, r, 3, [rgb('#7a2a22')])
    return img


def rotten_wood(seed: int = 13) -> Image.Image:
    img = Image.new('RGBA', (T, T))
    r = rng(seed)
    for row in range(4):
        tone = WOOD[1 + r.randint(0, 2)]
        for y in range(8):
            for x in range(T):
                v = _hash(x + row * 13, y + row * 31, seed)
                c = tone if v > 0.12 else WOOD[max(0, WOOD.index(tone) - 1)]
                if y == 0:
                    c = WOOD[0]
                if y == 1:
                    c = WOOD[min(4, WOOD.index(tone) + 1)]
                img.putpixel((x, row * 8 + y), c)
        jx = r.randint(0, T - 1)
        for y in range(8):
            dot(img, jx, row * 8 + y, WOOD[0])
    patch_mix(img, base(MOSS, seed + 4, 4, 2, 0.3), seed, 0.66)
    specks(img, r, 8, [rgb('#0d0b09')])
    return img


def dirty_carpet(seed: int = 14) -> Image.Image:
    rp = ramp('#3a2826', '#4b3330', '#5e403b', '#734e47', '#876057')
    img = base(rp, seed, 4, 3, 0.35)
    r = rng(seed)
    patch_mix(img, base([rgb('#2c2a24'), rgb('#38342b'), rgb('#443f33')], seed + 2, 8, 2, 0.3), seed, 0.6, 8)
    specks(img, r, 20, [rp[0], rp[4]])
    return img


def leaf_litter(seed: int = 15) -> Image.Image:
    img = base(LEAF_DEAD, seed, 4, 3, 0.3, -0.05)
    r = rng(seed)
    for _ in range(26):
        x, y = r.randint(0, T - 1), r.randint(0, T - 1)
        c = LEAF_DEAD[r.randint(1, 4)]
        dot(img, x, y, c); dot(img, x + 1, y, c)
        if r.random() < 0.5:
            dot(img, x, y + 1, LEAF_DEAD[0])
    return img


def ash(seed: int = 16) -> Image.Image:
    rp = ramp('#1c1c1b', '#2a2a28', '#3b3b38', '#4f4f4a', '#66665f')
    img = base(rp, seed, 4, 3, 0.3)
    r = rng(seed)
    specks(img, r, 20, [rgb('#8a8a82'), rgb('#e0e0d6')])
    specks(img, r, 6, [rgb('#3a1a10')])
    return img


def dirty_snow(seed: int = 17) -> Image.Image:
    rp = ramp('#8e9aa8', '#aab6c2', '#c4cfd8', '#dbe3e9', '#eef3f5')
    img = base(rp, seed, 4, 3, 0.22, 0.1)
    r = rng(seed)
    specks(img, r, 18, [rgb('#6a6d6b'), rgb('#7c7f78'), rgb('#4b4c47')])
    for _ in range(4):
        x, y = r.randint(0, T - 3), r.randint(0, T - 3)
        dot(img, x, y, rgb('#ffffff')); dot(img, x + 1, y, rgb('#ffffff'))
    return img


TILES: list[tuple[str, str, callable]] = [
    ('asfalto', 'Asfalto', asphalt),
    ('asfalto-rachado', 'Asfalto rachado', asphalt_cracked),
    ('asfalto-musgo', 'Asfalto tomado pelo musgo', asphalt_moss),
    ('calcada', 'Calçada de concreto', sidewalk),
    ('concreto', 'Concreto sujo', concrete),
    ('entulho', 'Chão de entulho', rubble_ground),
    ('terra', 'Terra batida', dirt),
    ('lama', 'Lama', mud),
    ('grama-seca', 'Grama seca', grass_dry),
    ('mato-invasor', 'Mato invadindo', grass_overgrown),
    ('micelio', 'Chão de micélio (fungo)', mycelium_ground),
    ('piso-hospital', 'Piso de hospital sujo', hospital_tile),
    ('madeira-podre', 'Madeira podre', rotten_wood),
    ('carpete-sujo', 'Carpete sujo', dirty_carpet),
    ('folhas-secas', 'Folhas secas', leaf_litter),
    ('cinzas', 'Cinzas', ash),
    ('neve-suja', 'Neve suja', dirty_snow),
]


def build() -> tuple[Image.Image, list[dict]]:
    cols = 8
    rows = (len(TILES) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * T, rows * T), (0, 0, 0, 0))
    entries = []
    for i, (slug, label, fn) in enumerate(TILES):
        x, y = (i % cols) * T, (i // cols) * T
        sheet.alpha_composite(fn(i * 3 + 1), (x, y))
        entries.append({'slug': slug, 'label': label, 'x': x, 'y': y})
    return sheet, entries


def merge_terrains(assets: str, sheet: Image.Image, entries: list[dict]) -> None:
    """Tira o pacote `tlou` do terrains.json e põe de volta os terrenos gerados agora."""
    path = os.path.join(assets, 'catalog', 'terrains.json')
    cat = load_json(path)
    sid = 'tlou-ground'
    url = 'terrain/tlou-ground.png'
    sheet.save(os.path.join(assets, url), optimize=True)
    cat['sheets'] = [s for s in cat['sheets'] if s['pack'] != PACK_ID] + [{'id': sid, 'pack': PACK_ID, 'url': url}]
    keep = [t for t in cat['terrains'] if t['pack'] != PACK_ID]
    rank = max((t['rank'] for t in keep), default=0)
    new = []
    for i, e in enumerate(entries):
        new.append({
            'pack': PACK_ID, 'sheet': sid, 'id': f'tlou-{e["slug"]}', 'label': e['label'], 'category': CAT,
            'rank': 2000 + i,   # fixo: o rank define a ordem das camadas e não pode mudar entre execuções
            'gen': {'url': url, 'x': e['x'], 'y': e['y'], 'size': 32},
        })
    cat['terrains'] = keep + new
    save_json(path, cat)


def preview(out: str, scale: int = 3) -> None:
    """3×3 repetições de cada tile, pra conferir se emenda."""
    sheet, entries = build()
    cell = T * 3 * scale
    cols = 6
    rows = (len(entries) + cols - 1) // cols
    canvas = Image.new('RGBA', (cols * (cell + 6), rows * (cell + 6)), (20, 20, 20, 255))
    for i, e in enumerate(entries):
        tile = sheet.crop((e['x'], e['y'], e['x'] + T, e['y'] + T))
        big = Image.new('RGBA', (T * 3, T * 3))
        for a in range(3):
            for b in range(3):
                big.alpha_composite(tile, (a * T, b * T))
        big = big.resize((cell, cell), Image.NEAREST)
        canvas.alpha_composite(big, ((i % cols) * (cell + 6), (i // cols) * (cell + 6)))
    canvas.save(out)
