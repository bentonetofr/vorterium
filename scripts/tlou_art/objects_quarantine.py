"""Objetos: zona de quarentena, barricadas, acampamento militar e pichações."""
from __future__ import annotations

from .objects_ruins import crack, moss_patch, rust_streaks
from .palettes import *  # noqa: F403
from .px import Cv, rgb, rng, scatter, text, text_width
from .sheet import Sheet, solid

CAT = 'Apocalipse: Quarentena'
YELLOW = ramp('#4a3d12', '#6f5c1b', '#957c26', '#b89d36', '#d9bd4f')


def jersey(seed: int = 1) -> Cv:
    cv = Cv(76, 38)
    cv.tex_poly([(8, 10), (68, 10), (74, 33), (2, 33)], CONCRETE, seed, 4, 0.5)
    cv.tex_poly([(8, 10), (68, 10), (66, 14), (10, 14)], CONCRETE[2:], seed + 1, 3, 0.3)   # topo
    # listras amarelo/preto desbotadas
    for i, x in enumerate(range(10, 66, 10)):
        cv.poly([(x, 16), (x + 5, 16), (x + 3, 28), (x - 2, 28)], YELLOW[2] if i % 2 == 0 else rgb('#1a1a16'))
    crack(cv, 30, 14, 14, seed + 2)
    crack(cv, 58, 16, 10, seed + 3)
    cv.rect(2, 30, 72, 3, CONCRETE_DARK[1])
    moss_patch(cv, 2, 28, 70, 6, seed + 4, 0.55)
    scatter(cv, rng(seed), 16, (4, 12, 70, 32), [CONCRETE[4], CONCRETE[0]])
    cv.finish(shadow=(38, 35, 74, 7))
    return cv


def wood_barricade(seed: int = 11) -> Cv:
    cv = Cv(68, 50)
    for x in (6, 58):
        cv.tex_rect(x, 8, 5, 38, WOOD, seed + x, 2, 0.5)
    r = rng(seed)
    # tábuas horizontais e cruzadas
    for i, y in enumerate((12, 22, 32)):
        cv.tex_poly([(2, y + r.randint(-1, 1)), (66, y), (66, y + 6), (2, y + 7)], WOOD_PALE, seed + i, 2.5, 0.5)
        cv.line(2, y + 7, 66, y + 6, WOOD[0])
    cv.tex_poly([(4, 8), (10, 6), (64, 44), (58, 46)], WOOD, seed + 7, 2.5, 0.5)
    cv.tex_poly([(62, 8), (56, 6), (4, 44), (10, 46)], WOOD, seed + 8, 2.5, 0.5)
    for (x, y) in ((8, 14), (60, 14), (8, 24), (60, 24), (8, 34), (60, 34), (34, 26)):
        cv.px(x, y, rgb('#b8b2a0')); cv.px(x, y + 1, rgb('#3a352c'))
    cv.px(30, 20, rgb('#16130f')); cv.px(31, 21, rgb('#16130f'))   # lasca
    moss_patch(cv, 2, 36, 64, 10, seed + 9, 0.35)
    cv.finish(shadow=(34, 47, 64, 6))
    return cv


def sandbags(seed: int = 21) -> Cv:
    cv = Cv(68, 36)
    layers = [(22, 7), (14, 6), (6, 5)]
    for li, (y, n) in enumerate(layers):
        off = 4 + (6 if li % 2 else 0)
        for i in range(n):
            x = off + i * 9
            cv.tex_ell(x, y, 13, 9, CANVAS, seed + li * 9 + i, 2, 0.55)
            cv.line(x + 3, y + 4, x + 9, y + 4, CANVAS[1])
    moss_patch(cv, 4, 24, 60, 8, seed, 0.3)
    cv.finish(shadow=(34, 33, 64, 6))
    return cv


