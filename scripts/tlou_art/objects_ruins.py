"""Objetos: ruínas, destroços, veículos abandonados e mobiliário urbano."""
from __future__ import annotations

import math

from .palettes import *  # noqa: F403
from .px import Cv, OUTLINE, rgb, rng, scatter, text
from .sheet import Sheet, solid

CAT = 'Apocalipse: Ruínas'
CAT_CITY = 'Apocalipse: Cidade'


# ── Auxiliares ───────────────────────────────────────────

def jag(cx: float, cy: float, rx: float, ry: float, n: int, jitter: float, seed: int) -> list[tuple[int, int]]:
    """Polígono irregular em volta de uma elipse (pedra, entulho)."""
    r = rng(seed)
    pts = []
    for i in range(n):
        a = i / n * math.tau + r.uniform(-0.2, 0.2)
        k = 1 + r.uniform(-jitter, jitter)
        pts.append((round(cx + math.cos(a) * rx * k), round(cy + math.sin(a) * ry * k)))
    return pts


def moss_patch(cv: Cv, x: int, y: int, w: int, h: int, seed: int, density: float = 0.6) -> None:
    """Manchinhas de musgo por cima do que já está desenhado (só onde há pixel)."""
    r = rng(seed)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if cv.get(xx, yy)[3] < 200:
                continue
            dx = (xx - x - w / 2) / (w / 2)
            dy = (yy - y - h / 2) / (h / 2)
            if dx * dx + dy * dy < 1 and r.random() < density * (1 - (dx * dx + dy * dy) * 0.7):
                cv.px(xx, yy, MOSS[r.randint(1, 4)])


