"""Dois draugr do Vortable (mortos-vivos de armadura): corpos inteiros desenhados por código, como o cavalo e o monstro.

  elmo     Esquelético, de elmo pontudo de cabelo enrolado, ombreiras com chifres e adornos em espiral, uma mão de garras
           compridas enroladas e um machado de lâmina farpada na outra.
  galhada  Curvado, de barba e coroa de chamas (galhada), ombreiras de espinhos, faixas no antebraço, tanga rasgada
           com guizos e uma espada longa.

Cada folha segue o padrão do personagem (LPC): linhas 0 = de costas, 1 = olhando pra esquerda, 2 = de frente, 3 = olhando pra
direita; colunas = quadros (caminhar 9, correr 8, parado 2). Quadro de 64x64 com os pés na linha 61. São mais altos que um
humano (o motor amplia em `DRAUGR_ESCALA`). Usam a cabeça vazia do cachorro (`tlou/head/nenhuma`).
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw

from .dog import ANIMS, BASE, BODIES, SHEETS
from .monstro import INK, TEETH, Draw, _dark, _gait as _mgait
from .px import RGBA, Cv, mix, ramp, rgb

SEED = 421
DRAUGR_ESCALA = 1.16

TYPES: dict[str, dict] = {
    'elmo': {
        'name': 'Draugr de elmo',
        'skin': ramp('#3a3935', '#5c5a53', '#827e72', '#a9a393', '#cfc8b4'),
        'bone': ramp('#4a4740', '#756f62', '#a39c88', '#cdc6ae', '#ece6d0'),
        'armor': ramp('#141c1b', '#25363a', '#3a5558', '#547a7a', '#7ba3a0'),
        'accent': ramp('#33250e', '#614513', '#8f6a24', '#c29a42', '#e9cd7c'),
        'hair': ramp('#2c2c30', '#4a4a50', '#6b6b73', '#8e8e98', '#b4b4be'),
        'blade': ramp('#1a1e22', '#2e353b', '#47515a', '#68747e', '#8d9aa4'),
        'eye': rgb('#7fe9ff'),
    },
    'galhada': {
        'name': 'Draugr de galhada',
        'skin': ramp('#2c2a33', '#4a4755', '#6c687b', '#8f8ba0', '#b4b0c4'),
        'bone': ramp('#403e48', '#69657a', '#948fa6', '#bcb7cc', '#e0dcee'),
        'armor': ramp('#1c1618', '#33282a', '#52413f', '#76605a', '#9a8279'),
        'accent': ramp('#2e1408', '#56250d', '#84391a', '#b3562a', '#dd8450'),
        'hair': ramp('#34343a', '#54545c', '#7a7a85', '#a3a3ae', '#cfcfda'),
        'blade': ramp('#1c2024', '#323a42', '#4f5b66', '#74828f', '#a3b2bf'),
        'eye': rgb('#ffa23c'),
    },
}


def _walk(anim: str, f: int) -> dict[str, float]:
    g = _mgait(anim, f)
    return {'bob': g['bob'] * 0.7, 'll': g['ll'], 'lr': g['lr'], 'al': g['al'] * 0.7, 'ar': g['ar'] * 0.7, 'sx': g['sx'], 'br': g['breath']}


# ── Partes ────────────────────────────────────────────────

def _head(d: Draw, kind: str, cx: float, cy: float, face: str, pal: dict) -> None:
    """Cabeça de caveira. `face`: 'front', 'side' (olhando pra esquerda) ou 'back'."""
    skin, armor, accent, hair = pal['bone'], pal['armor'], pal['accent'], pal['hair']
    eye = pal['eye']
    if face == 'back':
        d.ell(cx, cy, 4.8, 5.4, skin, light=0.7, seed_off=3)
    else:
        sk = d.ell(cx + (-0.8 if face == 'side' else 0), cy, 4.6, 5.4, skin, light=0.75, seed_off=3)
        ex = (cx - 2.2, cx + 2.2) if face == 'front' else (cx - 3.2,)
        for x in ex:
            d.cv.rect(round(x) - 1, round(cy) - 1, 2, 2, INK)
            d.px(x - 0.2, cy - 0.2, eye)
        d.cv.px(round(cx) + (0 if face == 'front' else -4), round(cy) + 2, INK)                       # nariz
        for i in range(-3, 4, 2):                                                                      # dentes
            if face == 'front':
                d.cv.px(round(cx) + i, round(cy) + 4, TEETH[4])
        if face == 'side':
            for i in range(3):
                d.cv.px(round(cx) - 4 + i, round(cy) + 4, TEETH[4])
    if kind == 'elmo':
        # elmo pontudo: cúpula, aba de nariz e a crista de cachos
        sx0 = -0.8 if face == 'side' else 0
        d.poly([(cx - 5 + sx0, cy + 1), (cx - 4 + sx0, cy - 4), (cx + sx0, cy - 7), (cx + 4 + sx0, cy - 4), (cx + 5 + sx0, cy + 1), (cx + 3 + sx0, cy - 1), (cx - 3 + sx0, cy - 1)], armor, light=0.7, seed_off=5)
        d.swirl(cx + sx0 + (0 if face != 'side' else 0.5), cy - 8, 2.6, accent[3], turns=1.4, flip=True)
        d.cv.rect(round(cx + sx0) - 4, round(cy) - 2, 8, 1, accent[2])                                 # faixa do elmo
        if face == 'front':
            d.cv.rect(round(cx) - 1, round(cy), 2, 4, armor[2])                                         # aba do nariz
            d.cv.px(round(cx), round(cy) + 3, armor[4])
    else:
        # barba grisalha e coroa de chamas
        sx0 = -0.8 if face == 'side' else 0
        if face != 'back':
            d.poly([(cx - 4 + sx0, cy + 3), (cx + 4 + sx0, cy + 3), (cx + 2 + sx0, cy + 9), (cx + sx0, cy + 11), (cx - 2 + sx0, cy + 9)], hair, light=0.7, seed_off=6)
        else:
            d.poly([(cx - 5, cy - 2), (cx + 5, cy - 2), (cx + 4, cy + 6), (cx - 4, cy + 6)], hair, light=0.7, seed_off=6)
        for i, (dx, h) in enumerate(((-4.5, 4), (-2.2, 6.5), (0, 9), (2.2, 6.5), (4.5, 4))):                      # espetos da coroa
            d.poly([(cx + sx0 + dx - 1.4, cy - 3), (cx + sx0 + dx + 1.4, cy - 3), (cx + sx0 + dx + (0.6 if i % 2 else -0.6), cy - 3 - h)], accent, light=0.6, seed_off=7 + i)
        d.cv.rect(round(cx + sx0) - 4, round(cy) - 3, 8, 1, accent[1])


def _pauldrons(d: Draw, kind: str, cx: float, y: float, spread: float, pal: dict, back: bool = False) -> None:
    armor, accent = pal['armor'], pal['accent']
    for side in (-1, 1):
        x = cx + side * spread
        d.ell(x, y, 5.2, 3.6, armor, light=0.7, seed_off=11 + side)
        if kind == 'elmo':                                                                            # chifre curvo pra cima
            d.poly([(x - 2 * side, y - 2), (x + side * 2, y - 2), (x + side * 3.5, y - 9), (x + side * 1.5, y - 5)], armor, light=0.6, seed_off=13 + side)
            d.swirl(x - side * 0.5, y, 2.2, accent[3], turns=1.2, flip=side < 0)
        else:                                                                                         # chamas de espinho
            for k, (dx, h) in enumerate(((-2, 5), (0, 7), (2, 5))):
                d.poly([(x + dx - 1.3, y - 2), (x + dx + 1.3, y - 2), (x + dx + side * 0.8, y - 2 - h)], armor, light=0.6, seed_off=13 + k + side)
            d.swirl(x, y + 0.5, 2.0, accent[3], turns=1.2, flip=side < 0)


def _torso(d: Draw, kind: str, cx: float, y: float, pal: dict, back: bool = False) -> None:
    skin, armor, accent = pal['skin'], pal['armor'], pal['accent']
    t = d.ell(cx, y + 8, 7.4, 8, skin, light=0.72, seed_off=21)
    d.poly([(cx - 4, y + 14), (cx + 4, y + 14), (cx + 3, y + 19), (cx - 3, y + 19)], skin, light=0.7, seed_off=22)  # cintura fina
    if back:
        for i in range(6):                                                                              # coluna
            d.cv.rect(round(cx) - 1, round(y + 3 + i * 2.4), 2, 1, skin[4] if i % 2 else skin[3])
        d.band(cx - 6, y + 7, cx + 6, y + 7, 0.8, skin[1], t)
        d.band(cx - 6, y + 11, cx + 6, y + 11, 0.8, skin[1], t)
        return
    for i in range(4):                                                                                  # costelas
        d.band(cx - 6, y + 4 + i * 2.6, cx + 6, y + 4 + i * 2.6, 1.4, skin[1], t)
    d.cv.rect(round(cx), round(y + 3), 1, 9, skin[1])                                                  # esterno
    # gola de armadura com espirais
    gx = d.poly([(cx - 6, y + 0.5), (cx + 6, y + 0.5), (cx + 4, y + 4), (cx - 4, y + 4)], armor, light=0.7, seed_off=23)
    d.swirl(cx - 2.5, y + 2.2, 1.6, accent[3], turns=1.2, within=gx)
    d.swirl(cx + 2.5, y + 2.2, 1.6, accent[3], turns=1.2, flip=True, within=gx)


def _skirt(d: Draw, kind: str, cx: float, y: float, pal: dict, w: float = 8.0, back: bool = False) -> None:
    armor, accent = pal['armor'], pal['accent']
    pts = [(cx - w, y), (cx + w, y), (cx + w + 1.5, y + 8), (cx + w * 0.6, y + 11), (cx + w * 0.3, y + 8.5), (cx, y + 12), (cx - w * 0.3, y + 8.5), (cx - w * 0.6, y + 11), (cx - w - 1.5, y + 8)]
    s = d.poly(pts, armor, light=0.65, seed_off=31)
    d.cv.rect(round(cx - w), round(y), round(2 * w), 2, accent[2])
    if not back:
        d.swirl(cx - w * 0.45, y + 5, 2.0, accent[3], turns=1.25, within=s)
        d.swirl(cx + w * 0.45, y + 5, 2.0, accent[3], turns=1.25, flip=True, within=s)
        d.band(cx - w + 1, y + 8, cx + w - 1, y + 8, 0.6, accent[1], s)
    if kind == 'galhada':                                                                               # guizos nas pontas
        for bx, by in ((cx - w * 0.6, y + 11.5), (cx, y + 12.5), (cx + w * 0.6, y + 11.5)):
            d.cv.px(round(bx), round(by), accent[4])
            d.cv.px(round(bx), round(by) + 1, accent[2])


def _leg(d: Draw, x: float, y: float, lift: int, pal: dict, side: int = 0, bare: bool = True) -> None:
    skin, accent = pal['skin'], pal['accent']
    pts = [(x, y), (x + side * 0.5, y + 10 - lift // 2), (x + side * 0.8, 55 - lift)]
    leg = d.limb(pts, [5.2, 4.2, 3.8], skin, light=0.75, seed_off=41 + side)
    d.band(x - 2.4, y + 9 - lift // 3, x + 2.4, y + 9 - lift // 3, 0.8, skin[1], leg)                    # joelho
    fy = 57 - lift
    d.ell(x + side * 1.2, fy, 4.4, 2.2, skin, light=0.75, seed_off=43 + side)
    for off in (-2.6, 0, 2.6):
        d.claw(x + side * 1.2 + off, fy + 1.4, off * 0.15, 1, 2.6, 0.9)


def _arm(d: Draw, x: float, y: float, hx: float, hy: float, pal: dict, wrap: bool = False) -> None:
    skin, accent = pal['skin'], pal['accent']
    mx, my = (x + hx) / 2 + (x - hx) * 0.1, (y + hy) / 2
    arm = d.limb([(x, y), (mx, my), (hx, hy)], [4.4, 3.6, 3.2], skin, light=0.75, seed_off=51)
    if wrap:
        for k in range(3):
            yy = my + 2 + k * 1.8
            d.band(mx - 2.2, yy, mx + 2.2, yy + 0.8, 0.0, accent[1] if k % 2 else skin[4], arm)


def _axe(d: Draw, hx: float, hy: float, pal: dict) -> None:
    """Machado de lâmina farpada, pendurado na mão (de frente)."""
    blade, accent = pal['blade'], pal['accent']
    d.cv.line(round(hx), round(hy) - 2, round(hx) + 3, 58, accent[1])
    d.cv.line(round(hx) + 1, round(hy) - 2, round(hx) + 4, 58, accent[2])
    d.poly([(hx + 2, hy + 8), (hx + 8, hy + 12), (hx + 6, hy + 14), (hx + 9, hy + 18), (hx + 5, hy + 18), (hx + 6, hy + 22), (hx + 3, hy + 20), (hx + 3, hy + 14)], blade, light=0.7, seed_off=61)
    d.swirl(hx + 5, hy + 14, 1.6, blade[4], turns=1.1)


def _sword(d: Draw, hx: float, hy: float, pal: dict, dx: float = 1.0) -> None:
    """Espada longa apontada pra baixo, na diagonal."""
    blade, accent = pal['blade'], pal['accent']
    ex, ey = hx + 11 * dx, hy + 24
    n = 26
    for i in range(n):
        t = i / n
        x, y = hx + (ex - hx) * t, hy + 2 + (ey - hy - 2) * t
        d.cv.px(round(x), round(y), blade[3])
        d.cv.px(round(x) + 1, round(y), blade[4] if i % 2 else blade[2])
        d.cv.px(round(x) - 1, round(y), blade[1])
    d.cv.line(round(hx) - 3, round(hy) + 1, round(hx) + 4, round(hy) + 1, accent[3])                    # guarda
    d.cv.px(round(hx), round(hy) - 1, accent[4])
    d.cv.line(round(hx), round(hy) - 3, round(hx), round(hy), accent[1])                                # cabo


def _curl_claw(d: Draw, hx: float, hy: float, pal: dict, flip: bool = False) -> None:
    """A mão de garras enroladas (e o grande adorno de espirais ao lado dela)."""
    skin, armor, accent = pal['skin'], pal['armor'], pal['accent']
    s = -1 if flip else 1
    d.ell(hx, hy, 3.6, 3, skin, light=0.75, seed_off=71)
    for off in (-2.4, -0.8, 0.8, 2.4):
        d.limb([(hx + off, hy + 1.5), (hx + off * 1.4 + s * 0.6, hy + 4.5)], [1.8, 1.4], skin, edge=False, light=0.6)
        d.claw(hx + off * 1.4 + s * 0.6, hy + 4.5, off * 0.25 + s * 0.4, 1, 3.2, 0.9)
    # adorno: tendrilhas em espiral crescendo ao lado do braço
    ox = hx - s * 9
    for k, (dx, dy, r) in enumerate(((0, -16, 3.6), (-s * 3, -9, 3.2), (s * 1, -3, 2.8))):
        d.swirl(ox + dx, hy + dy, r, armor[4], turns=1.5, flip=k % 2 == 0)
        d.swirl(ox + dx, hy + dy, r, accent[3], turns=1.5, flip=k % 2 == 0, start=0.7)
    d.cv.line(round(ox + 1), round(hy - 20), round(ox + s * 2), round(hy - 3), armor[3])


# ── Vistas ────────────────────────────────────────────────

def _front(kind: str, anim: str, f: int) -> Cv:
    pal = TYPES[kind]
    g = _walk(anim, f)
    d = Draw(pal, SEED)
    b = round(g['bob'])
    ll, lr, al, ar, sx = round(g['ll']), round(g['lr']), round(g['al']), round(g['ar']), round(g['sx'])
    lean = 1 if kind == 'galhada' else 0                                                               # galhada anda curvado
    # braço do adorno / bandagem (esquerda de quem olha) e o do porte da arma (direita)
    if kind == 'elmo':
        _arm(d, 22, 20 + b, 16, 40 + b + al, pal)
        _curl_claw(d, 16, 43 + b + al, pal, flip=False)
    else:
        _arm(d, 22, 20 + b, 15, 40 + b + al, pal, wrap=True)
        d.ell(15, 43 + b + al, 3.2, 2.8, pal['skin'], light=0.75, seed_off=72)
        for off in (-2, 0, 2):
            d.claw(15 + off, 45 + b + al, off * 0.2, 1, 2.8, 0.9)
    # pernas
    _leg(d, 28.2 - sx, 38 + b, ll, pal, side=-1)
    _leg(d, 35.8 + sx, 38 + b, lr, pal, side=1)
    _torso(d, kind, 32, 14 + b + lean, pal)
    _skirt(d, kind, 32, 31 + b, pal)
    # braço da arma
    _arm(d, 42, 20 + b, 47, 39 + b + ar, pal, wrap=kind == 'galhada')
    d.ell(47, 41 + b + ar, 2.8, 2.6, pal['skin'], light=0.75, seed_off=73)
    if kind == 'elmo':
        _axe(d, 47, 41 + b + ar, pal)
    else:
        _sword(d, 47, 41 + b + ar, pal, dx=0.55)
    _pauldrons(d, kind, 32, 17 + b + lean, 10, pal)
    _head(d, kind, 32, 8 + b + lean, 'front', pal)
    d.cv.outline(INK)
    return d.cv


def _back(kind: str, anim: str, f: int) -> Cv:
    pal = TYPES[kind]
    g = _walk(anim, f)
    d = Draw(pal, SEED)
    b = round(g['bob'])
    ll, lr, al, ar, sx = round(g['ll']), round(g['lr']), round(g['al']), round(g['ar']), round(g['sx'])
    lean = 1 if kind == 'galhada' else 0
    _arm(d, 42, 20 + b, 48, 40 + b + al, pal)
    d.ell(48, 42 + b + al, 3.0, 2.8, pal['skin'], light=0.75, seed_off=71)
    _leg(d, 28.2 - sx, 38 + b, ll, pal, side=-1)
    _leg(d, 35.8 + sx, 38 + b, lr, pal, side=1)
    _torso(d, kind, 32, 14 + b + lean, pal, back=True)
    _skirt(d, kind, 32, 31 + b, pal, back=True)
    _arm(d, 22, 20 + b, 16, 39 + b + ar, pal, wrap=kind == 'galhada')
    d.ell(16, 41 + b + ar, 2.8, 2.6, pal['skin'], light=0.75, seed_off=72)
    if kind == 'elmo':
        d.cv.line(16, 40 + b + ar, 14, 58, pal['accent'][1])
        d.poly([(14, 49), (9, 52), (11, 54), (8, 58), (12, 57), (11, 60), (14, 58)], pal['blade'], light=0.7, seed_off=61)
    else:
        _sword(d, 16, 41 + b + ar, pal, dx=-0.55)
    _pauldrons(d, kind, 32, 17 + b + lean, 10, pal, back=True)
    _head(d, kind, 32, 8 + b + lean, 'back', pal)
    d.cv.outline(INK)
    return d.cv


def _side(kind: str, anim: str, f: int) -> Cv:
    """Olhando pra esquerda."""
    pal = TYPES[kind]
    g = _walk(anim, f)
    d = Draw(pal, SEED)
    b = round(g['bob'])
    ll, lr, al, ar, sx = round(g['ll']), round(g['lr']), round(g['al']), round(g['ar']), round(g['sx'] * 1.6)
    lean = 2 if kind == 'galhada' else 1
    dark = _dark(pal['skin'])
    # perna e braço de trás
    d.limb([(34, 20 + b), (36, 30 + b), (36 - ar, 40 + b)], [3.6, 3.2, 2.8], dark, light=0.7, seed_off=5)
    _leg(d, 34 + sx, 38 + b, lr, {**pal, 'skin': dark}, side=-1)
    # tronco inclinado
    t = d.ell(31 - lean * 0.5, 22 + b, 5.6, 8.5, pal['skin'], light=0.75, seed_off=21)
    for i in range(4):
        d.band(26, 17 + b + i * 2.6, 32, 17 + b + i * 2.6, 1.0, pal['skin'][1], t)
    d.poly([(28, 28 + b), (34, 28 + b), (33, 33 + b), (29, 33 + b)], pal['skin'], light=0.7, seed_off=22)
    _skirt(d, kind, 31, 31 + b, pal, w=5.6)
    _leg(d, 29 - sx, 38 + b, ll, pal, side=-1)
    # braço da frente com a arma
    hx, hy = 24 + al // 2, 41 + b + al
    _arm(d, 29, 20 + b, hx, hy, pal, wrap=kind == 'galhada')
    d.ell(hx, hy + 1, 2.8, 2.6, pal['skin'], light=0.75, seed_off=73)
    if kind == 'elmo':
        d.cv.line(round(hx), round(hy) - 1, round(hx) - 6, 58, pal['accent'][1])
        d.poly([(hx - 5, 49), (hx - 10, 52), (hx - 8, 54), (hx - 11, 58), (hx - 7, 57), (hx - 8, 60), (hx - 5, 58)], pal['blade'], light=0.7, seed_off=61)
    else:
        _sword(d, hx, hy, pal, dx=-0.9)
    # ombreira, cabeça
    x = 29
    d.ell(x, 17 + b + lean, 4.6, 3.4, pal['armor'], light=0.7, seed_off=11)
    if kind == 'elmo':
        d.poly([(x - 1.5, 15 + b), (x + 2, 15 + b), (x + 3, 7 + b), (x + 1, 11 + b)], pal['armor'], light=0.6, seed_off=13)
        d.swirl(x - 0.5, 17.5 + b, 2.0, pal['accent'][3], turns=1.2)
    else:
        for k, (dx, h) in enumerate(((-1.5, 4), (0.5, 6), (2.5, 4))):
            d.poly([(x + dx - 1.2, 15 + b), (x + dx + 1.2, 15 + b), (x + dx + 0.6, 15 + b - h)], pal['armor'], light=0.6, seed_off=13 + k)
    _head(d, kind, 29.5, 8 + b + lean, 'side', pal)
    d.cv.outline(INK)
    return d.cv


def frame(kind: str, anim: str, row: int, f: int) -> Image.Image:
    cv = _front(kind, anim, f) if row == 2 else _back(kind, anim, f) if row == 0 else _side(kind, anim, f)
    if row == 3:
        cv = cv.flipped()
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    wide = 20 if row in (1, 3) else 26
    ImageDraw.Draw(sh).ellipse([32 - wide // 2, BASE - 2, 32 + wide // 2, BASE + 2], fill=(0, 0, 0, 70))
    sh.alpha_composite(cv.im)
    return sh


def sheet(kind: str, anim: str) -> Image.Image:
    n = ANIMS[anim]
    out = Image.new('RGBA', (n * 64, 256), (0, 0, 0, 0))
    for row in range(4):
        for f in range(n):
            out.alpha_composite(frame(kind, anim, row, f), (f * 64, row * 64))
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    items = []
    for kind, info in TYPES.items():
        rel = f'tlou/monsters/draugr-{kind}/'
        for anim in ANIMS:
            d = os.path.join(assets, SHEETS, rel, anim)
            os.makedirs(d, exist_ok=True)
            sheet(kind, anim).save(os.path.join(d, 'padrao.png'), optimize=True)
        items.append({'id': f'tlou/body/draugr-{kind}', 'slot': 'body', 'name': info['name'], 'layers': [{'z': 10, 'paths': {b: rel for b in BODIES}}],
                      'bodies': list(BODIES), 'anims': list(ANIMS), 'variants': ['padrao']})
    return [], items


def preview(out: str, scale: int = 5) -> None:
    frames = (0, 3, 6)
    big = Image.new('RGBA', (2 * (len(frames) * 64 + 20), 4 * 64 + 6), (62, 56, 48, 255))
    for i, kind in enumerate(TYPES):
        full = sheet(kind, 'walk')
        for row in range(4):
            for k, fr in enumerate(frames):
                big.alpha_composite(full.crop((fr * 64, row * 64, fr * 64 + 64, row * 64 + 64)), (i * (len(frames) * 64 + 20) + k * 64, row * 64))
    big.resize((big.width * scale // 2, big.height * scale // 2), Image.NEAREST).save(out)
