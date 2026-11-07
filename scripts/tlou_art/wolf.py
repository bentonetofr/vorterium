"""Lobo gigante do Vortable: um "corpo" completo, desenhado por código, pra ser uma criatura grande (2,5 m).

O lobo (do desenho do usuário): pelo branco muito farto e arrepiado, mancha cinza em volta de um olho e no focinho, olhos de gelo
(azul claro), uma cicatriz rosa riscando o outro olho, rabo cinza peludo e um amuleto redondo preso num cordão marrom no peito.
O desenho ocupa o quadro de 64x64 (pés na linha 61), com a cabeça na altura de uma pessoa; o motor amplia (aparência.height = 1.5,
a maior altura de gigante que o motor aceita perto de 2,5 m), então ele fica bem maior que as pessoas. Mesmo esquema do cachorro: linhas 0 = de costas, 1 = olhando pra esquerda, 2 = de frente,
3 = olhando pra direita; colunas = quadros (caminhar 9, correr 8, parado 2). Usa a cabeça vazia `tlou/head/nenhuma`.
Variantes de pelo: ártico (o do desenho), cinzento e negro.
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageChops, ImageDraw

from .dog import ANIMS, BASE, BODIES, SHEETS, _ell, _fill, _gait, _mask, _union
from .px import Cv, RGBA, mix, ramp, rgb

SEED = 913
LOBO_ESCALA = 1.5             # aparência.height do lobo (de cabeça erguida passa de 2,5 m: bem maior que uma pessoa)

# ── Pelagens ──────────────────────────────────────────────
#   fur = o pelo principal; mask = a mancha do olho/focinho, o rabo e as pontas; ear = o rosa de dentro da orelha.
COATS: dict[str, dict] = {
    'artico': {
        'fur': ramp('#7d8892', '#a8b1b9', '#cdd3d8', '#e6e9ec', '#f6f7f8'),
        'mask': ramp('#3b4147', '#5c636a', '#7d848b', '#9da3a9', '#babfc3'),
        'ear': rgb('#e9a3a6'),
    },
    'cinzento': {
        'fur': ramp('#4a4f55', '#6d747a', '#8f969b', '#aeb4b8', '#cbd0d3'),
        'mask': ramp('#24282c', '#383d42', '#4f555a', '#686f74', '#82898e'),
        'ear': rgb('#b97f84'),
    },
    'negro': {
        'fur': ramp('#101114', '#1b1d21', '#2a2d32', '#3b3f45', '#51565d'),
        'mask': ramp('#08080a', '#101114', '#1a1c20', '#272a2f', '#383c42'),
        'ear': rgb('#6e3f46'),
    },
}
NOSE = rgb('#0b0b0d')
EYE = rgb('#8ee0f7')
EYE_D = rgb('#2f86b0')
EYE_PUPIL = rgb('#e9fbff')
SCAR = rgb('#e8828c')
SCAR_D = rgb('#c25f6c')
CLAW = rgb('#16161a')
CORD = rgb('#6c5441')
CORD_D = rgb('#4a382a')
PEND = ramp('#161d14', '#26331f', '#3b4d2f')
PEND_RING = rgb('#4d5a3e')
TONGUE = rgb('#d4687c')
OUT = rgb('#10131a')


# ── Ajudantes ─────────────────────────────────────────────

def _dark(rp: list[RGBA], t: float = 0.28) -> list[RGBA]:
    return [mix(c, rgb('#000000'), t) for c in rp]


def _spiky(pts: list[tuple[float, float]], amp: float = 1.6, seed: int = 0) -> list[tuple[float, float]]:
    """Borda de pelo arrepiado: põe uma ponta pra fora entre cada par de pontos."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    out: list[tuple[float, float]] = []
    for i, (x0, y0) in enumerate(pts):
        x1, y1 = pts[(i + 1) % len(pts)]
        out.append((x0, y0))
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 3.2))
        for k in range(1, n + 1):
            t = (k - 0.5) / n
            mx, my = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            dx, dy = mx - cx, my - cy
            d = math.hypot(dx, dy) or 1
            a = amp * (0.55 + 0.9 * (((i * 7 + k * 13 + seed) * 2654435761) % 97) / 97)
            out.append((mx + dx / d * a, my + dy / d * a))
    return out


