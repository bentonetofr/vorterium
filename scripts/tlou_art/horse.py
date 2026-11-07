"""Cavalo do Vortable: um "corpo" completo, desenhado por código, que entra no boneco como a peça de corpo (igual ao cachorro).

Cada folha segue o padrão do personagem (LPC): linhas 0 = de costas, 1 = olhando pra esquerda, 2 = de frente, 3 = olhando pra
direita; colunas = quadros (caminhar 9, correr 8, parado 2). O cavalo é desenhado no quadro de 64x64, com os cascos na linha 61.
Pelagens (variantes prontas): preto, malhado (branco com manchas laranja), alazão (marrom alaranjado), palomino, tordilho (cinza
rodado) e castanho (marrom-escuro com meias brancas).

A cabeça humana que o personagem exige é a peça vazia que o cachorro já criou (`tlou/head/nenhuma`).
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageChops, ImageDraw

from .dog import ANIMS, BASE, BODIES, SHEETS, _ell, _fill, _gait, _limb, _mask, _union
from .px import RGBA, Cv, fbm, mix, ramp, rgb

SEED = 131
OUT = rgb('#120d0a')
EYE = rgb('#120a06')
EYE_GLINT = rgb('#f2e6cf')
NOSTRIL = rgb('#0a0707')

# ── Pelagens ──────────────────────────────────────────────
#   body = o pelo do corpo; belly = barriga e focinho (mais claro); mane = crina e rabo; hoof = casco;
#   patch = as manchas (se tiver); sock = as meias brancas das patas (se tiver); blaze = estrela/listra na testa.
COATS: dict[str, dict] = {
    'preto': {
        'body': ramp('#07070a', '#101015', '#1c1c23', '#2e2e38', '#4a4a58'),
        'belly': ramp('#0a0a0c', '#141418', '#1f1f25', '#2e2e36', '#42424e'),
        'mane': ramp('#030304', '#09090b', '#111114', '#1c1c21', '#2a2a31'),
        'hoof': ramp('#050505', '#0d0d0e', '#161617', '#202022', '#2c2c2f'),
    },
    'malhado': {
        'body': ramp('#a99f93', '#c9c0b3', '#e1d9cc', '#f1ebe0', '#fbf7ee'),
        'belly': ramp('#b8afa2', '#d3cbbd', '#e8e1d4', '#f5f0e6', '#fffdf7'),
        'mane': ramp('#8a4a1c', '#b3641f', '#d9842b', '#f0a246', '#f8bf73'),
        'hoof': ramp('#5a4a3a', '#76624d', '#928068', '#ad9c84', '#c7b9a2'),
        'patch': ramp('#8f3f12', '#b8561a', '#dc7424', '#f08f36', '#f7aa57'),
    },
    'alazao': {
        'body': ramp('#5a2a12', '#7e3e1a', '#a4562a', '#c7733c', '#e0925a'),
        'belly': ramp('#6e3818', '#93502a', '#b86a38', '#d6874f', '#eba873'),
        'mane': ramp('#2a1208', '#431e0d', '#5f2d15', '#7d4120', '#9c572f'),
        'hoof': ramp('#1c130c', '#2e2016', '#43301f', '#5a4229', '#735736'),
    },
    'palomino': {
        'body': ramp('#8a5f20', '#b0802d', '#d4a443', '#ecc15f', '#f8da86'),
        'belly': ramp('#a37a30', '#c79a45', '#e3b95e', '#f4d27f', '#fde9aa'),
        'mane': ramp('#b8a47a', '#d3c397', '#e8dcb7', '#f5edd3', '#fffaec'),
        'hoof': ramp('#3a2c1a', '#54402a', '#705738', '#8d7248', '#a98e5c'),
    },
    'tordilho': {
        'body': ramp('#4d5058', '#6b6f78', '#8c9099', '#aeb2ba', '#cdd0d6'),
        'belly': ramp('#6a6e76', '#868a93', '#a3a7af', '#c1c4ca', '#dcdee2'),
        'mane': ramp('#2f3238', '#464a52', '#62666f', '#80848c', '#a0a3aa'),
        'hoof': ramp('#1d1e21', '#2e3034', '#43464b', '#5a5d63', '#73767c'),
        'dapple': ramp('#3c3f46', '#52555d', '#6b6e77', '#868a93', '#a3a7ae'),
    },
    'castanho': {
        'body': ramp('#2e170b', '#47260f', '#63381a', '#824c26', '#a06636'),
        'belly': ramp('#3b1f0f', '#563116', '#744522', '#946032', '#b57f48'),
        'mane': ramp('#07050a', '#0f0b0f', '#1a1315', '#2a1f21', '#3d2e30'),
        'hoof': ramp('#1a1410', '#2b221a', '#403427', '#58493a', '#725f4c'),
        'sock': ramp('#a89c8c', '#c9bfb0', '#e3dccf', '#f3eee4', '#fffcf4'),
        'blaze': ramp('#c9bfb0', '#e3dccf', '#f3eee4', '#fffcf4', '#ffffff'),
    },
}

COAT_NAMES = {
    'preto': 'Cavalo preto', 'malhado': 'Cavalo branco malhado de laranja', 'alazao': 'Cavalo alazão (marrom alaranjado)',
    'palomino': 'Cavalo palomino', 'tordilho': 'Cavalo tordilho (cinza)', 'castanho': 'Cavalo castanho de meias brancas',
}


def _dark(rp: list[RGBA], t: float = 0.3) -> list[RGBA]:
    return [mix(c, rgb('#000000'), t) for c in rp]


def _patches(coat_name: str, shape: Image.Image, dx: float, dy: float, thr: float) -> Image.Image:
    """Manchas: onde o ruído passa do limiar, dentro de `shape` (coordenadas do bicho, sem a oscilação do passo)."""
    out = Image.new('L', (64, 64), 0)
    px = out.load()
    sp = shape.load()
    for y in range(64):
        for x in range(64):
            if sp[x, y] > 128 and fbm((x + dx) / 6.5, (y + dy) / 5.5, SEED + 40, 3) > thr:
                px[x, y] = 255
    return out


def _leg(cv: Cv, pts: list[tuple[float, float]], widths: list[int], rp: list[RGBA], hoof: list[RGBA], sock: list[RGBA] | None) -> None:
    _limb(cv, pts, widths, rp, hoof[2])
    (x, y) = pts[-1]
    d = ImageDraw.Draw(cv.im)
    # casco: um bloco escuro e achatado
    d.rectangle([round(x) - 2, round(y) - 2, round(x) + 2, round(y) + 1], fill=hoof[1])
    d.line([round(x) - 2, round(y) + 1, round(x) + 2, round(y) + 1], fill=hoof[0])
    d.point([round(x) - 2, round(y) - 2], fill=hoof[3])
    if sock:                                                       # meia branca: do boleto ao casco
        d.rectangle([round(x) - 2, round(y) - 6, round(x) + 1, round(y) - 3], fill=sock[3])
        d.point([round(x) - 2, round(y) - 6], fill=sock[4])


def _gallop(anim: str, f: int) -> dict[str, float]:
    g = _gait(anim, f)
    if anim == 'run':
        g['swing'] = 7.5
        g['lift'] = 7.0
        g['bob'] = 2.2 * abs(math.cos(g['phase']))
    elif anim == 'walk':
        g['swing'] = 4.5
        g['lift'] = 3.5
    return g


# ── De lado (olhando pra esquerda) ────────────────────────

def _side(name: str, anim: str, f: int) -> Cv:
    coat = COATS[name]
    cv = Cv(64, 64)
    g = _gallop(anim, f)
    body, belly, mane, hoof = coat['body'], coat['belly'], coat['mane'], coat['hoof']
    sock = coat.get('sock')
    b = round(g['bob'])
    ph = g['phase']
    sw, lf = g['swing'], g['lift']
    moving = anim != 'idle' and not (anim == 'walk' and f == 0)
    wag = g['wag']
    hd = round(g['head'])
    run = anim == 'run'

    def foot(phase: float) -> tuple[float, float]:
        fwd = sw * math.sin(phase)
        up = lf * max(0.0, math.cos(phase)) if moving else 0.0
        return -fwd, up

    fl, fr = foot(ph), foot(ph + math.pi)
    hr, hl = foot(ph + math.pi), foot(ph)                           # diagonais juntas

    def front_leg(x0: float, dx: float, up: float, shade: list[RGBA], hf: list[RGBA], sk) -> None:
        knee = (x0 + dx * 0.4 - up * 0.2, 50 - up * 0.9 + b * 0.3)
        fet = (x0 + dx * 0.8, 57 - up * 0.9)
        hoofp = (x0 + dx, BASE - up)
        _leg(cv, [(x0, 40 + b), knee, fet, hoofp], [6, 4, 3], shade, hf, sk)

    def hind_leg(x0: float, dx: float, up: float, shade: list[RGBA], hf: list[RGBA], sk) -> None:
        stifle = (x0 - 3 + dx * 0.1, 44 + b * 0.5)
        hock = (x0 + 2 + dx * 0.6 - up * 0.3, 52 - up * 0.7)
        fet = (x0 + dx * 0.9, 57 - up * 0.9)
        hoofp = (x0 + dx, BASE - up)
        _leg(cv, [(x0, 36 + b), stifle, hock, fet, hoofp], [7, 4, 3, 3], shade, hf, sk)

    far_b, far_h = _dark(body, 0.3), _dark(hoof, 0.1)
    front_leg(26, fr[0], fr[1], far_b, far_h, sock)
    hind_leg(44, hl[0], hl[1], far_b, far_h, sock)

    # rabo (comprido, cai e balança; na corrida voa pra trás)
    tw = round(wag)
    fl_up = 4 if run else 0
    tail = [(49, 31 + b), (53, 33 + b - fl_up), (56 + tw + (3 if run else 0), 40 + b - fl_up), (56 + tw + (4 if run else 0), 50 + b - fl_up * 2), (53 + tw, 57 + b - fl_up * 2),
            (51 + tw, 50 + b - fl_up), (50, 40 + b)]
    _fill(cv, _mask(tail), mane, SEED + 3, 0.35, 2.0)

    # tronco (barril), garupa e peito
    torso_m = _mask([(18, 33 + b), (23, 29 + b), (31, 28 + b), (40, 28 + b), (47, 29 + b), (51, 33 + b), (50, 40 + b), (45, 45 + b), (35, 46 + b), (26, 45 + b), (20, 41 + b)])
    _fill(cv, torso_m, body, SEED, 0.55, 2.8)
    belly_m = _mask([(22, 42 + b), (31, 45 + b), (41, 45 + b), (46, 44 + b), (45, 45 + b), (35, 47 + b), (26, 46 + b), (21, 43 + b)])
    _fill(cv, ImageChops.multiply(belly_m, torso_m), belly, SEED + 1, 0.45, 2.4)
    # luzes no lombo
    _fill(cv, ImageChops.multiply(_mask([(28, 29 + b), (45, 30 + b), (45, 33 + b), (28, 32 + b)]), torso_m), [mix(c, rgb('#ffffff'), 0.12) for c in body], SEED + 2, 0.3, 2.0)

    # pescoço e cabeça (comprida, de focinho pra baixo)
    neck_m = _mask([(24, 36 + b), (24, 29 + b), (19, 21 + hd + b), (13, 18 + hd + b), (12, 25 + hd + b), (16, 34 + b), (20, 41 + b)])
    _fill(cv, neck_m, body, SEED + 5, 0.55, 2.6)
    hx, hy = 10, 19 + hd + b
    head_m = _mask([(hx + 3, hy - 4), (hx + 8, hy - 3), (hx + 8, hy + 3), (hx + 2, hy + 6), (hx - 3, hy + 9), (hx - 7, hy + 9), (hx - 8, hy + 6), (hx - 5, hy + 1), (hx - 1, hy - 3)])
    _fill(cv, head_m, body, SEED + 9, 0.55, 2.2)
    muzzle = _mask([(hx - 4, hy + 5), (hx - 8, hy + 6), (hx - 8, hy + 9), (hx - 6, hy + 10), (hx - 2, hy + 8)])
    _fill(cv, muzzle, belly, SEED + 10, 0.5, 2.0)
    # orelha
    ear = _mask([(hx + 3, hy - 3), (hx + 4, hy - 9), (hx + 7, hy - 3)])
    _fill(cv, ear, body, SEED + 8, 0.5)
    # crina: do topo da cabeça até a cernelha, e a franja
    manem = _mask([(hx + 6, hy - 4), (hx + 9, hy - 2), (22, 24 + b), (27, 29 + b), (25, 31 + b), (20, 27 + b), (15, 22 + hd + b)])
    _fill(cv, manem, mane, SEED + 6, 0.35, 2.0)
    _fill(cv, _mask([(hx + 1, hy - 5), (hx + 6, hy - 6), (hx + 6, hy - 1), (hx + 2, hy + 1)]), mane, SEED + 7, 0.3, 2.0)  # franja
    # estrela/listra
    if 'blaze' in coat:
        _fill(cv, ImageChops.multiply(_mask([(hx - 2, hy - 1), (hx + 1, hy - 3), (hx - 5, hy + 7), (hx - 7, hy + 7)]), head_m), coat['blaze'], SEED + 11, 0.3, 2.0)
    cv.px(hx - 1, hy + 1, EYE); cv.px(hx, hy + 1, EYE)
    cv.px(hx - 1, hy, EYE_GLINT)
    cv.px(hx - 7, hy + 8, NOSTRIL); cv.px(hx - 7, hy + 7, NOSTRIL)
    if anim == 'idle' and f == 1:
        cv.px(hx - 3, hy + 6, mix(body[1], rgb('#000000'), 0.4))

    # manchas e rodado
    if 'patch' in coat:
        whole = _union(torso_m, neck_m, head_m)
        pm = _patches(name, whole, 0, -b, 0.56)
        _fill(cv, ImageChops.multiply(pm, whole), coat['patch'], SEED + 20, 0.45, 2.4)
    if 'dapple' in coat:
        whole = _union(torso_m, neck_m)
        dm = _patches(name, whole, 3, -b, 0.60)
        _fill(cv, ImageChops.multiply(dm, whole), coat['dapple'], SEED + 21, 0.4, 2.0)

    front_leg(21, fl[0], fl[1], body, hoof, sock)
    hind_leg(40, hr[0], hr[1], body, hoof, sock)
    return cv


# ── De frente ─────────────────────────────────────────────

def _front(name: str, anim: str, f: int) -> Cv:
    coat = COATS[name]
    cv = Cv(64, 64)
    g = _gallop(anim, f)
    body, belly, mane, hoof = coat['body'], coat['belly'], coat['mane'], coat['hoof']
    sock = coat.get('sock')
    b = round(g['bob'])
    ph = g['phase']
    lf = g['lift'] * 0.7
    moving = anim != 'idle' and not (anim == 'walk' and f == 0)

    def lift(p: float) -> float:
        return lf * max(0.0, math.cos(p)) if moving else 0.0

    l_up, r_up = lift(ph), lift(ph + math.pi)
    # patas de trás (aparecem dos lados, escuras)
    for cx, up in ((23, r_up), (41, l_up)):
        _leg(cv, [(cx, 44 + b), (cx + (1 if cx > 32 else -1), 52), (cx, BASE - up * 0.6)], [5, 3], _dark(body, 0.3), _dark(hoof, 0.1), sock)
    # peito largo
    chest = _union(_ell(32, 42 + b, 10, 8), _mask([(23, 34 + b), (41, 34 + b), (42, 48 + b), (22, 48 + b)]))
    _fill(cv, chest, body, SEED, 0.55, 2.8)
    _fill(cv, ImageChops.multiply(_mask([(28, 38 + b), (36, 38 + b), (37, 48 + b), (27, 48 + b)]), chest), belly, SEED + 1, 0.4, 2.4)
    # patas da frente
    for cx, up in ((27, l_up), (37, r_up)):
        _leg(cv, [(cx, 44 + b), (cx, 52 - up * 0.4), (cx, BASE - up)], [6, 4], body, hoof, sock)
    # pescoço grosso e cabeça comprida vista de frente
    hd = round(g['head'])
    neck = _mask([(24, 38 + b), (40, 38 + b), (38, 24 + hd + b), (26, 24 + hd + b)])
    _fill(cv, neck, body, SEED + 5, 0.5, 2.6)
    hy = 15 + hd + b
    _fill(cv, ImageChops.multiply(_mask([(24, hy + 9), (40, hy + 9), (40, 38 + b), (24, 38 + b)]), neck), _dark(body, 0.22), SEED + 12, 0.4, 2.4)   # o pescoço mais escuro, pra cabeça se destacar
    ear_l = _mask([(27, hy - 1), (28, hy - 8), (31, hy)])
    ear_r = _mask([(33, hy), (36, hy - 8), (37, hy - 1)])
    _fill(cv, ear_l, body, SEED + 8, 0.5); _fill(cv, ear_r, body, SEED + 8, 0.5)
    head = _mask([(27, hy), (37, hy), (38, hy + 5), (36, hy + 11), (35, hy + 13), (29, hy + 13), (28, hy + 11), (26, hy + 5)])
    _fill(cv, head, body, SEED + 9, 0.55, 2.2)
    muzzle = _mask([(29, hy + 9), (35, hy + 9), (36, hy + 13), (28, hy + 13)])
    _fill(cv, muzzle, belly, SEED + 10, 0.5, 2.0)
    if 'blaze' in coat:
        _fill(cv, ImageChops.multiply(_mask([(31, hy), (33, hy), (34, hy + 11), (30, hy + 11)]), head), coat['blaze'], SEED + 11, 0.3, 2.0)
    _fill(cv, _mask([(26, hy - 2), (38, hy - 2), (39, hy + 4), (36, hy + 3), (32, hy + 1), (28, hy + 3), (25, hy + 4)]), mane, SEED + 7, 0.3, 2.0)   # franja
    cv.px(28, hy + 4, EYE); cv.px(36, hy + 4, EYE)
    cv.px(28, hy + 3, EYE_GLINT); cv.px(36, hy + 3, EYE_GLINT)
    cv.px(30, hy + 12, NOSTRIL); cv.px(34, hy + 12, NOSTRIL)
    if 'patch' in coat:
        whole = _union(chest, neck, head)
        pm = _patches(name, whole, 0, -b, 0.56)
        _fill(cv, ImageChops.multiply(pm, whole), coat['patch'], SEED + 20, 0.45, 2.4)
    if 'dapple' in coat:
        whole = _union(chest, neck)
        dm = _patches(name, whole, 3, -b, 0.60)
        _fill(cv, ImageChops.multiply(dm, whole), coat['dapple'], SEED + 21, 0.4, 2.0)
    return cv


# ── De costas ─────────────────────────────────────────────

def _back(name: str, anim: str, f: int) -> Cv:
    coat = COATS[name]
    cv = Cv(64, 64)
    g = _gallop(anim, f)
    body, belly, mane, hoof = coat['body'], coat['belly'], coat['mane'], coat['hoof']
    sock = coat.get('sock')
    b = round(g['bob'])
    ph = g['phase']
    lf = g['lift'] * 0.7
    moving = anim != 'idle' and not (anim == 'walk' and f == 0)

    def lift(p: float) -> float:
        return lf * max(0.0, math.cos(p)) if moving else 0.0

    l_up, r_up = lift(ph), lift(ph + math.pi)
    # patas da frente (aparecem dos lados, escuras)
    for cx, up in ((24, r_up), (40, l_up)):
        _leg(cv, [(cx, 44 + b), (cx, 52), (cx, BASE - up * 0.6)], [4, 3], _dark(body, 0.3), _dark(hoof, 0.1), sock)
    # cabeça e pescoço por cima do lombo (só a nuca, as orelhas e a crina)
    hd = round(g['head'])
    hy = 18 + hd + b
    neck = _mask([(26, 36 + b), (38, 36 + b), (36, 22 + hd + b), (28, 22 + hd + b)])
    _fill(cv, neck, body, SEED + 5, 0.5, 2.6)
    ear_l = _mask([(27, hy - 1), (28, hy - 8), (31, hy)])
    ear_r = _mask([(33, hy), (36, hy - 8), (37, hy - 1)])
    _fill(cv, ear_l, body, SEED + 8, 0.5); _fill(cv, ear_r, body, SEED + 8, 0.5)
    poll = _mask([(28, hy), (36, hy), (37, hy + 6), (27, hy + 6)])
    _fill(cv, poll, body, SEED + 9, 0.5, 2.2)
    _fill(cv, _mask([(30, hy - 1), (34, hy - 1), (35, 36 + b), (29, 36 + b)]), mane, SEED + 7, 0.35, 2.0)   # crina pelo meio do pescoço
    # garupa
    rump = _union(_ell(32, 41 + b, 11, 9), _mask([(22, 34 + b), (42, 34 + b), (44, 47 + b), (20, 47 + b)]))
    _fill(cv, rump, body, SEED, 0.55, 2.8)
    _fill(cv, ImageChops.multiply(_mask([(26, 33 + b), (38, 33 + b), (37, 40 + b), (27, 40 + b)]), rump), [mix(c, rgb('#ffffff'), 0.1) for c in body], SEED + 2, 0.3, 2.0)
    # patas de trás
    for cx, up in ((27, l_up), (37, r_up)):
        _leg(cv, [(cx, 46 + b), (cx + (-1 if cx < 32 else 1), 53), (cx, BASE - up)], [7, 4], body, hoof, sock)
    # rabo no meio
    wag = round(g['wag'])
    upt = round(g['tail_up'])
    tail = _mask([(30, 36 + b), (35, 36 + b), (37 + wag, 46 + b - upt), (37 + wag, 56 + b - upt * 2), (32 + wag, 58 + b - upt * 2), (28 + wag, 50 + b - upt)])
    _fill(cv, tail, mane, SEED + 3, 0.35, 2.0)
    if 'patch' in coat:
        whole = _union(rump, neck, poll)
        pm = _patches(name, whole, 0, -b, 0.56)
        _fill(cv, ImageChops.multiply(pm, whole), coat['patch'], SEED + 20, 0.45, 2.4)
    if 'dapple' in coat:
        whole = _union(rump, neck)
        dm = _patches(name, whole, 3, -b, 0.60)
        _fill(cv, ImageChops.multiply(dm, whole), coat['dapple'], SEED + 21, 0.4, 2.0)
    return cv


def frame(name: str, anim: str, row: int, f: int) -> Image.Image:
    cv = _front(name, anim, f) if row == 2 else _back(name, anim, f) if row == 0 else _side(name, anim, f)
    if row == 3:
        cv = cv.flipped()
    cv.outline(OUT)
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    wide = 34 if row in (1, 3) else 20
    ImageDraw.Draw(sh).ellipse([32 - wide // 2, BASE - 1, 32 + wide // 2, BASE + 3], fill=(0, 0, 0, 70))
    sh.alpha_composite(cv.im)
    return sh


def sheet(name: str, anim: str) -> Image.Image:
    n = ANIMS[anim]
    out = Image.new('RGBA', (n * 64, 256), (0, 0, 0, 0))
    for row in range(4):
        for f in range(n):
            out.alpha_composite(frame(name, anim, row, f), (f * 64, row * 64))
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    """Folhas do cavalo (`tlou/horses/cavalo/<anim>/<pelagem>.png`) e o item do catálogo."""
    base_rel = 'tlou/horses/cavalo/'
    for anim in ANIMS:
        d = os.path.join(assets, SHEETS, base_rel, anim)
        os.makedirs(d, exist_ok=True)
        for coat in COATS:
            sheet(coat, anim).save(os.path.join(d, f'{coat}.png'), optimize=True)
    items = [
        {'id': 'tlou/body/cavalo', 'slot': 'body', 'name': 'Cavalo', 'layers': [{'z': 10, 'paths': {b: base_rel for b in BODIES}}],
         'bodies': list(BODIES), 'anims': list(ANIMS), 'variants': list(COATS)},
    ]
    return [], items


def preview(assets: str, out: str) -> None:
    """Folha de contato: cada pelagem em andar (as 4 direções, 3 quadros), ampliada 2x, 3 pelagens por linha."""
    names = list(COATS)
    frames = (0, 3, 6)
    cell_w, cell_h = len(frames) * 64 + 10, 4 * 64 + 6
    per_row = 3
    rows = (len(names) + per_row - 1) // per_row
    sheet_im = Image.new('RGBA', (per_row * cell_w, rows * cell_h), (62, 56, 48, 255))
    for i, coat in enumerate(names):
        full = sheet(coat, 'walk')
        ox, oy = (i % per_row) * cell_w, (i // per_row) * cell_h
        for row in range(4):
            for k, fr in enumerate(frames):
                sheet_im.alpha_composite(full.crop((fr * 64, row * 64, fr * 64 + 64, row * 64 + 64)), (ox + k * 64, oy + row * 64))
    sheet_im = sheet_im.resize((sheet_im.width * 2, sheet_im.height * 2), Image.NEAREST)
    sheet_im.save(out)