def chainlink(seed: int = 31) -> Cv:
    cv = Cv(64, 54)
    for x in (4, 58):
        cv.tex_rect(x, 6, 3, 44, IRON, seed + x, 2, 0.5)
        cv.rect(x - 1, 4, 5, 2, IRON[3])
    mesh = IRON_LIGHT[3]
    for y in range(8, 46, 4):
        for x in range(8, 56, 4):
            cv.px(x, y, mesh)
            cv.px(x + 2, y + 2, mesh)
            cv.px(x + 1, y + 1, IRON_LIGHT[2])
            cv.px(x + 3, y + 3, IRON_LIGHT[2])
    cv.rect(7, 8, 50, 1, IRON_LIGHT[4]); cv.rect(7, 45, 50, 1, IRON_LIGHT[2])
    # rasgo no arame
    for x in range(26, 38):
        for y in range(24, 36):
            if (x - 32) ** 2 + (y - 30) ** 2 < 30:
                cv.px(x, y, (0, 0, 0, 0))
    # arame farpado no topo
    for x in range(6, 58, 4):
        cv.px(x, 4, IRON[4]); cv.px(x + 1, 3, IRON[4]); cv.px(x + 2, 4, IRON[2])
    cv.line(6, 4, 58, 4, IRON[3])
    rust_streaks(cv, 4, 6, 56, 40, seed, 8)
    moss_patch(cv, 4, 40, 56, 8, seed + 1, 0.5)
    cv.finish(shadow=(32, 51, 60, 5))
    return cv


def barbed_coil(seed: int = 41) -> Cv:
    cv = Cv(52, 24)
    for i in range(5):
        x = 4 + i * 9
        cv.d.ellipse([x, 4, x + 14, 18], outline=IRON_LIGHT[3], width=1)
        cv.px(x + 2, 3, IRON[4]); cv.px(x + 12, 19, IRON[4]); cv.px(x + 7, 4, IRON[4])
    cv.line(4, 11, 48, 11, IRON[2])
    rust_streaks(cv, 4, 4, 46, 14, seed, 4)
    cv.finish(shadow=(26, 21, 46, 5), outline=False)
    return cv