def _fur_lines(cv: Cv, mask: Image.Image, rp: list[RGBA], seed: int, n: int, vertical: bool = True) -> None:
    """Riscos de pelo (um tom abaixo) dentro da peça, pra dar a cara de pelagem farta."""
    m = mask.load()
    for i in range(n):
        h1 = ((i * 2654435761 + seed * 97) >> 5) % 4096 / 4096
        h2 = ((i * 40503 + seed * 131) >> 3) % 4096 / 4096
        bb = mask.getbbox()
        if not bb:
            return
        x = int(bb[0] + h1 * (bb[2] - bb[0]))
        y = int(bb[1] + h2 * (bb[3] - bb[1]))
        ln = 2 + (i % 3)
        for k in range(ln):
            xx, yy = (x, y + k) if vertical else (x + k, y)
            if 0 <= xx < 64 and 0 <= yy < 64 and m[xx, yy] > 128:
                cv.px(xx, yy, rp[1] if k else rp[2])


def _paw(cv: Cv, x: float, y: float, rp: list[RGBA], w: int = 5) -> None:
    """Pata de baixo: palma redonda e três garras pretas."""
    d = ImageDraw.Draw(cv.im)
    d.ellipse([round(x) - w // 2, round(y) - 2, round(x) + w // 2, round(y) + 1], fill=rp[3])
    d.point([round(x) - 1, round(y) - 2], fill=rp[4])
    for dx in (-1, 0, 1):
        cv.px(round(x) + dx * (w // 3 + 0), round(y) + 2, CLAW)


def _leg(cv: Cv, pts: list[tuple[float, float]], widths: list[int], rp: list[RGBA], claws: bool = True) -> None:
    d = ImageDraw.Draw(cv.im)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        w = widths[i]
        d.line([round(x0), round(y0), round(x1), round(y1)], fill=rp[3], width=w)
        d.line([round(x0) + w // 2, round(y0), round(x1) + w // 2, round(y1)], fill=rp[1], width=1)
        d.line([round(x0) - w // 2 + 1, round(y0), round(x1) - w // 2 + 1, round(y1)], fill=rp[4], width=1)
    px, py = pts[-1]
    if claws:
        _paw(cv, px, py - 1, rp, widths[-1] + 2)


def _pendant(cv: Cv, x: int, y: int) -> None:
    """O amuleto: anel verde-escuro com uma flor de pétalas pretas."""
    cv.rect(x - 1, y - 1, 4, 4, PEND_RING)
    cv.rect(x, y, 2, 2, PEND[0])
    cv.px(x, y - 1, PEND[2]); cv.px(x + 1, y + 2, PEND[2])
    cv.px(x - 1, y, PEND[1]); cv.px(x + 2, y + 1, PEND[1])
    cv.px(x, y - 2, CORD_D)


def _eye(cv: Cv, x: int, y: int, glint: bool = True) -> None:
    cv.px(x, y, EYE); cv.px(x + 1, y, EYE)
    cv.px(x, y + 1, EYE_D); cv.px(x + 1, y + 1, EYE_D)
    if glint:
        cv.px(x, y, EYE_PUPIL)


# ── De lado (olhando pra esquerda: vê o lado da cicatriz) ───────

def _side(coat: dict, anim: str, f: int) -> Cv:
    cv = Cv(64, 64)
    g = _gait(anim, f)
    fur, mask = coat['fur'], coat['mask']
    b = round(g['bob'])
    ph = g['phase']
    sw, lf = g['swing'] * 1.1, g['lift'] * 1.1
    st = round(g['stretch'] * 2)

    def foot(phase: float) -> tuple[float, float]:
        fwd = sw * math.sin(phase)
        up = lf * max(0.0, math.cos(phase)) if anim != 'idle' and not (anim == 'walk' and f == 0) else 0.0
        return -fwd, up

    fl = foot(ph); fr = foot(ph + math.pi); hr = foot(ph); hl = foot(ph + math.pi)
    fx0, hx0 = 23 - st, 42 + st // 2

    def front(cx: float, dx: float, up: float, shade: list[RGBA]) -> None:
        paw = (cx + dx, BASE - up)
        elbow = (cx + dx * 0.45 - 1, 52 - up * 0.5 + b * 0.3)
        _leg(cv, [(cx, 42 + b), elbow, paw], [6, 4], shade)

    def hind(cx: float, dx: float, up: float, shade: list[RGBA]) -> None:
        paw = (cx + dx, BASE - up)
        knee = (cx - 4 + dx * 0.2, 50 + b * 0.4)
        hock = (cx + 3 + dx * 0.6, 55 - up * 0.6)
        _leg(cv, [(cx, 40 + b), knee, hock, paw], [7, 4, 4], shade)

    far = _dark(fur, 0.3)
    front(fx0 + 4, fr[0], fr[1], far)
    hind(hx0 - 3, hl[0], hl[1], far)

    # rabo grosso e cinza, cai atrás do corpo; balança e sobe na corrida
    wag, up = g['wag'], g['tail_up']
    tail = [(44 + st, 33 + b), (49 + st, 33 + b - up * 0.4), (54 + st + wag * 0.3, 38 + b - up), (57 + st + wag, 46 + b - up * 1.3), (56 + st + wag, 54 + b - up),
            (52 + st + wag * 0.5, 57 + b - up * 0.6), (49 + st, 51 + b), (47 + st, 43 + b)]
    tm = _mask(_spiky(tail, 1.5, 3))
    _fill(cv, tm, mask, SEED + 3, 0.5, 2.2, 0.14)
    _fur_lines(cv, tm, mask, 3, 22)

    # tronco farto de pelo, com a garupa
    torso = [(17, 35 + b), (22, 30 + b), (30, 30 + b), (38, 31 + b), (44 + st, 33 + b), (47 + st, 40 + b), (46 + st, 47 + b), (38, 49 + b), (28, 49 + b), (20, 48 + b), (16, 42 + b)]
    tm2 = _mask(_spiky(torso, 1.4, 5))
    _fill(cv, tm2, fur, SEED, 0.6, 2.8, 0.12)
    belly = _mask([(18, 45 + b), (28, 48 + b), (38, 48 + b), (45 + st, 46 + b), (46 + st, 50 + b), (36, 52 + b), (22, 52 + b)])
    _fill(cv, ImageChops.multiply(belly, ImageChops.lighter(tm2, belly)), _dark(fur, 0.18), SEED + 1, 0.4, 2.4, 0.1)
    _fur_lines(cv, tm2, fur, 7, 46)
    # sombra do ombro
    cv.line(25, 38 + b, 27, 46 + b, fur[1])
    cv.line(40 + st, 36 + b, 42 + st, 44 + b, fur[1])

    # pescoço e peitoral (cachecol de pelo caindo na frente)
    hd = round(g['head'])
    hx, hy = 12 - st // 2, 26 + hd + b
    neck = [(20, 33 + b), (22, 27 + hd + b), (17, 22 + hd + b), (11, 25 + hd + b), (9, 33 + b), (10, 41 + b), (14, 50 + b), (20, 47 + b), (22, 40 + b)]
    nm = _mask(_spiky(neck, 1.8, 9))
    _fill(cv, nm, fur, SEED + 5, 0.65, 2.6, 0.12)
    _fur_lines(cv, nm, fur, 11, 30)
    # cordão e amuleto no peito
    cv.line(17, 28 + hd + b, 15, 38 + b, CORD)
    cv.line(15, 38 + b, 16, 44 + b, CORD)
    _pendant(cv, 15, 45 + b)

    # orelha de trás, cabeça, focinho
    far_ear = _mask([(hx + 5, hy - 3), (hx + 7, hy - 11), (hx + 10, hy - 3)])
    _fill(cv, far_ear, _dark(fur, 0.3), SEED + 8, 0.4)
    skull = _union(_ell(hx + 2, hy, 6, 5), _mask([(hx - 3, hy - 3), (hx + 6, hy - 5), (hx + 8, hy + 4), (hx - 2, hy + 5)]))
    muzzle = _mask([(hx - 2, hy - 2), (hx - 9, hy), (hx - 11, hy + 3), (hx - 8, hy + 6), (hx - 1, hy + 6)])
    _fill(cv, _union(skull, muzzle), fur, SEED + 9, 0.65, 2.2, 0.1)
    # mancha cinza no focinho (de cima)
    _fill(cv, ImageChops.multiply(_mask([(hx - 3, hy - 2), (hx - 11, hy), (hx - 11, hy + 2), (hx - 3, hy + 1)]), muzzle), mask, SEED + 11, 0.5, 2.0)
    near = _mask([(hx - 1, hy - 3), (hx + 1, hy - 13), (hx + 7, hy - 3)])
    _fill(cv, near, fur, SEED + 13, 0.65)
    cv.px(hx + 1, hy - 7, coat['ear']); cv.px(hx + 2, hy - 8, coat['ear']); cv.px(hx + 2, hy - 6, coat['ear']); cv.px(hx + 3, hy - 6, coat['ear'])
    # pelo da bochecha (pontas pra trás)
    for k in range(3):
        cv.px(hx + 7 + k, hy + 2 + k, fur[3]); cv.px(hx + 6 + k, hy + 3 + k, fur[2])
    _eye(cv, hx - 3, hy - 1)
    cv.px(hx - 3, hy - 3, fur[1]); cv.px(hx - 4, hy - 3, fur[1])                       # sobrancelha brava
    # cicatriz rosa riscando o olho
    for i in range(8):
        cv.px(hx - 1 - i // 3, hy - 6 + i, SCAR)
        if i % 2 == 0:
            cv.px(hx - i // 3, hy - 6 + i, SCAR_D)
    cv.px(hx - 11, hy + 2, NOSE); cv.px(hx - 11, hy + 3, NOSE); cv.px(hx - 10, hy + 2, NOSE); cv.px(hx - 10, hy + 3, NOSE)
    cv.px(hx - 6, hy + 5, rgb('#2a1c1c'))                                                # boca
    if anim == 'run' or (anim == 'idle' and f == 1):
        cv.rect(hx - 8, hy + 6, 3, 2, TONGUE)

    # patas do lado de cá
    front(fx0, fl[0], fl[1], fur)
    hind(hx0, hr[0], hr[1], fur)
    return cv


# ── De frente (como no desenho) ───────────────────────────

def _front(coat: dict, anim: str, f: int) -> Cv:
    cv = Cv(64, 64)
    g = _gait(anim, f)
    fur, mask = coat['fur'], coat['mask']
    b = round(g['bob'])
    ph = g['phase']
    lf = g['lift'] * 0.8
    run = anim == 'run'

    def lift(p: float) -> float:
        return lf * max(0.0, math.cos(p)) if anim != 'idle' and not (anim == 'walk' and f == 0) else 0.0

    l_up, r_up = lift(ph), lift(ph + math.pi)
    far = _dark(fur, 0.3)
    wag = round(g['wag'])
    # rabo cinza peludo, saindo pelo lado esquerdo atrás das patas
    tail = [(18, 46 + b), (14, 49 + b), (11, 55 + b), (13, 60), (19, 60), (23, 56), (23, 49 + b)]
    tm = _mask(_spiky([(x + (wag if y > 52 else 0) * -0.6, y) for x, y in tail], 1.5, 4))
    _fill(cv, tm, mask, SEED + 3, 0.5, 2.2, 0.14)
    _fur_lines(cv, tm, mask, 3, 18)
    # ancas por trás das patas da frente
    for cx in (20, 44):
        h = _mask(_spiky([(cx - 6, 44 + b), (cx + 6, 44 + b), (cx + 7, 55), (cx - 7, 55)], 1.5, cx))
        _fill(cv, h, far, SEED + 6, 0.5, 2.4, 0.12)
        _paw(cv, cx, BASE - 1 - (r_up if cx < 32 else l_up) * 0.6, far, 6)
    # tronco e peito farto (cachecol de pelo)
    body = _union(_ell(32, 41 + b, 11, 9), _mask([(22, 34 + b), (42, 34 + b), (44, 48 + b), (20, 48 + b)]))
    _fill(cv, body, fur, SEED, 0.6, 2.8, 0.12)
    # patas da frente
    for cx, up in ((27, l_up), (37, r_up)):
        _leg(cv, [(cx, 46 + b), (cx, 53 - up * 0.4), (cx, BASE - 1 - up)], [7, 5], fur)
        for k in range(3):
            cv.px(cx - 2 + k * 2, 55 - round(up * 0.4), fur[1])
    chest_pts = [(21, 33 + b), (43, 33 + b), (45, 40 + b), (41, 49 + b), (37, 53 + b), (32, 51 + b), (27, 53 + b), (23, 49 + b), (19, 40 + b)]
    chest = _mask(_spiky(chest_pts, 2.0, 8))
    _fill(cv, chest, fur, SEED + 5, 0.68, 2.6, 0.12)
    _fur_lines(cv, chest, fur, 13, 70)
    for k in range(5):                                                      # pontas do pelo no peito (V)
        cv.px(30 + k, 50 + b + abs(k - 2), fur[0] if k % 2 else fur[1])
    # cordão e amuleto
    cv.line(24, 33 + b, 31, 44 + b, CORD); cv.line(40, 33 + b, 33, 44 + b, CORD)
    cv.line(25, 33 + b, 31, 43 + b, CORD_D); cv.line(39, 33 + b, 33, 43 + b, CORD_D)
    _pendant(cv, 31, 45 + b)
    # cabeça
    hd = round(g['head'])
    hy = 25 + hd + b
    ear_l = _mask([(24, hy - 2), (24, hy - 14), (31, hy - 5)])
    ear_r = _mask([(33, hy - 5), (40, hy - 14), (40, hy - 2)])
    _fill(cv, ear_l, fur, SEED + 8, 0.65); _fill(cv, ear_r, fur, SEED + 8, 0.65)
    for x, y in ((26, hy - 6), (26, hy - 8), (27, hy - 5), (38, hy - 6), (38, hy - 8), (37, hy - 5), (26, hy - 10), (38, hy - 10)):
        cv.px(x, y, coat['ear'])
    skull = _union(_ell(32, hy, 9, 7), _mask([(23, hy - 3), (41, hy - 3), (40, hy + 5), (24, hy + 5)]))
    ruff = _mask(_spiky([(21, hy), (43, hy), (45, hy + 6), (39, hy + 10), (25, hy + 10), (19, hy + 6)], 2.0, 12))
    _fill(cv, ruff, fur, SEED + 7, 0.65, 2.4, 0.12)
    _fill(cv, skull, fur, SEED + 9, 0.7, 2.2, 0.1)
    # mancha cinza do lado esquerdo de quem olha (em volta do olho e descendo pro focinho)
    patch = _mask([(25, hy - 3), (31, hy - 4), (31, hy + 1), (32, hy + 6), (28, hy + 7), (25, hy + 3)])
    _fill(cv, ImageChops.multiply(patch, skull), mask, SEED + 11, 0.5, 2.0)
    cv.rect(26, hy + 1, 3, 2, fur[3]); cv.px(27, hy + 1, fur[4])        # a "lágrima" clara dentro da mancha
    # focinho
    muzzle = _mask([(28, hy + 1), (36, hy + 1), (35, hy + 7), (29, hy + 7)])
    _fill(cv, muzzle, fur, SEED + 10, 0.7, 2.0)
    _fill(cv, ImageChops.multiply(_mask([(28, hy + 1), (32, hy + 1), (32, hy + 7), (29, hy + 7)]), muzzle), mask, SEED + 12, 0.5, 2.0)
    # olhos de gelo, sobrancelhas bravas
    _eye(cv, 27, hy - 1); _eye(cv, 35, hy - 1)
    cv.line(26, hy - 3, 30, hy - 2, fur[0]); cv.line(34, hy - 2, 38, hy - 3, fur[0])
    # cicatriz rosa do lado direito de quem olha (cruzando o olho) e arranhões no focinho
    for i in range(10):
        cv.px(38 - i // 3, hy - 6 + i, SCAR)
        cv.px(39 - i // 3, hy - 6 + i, SCAR_D if i % 2 else SCAR)
    cv.px(34, hy + 3, SCAR); cv.px(35, hy + 4, SCAR_D); cv.px(36, hy + 3, SCAR)
    # nariz e boca
    cv.rect(30, hy + 3, 4, 3, NOSE); cv.px(31, hy + 3, rgb('#3a3a40'))
    cv.px(32, hy + 7, rgb('#2a1c1c')); cv.px(31, hy + 8, rgb('#2a1c1c')); cv.px(33, hy + 8, rgb('#2a1c1c'))
    if run or (anim == 'idle' and f == 1):
        cv.rect(31, hy + 8, 3, 3, TONGUE)
    return cv


# ── De costas ─────────────────────────────────────────────

def _back(coat: dict, anim: str, f: int) -> Cv:
    cv = Cv(64, 64)
    g = _gait(anim, f)
    fur, mask = coat['fur'], coat['mask']
    b = round(g['bob'])
    ph = g['phase']
    lf = g['lift'] * 0.8

    def lift(p: float) -> float:
        return lf * max(0.0, math.cos(p)) if anim != 'idle' and not (anim == 'walk' and f == 0) else 0.0

    l_up, r_up = lift(ph), lift(ph + math.pi)
    far = _dark(fur, 0.3)
    for cx, up in ((25, r_up), (39, l_up)):
        _leg(cv, [(cx, 44 + b), (cx, 53), (cx, BASE - 1 - up * 0.6)], [5, 4], far)
    body = _union(_ell(32, 41 + b, 11, 9), _mask([(22, 33 + b), (42, 33 + b), (44, 48 + b), (20, 48 + b)]))
    bm = _mask(_spiky([(21, 33 + b), (43, 33 + b), (46, 42 + b), (44, 50 + b), (20, 50 + b), (18, 42 + b)], 1.8, 3))
    _fill(cv, ImageChops.lighter(body, bm), fur, SEED, 0.6, 2.8, 0.12)
    _fur_lines(cv, bm, fur, 5, 60)
    for cx, up in ((26, l_up), (38, r_up)):
        _leg(cv, [(cx, 47 + b), (cx + (-1 if cx < 32 else 1), 54), (cx, BASE - 1 - up)], [7, 5], fur)
    # rabo grosso e cinza no meio, caído
    wag = round(g['wag'])
    up = round(g['tail_up'])
    tail = [(28, 40 + b), (36, 40 + b), (39 + wag, 48 + b - up), (38 + wag, 57 + b - up * 2), (32 + wag, 60 + b - up * 2), (26 + wag, 57 + b - up * 2), (25 + wag, 48 + b - up)]
    tm = _mask(_spiky(tail, 1.5, 6))
    _fill(cv, tm, mask, SEED + 3, 0.5, 2.2, 0.14)
    _fur_lines(cv, tm, mask, 3, 24)
    # cabeça de costas: orelhas, crânio e a juba da nuca
    hd = round(g['head'])
    hy = 27 + hd + b
    ear_l = _mask([(24, hy - 2), (24, hy - 14), (31, hy - 5)])
    ear_r = _mask([(33, hy - 5), (40, hy - 14), (40, hy - 2)])
    _fill(cv, ear_l, fur, SEED + 8, 0.65); _fill(cv, ear_r, fur, SEED + 8, 0.65)
    skull = _union(_ell(32, hy, 8, 7), _mask([(24, hy - 3), (40, hy - 3), (39, hy + 6), (25, hy + 6)]))
    _fill(cv, skull, fur, SEED + 9, 0.7, 2.2, 0.1)
    nape = _mask(_spiky([(23, hy + 2), (41, hy + 2), (44, hy + 9), (32, hy + 12), (20, hy + 9)], 1.8, 14))
    _fill(cv, nape, fur, SEED + 10, 0.65, 2.4, 0.12)
    _fur_lines(cv, nape, fur, 17, 26)
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
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    wide = 30 if row in (1, 3) else 26
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


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    """Folhas do lobo (`tlou/dogs/lobo/<anim>/<pelagem>.png`) e o item do catálogo (a cabeça vazia já vem do cachorro)."""
    base_rel = 'tlou/dogs/lobo/'
    for anim in ANIMS:
        d = os.path.join(assets, SHEETS, base_rel, anim)
        os.makedirs(d, exist_ok=True)
        for coat in COATS:
            sheet(coat, anim).save(os.path.join(d, f'{coat}.png'), optimize=True)
    items = [
        {'id': 'tlou/body/lobo', 'slot': 'body', 'name': 'Lobo gigante', 'layers': [{'z': 10, 'paths': {b: base_rel for b in BODIES}}],
         'bodies': list(BODIES), 'anims': list(ANIMS), 'variants': list(COATS)},
    ]
    return [], items


def preview(assets: str, out: str, scale: int = 4) -> None:
    """Folha de contato: a primeira pelagem em andar (4 direções, 3 quadros) e as outras de frente e de lado."""
    frames = (0, 3, 6)
    names = list(COATS)
    full = sheet(names[0], 'walk')
    big = Image.new('RGBA', (len(frames) * 64 + 10 + 3 * 64, 4 * 64 + 6), (62, 56, 48, 255))
    for row in range(4):
        for k, fr in enumerate(frames):
            big.alpha_composite(full.crop((fr * 64, row * 64, fr * 64 + 64, row * 64 + 64)), (k * 64, row * 64))
    x0 = len(frames) * 64 + 10
    for i, n in enumerate(names):
        big.alpha_composite(sheet(n, 'walk').crop((0, 2 * 64, 64, 3 * 64)), (x0 + i * 64, 0))
        big.alpha_composite(sheet(n, 'walk').crop((64, 64, 128, 128)), (x0 + i * 64, 70))
    big = big.resize((big.width * scale // 2, big.height * scale // 2), Image.NEAREST)
    big.save(out)
