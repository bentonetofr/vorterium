"""Arte do campo de batalha (pacote 'batalha'): espadas cravadas e caídas, soldados tombados, escudos, elmos, mancha de sangue.
Tudo desenhado por código, no estilo do resto do catálogo (visão 3/4, luz de cima à esquerda, contorno de 1 px)."""
from __future__ import annotations

import math

from tlou_art.palettes import BLOOD, CAR_BLUE, CAR_RED, WOOD
from tlou_art.px import OUTLINE, Cv, fbm, ramp, rng

PACK_ID = 'batalha'
CAT = 'Campo de batalha'
TAGS = ['batalha', 'guerra']

SKIN = ramp('#4a2f24', '#6b4332', '#8f5d46', '#b57f60', '#d3a07e')
SKIN_PALE = ramp('#5a4a42', '#7b675b', '#9b867a', '#bba99a', '#d6c8b8')
PANTS = ramp('#241d17', '#382d23', '#4f4034', '#6a5646', '#85705d')
PANTS_GREY = ramp('#1f2124', '#30343a', '#454b53', '#5d646d', '#78808a')
STEEL = ramp('#232a31', '#3a4650', '#566673', '#788b9a', '#a3b5c2')
STEEL_DARK = ramp('#15191d', '#242c33', '#37424b', '#4d5b66', '#667682')
HAIR = ramp('#17110c', '#2a1d14', '#43301f', '#5f4429', '#7f5a35')
HAIR_PALE = ramp('#3c3225', '#5b4c38', '#7d6a4f', '#a08b68', '#c3ae86')
BLADE = ramp('#3a4249', '#5b6770', '#8b99a3', '#b9c5cd', '#e4ecf0')
GOLD = ramp('#3d2c0e', '#6a4d14', '#97721e', '#c49a2e', '#e8c457')
CLOTH_RED = CAR_RED
CLOTH_BLUE = CAR_BLUE
DIRT = ramp('#2c2014', '#44311d', '#5f4528', '#7d5d38', '#9c7a4d')


def _sword_parts(cv: Cv, x0: int, y0: int, x1: int, y1: int, blade_w: int = 3, guard: int = 11) -> None:
    """Espada do punho (x0,y0) à ponta (x1,y1): lâmina, guarda e pomo."""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    px, py = -uy, ux
    gx, gy = x0 + ux * 6, y0 + uy * 6
    pts = [(gx + px * blade_w / 2, gy + py * blade_w / 2), (gx - px * blade_w / 2, gy - py * blade_w / 2),
           (x1 - px * 0.6, y1 - py * 0.6), (x1 + px * 0.6, y1 + py * 0.6)]
    cv.poly([(round(a), round(b)) for a, b in pts], BLADE[2])
    cv.line(round(gx + px * (blade_w / 2 - 0.4)), round(gy + py * (blade_w / 2 - 0.4)), round(x1), round(y1), BLADE[4])
    cv.line(round(gx), round(gy), round(x1 - ux * 2), round(y1 - uy * 2), BLADE[1])
    cv.line(round(x0 + ux * 1.5), round(y0 + uy * 1.5), round(gx), round(gy), WOOD[2], 2)
    cv.line(round(gx + px * guard / 2), round(gy + py * guard / 2), round(gx - px * guard / 2), round(gy - py * guard / 2), GOLD[3], 2)
    cv.px(round(gx + px * guard / 2), round(gy + py * guard / 2), GOLD[4])
    cv.ell(round(x0) - 1, round(y0) - 1, 3, 3, GOLD[3])
    cv.px(round(x0), round(y0), GOLD[4])


def sword_stuck(tilt: int = 0) -> Cv:
    """Espada cravada na terra, lâmina pra cima (o punho fica `tilt` px por tile de altura pro lado)."""
    cv = Cv(24, 44)
    cv.ell(6, 36, 13, 6, DIRT[2]); cv.ell(7, 36, 8, 3, DIRT[3]); cv.ell(10, 38, 8, 3, DIRT[1])
    tmp = Cv(24, 44)
    _sword_parts(tmp, 12 + tilt * 3, 3, 12 + tilt, 38, 3, 11)
    tmp.outline()
    cv.paste(tmp, 0, 0)
    cv.ell(6, 38, 13, 4, DIRT[2]); cv.ell(8, 38, 7, 2, DIRT[3])
    for x, y in ((8, 40), (16, 39), (11, 41)):
        cv.px(x, y, DIRT[1])
    return cv.finish(shadow=(12, 41, 16, 4), outline=False)


