"""Objetos: sobrevivência (acampamento, suprimentos, bancada, cofres, hospital improvisado)."""
from __future__ import annotations

import math

from .objects_ruins import crack, jag, moss_patch, rust_streaks
from .palettes import *  # noqa: F403
from .px import Cv, rgb, rng, scatter, text
from .sheet import Sheet, solid

CAT = 'Apocalipse: Sobrevivência'
TAGS = ['pós-apocalipse', 'sobrevivência']
FLAME = [rgb('#7a1d0c'), rgb('#c2410c'), rgb('#f08a1c'), rgb('#ffd24a'), rgb('#fff2b0')]


def backpack_ground(seed: int = 1) -> Cv:
    cv = Cv(30, 28)
    cv.tex_poly([(5, 24), (3, 12), (8, 4), (20, 3), (25, 10), (26, 24)], OLIVE_DRAB, seed, 3, 0.55)
    cv.tex_rect(8, 14, 14, 9, OLIVE, seed + 1, 2, 0.5)            # bolso da frente
    cv.rect(8, 14, 14, 1, OLIVE_DRAB[4])
    cv.rect(13, 17, 4, 3, IRON[3])                                 # fivela
    cv.line(7, 5, 7, 22, CANVAS[1])                                # alças
    cv.line(23, 6, 24, 22, CANVAS[1])
    cv.rect(10, 1, 10, 3, OLIVE_DRAB[2])                           # alça de mão
    cv.tex_ell(2, 14, 7, 9, CANVAS, seed + 2, 2, 0.5)              # lateral enrolada (saco de dormir)
    rust_streaks(cv, 4, 4, 22, 18, seed + 3, 3)
    cv.finish(shadow=(15, 25, 26, 5))
    return cv


def medkit(seed: int = 2) -> Cv:
    cv = Cv(22, 18)
    cv.tex_rect(2, 4, 18, 11, rgb('#7a7d76') and [rgb('#a7a99e'), rgb('#bfc1b5'), rgb('#d6d8cb')], seed, 2, 0.5)
    cv.rect(2, 4, 18, 2, rgb('#e2e4d8'))
    cv.rect(9, 7, 4, 7, rgb('#a3281f')); cv.rect(7, 9, 8, 3, rgb('#a3281f'))
    cv.rect(8, 2, 6, 2, rgb('#8c8e84'))
    cv.finish(shadow=(11, 16, 18, 4))
    return cv