def rust_streaks(cv: Cv, x: int, y: int, w: int, h: int, seed: int, n: int = 8) -> None:
    r = rng(seed)
    for _ in range(n):
        xx = r.randint(x, x + w - 1)
        yy = r.randint(y, y + h - 1)
        ln = r.randint(2, max(3, h // 2))
        for k in range(ln):
            if cv.get(xx, yy + k)[3] > 200:
                cv.px(xx, yy + k, RUST[r.randint(1, 3)])


def crack(cv: Cv, x: int, y: int, ln: int, seed: int, c=None) -> None:
    c = c or rgb('#15130f')
    r = rng(seed)
    for _ in range(ln):
        if cv.get(x, y)[3] > 200:
            cv.px(x, y, c)
        x += r.choice((-1, 0, 1, 1))
        y += 1 if r.random() < 0.7 else 0


def chunk(cv: Cv, cx: int, cy: int, rx: int, ry: int, seed: int, rp=CONCRETE) -> None:
    cv.tex_poly(jag(cx, cy, rx, ry, 7, 0.28, seed), rp, seed, scale=2.5, light=0.55)


# ── Destroços ────────────────────────────────────────────

def rubble(seed: int = 11, size: int = 0) -> Cv:
    w, h = (56, 38) if size == 0 else (34, 24)
    cv = Cv(w, h)
    r = rng(seed)
    base = h - 5
    spec = ([(18, base - 8, 14, 9), (36, base - 6, 13, 8), (27, base - 14, 11, 8), (9, base - 3, 7, 5), (47, base - 3, 7, 5)]
            if size == 0 else [(12, base - 6, 9, 6), (24, base - 4, 8, 5), (18, base - 11, 7, 5)])
    for i, (cx, cy, rx, ry) in enumerate(spec):
        chunk(cv, cx, cy, rx, ry, seed + i * 7, CONCRETE if i % 2 == 0 else CONCRETE_DARK)
    # vergalhões saindo
    for _ in range(3 if size == 0 else 2):
        x0 = r.randint(8, w - 8)
        y0 = r.randint(base - 14, base - 6)
        cv.line(x0, y0, x0 + r.randint(-5, 5), y0 - r.randint(6, 11), RUST[2])
        cv.px(x0, y0, RUST[3])
    scatter(cv, r, 18, (4, base - 18, w - 5, base), [CONCRETE[4], CONCRETE[0]])
    moss_patch(cv, 6, base - 16, w - 14, 10, seed + 5, 0.35)
    cv.finish(shadow=(w // 2, h - 3, w - 8, 7))
    return cv


def slab(seed: int = 21) -> Cv:
    cv = Cv(64, 36)
    top = [(6, 14), (52, 6), (60, 16), (14, 26)]
    front = [(14, 26), (60, 16), (60, 21), (14, 31)]
    cv.tex_poly(front, CONCRETE_DARK, seed, 3.0, 0.5)
    cv.tex_poly(top, CONCRETE, seed + 1, 3.5, 0.6)
    cv.line(6, 14, 14, 26, CONCRETE[1])
    crack(cv, 28, 14, 10, seed + 2)
    crack(cv, 44, 10, 8, seed + 3)
    r = rng(seed)
    for x0 in (12, 18, 24):  # armação aparecendo na quebra
        cv.line(x0, 26, x0 - 2, 30, RUST[2])
    scatter(cv, r, 10, (8, 8, 58, 26), [CONCRETE[4]])
    moss_patch(cv, 34, 12, 22, 9, seed + 4, 0.5)
    cv.finish(shadow=(32, 33, 56, 6))
    return cv


def rebar_pillar(seed: int = 31) -> Cv:
    cv = Cv(28, 50)
    cv.tex_poly([(6, 14), (22, 12), (23, 44), (5, 44)], CONCRETE, seed, 3, 0.5)
    cv.tex_poly([(5, 44), (23, 44), (25, 47), (3, 47)], CONCRETE_DARK, seed + 1, 3, 0.5)
    # topo quebrado, em dentes
    cv.poly([(6, 14), (9, 9), (12, 13), (15, 7), (18, 12), (22, 12)], CONCRETE[3])
    r = rng(seed)
    for x0 in (8, 12, 16, 20):
        cv.line(x0, 11, x0 + r.randint(-2, 2), 1 + r.randint(0, 4), RUST[2])
        cv.px(x0, 11, RUST[4])
    crack(cv, 14, 18, 14, seed + 2)
    crack(cv, 9, 26, 9, seed + 3)
    rust_streaks(cv, 6, 14, 16, 22, seed + 4, 6)
    moss_patch(cv, 4, 36, 20, 10, seed + 5, 0.6)
    cv.finish(shadow=(14, 47, 24, 6))
    return cv


def tire_stack(seed: int = 41) -> Cv:
    cv = Cv(30, 30)
    for i, y in enumerate((18, 10, 2)):
        cv.tex_rect(3, y + 4, 24, 8, [rgb('#0f0f0f'), rgb('#1b1b1b'), rgb('#292826')], seed + i, 1.5, 0.3)
        cv.tex_ell(3, y, 24, 10, [rgb('#171717'), rgb('#232323'), rgb('#33322f')], seed + i + 5, 1.5, 0.3)
        cv.ell(10, y + 2, 10, 6, rgb('#0a0a0a'))
        cv.ell(12, y + 3, 6, 3, rgb('#222120'))
    moss_patch(cv, 4, 0, 22, 8, seed, 0.25)
    cv.finish(shadow=(15, 27, 28, 6))
    return cv


def trash_bags(seed: int = 51) -> Cv:
    cv = Cv(32, 24)
    bag = ramp_bag = [rgb('#0e0f10'), rgb('#1a1c1d'), rgb('#2a2d2e'), rgb('#3c4042'), rgb('#555a5c')]
    cv.tex_ell(2, 8, 14, 12, bag, seed, 2, 0.6)
    cv.tex_ell(14, 6, 15, 14, bag, seed + 3, 2, 0.6)
    cv.tex_ell(8, 2, 13, 12, bag, seed + 6, 2, 0.6)
    for (x, y) in ((9, 3), (21, 7), (8, 9)):
        cv.px(x, y, rgb('#6c7173'))
        cv.px(x + 1, y, rgb('#6c7173'))
    r = rng(seed)
    scatter(cv, r, 6, (4, 4, 28, 20), [rgb('#8a8a7a'), rgb('#5b6b3a')], True)
    cv.finish(shadow=(16, 21, 30, 6))
    return cv


def dumpster(seed: int = 61) -> Cv:
    cv = Cv(64, 48)
    # tampa aberta atrás (inclinada) e corpo
    cv.tex_poly([(6, 6), (58, 6), (60, 16), (4, 16)], PLASTIC_GREEN, seed, 3, 0.5)
    cv.tex_rect(4, 16, 56, 24, PLASTIC_GREEN, seed + 1, 4, 0.55)
    cv.rect(4, 16, 56, 3, rgb('#1a3324'))                 # borda
    for x in (14, 26, 38, 50):                             # nervuras
        cv.line(x, 20, x, 39, rgb('#183221'))
    cv.rect(4, 38, 56, 2, rgb('#10241a'))
    cv.rect(10, 40, 8, 4, rgb('#17171a'))                 # rodinhas
    cv.rect(46, 40, 8, 4, rgb('#17171a'))
    r = rng(seed)
    rust_streaks(cv, 4, 16, 56, 22, seed + 2, 14)
    text(cv, 20, 25, 'LIXO', rgb('#c9d3c0'))
    for _ in range(3):
        crack(cv, r.randint(8, 56), 18, 6, seed + r.randint(0, 99), rgb('#0f2418'))
    moss_patch(cv, 6, 6, 52, 6, seed + 3, 0.3)
    cv.finish(shadow=(32, 45, 60, 7))
    return cv


def shopping_cart(seed: int = 71) -> Cv:
    cv = Cv(32, 30)
    c1, c2 = IRON_LIGHT[3], IRON_LIGHT[1]
    cv.poly([(4, 6), (27, 6), (24, 20), (8, 20)], rgb('#1a1d20', 90))
    for x in range(5, 27, 3):
        cv.line(x, 6, x - (x - 15) // 6, 19, c1)
    for y in (8, 12, 16):
        cv.line(5 + (y - 6) // 3, y, 26 - (y - 6) // 3, y, c2)
    cv.line(4, 6, 27, 6, c1, 2)
    cv.line(2, 3, 6, 6, c1, 2)       # alça
    cv.line(2, 3, 2, 8, c1, 1)
    cv.line(8, 20, 24, 20, c2, 2)
    for x in (9, 23):
        cv.ell(x - 2, 22, 5, 5, rgb('#101213'))
        cv.px(x, 24, IRON_LIGHT[2])
    rust_streaks(cv, 4, 6, 24, 14, seed, 6)
    cv.finish(shadow=(16, 27, 26, 5))
    return cv


# ── Veículos ─────────────────────────────────────────────

def wheel(cv: Cv, cx: int, cy: int, r: int, flat: bool = False) -> None:
    if flat:
        cv.ell(cx - r, cy - r + 3, r * 2, r * 2 - 3, rgb('#0d0d0e'))
    else:
        cv.ell(cx - r, cy - r, r * 2, r * 2, rgb('#0d0d0e'))
    cv.ell(cx - r + 2, cy - r + 2 + (3 if flat else 0), r * 2 - 4, r * 2 - 4 - (3 if flat else 0), rgb('#222324'))
    cv.ell(cx - 3, cy - 3 + (3 if flat else 0), 6, 6, IRON[3])
    cv.px(cx, cy + (3 if flat else 0), IRON[1])


def car(body: list, seed: int, label_wear: int = 1, flat_front: bool = False) -> Cv:
    """Carro de lado, virado pra direita."""
    cv = Cv(92, 48)
    # corpo baixo
    cv.tex_poly([(4, 24), (10, 18), (82, 18), (89, 25), (89, 36), (4, 36)], body, seed, 4, 0.55)
    # cabine
    cv.tex_poly([(24, 18), (30, 6), (58, 6), (68, 18)], body, seed + 1, 4, 0.55)
    # vidros
    cv.poly([(28, 17), (32, 9), (42, 9), (42, 17)], GLASS[2])
    cv.poly([(45, 17), (45, 9), (57, 9), (64, 17)], GLASS[1])
    cv.line(32, 9, 40, 9, GLASS[4])
    cv.line(31, 11, 31, 15, GLASS[4])
    crack(cv, 49, 10, 6, seed + 2, GLASS[0])                      # vidro trincado
    cv.line(42, 9, 42, 17, body[1], 2)                            # coluna
    # faixa de moldura e portas
    cv.line(10, 25, 87, 25, body[1])
    cv.line(43, 18, 43, 35, body[1])
    cv.line(66, 19, 68, 35, body[1])
    cv.rect(36, 27, 4, 1, body[4])                                 # maçaneta
    cv.rect(60, 27, 4, 1, body[4])
    # para-choques e faróis
    cv.rect(2, 31, 6, 5, IRON_LIGHT[1]); cv.rect(84, 31, 6, 5, IRON_LIGHT[1])
    cv.rect(84, 24, 4, 4, rgb('#d8d4a4') if label_wear == 0 else GLASS[1])
    cv.rect(3, 24, 3, 3, rgb('#7a2a22'))
    # rodas
    wheel(cv, 20, 36, 7)
    wheel(cv, 72, 36, 7, flat=flat_front)
    cv.rect(4, 36, 85, 2, rgb('#101012'))
    # desgaste: ferrugem, musgo, riscos
    r = rng(seed)
    for _ in range(5):
        x0 = r.randint(8, 80)
        cv.tex_ell(x0, r.randint(26, 33), r.randint(5, 11), r.randint(3, 5), RUST, seed + x0, 1.5, 0.3)
    rust_streaks(cv, 6, 24, 80, 12, seed + 3, 10)
    moss_patch(cv, 28, 4, 38, 8, seed + 4, 0.35)
    moss_patch(cv, 6, 18, 20, 8, seed + 5, 0.25)
    cv.finish(shadow=(46, 44, 86, 8))
    return cv


def van(body: list, seed: int) -> Cv:
    cv = Cv(100, 56)
    cv.tex_poly([(4, 14), (66, 14), (80, 24), (96, 28), (96, 44), (4, 44)], body, seed, 4, 0.55)
    cv.tex_rect(4, 14, 62, 30, body, seed + 1, 4, 0.5)
    cv.poly([(68, 17), (78, 25), (90, 28), (68, 28)], GLASS[2])
    cv.line(72, 18, 78, 25, GLASS[4])
    cv.line(10, 24, 62, 24, body[1])
    cv.line(35, 14, 35, 44, body[1])
    cv.rect(26, 32, 3, 1, body[4]); cv.rect(40, 32, 3, 1, body[4])
    cv.rect(2, 38, 6, 5, IRON_LIGHT[1]); cv.rect(92, 38, 6, 5, IRON_LIGHT[1])
    wheel(cv, 22, 44, 8)
    wheel(cv, 78, 44, 8)
    cv.rect(4, 44, 92, 2, rgb('#101012'))
    r = rng(seed)
    for _ in range(7):
        x0 = r.randint(8, 86)
        cv.tex_ell(x0, r.randint(20, 40), r.randint(6, 12), r.randint(3, 6), RUST, seed + x0, 1.5, 0.3)
    rust_streaks(cv, 6, 14, 90, 30, seed + 3, 14)
    text(cv, 10, 18, 'SOCORRO', rgb('#d8d4c4'))
    moss_patch(cv, 6, 12, 60, 8, seed + 4, 0.3)
    cv.finish(shadow=(50, 52, 94, 8))
    return cv


# ── Mobiliário urbano ───────────────────────────────────

def street_lamp(seed: int = 81) -> Cv:
    cv = Cv(26, 80)
    cv.tex_rect(11, 10, 4, 66, IRON, seed, 2, 0.5)
    cv.rect(8, 72, 10, 5, IRON[2]); cv.rect(7, 76, 12, 2, IRON[1])
    cv.line(13, 10, 13, 6, IRON[2], 3)
    cv.line(13, 6, 20, 4, IRON[3], 2)           # braço
    cv.poly([(17, 3), (25, 3), (24, 8), (18, 8)], IRON[1])
    cv.rect(18, 8, 6, 2, rgb('#3c4a40'))         # lâmpada apagada/quebrada
    cv.px(20, 9, rgb('#7a8d85'))
    rust_streaks(cv, 11, 10, 4, 60, seed, 8)
    moss_patch(cv, 8, 66, 10, 10, seed + 1, 0.5)
    cv.finish(shadow=(13, 77, 18, 5))
    return cv


def traffic_light(seed: int = 91) -> Cv:
    cv = Cv(24, 72)
    cv.tex_rect(10, 20, 4, 50, IRON, seed, 2, 0.5)
    cv.rect(7, 66, 10, 4, IRON[2])
    cv.tex_rect(5, 2, 14, 22, [rgb('#12130f'), rgb('#1c1e18'), rgb('#2a2d25')], seed + 1, 2, 0.4)
    for i, c in enumerate((rgb('#4a1c18'), rgb('#4a4318'), rgb('#18401f'))):
        cv.ell(8, 4 + i * 7, 8, 6, c)
        cv.px(10, 5 + i * 7, rgb('#ffffff', 70))
    cv.line(10, 9, 14, 11, rgb('#0b0b0b'))      # trinca
    rust_streaks(cv, 5, 2, 14, 22, seed + 2, 6)
    moss_patch(cv, 6, 58, 12, 10, seed + 3, 0.5)
    cv.finish(shadow=(12, 69, 16, 5))
    return cv


def hydrant(seed: int = 101) -> Cv:
    cv = Cv(20, 28)
    red = ramp('#3a0f0d', '#5e1a15', '#822821', '#a3382d', '#c04a3c')
    cv.tex_rect(6, 8, 8, 14, red, seed, 2, 0.6)
    cv.tex_ell(5, 3, 10, 8, red, seed + 1, 2, 0.6)
    cv.rect(2, 12, 16, 3, red[2]); cv.rect(3, 12, 14, 1, red[4])
    cv.rect(4, 21, 12, 3, red[1])
    cv.px(10, 4, red[4])
    rust_streaks(cv, 4, 4, 12, 18, seed + 2, 5)
    moss_patch(cv, 3, 20, 14, 5, seed + 3, 0.5)
    cv.finish(shadow=(10, 25, 16, 5))
    return cv


def mailbox(seed: int = 111) -> Cv:
    cv = Cv(22, 34)
    blue = ramp('#16243a', '#243a5a', '#355079', '#476a9a', '#5f87b9')
    cv.rect(10, 16, 3, 15, IRON[1])
    cv.tex_poly([(3, 6), (6, 2), (17, 2), (20, 6), (20, 16), (3, 16)], blue, seed, 2, 0.6)
    cv.rect(5, 10, 13, 2, blue[1])
    cv.rect(16, 4, 2, 4, rgb('#aa3a30'))
    rust_streaks(cv, 3, 3, 17, 13, seed + 1, 6)
    cv.finish(shadow=(11, 31, 14, 5))
    return cv


def bench(seed: int = 121) -> Cv:
    cv = Cv(56, 32)
    for x in (6, 44):
        cv.rect(x, 10, 4, 14, IRON[2]); cv.rect(x - 1, 22, 6, 3, IRON[1])
    for i, y in enumerate((8, 12, 16)):
        if i == 1:
            cv.tex_rect(4, y, 22, 3, WOOD, seed + i, 2, 0.5)   # tábua quebrada no meio
            cv.tex_rect(32, y, 20, 3, WOOD, seed + i + 9, 2, 0.5)
        else:
            cv.tex_rect(4, y, 48, 3, WOOD, seed + i, 2, 0.5)
    cv.tex_rect(4, 2, 48, 3, WOOD_PALE, seed + 7, 2, 0.5)       # encosto
    cv.tex_rect(4, 4, 48, 2, WOOD, seed + 8, 2, 0.5)
    rust_streaks(cv, 4, 8, 48, 14, seed, 5)
    moss_patch(cv, 8, 6, 40, 14, seed + 2, 0.18)
    cv.finish(shadow=(28, 28, 50, 6))
    return cv


def brick_wall(seed: int = 131, hole: bool = True) -> Cv:
    cv = Cv(72, 52)
    r = rng(seed)
    top = [(0, 12), (6, 8), (14, 12), (22, 5), (30, 9), (38, 4), (48, 10), (58, 6), (66, 11), (71, 9)]
    pts = top + [(71, 46), (0, 46)]
    cv.tex_poly(pts, BRICK, seed, 5, 0.5, 0.12)
    # fiadas de tijolo
    for row, y in enumerate(range(10, 46, 5)):
        cv.line(0, y, 71, y, BRICK[0])
        off = 0 if row % 2 == 0 else 5
        for x in range(off, 72, 10):
            cv.line(x, y, x, y + 4, BRICK[0])
    if hole:
        cv.poly([(26, 26), (38, 22), (46, 30), (40, 42), (28, 42)], rgb('#120d0b'))
        cv.line(26, 26, 38, 22, BRICK[4])
    for x in range(0, 72, 6):               # lascas faltando
        if r.random() < 0.3:
            cv.px(x + r.randint(0, 4), r.randint(12, 44), CONCRETE[3])
    moss_patch(cv, 0, 38, 72, 10, seed + 1, 0.6)
    moss_patch(cv, 2, 8, 26, 10, seed + 2, 0.3)
    cv.rect(0, 46, 72, 3, CONCRETE_DARK[1])
    cv.finish(shadow=(36, 49, 70, 6))
    return cv


# ── Decalques no chão ───────────────────────────────────

def papers(seed: int = 141) -> Cv:
    cv = Cv(38, 22)
    r = rng(seed)
    for _ in range(7):
        x, y = r.randint(2, 28), r.randint(2, 14)
        w, h = r.randint(7, 11), r.randint(5, 8)
        tone = r.choice((rgb('#b9b6a6'), rgb('#a29f90'), rgb('#cfccbb'), rgb('#8e8b7c')))
        cv.rect(x, y, w, h, tone)
        for ly in range(y + 2, y + h - 1, 2):
            cv.line(x + 1, ly, x + w - 2, ly, rgb('#6f6c60'))
    cv.finish(outline=True)
    return cv


def glass_shards(seed: int = 151) -> Cv:
    cv = Cv(32, 20)
    r = rng(seed)
    for _ in range(11):
        x, y = r.randint(2, 28), r.randint(2, 15)
        s = r.randint(2, 5)
        cv.poly([(x, y), (x + s, y + 1), (x + s // 2, y + s)], GLASS[r.randint(2, 4)])
        cv.px(x + 1, y, rgb('#e9f6f6'))
    cv.finish(outline=False)
    return cv


def build(sh: Sheet) -> None:
    tg = ['pós-apocalipse']
    sh.add(rubble(11, 0), 'entulho', 'Entulho de concreto', CAT, ['entulho', 'destroços', 'ruína'] + tg, solids=[solid(21, 14)], sort=4)
    sh.add(rubble(17, 1), 'entulho-pequeno', 'Entulho pequeno', CAT, ['entulho', 'destroços'] + tg, solids=[solid(11, 7)], sort=3)
    sh.add(slab(), 'laje', 'Laje de concreto caída', CAT, ['laje', 'concreto', 'ruína'] + tg, solids=[solid(26, 10)], sort=3)
    sh.add(rebar_pillar(), 'pilar-quebrado', 'Pilar quebrado com vergalhões', CAT, ['pilar', 'concreto', 'ruína'] + tg, solids=[solid(9, 8)], sort=3)
    sh.add(tire_stack(), 'pneus', 'Pilha de pneus', CAT, ['pneu', 'borracha', 'barricada'] + tg, solids=[solid(11, 8)], sort=3)
    sh.add(trash_bags(), 'sacos-lixo', 'Sacos de lixo', CAT, ['lixo', 'saco'] + tg, solids=[solid(12, 8)], sort=3)
    sh.add(dumpster(), 'cacamba', 'Caçamba de lixo', CAT_CITY, ['lixo', 'caçamba', 'rua'] + tg, solids=[solid(26, 12)], sort=4)
    sh.add(shopping_cart(), 'carrinho', 'Carrinho de supermercado', CAT_CITY, ['carrinho', 'loja', 'rua'] + tg, solids=[solid(10, 6)], sort=3)

    cars = [('vermelho', CAR_RED, 'Carro abandonado (vermelho desbotado)'), ('azul', CAR_BLUE, 'Carro abandonado (azul)'),
            ('branco', CAR_WHITE, 'Carro abandonado (branco sujo)'), ('amarelo', CAR_YELLOW, 'Táxi abandonado'),
            ('verde', CAR_GREEN, 'Carro abandonado (verde)')]
    for i, (key, body, label) in enumerate(cars):
        sh.add(car(body, 200 + i * 13, 1, flat_front=(i % 2 == 1)), f'carro-{key}', label, CAT_CITY, ['carro', 'veículo', 'rua'] + tg,
               solids=[solid(40, 12)], sort=5, group='carro-vermelho' if i else None, variant=key.capitalize() if i else None)
    sh.add(van(CAR_WHITE, 300), 'van', 'Van abandonada', CAT_CITY, ['van', 'veículo', 'rua'] + tg, solids=[solid(44, 14)], sort=5)

    sh.add(street_lamp(), 'poste-luz', 'Poste de luz apagado', CAT_CITY, ['poste', 'luz', 'rua'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(traffic_light(), 'semaforo', 'Semáforo apagado', CAT_CITY, ['semáforo', 'rua'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(hydrant(), 'hidrante', 'Hidrante enferrujado', CAT_CITY, ['hidrante', 'rua'] + tg, solids=[solid(5, 4)], sort=3)
    sh.add(mailbox(), 'caixa-correio', 'Caixa de correio', CAT_CITY, ['correio', 'rua'] + tg, solids=[solid(5, 4)], sort=3)
    sh.add(bench(), 'banco-pracas', 'Banco de praça quebrado', CAT_CITY, ['banco', 'praça', 'rua'] + tg, solids=[solid(24, 6)], sort=3)
    sh.add(brick_wall(131, True), 'muro-tijolos', 'Muro de tijolos desabado', CAT, ['muro', 'tijolo', 'ruína'] + tg, solids=[solid(35, 6)], sort=4)

    sh.add(papers(), 'papeis', 'Papéis espalhados', CAT, ['papel', 'lixo'] + tg, kind='floor', sort=0)
    sh.add(glass_shards(), 'vidro-quebrado', 'Vidro estilhaçado', CAT, ['vidro', 'cacos'] + tg, kind='floor', sort=0)
