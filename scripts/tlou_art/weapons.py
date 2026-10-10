"""Armas no boneco: na mão, nas costas e no bolso (cintura).

O motor monta o boneco por camadas (ordem pelo `z`), e só a folha "walk" é obrigatória (idle e run
usam a walk). Cada arma vira peças de três espaços (`weapon_hand`, `weapon_back`, `weapon_hip`), e
cada peça tem DUAS camadas: "atrás" (z abaixo do corpo: o corpo esconde o que fica atrás dele) e
"frente" (z acima das roupas). Quem decide em qual camada cada quadro vai é a direção em que o boneco
olha: uma arma nas costas aparece inteira de costas e só espia pelos lados de frente.

A ancoragem (mão, quadril, ombro) é lida da própria folha do corpo, quadro a quadro, então a arma
acompanha o balanço da caminhada.
"""
from __future__ import annotations

import math
import os

from PIL import Image

from .palettes import IRON, IRON_LIGHT, OLIVE_DRAB, RUST, WOOD, WOOD_PALE
from .px import Cv, OUTLINE, RGBA, rgb

SHEETS = 'character/sheets'
BODIES = ('male', 'female', 'muscular', 'teen')
ROWS = ('up', 'left', 'down', 'right')           # linhas do LPC
FRAMES = 9
Z_BEHIND = 8
Z_FRONT = 108

SLOTS = [
    {'id': 'weapon_hand', 'label': 'Arma na mão', 'group': 'Armas'},
    {'id': 'weapon_back', 'label': 'Arma nas costas', 'group': 'Armas'},
    {'id': 'weapon_hip', 'label': 'Arma no bolso', 'group': 'Armas'},
]

STEEL = [rgb('#15171a'), rgb('#2b3035'), rgb('#444b52'), rgb('#626b73'), rgb('#8a959d')]
GLASS_G = [rgb('#17301d'), rgb('#25502f'), rgb('#37733f'), rgb('#52a05a')]


# ── Sprites de lado, virados pra direita ────────────────

class Spr:
    """Arma desenhada de lado, virada pra direita, com o ponto onde a mão segura."""

    def __init__(self, cv: Cv, grip: tuple[int, int]):
        self.cv, self.grip = cv, grip


def _box(cv: Cv, x: int, y: int, w: int, h: int, rp: list[RGBA]) -> None:
    cv.rect(x, y, w, h, rp[2])
    cv.rect(x, y, w, 1, rp[min(4, len(rp) - 1)])
    cv.rect(x, y + h - 1, w, 1, rp[0])


def pistol() -> Spr:
    cv = Cv(12, 9)
    _box(cv, 2, 1, 9, 3, STEEL)
    cv.rect(10, 2, 2, 1, STEEL[0])
    _box(cv, 2, 4, 3, 4, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[3]])
    cv.px(5, 4, STEEL[0]); cv.px(6, 4, STEEL[1])
    return Spr(cv.finish(outline=True), (4, 6))


def revolver() -> Spr:
    cv = Cv(14, 9)
    _box(cv, 5, 1, 8, 2, STEEL)
    cv.rect(13, 1, 1, 2, STEEL[0])
    cv.ell(3, 1, 4, 4, STEEL[3]); cv.px(5, 3, STEEL[0])
    _box(cv, 2, 4, 3, 4, [WOOD[0], WOOD[1], WOOD[3], WOOD[4], WOOD[4]])
    return Spr(cv.finish(outline=True), (4, 6))


def shotgun() -> Spr:
    cv = Cv(30, 8)
    _box(cv, 11, 1, 18, 2, STEEL)
    _box(cv, 14, 3, 8, 2, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]])      # pump
    _box(cv, 3, 2, 10, 4, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]])      # coronha
    cv.rect(10, 2, 2, 3, STEEL[1])
    return Spr(cv.finish(outline=True), (11, 5))


def rifle() -> Spr:
    cv = Cv(32, 9)
    _box(cv, 13, 3, 18, 2, STEEL)
    cv.rect(31, 3, 1, 2, STEEL[0])
    _box(cv, 16, 1, 7, 2, STEEL)                    # luneta
    cv.rect(17, 1, 5, 1, STEEL[4])
    _box(cv, 3, 3, 11, 4, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]])
    cv.rect(12, 5, 2, 3, STEEL[1])                  # empunhadura
    return Spr(cv.finish(outline=True), (12, 5))