def sword_lying(angle: float = 0.0, broken: bool = False) -> Cv:
    """Espada caída no chão (vista de cima), `angle` em graus."""
    cv = Cv(38, 22)
    c = (19, 11)
    length = 15 if not broken else 9
    a = math.radians(angle)
    x0, y0 = c[0] - math.cos(a) * 15, c[1] - math.sin(a) * 6
    x1, y1 = c[0] + math.cos(a) * length, c[1] + math.sin(a) * length * 0.4
    tmp = Cv(38, 22)
    _sword_parts(tmp, round(x0), round(y0), round(x1), round(y1), 3, 9)
    if broken:
        tmp.px(round(x1), round(y1), (0, 0, 0, 0)); tmp.px(round(x1 - 1), round(y1 + 1), (0, 0, 0, 0))
    tmp.outline()
    cv.paste(tmp, 0, 0)
    return cv.finish(shadow=(19, 16, 30, 5), outline=False)


def shield_lying(cloth: list, seed: int = 1, broken: bool = False) -> Cv:
    cv = Cv(26, 22)
    cv.tex_ell(2, 2, 22, 16, WOOD, seed, 2.0, 0.5)
    cv.tex_ell(4, 4, 18, 12, cloth, seed + 3, 2.0, 0.5)
    cv.line(13, 4, 13, 15, WOOD[1])
    cv.line(4, 10, 21, 10, WOOD[1])
    cv.ell(10, 7, 6, 5, STEEL[3]); cv.ell(11, 8, 3, 2, STEEL[4])
    if broken:
        cv.poly([(15, 2), (24, 6), (19, 11), (22, 17), (15, 17)], (0, 0, 0, 0))
        cv.line(15, 3, 19, 11, WOOD[0]); cv.line(19, 11, 15, 17, WOOD[0])
    return cv.finish(shadow=(13, 17, 22, 5))


def helmet_lying(seed: int = 1) -> Cv:
    cv = Cv(20, 18)
    cv.tex_ell(2, 3, 16, 12, STEEL, seed, 2.0, 0.6)
    cv.rect(2, 9, 16, 2, STEEL_DARK[1])
    cv.line(10, 3, 10, 10, STEEL[4])
    cv.ell(7, 10, 6, 4, STEEL_DARK[0])
    cv.px(5, 6, STEEL[4]); cv.px(6, 5, STEEL[4])
    return cv.finish(shadow=(10, 15, 16, 4))


def blood_stain(w: int, h: int, seed: int = 1) -> Cv:
    """Mancha de sangue seco no chão (irregular, translúcida)."""
    cv = Cv(w, h)
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(w):
            nx, ny = (x - cx) / (w / 2), (y - cy) / (h / 2)
            d = math.hypot(nx, ny) + (fbm(x / 3.0, y / 3.0, seed, 3) - 0.5) * 0.9
            if d < 1.0:
                t = max(0.0, 1.0 - d)
                col = BLOOD[1] if t > 0.55 else BLOOD[2] if t > 0.25 else BLOOD[3]
                cv.px(x, y, col[:3] + (int(120 + 90 * t),))
    return cv


def soldier(cloth: list, pose: int, face_up: bool, seed: int = 1) -> Cv:
    """Soldado tombado, de comprido na horizontal (cabeça à esquerda). `pose` varia braços e pernas (0..2)."""
    W, H = 52, 28
    cv = Cv(W, H)
    r = rng(seed)
    cv.paste(blood_stain(34, 22, seed + 40), 8 + pose * 2, 4)
    body = Cv(W, H)
    ly0, ly1 = [(16, 20), (15, 21), (13, 22)][pose]
    pants = PANTS_GREY if seed % 2 else PANTS
    body.tex_poly([(30, ly0 - 1), (46, ly0 - 2 + pose), (46, ly0 + 3 + pose), (30, ly0 + 4)], pants, seed + 1, 2.0, 0.5)
    body.tex_poly([(30, ly1 - 4), (46, ly1 - 4 - pose), (46, ly1 + 1), (30, ly1 + 1)], pants, seed + 2, 2.0, 0.5)
    body.tex_poly([(44, ly0 - 2 + pose), (50, ly0 - 3 + pose), (50, ly0 + 3 + pose), (44, ly0 + 3 + pose)], WOOD, seed + 3, 1.5, 0.5)
    body.tex_poly([(44, ly1 - 4 - pose), (50, ly1 - 4 - pose * 2), (50, ly1 + 1), (44, ly1 + 1)], WOOD, seed + 4, 1.5, 0.5)
    arm_dy = [-4, 0, 3][pose]
    body.tex_poly([(14, 17), (26, 18 + arm_dy), (30, 19 + arm_dy), (28, 22 + arm_dy), (14, 21)], STEEL, seed + 5, 2.0, 0.5)
    body.tex_poly([(13, 7), (4 + pose, 3 + pose), (1 + pose, 6 + pose), (4 + pose, 9 + pose), (14, 11)], STEEL_DARK, seed + 6, 2.0, 0.5)
    body.ell(0 + pose, 3 + pose, 5, 5, SKIN[2])
    body.tex_poly([(13, 5), (31, 5), (32, 12), (31, 20), (13, 20), (11, 12)], STEEL, seed + 7, 3.0, 0.55)
    body.tex_poly([(15, 6), (29, 6), (30, 12), (29, 19), (15, 19), (14, 12)], cloth, seed + 8, 2.5, 0.5)
    body.rect(15, 12, 15, 1, cloth[0])
    body.rect(28, 6, 2, 14, STEEL_DARK[2])
    for _ in range(14):
        x, y = r.randint(17, 26), r.randint(8, 17)
        if body.get(x, y)[3] > 0:
            body.px(x, y, BLOOD[r.choice((1, 2, 3))])
    body.line(19, 9, 24, 15, BLOOD[0])
    body.tex_ell(3, 6, 11, 12, SKIN_PALE if face_up else HAIR, seed + 9, 2.0, 0.5)
    if face_up:
        body.poly([(3, 9), (7, 6), (12, 7), (13, 9), (3, 11)], HAIR_PALE[2])
        body.px(6, 12, OUTLINE); body.px(10, 12, OUTLINE)
        body.px(8, 15, BLOOD[2])
    else:
        body.ell(4, 7, 9, 9, HAIR[2]); body.ell(5, 8, 5, 4, HAIR[3])
    body.outline()
    cv.paste(body, 0, 0)
    return cv.finish(outline=False)


