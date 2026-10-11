"""Cachorro (pastor alemão) do Vortable: um "corpo" completo, desenhado por código, que entra no boneco como a peça de corpo.

Cada folha segue o padrão do personagem (LPC): linhas 0 = de costas, 1 = olhando pra esquerda, 2 = de frente, 3 = olhando pra
direita; colunas = quadros (caminhar 9, correr 8, parado 2). O cachorro é desenhado no próprio tamanho dentro do quadro de 64x64,
com os pés na linha 61. Pelagens (variantes prontas): clássico (sela preta e marrom), preto, sable (marrom com o lombo escuro) e branco.

Como o motor monta o boneco em camadas, o cachorro é um item do espaço "Corpo" (`tlou/body/cachorro`) e a cabeça é uma peça vazia
(`tlou/head/nenhuma`), que ocupa o lugar da cabeça humana que o personagem exige.
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageChops, ImageDraw

from .px import Cv, RGBA, ramp, rgb, mix

SHEETS = 'character/sheets'
BODIES = ('male', 'female', 'muscular', 'teen', 'child')
ANIMS = {'walk': 9, 'run': 8, 'idle': 2}
BASE = 61

# ── Pelagens ──────────────────────────────────────────────
#   tan = o marrom (patas, focinho, peito); black = a sela e o dorso; cream = barriga, peito e patas por dentro.
COATS: dict[str, dict[str, list[RGBA]]] = {
    'classico': {
        'tan': ramp('#6a3f1c', '#94602b', '#b97d3a', '#d29a55', '#e6b878'),
        'black': ramp('#08080a', '#141417', '#222226', '#34343a', '#4a4a52'),
        'cream': ramp('#9c8a68', '#bcab88', '#d6c8a4', '#e8dcbc', '#f4ead0'),
    },
    'preto': {
        'tan': ramp('#2a1a0e', '#4a2e18', '#6a4426', '#8a5c34', '#a8764a'),
        'black': ramp('#050506', '#0e0e10', '#19191c', '#27272b', '#3a3a40'),
        'cream': ramp('#3a3026', '#54483a', '#6e6050', '#8a7a68', '#a89886'),
    },
    'sable': {
        'tan': ramp('#6a3f1c', '#94602b', '#b97d3a', '#d29a55', '#e6b878'),
        'black': ramp('#2a1a0e', '#43301a', '#5e4424', '#7a5a32', '#94703f'),
        'cream': ramp('#9c8a68', '#bcab88', '#d6c8a4', '#e8dcbc', '#f4ead0'),
    },
    'branco': {
        'tan': ramp('#a89a82', '#c4b79c', '#dcd0b6', '#ece3cc', '#f8f1de'),
        'black': ramp('#b8a88a', '#cdbfa2', '#e0d4ba', '#efe6d0', '#faf4e4'),
        'cream': ramp('#c4b79c', '#dcd0b6', '#ece3cc', '#f6efdc', '#fffaee'),
    },
}
NOSE = rgb('#0b0b0d')
EYE = rgb('#1c0f06')
EYE_GLINT = rgb('#e8d8b8')
TONGUE = rgb('#d4687c')
TONGUE_D = rgb('#a84560')
OUT = rgb('#140e09')

SEED = 77


# ── Ajudantes de desenho ──────────────────────────────────

def _mask(pts: list[tuple[float, float]]) -> Image.Image:
    m = Image.new('L', (64, 64), 0)
    ImageDraw.Draw(m).polygon([(round(x), round(y)) for x, y in pts], fill=255)
    return m


def _ell(cx: float, cy: float, rx: float, ry: float) -> Image.Image:
    m = Image.new('L', (64, 64), 0)
    ImageDraw.Draw(m).ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=255)
    return m


def _union(*ms: Image.Image) -> Image.Image:
    out = ms[0]
    for m in ms[1:]:
        out = ImageChops.lighter(out, m)
    return out


def _fill(cv: Cv, mask: Image.Image, rp: list[RGBA], seed: int = SEED, light: float = 0.55, scale: float = 2.4, grain: float = 0.16) -> None:
    cv._tex(mask, rp, seed, scale, light, grain)


def _limb(cv: Cv, pts: list[tuple[float, float]], widths: list[int], rp: list[RGBA], paw: RGBA | None = None) -> None:
    """Pata: segmentos grossos que afinam (luz de cima: o lado esquerdo é mais claro)."""
    d = ImageDraw.Draw(cv.im)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        w = widths[i]
        d.line([round(x0), round(y0), round(x1), round(y1)], fill=rp[2], width=w)
        # sombra no lado direito e luz no esquerdo
        d.line([round(x0) + w // 2, round(y0), round(x1) + w // 2, round(y1)], fill=rp[1], width=1)
        d.line([round(x0) - w // 2 + 1, round(y0), round(x1) - w // 2 + 1, round(y1)], fill=rp[3], width=1)
    px, py = pts[-1]
    d.ellipse([round(px) - 2, round(py) - 1, round(px) + 2, round(py) + 1], fill=paw or rp[2])
    d.point([round(px) - 1, round(py) - 1], fill=rp[4])


def _gait(anim: str, f: int) -> dict[str, float]:
    """Parâmetros do passo no quadro f: oscilação das patas, altura, balanço do corpo e do rabo."""
    if anim == 'idle':
        return {'swing': 0.0, 'lift': 0.0, 'bob': 1.0 if f else 0.0, 'wag': -1.0 if f else 1.0, 'head': 1.0 if f else 0.0, 'phase': 0.0, 'tail_up': 0.0, 'stretch': 0.0}
    if anim == 'walk' and f == 0:
        return {'swing': 0.0, 'lift': 0.0, 'bob': 0.0, 'wag': 0.0, 'head': 0.0, 'phase': 0.0, 'tail_up': 0.0, 'stretch': 0.0}
    n = 8
    i = (f - 1) if anim == 'walk' else f
    phase = 2 * math.pi * i / n
    run = anim == 'run'
    return {
        'swing': 6.5 if run else 4.0, 'lift': 5.0 if run else 3.0,
        'bob': (1.8 if run else 0.9) * abs(math.cos(phase)) + (0.0),
        'wag': math.sin(phase * 2) * 1.5, 'head': 0.6 * math.sin(phase * 2), 'phase': phase,
        'tail_up': 3.0 if run else 0.0, 'stretch': 1.0 if run else 0.0,
    }


# ── De lado (olhando pra esquerda) ────────────────────────

def _side(coat: dict[str, list[RGBA]], anim: str, f: int) -> Cv:
    cv = Cv(64, 64)
    g = _gait(anim, f)
    tan, black, cream = coat['tan'], coat['black'], coat['cream']
    b = round(g['bob'])
    ph = g['phase']
    sw, lf = g['swing'], g['lift']
    st = round(g['stretch'] * 2)

    def foot(phase: float) -> tuple[float, float]:
        fwd = sw * math.sin(phase)
        up = lf * max(0.0, math.cos(phase)) if anim != 'idle' and not (anim == 'walk' and f == 0) else 0.0
        return -fwd, up                                            # + é pra trás (direita)

    # patas: diagonais juntas (trote). FL e HR em fase; FR e HL no contrafluxo
    fl = foot(ph); fr = foot(ph + math.pi); hr = foot(ph); hl = foot(ph + math.pi)
    fx0, hx0 = 24 - st, 41 + st // 2

    def front(cx: float, dx: float, up: float, shade: list[RGBA]) -> None:
        paw = (cx + dx, BASE - up)
        elbow = (cx + dx * 0.45 - 1, 51 - up * 0.5 + b * 0.3)
        _limb(cv, [(cx, 44 + b), elbow, paw], [4, 3], shade, mix(shade[2], shade[1], 0.3))

    def hind(cx: float, dx: float, up: float, shade: list[RGBA]) -> None:
        paw = (cx + dx, BASE - up)
        knee = (cx - 3 + dx * 0.2, 50 + b * 0.4)
        hock = (cx + 3 + dx * 0.6, 55 - up * 0.6)
        _limb(cv, [(cx, 42 + b), knee, hock, paw], [5, 3, 3], shade, mix(shade[2], shade[1], 0.3))

    dark_tan = [mix(c, rgb('#000000'), 0.28) for c in tan]
    # patas do outro lado (escurecidas)
    front(fx0 + 3, fr[0], fr[1], dark_tan)
    hind(hx0 - 2, hl[0], hl[1], dark_tan)

    # rabo (peludo, caindo; balança e sobe na corrida)
    wag = g['wag']
    up = g['tail_up']
    tail = [(44 + st, 38 + b), (48 + st, 39 + b - up * 0.4), (52 + st + wag * 0.3, 43 + b - up), (54 + st + wag, 49 + b - up * 1.3), (52 + st + wag, 55 + b - up),
            (49 + st + wag * 0.5, 52 + b - up * 0.6), (47 + st, 46 + b)]
    tm = _mask(tail)
    _fill(cv, tm, black if True else tan, SEED + 3, 0.35, 2.0)
    under = _mask([(47 + st, 46 + b), (49 + st + wag * 0.5, 52 + b - up * 0.6), (52 + st + wag, 55 + b - up), (51 + st + wag, 50 + b - up * 0.8)])
    _fill(cv, ImageChops.multiply(under, tm), tan, SEED + 4, 0.4, 2.0)

    # tronco
    torso = _mask([(19, 36 + b), (24, 33 + b), (31, 34 + b), (38, 35 + b), (44 + st, 38 + b), (46 + st, 43 + b), (43 + st, 47 + b), (36, 48 + b), (28, 48 + b), (22, 46 + b), (19, 41 + b)])
    _fill(cv, torso, tan, SEED, 0.55, 2.6)
    belly = _mask([(21, 44 + b), (30, 46 + b), (40 + st, 45 + b), (43 + st, 47 + b), (36, 48 + b), (28, 48 + b), (22, 47 + b)])
    _fill(cv, ImageChops.multiply(belly, torso), cream, SEED + 1, 0.4, 2.2)
    saddle = _mask([(23, 33 + b), (31, 34 + b), (39, 35 + b), (46 + st, 39 + b), (46 + st, 42 + b), (42 + st, 41 + b), (36, 40 + b), (30, 39 + b), (26, 38 + b), (24, 36 + b)])
    _fill(cv, ImageChops.multiply(saddle, torso), black, SEED + 2, 0.5, 2.2)

    # pescoço, peito (creme/marrom) e cabeça
    hd = round(g['head'])
    hx, hy = 14 - st // 2, 27 + hd + b
    neck = _mask([(20, 36 + b), (22, 31 + b), (20, 26 + hd + b), (15, 28 + hd + b), (15, 34 + b), (18, 38 + b)])
    _fill(cv, neck, tan, SEED + 5, 0.55, 2.6)
    ruff = _mask([(22, 31 + b), (24, 35 + b), (22, 40 + b), (19, 40 + b), (18, 36 + b), (20, 31 + b)])
    _fill(cv, ruff, cream, SEED + 6, 0.45, 2.2)
    nape = _mask([(22, 31 + b), (20, 26 + hd + b), (17, 27 + hd + b), (19, 33 + b), (23, 34 + b)])
    _fill(cv, nape, black, SEED + 7, 0.4, 2.0)
    far_ear = _mask([(hx + 4, hy - 3), (hx + 6, hy - 10), (hx + 8, hy - 3)])
    _fill(cv, far_ear, [mix(c, rgb('#000000'), 0.3) for c in black], SEED + 8, 0.4)
    skull = _union(_ell(hx + 1, hy, 5, 4), _mask([(hx - 3, hy - 2), (hx + 5, hy - 4), (hx + 6, hy + 3), (hx - 2, hy + 4)]))
    muzzle = _mask([(hx - 2, hy - 1), (hx - 8, hy + 1), (hx - 9, hy + 3), (hx - 7, hy + 5), (hx - 1, hy + 5)])
    _fill(cv, skull, tan, SEED + 9, 0.55, 2.2)
    _fill(cv, muzzle, tan, SEED + 10, 0.6, 2.0)
    mask_dark = _mask([(hx - 9, hy + 1), (hx - 4, hy - 1), (hx - 3, hy + 3), (hx - 6, hy + 5), (hx - 9, hy + 3)])
    _fill(cv, ImageChops.multiply(mask_dark, muzzle), black, SEED + 11, 0.4, 2.0)
    _fill(cv, _mask([(hx, hy - 4), (hx + 4, hy - 4), (hx + 5, hy - 1), (hx + 1, hy - 1)]), black, SEED + 12, 0.4, 2.0)   # topo da cabeça
    near_ear = _mask([(hx - 1, hy - 3), (hx + 1, hy - 11), (hx + 5, hy - 3)])
    _fill(cv, near_ear, black, SEED + 13, 0.5)
    cv.px(hx - 1, hy - 1, EYE); cv.px(hx - 2, hy - 1, EYE)
    cv.px(hx - 1, hy - 2, mix(tan[3], tan[4], 0.5))                      # sobrancelha clara
    cv.px(hx - 9, hy + 2, NOSE); cv.px(hx - 9, hy + 3, NOSE); cv.px(hx - 8, hy + 2, NOSE)
    cv.px(hx - 5, hy + 4, rgb('#1a0f08'))                                # boca
    if anim == 'run' or (anim == 'idle' and f == 1):                      # língua de fora
        cv.rect(hx - 7, hy + 5, 3, 2, TONGUE); cv.px(hx - 6, hy + 6, TONGUE_D)

    # patas do lado de cá
    front(fx0, fl[0], fl[1], tan)
    hind(hx0, hr[0], hr[1], tan)
    # creme por dentro da pata da frente e peito
    cv.px(fx0 - 1, 50 + b, cream[3]); cv.px(fx0 - 1, 51 + b, cream[3])
    return cv


# ── De frente ─────────────────────────────────────────────

def _front(coat: dict[str, list[RGBA]], anim: str, f: int) -> Cv:
    cv = Cv(64, 64)
    g = _gait(anim, f)
    tan, black, cream = coat['tan'], coat['black'], coat['cream']
    b = round(g['bob'])
    ph = g['phase']
    lf = g['lift'] * 0.7
    run = anim == 'run'

    def lift(p: float) -> float:
        return lf * max(0.0, math.cos(p)) if anim != 'idle' and not (anim == 'walk' and f == 0) else 0.0

    dark_tan = [mix(c, rgb('#000000'), 0.3) for c in tan]
    l_up, r_up = lift(ph), lift(ph + math.pi)
    # patas de trás (aparecem dos lados, escuras)
    for cx, up in ((24, r_up), (40, l_up)):
        _limb(cv, [(cx, 47 + b), (cx + (1 if cx > 32 else -1), 53), (cx, BASE - up * 0.6)], [4, 3], dark_tan)
    # tronco visto de frente (peito largo)
    body = _union(_ell(32, 41 + b, 9, 7), _mask([(24, 36 + b), (40, 36 + b), (41, 46 + b), (23, 46 + b)]))
    _fill(cv, body, tan, SEED, 0.55, 2.6)
    _fill(cv, ImageChops.multiply(_mask([(23, 30 + b), (41, 30 + b), (40, 37 + b), (24, 37 + b)]), body), black, SEED + 2, 0.4, 2.0)   # ombros escuros
    chest = _mask([(28, 36 + b), (36, 36 + b), (37, 47 + b), (27, 47 + b)])
    _fill(cv, ImageChops.multiply(chest, body), cream, SEED + 1, 0.45, 2.2)
    # patas da frente
    for cx, up in ((28, l_up), (36, r_up)):
        _limb(cv, [(cx, 44 + b), (cx + (0 if cx < 32 else 0), 52 - up * 0.4), (cx, BASE - up)], [4, 3], tan, cream[2])
        cv.px(cx - 1, 54 - round(up * 0.4), cream[3])
    # pescoço e cabeça
    hd = round(g['head'])
    hy = 26 + hd + b
    ruff = _union(_ell(32, 33 + b, 7, 5), _mask([(26, 30 + b), (38, 30 + b), (37, 37 + b), (27, 37 + b)]))
    _fill(cv, ruff, tan, SEED + 5, 0.5, 2.4)
    ear_l = _mask([(25, hy - 3), (26, hy - 12), (31, hy - 4)])
    ear_r = _mask([(33, hy - 4), (38, hy - 12), (39, hy - 3)])
    _fill(cv, ear_l, black, SEED + 8, 0.45); _fill(cv, ear_r, black, SEED + 8, 0.45)
    inner = rgb('#9a6a40') if coat is not COATS['preto'] else rgb('#3a2a1c')
    cv.px(27, hy - 6, inner); cv.px(27, hy - 5, inner); cv.px(37, hy - 6, inner); cv.px(37, hy - 5, inner)
    skull = _union(_ell(32, hy, 6, 5), _mask([(26, hy - 2), (38, hy - 2), (37, hy + 4), (27, hy + 4)]))
    _fill(cv, skull, tan, SEED + 9, 0.55, 2.2)
    _fill(cv, _mask([(28, hy - 5), (36, hy - 5), (37, hy - 2), (27, hy - 2)]), black, SEED + 12, 0.4, 2.0)         # testa escura
    muzzle = _mask([(29, hy + 1), (35, hy + 1), (36, hy + 6), (28, hy + 6)])
    _fill(cv, muzzle, cream if coat is not COATS['preto'] else tan, SEED + 10, 0.5, 2.0)
    cv.px(30, hy - 1, EYE); cv.px(34, hy - 1, EYE)
    cv.px(30, hy - 2, tan[4]); cv.px(34, hy - 2, tan[4])
    cv.rect(31, hy + 2, 3, 2, NOSE)
    cv.px(32, hy + 5, rgb('#1a0f08'))
    if run or (anim == 'idle' and f == 1):
        cv.rect(31, hy + 6, 3, 3, TONGUE); cv.px(32, hy + 8, TONGUE_D)
    return cv


# ── De costas ─────────────────────────────────────────────

def _back(coat: dict[str, list[RGBA]], anim: str, f: int) -> Cv:
    cv = Cv(64, 64)
    g = _gait(anim, f)
    tan, black, cream = coat['tan'], coat['black'], coat['cream']
    b = round(g['bob'])
    ph = g['phase']
    lf = g['lift'] * 0.7

    def lift(p: float) -> float:
        return lf * max(0.0, math.cos(p)) if anim != 'idle' and not (anim == 'walk' and f == 0) else 0.0

    dark_tan = [mix(c, rgb('#000000'), 0.3) for c in tan]
    l_up, r_up = lift(ph), lift(ph + math.pi)
    # patas da frente (aparecem dos lados, escuras)
    for cx, up in ((25, r_up), (39, l_up)):
        _limb(cv, [(cx, 44 + b), (cx, 52), (cx, BASE - up * 0.6)], [3, 3], dark_tan)
    # tronco e ancas
    body = _union(_ell(32, 41 + b, 9, 7), _mask([(24, 34 + b), (40, 34 + b), (42, 46 + b), (22, 46 + b)]))
    _fill(cv, body, tan, SEED, 0.55, 2.6)
    _fill(cv, ImageChops.multiply(_mask([(24, 32 + b), (40, 32 + b), (39, 42 + b), (25, 42 + b)]), body), black, SEED + 2, 0.45, 2.1)   # sela
    # patas de trás
    for cx, up in ((27, l_up), (37, r_up)):
        _limb(cv, [(cx, 45 + b), (cx + (-1 if cx < 32 else 1), 52), (cx, BASE - up)], [5, 3], tan, cream[2])
    # rabo no meio, caído, balançando
    wag = round(g['wag'])
    up = round(g['tail_up'])
    tail = _mask([(31, 40 + b), (34, 40 + b), (35 + wag, 48 + b - up), (35 + wag, 55 + b - up * 2), (32 + wag, 56 + b - up * 2), (30 + wag, 49 + b - up)])
    _fill(cv, tail, black, SEED + 3, 0.35, 2.0)
    _fill(cv, ImageChops.multiply(_mask([(32, 52 + b - up), (35 + wag, 52 + b - up), (35 + wag, 56 + b - up * 2), (32 + wag, 56 + b - up * 2)]), tail), tan, SEED + 4, 0.4)
    # cabeça de costas: crânio, orelhas e a nuca
    hd = round(g['head'])
    hy = 28 + hd + b
    ear_l = _mask([(26, hy - 4), (27, hy - 13), (32, hy - 5)])
    ear_r = _mask([(32, hy - 5), (37, hy - 13), (38, hy - 4)])
    _fill(cv, ear_l, black, SEED + 8, 0.45); _fill(cv, ear_r, black, SEED + 8, 0.45)
    skull = _union(_ell(32, hy, 6, 5), _mask([(26, hy - 2), (38, hy - 2), (37, hy + 5), (27, hy + 5)]))
    _fill(cv, skull, black, SEED + 9, 0.45, 2.2)
    nape = _mask([(28, hy + 3), (36, hy + 3), (37, hy + 8), (27, hy + 8)])
    _fill(cv, nape, tan, SEED + 10, 0.5, 2.2)
    return cv


def frame(coat_name: str, anim: str, row: int, f: int) -> Image.Image:
    coat = COATS[coat_name]
    if row == 2:
        cv = _front(coat, anim, f)
    elif row == 0:
        cv = _back(coat, anim, f)
    else:
        cv = _side(coat, anim, f)
        if row == 3:
            cv = cv.flipped()
    cv.outline(OUT)
    # sombra no chão
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    wide = 24 if row in (1, 3) else 17
    ImageDraw.Draw(sh).ellipse([32 - wide // 2 - (1 if row in (1, 3) else 0), BASE - 1, 32 + wide // 2 - (1 if row in (1, 3) else 0), BASE + 3], fill=(0, 0, 0, 70))
    sh.alpha_composite(cv.im)
    return sh


def sheet(coat_name: str, anim: str) -> Image.Image:
    n = ANIMS[anim]
    out = Image.new('RGBA', (n * 64, 256), (0, 0, 0, 0))
    for row in range(4):
        for f in range(n):
            out.alpha_composite(frame(coat_name, anim, row, f), (f * 64, row * 64))
    return out


COAT_NAMES = {'classico': 'Pastor alemão clássico', 'preto': 'Pastor alemão preto', 'sable': 'Pastor alemão sable', 'branco': 'Pastor alemão branco'}


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    """Folhas do cachorro (`tlou/dogs/pastor/<anim>/<pelagem>.png`), a cabeça vazia e o catálogo."""
    base_rel = 'tlou/dogs/pastor/'
    for anim in ANIMS:
        d = os.path.join(assets, SHEETS, base_rel, anim)
        os.makedirs(d, exist_ok=True)
        for coat in COATS:
            sheet(coat, anim).save(os.path.join(d, f'{coat}.png'), optimize=True)
    # cabeça vazia (a "cabeça" do cachorro já vem no corpo)
    blank_rel = 'tlou/head/nenhuma/'
    bd = os.path.join(assets, SHEETS, blank_rel)
    os.makedirs(bd, exist_ok=True)
    for anim, n in ANIMS.items():
        Image.new('RGBA', (n * 64, 256), (0, 0, 0, 0)).save(os.path.join(bd, f'{anim}.png'), optimize=True)
    items = [
        {'id': 'tlou/body/cachorro', 'slot': 'body', 'name': 'Cachorro (pastor alemão)', 'layers': [{'z': 10, 'paths': {b: base_rel for b in BODIES}}],
         'bodies': list(BODIES), 'anims': list(ANIMS), 'variants': list(COATS)},
        {'id': 'tlou/head/nenhuma', 'slot': 'head', 'name': 'Sem cabeça (cachorros)', 'layers': [{'z': 100, 'paths': {b: blank_rel for b in BODIES}}],
         'bodies': list(BODIES), 'anims': list(ANIMS)},
    ]
    return [], items


def preview(assets: str, out: str) -> None:
    """Folha de contato: cada pelagem, cada animação, as 4 direções, ampliada 3x."""
    cols = 9
    gap = 4
    names = list(COATS)
    h = 0
    sections = []
    for coat in names:
        for anim in ('walk', 'run', 'idle'):
            sections.append((coat, anim))
    W = cols * 64 + (cols - 1) * 2
    sheet_im = Image.new('RGBA', (W, len(sections) * (256 + gap)), (58, 52, 46, 255))
    for i, (coat, anim) in enumerate(sections):
        sheet_im.alpha_composite(sheet(coat, anim), (0, i * (256 + gap)))
    sheet_im = sheet_im.resize((sheet_im.width * 2, sheet_im.height * 2), Image.NEAREST)
    sheet_im.save(out)