def bat() -> Spr:
    cv = Cv(28, 6)
    cv.poly([(2, 2), (27, 1), (27, 4), (2, 3)], WOOD_PALE[2])
    cv.rect(2, 2, 25, 1, WOOD_PALE[4])
    cv.rect(2, 3, 25, 1, WOOD[1])
    for x in (3, 5, 7):
        cv.rect(x, 1, 1, 4, rgb('#d8d4c4'))         # fita no cabo
    cv.px(24, 2, WOOD[0]); cv.px(25, 3, WOOD[0])    # lasca
    return Spr(cv.finish(outline=True), (5, 3))


def pipe() -> Spr:
    cv = Cv(26, 5)
    cv.rect(2, 1, 23, 3, IRON_LIGHT[2])
    cv.rect(2, 1, 23, 1, IRON_LIGHT[4])
    cv.rect(2, 3, 23, 1, IRON[1])
    for x in (8, 14, 20):
        cv.px(x, 2, RUST[2]); cv.px(x + 1, 3, RUST[3])
    cv.rect(2, 1, 5, 3, rgb('#2a2824'))             # cabo envolvido
    return Spr(cv.finish(outline=True), (4, 2))


def hatchet() -> Spr:
    cv = Cv(18, 11)
    cv.rect(2, 4, 13, 2, WOOD[3]); cv.rect(2, 4, 13, 1, WOOD[4])
    cv.poly([(12, 1), (17, 0), (17, 8), (12, 6)], STEEL[3])
    cv.poly([(12, 1), (17, 0), (17, 2), (12, 3)], STEEL[4])
    return Spr(cv.finish(outline=True), (3, 5))


def machete() -> Spr:
    cv = Cv(24, 8)
    cv.poly([(7, 2), (22, 1), (23, 3), (22, 5), (7, 5)], STEEL[3])
    cv.rect(7, 2, 15, 1, STEEL[4])
    cv.rect(2, 2, 6, 3, rgb('#1d1a16'))
    cv.rect(7, 1, 1, 5, IRON[3])
    return Spr(cv.finish(outline=True), (4, 3))


def knife() -> Spr:
    cv = Cv(14, 6)
    cv.poly([(5, 1), (12, 2), (13, 3), (5, 4)], STEEL[4])
    cv.rect(1, 1, 4, 3, rgb('#1d1a16'))
    cv.rect(5, 0, 1, 5, IRON[3])
    return Spr(cv.finish(outline=True), (2, 2))


def bow() -> Spr:
    cv = Cv(10, 26)
    for i in range(24):
        t = i / 23
        x = round(6 + math.sin(t * math.pi) * 2)
        cv.px(x, 1 + i, WOOD[3]); cv.px(x - 1, 1 + i, WOOD[2])
    cv.line(2, 1, 2, 24, rgb('#cfc8ac'))
    cv.line(2, 1, 6, 1, WOOD[1]); cv.line(2, 24, 6, 24, WOOD[1])
    cv.rect(6, 11, 3, 4, rgb('#1d1a16'))
    return Spr(cv.finish(outline=True), (7, 13))


def molotov() -> Spr:
    cv = Cv(8, 14)
    cv.tex_rect(1, 5, 6, 8, GLASS_G, 3, 2, 0.5)
    cv.rect(2, 3, 4, 3, GLASS_G[1])
    cv.rect(3, 1, 2, 3, rgb('#cfc8ac'))
    cv.px(4, 0, rgb('#f08a1c')); cv.px(3, 0, rgb('#c2410c'))
    cv.px(2, 8, rgb('#a8d8ac'))
    return Spr(cv.finish(outline=True), (4, 10))


def grenade() -> Spr:
    cv = Cv(8, 10)
    cv.tex_ell(1, 3, 6, 6, OLIVE_DRAB, 4, 2, 0.5)
    cv.rect(3, 1, 2, 3, IRON[3])
    cv.px(6, 1, IRON_LIGHT[4]); cv.px(7, 2, IRON_LIGHT[3])
    return Spr(cv.finish(outline=True), (4, 6))


def flamethrower() -> Spr:
    cv = Cv(28, 12)
    cv.tex_rect(2, 1, 8, 10, STEEL, 5, 2, 0.5)
    cv.rect(3, 2, 1, 8, STEEL[4])
    cv.rect(10, 5, 14, 2, IRON_LIGHT[2]); cv.rect(10, 5, 14, 1, IRON_LIGHT[4])
    cv.rect(24, 4, 3, 4, IRON[1])
    cv.px(26, 3, rgb('#f08a1c'))
    cv.rect(12, 7, 2, 3, rgb('#1d1a16'))
    return Spr(cv.finish(outline=True), (12, 8))