def sign(lines: list[str], bg: list, fg, seed: int, w: int = 50) -> Cv:
    cv = Cv(w + 6, 66)
    cv.tex_rect(w // 2 + 1, 28, 4, 34, IRON, seed, 2, 0.5)
    cv.rect(w // 2 - 1, 60, 8, 3, IRON[1])
    cv.tex_rect(3, 4, w, 8 + 8 * len(lines), bg, seed + 1, 3, 0.45)
    cv.rect(3, 4, w, 1, bg[4]); cv.rect(3, 4, 1, 8 + 8 * len(lines), bg[4])
    rust_streaks(cv, 3, 4, w, 8 + 8 * len(lines), seed + 2, 5)
    for i, ln in enumerate(lines):
        tw = text_width(ln)
        text(cv, 3 + (w - tw) // 2, 9 + i * 8, ln, fg)
    cv.px(5, 6, rgb('#d0cbbd')); cv.px(w, 6, rgb('#d0cbbd'))     # parafusos
    moss_patch(cv, w // 2 - 4, 54, 12, 8, seed + 4, 0.5)
    cv.finish(shadow=(w // 2 + 3, 63, 18, 4))
    return cv


def crate(seed: int = 51, stack: int = 1, open_: bool = False) -> Cv:
    w, h = (36, 30 * stack - 4 * (stack - 1) + 4) if stack > 1 else (36, 34)
    cv = Cv(w, h)
    cw, ch = 30, 24
    for s in range(stack):
        y = h - 6 - ch - s * (ch - 3)
        x = 3 + (s % 2) * 2
        cv.tex_rect(x, y, cw, ch, OLIVE_DRAB, seed + s, 3, 0.5)
        cv.rect(x, y, cw, 3, OLIVE_DRAB[4])
        cv.line(x, y + 12, x + cw - 1, y + 12, OLIVE_DRAB[0])
        for bx in (x + 2, x + cw - 4):
            cv.rect(bx, y + 3, 2, ch - 3, OLIVE_DRAB[1])
        if open_ and s == 0:
            cv.rect(x + 3, y + 3, cw - 6, 8, rgb('#15130f'))
            for k in range(3):
                cv.rect(x + 5 + k * 8, y + 4, 6, 5, [rgb('#7a3a24'), rgb('#4b5a32'), rgb('#8a7a52')][k])
    rust_streaks(cv, 3, 3, 32, h - 8, seed + 9, 4)
    if not open_:
        text(cv, 9, h - 6 - 24 + 15, 'EXERC', rgb('#e3e6cc'))
    moss_patch(cv, 3, h - 14, 32, 8, seed + 5, 0.2)
    cv.finish(shadow=(w // 2 + 1, h - 3, w - 2, 6))
    return cv


def tent(seed: int = 61) -> Cv:
    cv = Cv(92, 70)
    cv.tex_poly([(4, 62), (46, 6), (88, 62)], OLIVE_DRAB, seed, 5, 0.5)
    cv.poly([(46, 6), (88, 62), (66, 62)], OLIVE_DRAB[1])             # lado sombreado
    cv.poly([(46, 6), (4, 62), (22, 62)], OLIVE_DRAB[3])
    cv.poly([(34, 62), (46, 30), (58, 62)], rgb('#14120d'))           # entrada
    cv.poly([(34, 62), (46, 30), (40, 62)], OLIVE_DRAB[2])            # aba da porta aberta
    cv.line(46, 6, 4, 62, OLIVE_DRAB[4]); cv.line(46, 6, 88, 62, OLIVE_DRAB[0])
    for gx in (4, 88):
        cv.line(gx, 62, gx + (-6 if gx < 40 else 6), 66, CANVAS[3])   # cordas
        cv.px(gx + (-6 if gx < 40 else 6), 66, IRON[3])
    r = rng(seed)
    for _ in range(3):
        x = r.randint(14, 78)
        cv.tex_ell(x, r.randint(40, 58), r.randint(5, 9), r.randint(3, 5), CANVAS, seed + x, 1.5, 0.4)   # remendos
    rust_streaks(cv, 10, 20, 70, 40, seed + 2, 6)
    moss_patch(cv, 4, 54, 84, 8, seed + 3, 0.3)
    cv.finish(shadow=(46, 66, 86, 7))
    return cv


def generator(seed: int = 71) -> Cv:
    cv = Cv(42, 36)
    cv.tex_rect(3, 10, 36, 20, OLIVE_DRAB, seed, 3, 0.5)
    cv.rect(3, 10, 36, 3, OLIVE_DRAB[4])
    cv.tex_rect(6, 4, 14, 8, IRON, seed + 1, 2, 0.5)          # tanque
    cv.rect(10, 2, 5, 3, IRON[3])
    cv.rect(26, 14, 10, 8, rgb('#13140f'))                     # painel
    for x in (28, 31, 34):
        cv.px(x, 18, rgb('#6a3a28'))
    cv.line(30, 4, 30, 10, IRON[2], 2)                         # escapamento
    cv.rect(5, 30, 4, 3, rgb('#101012')); cv.rect(33, 30, 4, 3, rgb('#101012'))
    rust_streaks(cv, 3, 10, 36, 20, seed + 2, 6)
    cv.finish(shadow=(21, 33, 38, 6))
    return cv


def spotlight(seed: int = 81) -> Cv:
    cv = Cv(30, 60)
    for x0, x1 in ((15, 5), (15, 25)):
        cv.line(x0, 28, x1, 55, IRON[2], 2)
    cv.line(15, 28, 15, 56, IRON[2], 2)
    cv.tex_rect(6, 10, 18, 16, IRON, seed, 2, 0.5)
    cv.rect(8, 12, 14, 12, rgb('#cfd8d8'))
    cv.rect(10, 14, 10, 8, rgb('#f2f6f2'))
    cv.line(6, 10, 23, 10, IRON[4])
    cv.finish(shadow=(15, 56, 26, 5))
    return cv


def boarded_window(seed: int = 91) -> Cv:
    cv = Cv(40, 52)
    cv.tex_rect(2, 2, 36, 46, CONCRETE_DARK, seed, 4, 0.4)
    cv.tex_rect(6, 6, 28, 38, [rgb('#0c0e10'), rgb('#141719')], seed + 1, 3, 0.2)
    r = rng(seed)
    for y in (10, 21, 32):
        cv.tex_poly([(2, y + r.randint(-1, 1)), (38, y), (38, y + 7), (2, y + 8)], WOOD_PALE, seed + y, 2.5, 0.5)
        for nx in (6, 33):
            cv.px(nx, y + 3, rgb('#bdb7a4')); cv.px(nx, y + 4, rgb('#3a352c'))
    cv.line(2, 47, 38, 47, CONCRETE[1], 2)
    moss_patch(cv, 2, 38, 36, 10, seed + 2, 0.4)
    cv.finish(shadow=None)
    return cv


def boarded_door(seed: int = 101) -> Cv:
    cv = Cv(40, 70)
    cv.tex_rect(2, 2, 36, 64, WOOD, seed, 3, 0.4)
    cv.rect(2, 2, 36, 3, WOOD[4]); cv.rect(2, 2, 3, 64, WOOD[3]); cv.rect(35, 2, 3, 64, WOOD[1])
    for y in (12, 28, 44):
        cv.tex_rect(0, y, 40, 8, WOOD_PALE, seed + y, 2.5, 0.5)
        for nx in (5, 34):
            cv.px(nx, y + 3, rgb('#bdb7a4')); cv.px(nx, y + 4, rgb('#3a352c'))
    # X pintado de vermelho
    cv.line(8, 14, 32, 58, rgb('#a3281f'), 3); cv.line(32, 14, 8, 58, rgb('#a3281f'), 3)
    for x in (12, 20, 28):
        cv.line(x, 54, x, 60, rgb('#a3281f'))
    cv.rect(0, 66, 40, 3, CONCRETE_DARK[1])
    moss_patch(cv, 2, 56, 36, 10, seed + 2, 0.4)
    cv.finish(shadow=None)
    return cv


def graffiti(lines: list[str], color: str, seed: int, drip: bool = True, w: int = 0) -> Cv:
    tw = max(text_width(l, 2) for l in lines) + 1
    cv = Cv(tw + 12, 10 + 8 * len(lines) + (6 if drip else 0))
    r = rng(seed)
    c = rgb(color)
    for i, ln in enumerate(lines):
        x = 6 + (tw - text_width(ln, 2) - 1) // 2 + r.randint(-1, 1)
        y = 4 + i * 8 + r.randint(-1, 1)
        text(cv, x, y, ln, c, gap=2)
        text(cv, x + 1, y, ln, c, gap=2)          # traço mais grosso
        if drip:
            for k in range(0, len(ln) * 5, 6):
                if r.random() < 0.45:
                    for d in range(r.randint(1, 5)):
                        cv.px(x + k + 1, y + 5 + d, c)
    cv.finish(outline=False)
    return cv


def cone(seed: int = 111) -> Cv:
    cv = Cv(18, 24)
    orange = ramp('#6a2a0e', '#8f3b14', '#b8501c', '#d96a28', '#f08a40')
    cv.tex_poly([(9, 2), (14, 18), (4, 18)], orange, seed, 2, 0.6)
    cv.poly([(7, 8), (11, 8), (12, 11), (6, 11)], rgb('#cfcbb8'))
    cv.rect(2, 18, 14, 3, rgb('#2a2824'))
    rust_streaks(cv, 4, 4, 10, 14, seed, 3)
    cv.finish(shadow=(9, 21, 16, 4))
    return cv


def sawhorse(seed: int = 121) -> Cv:
    cv = Cv(46, 34)
    cv.line(8, 14, 4, 30, WOOD[2], 3); cv.line(38, 14, 42, 30, WOOD[2], 3)
    cv.line(12, 14, 14, 30, WOOD[2], 3); cv.line(34, 14, 32, 30, WOOD[2], 3)
    for i, y in enumerate((4, 11)):
        cv.tex_rect(2, y, 42, 6, WOOD_PALE, seed + i, 2, 0.5)
        for x in range(4, 42, 8):
            cv.poly([(x, y), (x + 4, y), (x + 8, y + 5), (x + 4, y + 5)], rgb('#a8271f') if (x // 8) % 2 == 0 else rgb('#bcb7a4'))
    cv.finish(shadow=(23, 31, 40, 5))
    return cv


def build(sh: Sheet) -> None:
    tg = ['pós-apocalipse']
    sh.add(jersey(), 'barreira-concreto', 'Barreira de concreto', CAT, ['barreira', 'concreto', 'bloqueio'] + tg, solids=[solid(36, 12)], sort=4)
    sh.add(wood_barricade(), 'barricada-madeira', 'Barricada de madeira', CAT, ['barricada', 'madeira', 'bloqueio'] + tg, solids=[solid(32, 8)], sort=4)
    sh.add(sandbags(), 'sacos-areia', 'Muro de sacos de areia', CAT, ['sacos', 'areia', 'trincheira'] + tg, solids=[solid(32, 10)], sort=4)
    sh.add(chainlink(), 'cerca-arame', 'Cerca de arame', CAT, ['cerca', 'arame', 'bloqueio'] + tg, solids=[solid(30, 5)], sort=4)
    sh.add(barbed_coil(), 'arame-farpado', 'Rolo de arame farpado', CAT, ['arame', 'farpado', 'bloqueio'] + tg, solids=[solid(22, 6)], sort=3)

    red = ramp('#3a0f0d', '#5e1a15', '#822821', '#a3382d', '#c04a3c')
    sh.add(sign(['ZONA DE', 'QUARENTENA'], red, rgb('#e6e0cc'), 5, 48), 'placa-quarentena', 'Placa: Zona de quarentena', CAT, ['placa', 'sinal', 'quarentena'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(sign(['PERIGO', 'NAO ENTRE'], YELLOW, rgb('#1d1a12'), 6, 44), 'placa-perigo', 'Placa: Perigo, não entre', CAT, ['placa', 'sinal', 'perigo'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(sign(['ESTRADA', 'FECHADA'], IRON_LIGHT, rgb('#1d1f20'), 7, 40), 'placa-estrada', 'Placa: Estrada fechada', CAT, ['placa', 'sinal', 'estrada'] + tg, solids=[solid(3, 3)], sort=3)

    sh.add(crate(51, 1), 'caixote', 'Caixote militar', CAT, ['caixote', 'militar', 'suprimentos'] + tg, solids=[solid(15, 9)], sort=3)
    sh.add(crate(52, 2), 'caixotes-pilha', 'Pilha de caixotes militares', CAT, ['caixote', 'militar', 'pilha'] + tg, solids=[solid(15, 9)], sort=3)
    sh.add(crate(53, 1, True), 'caixote-aberto', 'Caixote aberto com suprimentos', CAT, ['caixote', 'militar', 'suprimentos'] + tg, solids=[solid(15, 9)], sort=3)
    sh.add(tent(), 'barraca-militar', 'Barraca militar', CAT, ['barraca', 'tenda', 'acampamento'] + tg, solids=[solid(40, 14)], sort=4)
    sh.add(generator(), 'gerador', 'Gerador portátil', CAT, ['gerador', 'acampamento'] + tg, solids=[solid(18, 9)], sort=3)
    sh.add(spotlight(), 'holofote', 'Holofote de posto de controle', CAT, ['holofote', 'luz', 'posto'] + tg, solids=[solid(5, 4)], sort=3,
           light={'x': 0, 'y': -40, 'radius': 150, 'color': '#e8f0ff', 'intensity': 0.85, 'flicker': 0.04})
    sh.add(cone(), 'cone', 'Cone de trânsito', CAT, ['cone', 'rua', 'bloqueio'] + tg, solids=[solid(5, 4)], sort=2)
    sh.add(sawhorse(), 'cavalete', 'Cavalete de bloqueio', CAT, ['cavalete', 'rua', 'bloqueio'] + tg, solids=[solid(20, 5)], sort=3)

    sh.add(boarded_window(), 'janela-tapada', 'Janela tapada com tábuas', CAT, ['janela', 'tábuas', 'parede'] + tg, kind='wall', sort=0)
    sh.add(boarded_door(), 'porta-tapada', 'Porta tapada com tábuas', CAT, ['porta', 'tábuas', 'parede'] + tg, kind='wall', sort=0)
    sh.add(graffiti(['NAO CONFIE', 'EM NINGUEM'], '#e8e4d0', 301), 'pichacao-confie', 'Pichação: Não confie em ninguém', CAT, ['pichação', 'parede', 'texto'] + tg, kind='wall', sort=0)
    sh.add(graffiti(['ONDE ESTA', 'A CURA?'], '#b3281e', 302), 'pichacao-cura', 'Pichação: Onde está a cura?', CAT, ['pichação', 'parede', 'texto'] + tg, kind='wall', sort=0)
    sh.add(graffiti(['AINDA', 'ESTAMOS VIVOS'], '#e6c84a', 303), 'pichacao-vivos', 'Pichação: Ainda estamos vivos', CAT, ['pichação', 'parede', 'texto'] + tg, kind='wall', sort=0)