def workbench(seed: int = 3) -> Cv:
    cv = Cv(72, 52)
    cv.tex_rect(2, 4, 68, 20, [rgb('#1d1814'), rgb('#2a231c')], seed, 4, 0.3)       # painel de ferramentas na parede
    for i, x in enumerate(range(8, 64, 9)):
        cv.line(x, 6, x, 6 + 6 + (i % 3) * 3, IRON_LIGHT[3], 1)
        cv.rect(x - 1, 6 + 6 + (i % 3) * 3, 3, 3, [RUST[3], IRON[3], WOOD[3]][i % 3])
    cv.tex_poly([(2, 24), (70, 24), (66, 32), (6, 32)], WOOD_PALE, seed + 1, 3, 0.6)   # tampo
    cv.tex_rect(6, 32, 60, 5, WOOD, seed + 2, 3, 0.5)
    for x in (8, 58):
        cv.tex_rect(x, 36, 5, 12, WOOD, seed + x, 2, 0.5)
    cv.tex_rect(10, 38, 50, 4, WOOD_PALE, seed + 5, 3, 0.5)                        # prateleira
    cv.rect(46, 20, 8, 5, IRON[3]); cv.rect(48, 17, 4, 4, IRON[2])               # morsa
    cv.rect(14, 19, 10, 5, RUST[3]); cv.rect(16, 17, 6, 3, IRON[2])               # caixa/serra
    cv.rect(28, 21, 14, 3, IRON_LIGHT[3])                                          # chave inglesa
    for x in (14, 24, 40):
        cv.rect(x, 38, 6, 3, [OLIVE_DRAB[3], CANVAS[3], RUST[2]][(x // 10) % 3])
    rust_streaks(cv, 2, 24, 68, 22, seed + 6, 6)
    cv.finish(shadow=(36, 49, 66, 6))
    return cv


def campfire(frame: int, lit: bool = True, seed: int = 4) -> Cv:
    cv = Cv(44, 40)
    r = rng(seed)
    for a in range(9):                                                     # pedras em roda
        x = 22 + math.cos(a / 9 * math.tau) * 14
        y = 30 + math.sin(a / 9 * math.tau) * 6
        cv.tex_ell(round(x) - 4, round(y) - 3, 8, 6, CONCRETE, seed + a, 2, 0.5)
    cv.tex_poly([(10, 32), (14, 28), (32, 30), (36, 34), (30, 36), (14, 36)], rgb('#1b1612') and [rgb('#0f0d0a'), rgb('#1a1612'), rgb('#2a221b')], seed, 2, 0.3)
    cv.line(12, 32, 30, 27, WOOD[2], 3); cv.line(30, 33, 14, 28, WOOD[3], 3)   # lenhas
    if lit:
        rr = rng(seed + frame * 31)
        for k, (cx, hgt, w) in enumerate(((22, 20, 12), (16, 13, 7), (28, 14, 7))):
            hh = hgt + rr.randint(-3, 3)
            for yy in range(hh):
                t = yy / hh
                ww = max(1, round(w * (1 - t) * (0.85 + 0.15 * math.sin(frame + yy))))
                tone = FLAME[min(4, int(t * 4.9) if False else 4 - min(4, int(t * 5)))] if False else FLAME[max(0, 3 - int(t * 4))]
                cv.rect(cx - ww // 2 + rr.randint(-1, 1), 30 - yy, ww, 1, tone)
        cv.rect(19, 27, 6, 2, FLAME[4])
    else:
        for x in (16, 24, 30):
            cv.px(x, 29, rgb('#3a352c')); cv.px(x + 1, 28, rgb('#55503f'))
    cv.finish(shadow=(22, 36, 36, 6))
    return cv


def sleeping_bag(seed: int = 5) -> Cv:
    cv = Cv(52, 28)
    cv.tex_poly([(4, 18), (6, 8), (42, 6), (48, 14), (46, 22), (6, 24)], OLIVE_DRAB, seed, 3, 0.5)
    cv.tex_ell(2, 8, 14, 12, CANVAS, seed + 1, 2, 0.5)                          # travesseiro
    for x in (22, 30, 38):
        cv.line(x, 8, x - 1, 22, OLIVE_DRAB[1])
    cv.line(6, 16, 46, 14, OLIVE_DRAB[4])
    rust_streaks(cv, 6, 8, 40, 14, seed + 2, 2)
    cv.finish(shadow=(26, 25, 46, 5))
    return cv


def flashlight(seed: int = 6) -> Cv:
    cv = Cv(20, 24)
    cv.rect(8, 8, 5, 12, IRON[2]); cv.rect(8, 8, 1, 12, IRON[4])
    cv.poly([(5, 3), (16, 3), (13, 9), (8, 9)], IRON_LIGHT[3])
    cv.rect(7, 2, 8, 2, rgb('#fff6c8'))
    cv.px(10, 14, rgb('#a3281f'))
    cv.finish(shadow=(10, 22, 14, 4))
    return cv


def oil_lamp(frame: int, seed: int = 7) -> Cv:
    cv = Cv(18, 30)
    cv.tex_rect(5, 16, 8, 9, GLASS, seed, 2, 0.5)
    cv.rect(4, 24, 10, 3, IRON[2]); cv.rect(5, 14, 8, 2, IRON[3])
    cv.line(4, 14, 9, 8, IRON[2]); cv.line(14, 14, 9, 8, IRON[2])
    rr = rng(seed + frame * 7)
    h = 5 + rr.randint(0, 2)
    for yy in range(h):
        w = max(1, 3 - yy // 2)
        cv.rect(9 - w // 2, 21 - yy, w, 1, FLAME[3 - min(3, yy // 2)])
    cv.finish(shadow=(9, 28, 14, 4))
    return cv


def radio(seed: int = 8) -> Cv:
    cv = Cv(26, 22)
    cv.tex_rect(3, 6, 20, 13, OLIVE_DRAB, seed, 2, 0.5)
    cv.rect(5, 8, 8, 6, rgb('#14150f')); cv.rect(6, 9, 6, 1, rgb('#3a4a30'))
    cv.ell(15, 9, 5, 5, IRON[3]); cv.px(17, 11, IRON[1])
    cv.line(20, 6, 24, 0, IRON_LIGHT[3])
    cv.rect(5, 16, 14, 1, OLIVE_DRAB[1])
    cv.finish(shadow=(13, 20, 22, 4))
    return cv


def safe(seed: int = 9) -> Cv:
    cv = Cv(36, 40)
    cv.tex_rect(3, 4, 30, 32, IRON, seed, 3, 0.5)
    cv.rect(3, 4, 30, 2, IRON[4]); cv.rect(3, 4, 2, 32, IRON[3])
    cv.rect(6, 8, 24, 24, IRON[1])
    cv.ell(10, 16, 9, 9, IRON_LIGHT[2]); cv.ell(12, 18, 5, 5, IRON[2]); cv.px(14, 20, IRON_LIGHT[4])
    cv.rect(21, 11, 8, 12, rgb('#14150f'))                                      # teclado
    for i in range(6):
        cv.rect(22 + (i % 2) * 3, 12 + (i // 2) * 3, 2, 2, rgb('#8d928a'))
    cv.px(26, 22, rgb('#d63a2a'))
    cv.rect(4, 34, 5, 3, IRON[0]); cv.rect(27, 34, 5, 3, IRON[0])
    rust_streaks(cv, 3, 4, 30, 30, seed + 1, 7)
    cv.finish(shadow=(18, 37, 30, 5))
    return cv


def locker(seed: int = 10) -> Cv:
    cv = Cv(30, 64)
    cv.tex_rect(3, 4, 24, 54, IRON_LIGHT, seed, 3, 0.5)
    cv.rect(3, 4, 24, 2, IRON_LIGHT[4])
    cv.line(14, 6, 14, 56, IRON[1])
    for y in (9, 12, 15):
        cv.rect(6, y, 6, 1, IRON[1]); cv.rect(17, y, 6, 1, IRON[1])
    cv.rect(11, 28, 2, 4, IRON[0]); cv.rect(16, 28, 2, 4, IRON[0])
    cv.rect(4, 56, 4, 3, IRON[0]); cv.rect(21, 56, 4, 3, IRON[0])
    # porta amassada/aberta
    cv.poly([(15, 6), (26, 8), (26, 52), (15, 56)], IRON_LIGHT[1])
    rust_streaks(cv, 3, 4, 24, 52, seed + 1, 10)
    crack(cv, 8, 20, 8, seed + 2, IRON[0])
    cv.finish(shadow=(15, 60, 26, 5))
    return cv


def toolbox(seed: int = 11) -> Cv:
    cv = Cv(30, 22)
    red = ramp('#3a0f0d', '#5e1a15', '#822821', '#a3382d', '#c04a3c')
    cv.tex_rect(3, 8, 24, 11, red, seed, 2, 0.5)
    cv.rect(3, 8, 24, 2, red[4])
    cv.rect(10, 4, 10, 4, IRON[3]); cv.rect(12, 5, 6, 2, IRON[1])
    cv.rect(13, 12, 4, 2, IRON[3])
    rust_streaks(cv, 3, 8, 24, 11, seed + 1, 4)
    cv.finish(shadow=(15, 20, 26, 4))
    return cv


def barrel(seed: int = 12, water: bool = True) -> Cv:
    cv = Cv(32, 42)
    body = ramp('#14202c', '#223548', '#32506a', '#46708f', '#5f8fae') if water else RUST
    cv.tex_poly([(6, 8), (26, 8), (28, 34), (4, 34)], body, seed, 3, 0.55)
    cv.tex_ell(5, 3, 22, 10, body, seed + 1, 2, 0.6)
    cv.ell(8, 5, 16, 6, rgb('#101c28') if water else rgb('#1f0f0a'))
    for y in (14, 28):
        cv.rect(4, y, 24, 2, IRON[1])
    cv.rect(6, 33, 20, 3, IRON[0])
    rust_streaks(cv, 4, 8, 24, 26, seed + 2, 9)
    moss_patch(cv, 6, 28, 20, 8, seed + 3, 0.3)
    cv.finish(shadow=(16, 38, 28, 5))
    return cv


def tarp_shelter(seed: int = 13) -> Cv:
    cv = Cv(76, 60)
    cv.tex_poly([(4, 24), (66, 6), (74, 44), (10, 52)], TARP_BLUE, seed, 4, 0.5)
    cv.poly([(10, 52), (74, 44), (74, 50), (10, 58)], rgb('#101c28'))
    cv.line(4, 24, 66, 6, TARP_BLUE[4]); cv.line(66, 6, 74, 44, TARP_BLUE[1])
    for x0, y0 in ((6, 26), (68, 8)):
        cv.line(x0, y0, x0, y0 + 30, WOOD[2], 3)
    r = rng(seed)
    for _ in range(4):
        x = r.randint(14, 64)
        cv.line(x, 18 + (x - 14) // 6, x - 2, 44, TARP_BLUE[1])
    cv.tex_ell(30, 40, 22, 8, rgb('#171310') and [rgb('#171310'), rgb('#251d17')], seed + 1, 2, 0.3)    # sombra dentro
    moss_patch(cv, 8, 20, 60, 26, seed + 2, 0.12)
    cv.finish(shadow=(40, 56, 70, 6))
    return cv


def trash_scatter(seed: int = 14) -> Cv:
    cv = Cv(30, 18)
    r = rng(seed)
    for _ in range(4):
        x, y = r.randint(2, 22), r.randint(3, 11)
        cv.rect(x, y, 3, 5, r.choice((rgb('#8a8a7a'), rgb('#6e5a3a'), rgb('#4a6a52'))))
        cv.px(x + 1, y, rgb('#d0d0c0'))
    for _ in range(3):
        cv.ell(r.randint(2, 24), r.randint(4, 12), 4, 3, rgb('#7a7a6e'))
    cv.finish(outline=True)
    return cv


def ammo_box(seed: int = 15) -> Cv:
    cv = Cv(22, 16)
    cv.tex_rect(3, 4, 16, 9, OLIVE_DRAB, seed, 2, 0.5)
    cv.rect(3, 4, 16, 2, OLIVE_DRAB[4]); cv.rect(9, 3, 4, 2, IRON[3])
    cv.rect(5, 8, 8, 2, rgb('#d9bd4f'))
    cv.finish(shadow=(11, 14, 18, 4))
    return cv


def map_table(seed: int = 16) -> Cv:
    cv = Cv(66, 46)
    cv.tex_poly([(4, 18), (62, 18), (58, 28), (8, 28)], WOOD_PALE, seed, 3, 0.6)
    cv.tex_rect(8, 28, 50, 5, WOOD, seed + 1, 3, 0.5)
    for x in (10, 52):
        cv.tex_rect(x, 32, 5, 12, WOOD, seed + x, 2, 0.5)
    cv.poly([(14, 19), (50, 19), (48, 26), (16, 26)], rgb('#b9b49a'))                  # mapa
    cv.line(20, 21, 40, 24, rgb('#7a3a2a')); cv.line(30, 20, 36, 25, rgb('#3a5a7a'))
    for (x, y) in ((24, 22), (38, 21), (31, 24)):
        cv.px(x, y, rgb('#d63a2a'))
    cv.rect(52, 16, 4, 3, rgb('#d9d6c4'))                                               # copo
    cv.finish(shadow=(33, 43, 60, 5))
    return cv


def dirty_mattress(seed: int = 17) -> Cv:
    cv = Cv(54, 30)
    cv.tex_poly([(4, 20), (8, 8), (46, 6), (52, 16), (48, 24), (6, 26)], CANVAS, seed, 3, 0.5)
    cv.tex_ell(10, 12, 12, 8, rgb('#5a4a30') and [rgb('#4a3d28'), rgb('#5c4c34')], seed + 1, 2, 0.3)       # mancha
    cv.tex_ell(30, 10, 10, 8, [rgb('#46321e'), rgb('#58422a')], seed + 2, 2, 0.3)
    for x in (16, 28, 38):
        cv.px(x, 15, CANVAS[0]); cv.px(x + 1, 15, CANVAS[0])
    cv.line(8, 10, 46, 8, CANVAS[4])
    cv.finish(shadow=(28, 27, 48, 5))
    return cv


def hospital_bed(seed: int = 18) -> Cv:
    cv = Cv(66, 46)
    for x in (6, 56):
        cv.rect(x, 26, 3, 14, IRON_LIGHT[2]); cv.ell(x - 1, 39, 5, 4, rgb('#101213'))
    cv.tex_poly([(4, 22), (62, 22), (62, 30), (4, 30)], IRON_LIGHT, seed, 3, 0.5)
    cv.tex_poly([(6, 12), (60, 12), (62, 24), (4, 24)], CAR_WHITE, seed + 1, 3, 0.6)             # colchão
    cv.tex_ell(8, 10, 14, 8, CAR_WHITE, seed + 2, 2, 0.6)                                        # travesseiro
    cv.tex_ell(30, 14, 18, 8, [BLOOD[1], BLOOD[2], BLOOD[3]], seed + 3, 2, 0.3)                 # mancha escura
    cv.line(4, 12, 4, 30, IRON_LIGHT[3], 2); cv.line(62, 12, 62, 30, IRON_LIGHT[3], 2)
    rust_streaks(cv, 4, 22, 58, 18, seed + 4, 6)
    cv.finish(shadow=(33, 43, 60, 5))
    return cv


def iv_stand(seed: int = 19) -> Cv:
    cv = Cv(24, 62)
    cv.line(12, 8, 12, 54, IRON_LIGHT[3], 2)
    for x0, x1 in ((12, 4), (12, 20)):
        cv.line(x0, 54, x1, 58, IRON_LIGHT[2], 2)
    cv.line(6, 8, 18, 8, IRON_LIGHT[3], 2)
    cv.tex_rect(15, 9, 5, 13, GLASS, seed, 2, 0.6); cv.rect(15, 9, 5, 1, IRON[3])
    cv.line(17, 22, 17, 36, rgb('#a9c2c2'))
    cv.finish(shadow=(12, 59, 20, 4))
    return cv


def woodpile(seed: int = 20) -> Cv:
    cv = Cv(46, 32)
    for row, (y, n) in enumerate(((22, 7), (13, 6), (5, 5))):
        for i in range(n):
            x = 4 + i * 6 + (3 if row % 2 else 0)
            cv.tex_ell(x, y, 8, 8, WOOD, seed + row * 9 + i, 1.5, 0.5)
            cv.ell(x + 2, y + 2, 4, 4, WOOD[4]); cv.px(x + 4, y + 4, WOOD[2])
    moss_patch(cv, 6, 20, 34, 10, seed, 0.2)
    cv.finish(shadow=(23, 30, 40, 5))
    return cv


def build(sh: Sheet) -> None:
    sh.add(backpack_ground(), 'mochila-chao', 'Mochila no chão', CAT, ['mochila', 'suprimentos'] + TAGS, sort=2, solids=[solid(10, 6)])
    sh.add(medkit(), 'kit-medico', 'Kit médico', CAT, ['kit', 'curativo', 'suprimentos'] + TAGS, sort=1)
    sh.add(workbench(), 'bancada', 'Bancada de trabalho', CAT, ['bancada', 'oficina', 'ferramentas'] + TAGS, solids=[solid(33, 14)], sort=4)
    sh.add([campfire(f) for f in range(4)], 'fogueira', 'Fogueira acesa', CAT, ['fogueira', 'fogo', 'luz', 'acampamento'] + TAGS,
           solids=[solid(14, 6)], sort=3, fps=8, light={'x': 0, 'y': -14, 'radius': 150, 'color': '#ff9a45', 'intensity': 1, 'flicker': 0.35})
    sh.add(campfire(0, lit=False), 'fogueira-apagada', 'Fogueira apagada', CAT, ['fogueira', 'acampamento'] + TAGS, solids=[solid(14, 6)], sort=3)
    sh.add(sleeping_bag(), 'saco-dormir', 'Saco de dormir', CAT, ['saco de dormir', 'acampamento'] + TAGS, kind='floor', sort=0)
    sh.add(flashlight(), 'lanterna', 'Lanterna acesa', CAT, ['lanterna', 'luz'] + TAGS, sort=2,
           light={'x': 0, 'y': -14, 'radius': 110, 'color': '#fff2c8', 'intensity': 0.85, 'flicker': 0.04})
    sh.add([oil_lamp(f) for f in range(3)], 'lampiao', 'Lampião a óleo', CAT, ['lampião', 'luz', 'fogo'] + TAGS, sort=2, fps=6,
           light={'x': 0, 'y': -12, 'radius': 120, 'color': '#ffb060', 'intensity': 0.9, 'flicker': 0.22})
    sh.add(radio(), 'radio', 'Rádio velho', CAT, ['rádio', 'comunicação'] + TAGS, sort=2, solids=[solid(10, 5)])
    sh.add(safe(), 'cofre', 'Cofre com teclado', CAT, ['cofre', 'teclado', 'senha'] + TAGS, solids=[solid(15, 8)], sort=4)
    sh.add(locker(), 'armario-ferro', 'Armário de ferro', CAT, ['armário', 'locker', 'ferro'] + TAGS, solids=[solid(12, 6)], sort=4)
    sh.add(toolbox(), 'caixa-ferramentas', 'Caixa de ferramentas', CAT, ['ferramentas', 'caixa'] + TAGS, solids=[solid(12, 6)], sort=2)
    sh.add(barrel(12, True), 'barril-agua', 'Barril d\'água', CAT, ['barril', 'água'] + TAGS, solids=[solid(12, 8)], sort=4)
    sh.add(barrel(13, False), 'barril-enferrujado', 'Barril enferrujado', CAT, ['barril', 'ferrugem'] + TAGS, solids=[solid(12, 8)], sort=4,
           group='barril-agua', variant='Enferrujado')
    sh.add(tarp_shelter(), 'abrigo-lona', 'Abrigo de lona improvisado', CAT, ['abrigo', 'lona', 'acampamento'] + TAGS, solids=[solid(34, 10)], sort=4)
    sh.add(trash_scatter(), 'latas-garrafas', 'Latas e garrafas', CAT, ['lixo', 'latas'] + TAGS, kind='floor', sort=0)
    sh.add(ammo_box(), 'caixa-municao', 'Caixa de munição', CAT, ['munição', 'suprimentos'] + TAGS, sort=1)
    sh.add(map_table(), 'mesa-mapa', 'Mesa com mapa', CAT, ['mesa', 'mapa', 'planejamento'] + TAGS, solids=[solid(28, 8)], sort=3)
    sh.add(dirty_mattress(), 'colchao-sujo', 'Colchão sujo', CAT, ['colchão', 'cama'] + TAGS, kind='floor', sort=0)
    sh.add(hospital_bed(), 'cama-hospital', 'Cama de hospital manchada', CAT, ['cama', 'hospital'] + TAGS, solids=[solid(30, 8)], sort=3)
    sh.add(iv_stand(), 'suporte-soro', 'Suporte de soro', CAT, ['soro', 'hospital'] + TAGS, solids=[solid(4, 3)], sort=3)
    sh.add(woodpile(), 'pilha-lenha', 'Pilha de lenha', CAT, ['lenha', 'madeira'] + TAGS, solids=[solid(20, 8)], sort=3)