MAKERS = {
    'pistola': pistol, 'revolver': revolver, 'escopeta': shotgun, 'rifle': rifle, 'taco': bat, 'cano': pipe,
    'machadinha': hatchet, 'facao': machete, 'faca': knife, 'arco': bow, 'molotov': molotov,
    'granada': grenade, 'lanca-chamas': flamethrower,
}

# onde cada tipo pode ficar (espaço → tipos)
LONG = ('escopeta', 'rifle', 'taco', 'cano', 'machadinha', 'facao', 'arco', 'lanca-chamas')
SMALL = ('pistola', 'revolver', 'faca', 'machadinha', 'facao', 'molotov', 'granada')
HAND = tuple(MAKERS)
SLOT_TYPES = {'weapon_hand': HAND, 'weapon_back': LONG, 'weapon_hip': SMALL}
LABELS = {
    'pistola': 'Pistola', 'revolver': 'Revólver', 'escopeta': 'Escopeta', 'rifle': 'Rifle', 'taco': 'Taco',
    'cano': 'Cano de ferro', 'machadinha': 'Machadinha', 'facao': 'Facão', 'faca': 'Faca', 'arco': 'Arco',
    'molotov': 'Coquetel molotov', 'granada': 'Granada', 'lanca-chamas': 'Lança-chamas',
}
GUNS = ('pistola', 'revolver', 'escopeta', 'rifle', 'lanca-chamas')


# ── Geometria do corpo, lida da folha ───────────────────

class Geo:
    """Âncoras de um boneco (corpo) em cada quadro da caminhada."""

    def __init__(self, assets: str, body: str):
        im = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA')
        self.frames: dict[tuple[int, int], dict] = {}
        for r in range(4):
            tops = []
            for c in range(FRAMES):
                a = im.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64)).getchannel('A')
                bb = a.point(lambda v: 255 if v > 20 else 0).getbbox()
                tops.append(bb[1])
            base = min(tops)
            for c in range(FRAMES):
                a = im.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64)).getchannel('A')

                def ext(y: int) -> tuple[int, int]:
                    xs = [x for x in range(64) if a.getpixel((x, y)) > 20]
                    return (min(xs), max(xs)) if xs else (28, 36)
                lx, rx = ext(44)
                hx = ext(48)
                self.frames[(r, c)] = {'bob': tops[c] - base, 'lx': lx, 'rx': rx, 'hl': hx[0], 'hr': hx[1]}


# ── Poses ───────────────────────────────────────────────