def banner_fallen(cloth: list, seed: int = 1) -> Cv:
    """Estandarte rasgado, caído de lado, com a haste partida."""
    cv = Cv(54, 26)
    cv.line(2, 20, 52, 12, WOOD[2], 2)
    cv.line(2, 21, 52, 13, WOOD[1])
    cv.tex_poly([(14, 17), (40, 11), (38, 18), (34, 16), (30, 22), (24, 18), (18, 24), (14, 22)], cloth, seed, 2.0, 0.5)
    cv.line(20, 16, 22, 21, cloth[0]); cv.line(30, 14, 31, 18, cloth[0])
    cv.px(50, 12, GOLD[3]); cv.px(51, 12, GOLD[4])
    return cv.finish(shadow=(27, 22, 46, 4))


def build(sh) -> None:
    for i, tilt in enumerate((0, -1, 1, 0)):
        sh.add(sword_stuck(tilt), f'espada-cravada-{i + 1}', f'Espada cravada {i + 1}', CAT, ['espada', 'cravada'] + TAGS, sort=2)
    for i, ang in enumerate((-10, 25, -35, 60)):
        sh.add(sword_lying(ang), f'espada-caida-{i + 1}', f'Espada caída {i + 1}', CAT, ['espada', 'caída'] + TAGS, kind='floor', sort=0)
    sh.add(sword_lying(15, broken=True), 'espada-quebrada', 'Espada quebrada', CAT, ['espada', 'quebrada'] + TAGS, kind='floor', sort=0)
    sh.add(shield_lying(CLOTH_RED, 11), 'escudo-vermelho', 'Escudo caído (vermelho)', CAT, ['escudo'] + TAGS, kind='floor', sort=0)
    sh.add(shield_lying(CLOTH_BLUE, 12), 'escudo-azul', 'Escudo caído (azul)', CAT, ['escudo'] + TAGS, kind='floor', sort=0)
    sh.add(shield_lying(CLOTH_BLUE, 13, broken=True), 'escudo-partido', 'Escudo partido', CAT, ['escudo', 'quebrado'] + TAGS, kind='floor', sort=0)
    sh.add(helmet_lying(14), 'elmo-caido', 'Elmo caído', CAT, ['elmo'] + TAGS, kind='floor', sort=0)
    n = 0
    for cloth, nm in ((CLOTH_RED, 'vermelho'), (CLOTH_BLUE, 'azul')):
        for pose in range(3):
            for face_up in (True, False):
                n += 1
                sh.add(soldier(cloth, pose, face_up, 20 + n), f'soldado-{n}', f'Soldado tombado ({nm}) {n}', CAT,
                       ['soldado', 'corpo', 'morto', nm] + TAGS, kind='floor', sort=0)
    for i, (w, h) in enumerate(((22, 14), (34, 20), (46, 26))):
        sh.add(blood_stain(w, h, 30 + i), f'sangue-{i + 1}', f'Mancha de sangue {i + 1}', CAT, ['sangue', 'mancha'] + TAGS, kind='floor', sort=0)
    sh.add(banner_fallen(CLOTH_RED, 40), 'estandarte-vermelho', 'Estandarte caído (vermelho)', CAT, ['estandarte', 'bandeira'] + TAGS, kind='floor', sort=0)
    sh.add(banner_fallen(CLOTH_BLUE, 41), 'estandarte-azul', 'Estandarte caído (azul)', CAT, ['estandarte', 'bandeira'] + TAGS, kind='floor', sort=0)