def rotated(spr: Spr, angle: float, flip: bool = False) -> tuple[Image.Image, tuple[int, int]]:
    """Gira a arma (graus, anti-horário) e devolve a imagem e onde ficou o ponto da mão."""
    im = spr.cv.im
    gx, gy = spr.grip
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        gx = im.width - 1 - gx
        angle = -angle
    marker = Image.new('L', im.size, 0)
    marker.putpixel((gx, gy), 255)
    big = Image.new('RGBA', (im.width + 8, im.height + 8), (0, 0, 0, 0))
    mbig = Image.new('L', big.size, 0)
    big.alpha_composite(im, (4, 4)); mbig.paste(marker, (4, 4))
    r = big.rotate(angle, resample=Image.NEAREST, expand=True)
    mr = mbig.rotate(angle, resample=Image.NEAREST, expand=True)
    bb = mr.getbbox()
    g = ((bb[0] + bb[2] - 1) // 2, (bb[1] + bb[3] - 1) // 2) if bb else (r.width // 2, r.height // 2)
    return r, g


def put(frame: Image.Image, spr: Spr, grip_at: tuple[int, int], angle: float, flip: bool = False) -> None:
    im, g = rotated(spr, angle, flip)
    frame.alpha_composite(im, (grip_at[0] - g[0], grip_at[1] - g[1]))


def pose(slot: str, kind: str, geo: dict, row: int) -> tuple[str, tuple[int, int], float, bool]:
    """Camada ('behind'|'front'), onde a mão segura, ângulo e se espelha — pra um quadro."""
    bob = geo['bob']
    cx = 32
    side = row in (1, 3)                       # esquerda / direita
    dirsign = -1 if row == 1 else 1
    is_gun = kind in GUNS
    if slot == 'weapon_hand':
        if row == 2:                           # de frente: na mão que aparece à esquerda, apontada pra baixo
            return 'front', (geo['lx'] + 1, 46 + bob), (-80 if is_gun else -95), False
        if row == 0:                           # de costas: o corpo esconde
            return 'behind', (geo['rx'] - 1, 46 + bob), -100, False
        ang = 0 if is_gun else 28
        return 'front', (cx + dirsign * 3, 45 + bob), (ang if dirsign == 1 else -ang), dirsign == -1
    if slot == 'weapon_back':
        if row == 0:                           # de costas: inteira, atravessada
            return 'front', (cx, 42 + bob), 42, False
        if row == 2:                           # de frente: só espia pelas bordas
            return 'behind', (cx, 42 + bob), 42, False
        return 'behind', (cx - dirsign * 4, 43 + bob), (118 if dirsign == 1 else -118), dirsign == -1
    # weapon_hip
    if row == 2:
        return 'front', (geo['lx'] + 3, 49 + bob), -90, False
    if row == 0:
        return 'behind', (geo['rx'] - 3, 49 + bob), -90, False
    return 'front', (cx - dirsign * 2, 49 + bob), -90, False


def build_layers(assets: str, slot: str, kind: str, body: str, geo: Geo) -> dict[str, Image.Image]:
    spr = MAKERS[kind]()
    out = {'behind': Image.new('RGBA', (FRAMES * 64, 256), (0, 0, 0, 0)), 'front': Image.new('RGBA', (FRAMES * 64, 256), (0, 0, 0, 0))}
    for r in range(4):
        for c in range(FRAMES):
            layer, at, ang, flip = pose(slot, kind, geo.frames[(r, c)], r)
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            put(tile, spr, at, ang, flip)
            out[layer].alpha_composite(tile, (c * 64, r * 64))
    return out


def item_id(slot: str, kind: str) -> str:
    return f'tlou/{slot}/{kind}'


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    """Grava as folhas e devolve (espaços, itens) pro catálogo."""
    geos = {b: Geo(assets, b) for b in BODIES}
    items = []
    for slot, kinds in SLOT_TYPES.items():
        for kind in kinds:
            paths = {'behind': {}, 'front': {}}
            for body in BODIES:
                layers = build_layers(assets, slot, kind, body, geos[body])
                for name, img in layers.items():
                    rel = f'tlou/weapons/{slot}/{kind}/{name}/{body}/'
                    d = os.path.join(assets, SHEETS, rel)
                    os.makedirs(d, exist_ok=True)
                    img.save(os.path.join(d, 'walk.png'), optimize=True)
                    paths[name][body] = rel
            items.append({
                'id': item_id(slot, kind), 'slot': slot, 'name': LABELS[kind],
                'layers': [{'z': Z_BEHIND, 'paths': paths['behind']}, {'z': Z_FRONT, 'paths': paths['front']}],
                'bodies': list(BODIES), 'anims': ['walk'],
            })
    return SLOTS, items


def preview(assets: str, out: str, body: str = 'male', cols: tuple[int, ...] = (0, 2, 4, 6), scale: int = 3) -> None:
    """Boneco + arma, de frente, de costas e dos lados, ampliado (sem gravar nada nos catálogos)."""
    geo = Geo(assets, body)
    base = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', body, 'walk.png')).convert('RGBA')
    head = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', body, 'walk.png')).convert('RGBA')
    legs = None
    cells = []
    for slot, kinds in SLOT_TYPES.items():
        for kind in kinds:
            lay = build_layers(assets, slot, kind, body, geo)
            strip = Image.new('RGBA', (len(cols) * 4 * 64, 64), (0, 0, 0, 0))
            for r in (2, 1, 0, 3):
                for ci, c in enumerate(cols[:1]):
                    pass
            x = 0
            for r in (2, 0, 1, 3):                      # frente, costas, esquerda, direita
                for c in (cols[0], cols[2]):
                    tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
                    box = (c * 64, r * 64, c * 64 + 64, r * 64 + 64)
                    tile.alpha_composite(lay['behind'].crop(box))
                    tile.alpha_composite(base.crop(box))
                    tile.alpha_composite(head.crop(box))
                    tile.alpha_composite(lay['front'].crop(box))
                    strip.alpha_composite(tile, (x, 0))
                    x += 64
            strip = strip.crop((0, 0, x, 64))
            cells.append((f'{slot[7:]}: {LABELS[kind]}', strip))
    cw = max(c[1].width for c in cells) * scale
    cols_n = 2
    rows_n = (len(cells) + cols_n - 1) // cols_n
    canvas = Image.new('RGBA', (cols_n * (cw + 12), rows_n * (64 * scale + 18)), (74, 82, 66, 255))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    for i, (label, strip) in enumerate(cells):
        big = strip.resize((strip.width * scale, strip.height * scale), Image.NEAREST)
        px_, py_ = (i % cols_n) * (cw + 12), (i // cols_n) * (64 * scale + 18)
        canvas.alpha_composite(big, (px_, py_ + 12))
        d.text((px_ + 2, py_), label, fill=(255, 255, 255, 255))
    canvas.save(out)
