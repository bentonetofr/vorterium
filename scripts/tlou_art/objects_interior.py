"""Objetos de interior que faltavam no catálogo: banheiro, cozinha industrial, loja, escritório, escola, lanchonete, delegacia.

Folha `tlou-interior`. Usados pelos interiores detalhados do mundo "Nova York" (nyc_floor.py / nyc_buildings.py / nyc_inner.py).
"""
from __future__ import annotations

from .objects_roads import BLACKISH, SIGN_GREEN, SIGN_RED, WHITE
from .objects_ruins import moss_patch, rust_streaks
from .palettes import *  # noqa: F403
from .px import Cv, _hash, rgb, rng, scatter, text, text_width
from .sheet import Sheet, solid

CAT = 'Apocalipse: Interiores'
CERAMIC = ramp('#6d7478', '#8f979b', '#b2babd', '#d2d8da', '#eef2f3')
STEEL = ramp('#2e3438', '#4a5258', '#6a747a', '#8d989f', '#b4bfc5')
VINYL_RED = ramp('#2c0d0d', '#4d1616', '#722020', '#982d2d', '#b84444')
VINYL_TEAL = ramp('#0d2a2a', '#164a4a', '#206f6f', '#2d9494', '#44b4b4')
LOCKER_BLUE = ramp('#14212e', '#22384e', '#325472', '#4672a0', '#5f90c4')
PAPER = ramp('#7a7160', '#9c9280', '#bdb39f', '#d9cfba', '#efe6d2')


def _wear(cv: Cv, seed: int, rust: int = 4, moss: float = 0.0, mx: tuple[int, int, int, int] | None = None) -> None:
    rust_streaks(cv, 2, 2, cv.w - 4, cv.h - 4, seed, rust)
    if moss and mx:
        moss_patch(cv, mx[0], mx[1], mx[2], mx[3], seed + 1, moss)


def _stain(cv: Cv, seed: int, n: int = 6, c=rgb('#4a3a22')) -> None:
    r = rng(seed)
    for _ in range(n):
        x, y = r.randint(3, cv.w - 4), r.randint(3, cv.h - 4)
        if cv.get(x, y)[3] > 200:
            cv.px(x, y, c); cv.px(x + 1, y, c)


# ── Banheiro ───────────────────────────────────────────────

def toilet(seed: int = 1) -> Cv:
    cv = Cv(24, 30)
    cv.tex_rect(5, 3, 14, 9, CERAMIC, seed, 2, 0.5)                 # caixa acoplada
    cv.rect(8, 4, 8, 1, CERAMIC[4]); cv.px(18, 5, STEEL[3])
    cv.tex_ell(4, 10, 16, 14, CERAMIC, seed + 1, 2, 0.5)            # bacia
    cv.ell(7, 12, 10, 8, CERAMIC[1]); cv.ell(8, 13, 8, 5, rgb('#2d3a40'))
    cv.rect(6, 22, 12, 4, CERAMIC[2])
    _stain(cv, seed, 5, rgb('#6a5a30'))
    cv.finish(shadow=(12, 27, 20, 4))
    return cv


def bath_sink(seed: int = 2) -> Cv:
    cv = Cv(28, 38)
    cv.tex_rect(10, 20, 8, 14, CERAMIC, seed, 2, 0.5)               # coluna
    cv.tex_ell(3, 10, 22, 14, CERAMIC, seed + 1, 2, 0.5)            # pia
    cv.ell(6, 12, 16, 8, CERAMIC[1]); cv.ell(8, 13, 12, 5, rgb('#2d3a40'))
    cv.rect(12, 5, 4, 7, STEEL[3]); cv.rect(10, 5, 8, 2, STEEL[4])  # torneira
    _stain(cv, seed, 4)
    cv.finish(shadow=(14, 35, 22, 4))
    return cv


def bathtub(seed: int = 3) -> Cv:
    cv = Cv(68, 36)
    cv.tex_poly([(2, 10), (66, 10), (66, 28), (58, 33), (10, 33), (2, 28)], CERAMIC, seed, 3, 0.5)
    cv.poly([(6, 14), (62, 14), (62, 26), (56, 29), (12, 29), (6, 26)], rgb('#2a3a40'))
    cv.poly([(8, 15), (60, 15), (60, 20), (8, 20)], rgb('#3a5058'))
    cv.rect(60, 4, 3, 8, STEEL[3]); cv.rect(57, 4, 9, 2, STEEL[4])
    _stain(cv, seed, 8, rgb('#5a4a28'))
    moss_patch(cv, 8, 22, 50, 8, seed, 0.25)
    cv.finish(shadow=(34, 33, 62, 5))
    return cv


def shower(seed: int = 4) -> Cv:
    cv = Cv(40, 72)
    cv.tex_rect(2, 6, 36, 62, CERAMIC, seed, 3, 0.4)
    cv.rect(4, 10, 32, 54, rgb('#26343a'))
    cv.rect(5, 12, 30, 2, STEEL[3])
    cv.rect(18, 6, 4, 8, STEEL[3]); cv.ell(15, 12, 10, 4, STEEL[4])      # chuveiro
    for x in range(4, 36, 6):                                           # cortina rasgada
        cv.rect(x, 14, 4, 46, rgb('#7f9a8e') if (x // 6) % 2 else rgb('#6e8a7e'))
    for _ in range(4):
        cv.rect(rng(seed + _).randint(6, 30), 40, 3, 20, (0, 0, 0, 0))
    _stain(cv, seed, 6)
    moss_patch(cv, 3, 56, 34, 12, seed, 0.4)
    cv.finish(shadow=(20, 68, 34, 5))
    return cv


def bath_mirror(seed: int = 5) -> Cv:
    cv = Cv(32, 40)
    cv.tex_rect(2, 2, 28, 34, WOOD, seed, 2, 0.5)
    cv.rect(5, 5, 22, 28, rgb('#60767a')); cv.poly([(6, 6), (14, 6), (6, 18)], rgb('#a8bcc0'))
    cv.poly([(16, 20), (26, 20), (26, 32), (20, 32)], rgb('#101820'))           # lasca
    _stain(cv, seed, 3)
    cv.finish(shadow=None)
    return cv


def washer(seed: int = 6) -> Cv:
    cv = Cv(32, 40)
    cv.tex_rect(3, 4, 26, 32, CERAMIC, seed, 2, 0.5)
    cv.ell(7, 14, 18, 18, STEEL[1]); cv.ell(9, 16, 14, 14, rgb('#1d2a2e')); cv.ell(10, 17, 6, 4, rgb('#5a7a82'))
    cv.rect(6, 6, 20, 4, STEEL[2]); cv.rect(8, 7, 3, 2, SIGN_RED[3])
    _wear(cv, seed, 5, 0.3, (3, 24, 26, 12))
    cv.finish(shadow=(16, 37, 26, 4))
    return cv


def fridge(seed: int = 7) -> Cv:
    cv = Cv(34, 72)
    cv.tex_rect(3, 4, 28, 64, CERAMIC, seed, 3, 0.5)
    cv.rect(3, 24, 28, 2, CERAMIC[0])
    cv.rect(26, 10, 2, 10, STEEL[3]); cv.rect(26, 30, 2, 18, STEEL[3])
    cv.rect(5, 6, 24, 1, CERAMIC[4])
    _wear(cv, seed, 9, 0.35, (3, 50, 28, 18))
    _stain(cv, seed, 8)
    cv.finish(shadow=(17, 69, 28, 4))
    return cv


def freezer_chest(seed: int = 8) -> Cv:
    cv = Cv(68, 40)
    cv.tex_rect(2, 12, 64, 24, CERAMIC, seed, 3, 0.5)
    cv.tex_rect(4, 6, 60, 10, [rgb('#5a727a'), rgb('#7a949c'), rgb('#9ab4bc'), rgb('#bad0d6'), rgb('#e0eef0')], seed + 1, 3, 0.5)
    cv.rect(2, 16, 64, 2, STEEL[2])
    for x in range(8, 62, 14):
        cv.rect(x, 20, 8, 2, CERAMIC[3])
    _wear(cv, seed, 7, 0.25, (2, 26, 64, 10))
    cv.finish(shadow=(34, 37, 62, 4))
    return cv


def stove_hood(seed: int = 9) -> Cv:
    """Coifa de cozinha industrial (na parede)."""
    cv = Cv(64, 44)
    cv.tex_poly([(4, 6), (60, 6), (64, 36), (0, 36)], STEEL, seed, 3, 0.5)
    cv.rect(0, 34, 64, 4, STEEL[1]); cv.rect(2, 8, 60, 1, STEEL[4])
    for x in range(8, 58, 8):
        cv.rect(x, 22, 4, 10, STEEL[0])
    _wear(cv, seed, 8, 0.2, (2, 28, 60, 8))
    cv.finish(shadow=None)
    return cv


def industrial_stove(seed: int = 10) -> Cv:
    cv = Cv(52, 54)
    cv.tex_rect(2, 14, 48, 34, STEEL, seed, 3, 0.5)
    cv.rect(2, 14, 48, 3, STEEL[4])
    for i, x in enumerate((8, 22, 36)):                              # bocas
        cv.ell(x, 17, 10, 6, rgb('#14171a')); cv.ell(x + 2, 18, 6, 3, rgb('#2a2e33'))
    for x in (8, 20, 32, 44):
        cv.rect(x, 36, 4, 4, STEEL[3])
    cv.rect(4, 44, 44, 2, STEEL[0])
    _wear(cv, seed, 9, 0.2, (2, 38, 48, 10))
    _stain(cv, seed, 10, rgb('#2a2018'))
    cv.finish(shadow=(26, 51, 46, 4))
    return cv


def steel_table(seed: int = 11) -> Cv:
    cv = Cv(68, 36)
    cv.tex_rect(2, 6, 64, 12, STEEL, seed, 3, 0.55)
    cv.rect(2, 6, 64, 2, STEEL[4]); cv.rect(2, 17, 64, 2, STEEL[1])
    for x in (6, 58):
        cv.rect(x, 19, 3, 12, STEEL[2])
    cv.rect(6, 28, 56, 2, STEEL[1])
    _wear(cv, seed, 6, 0.2, (2, 8, 64, 8))
    cv.finish(shadow=(34, 32, 62, 4))
    return cv


def steel_sink(seed: int = 12) -> Cv:
    cv = Cv(68, 52)
    cv.tex_rect(2, 14, 64, 30, STEEL, seed, 3, 0.5)
    cv.rect(2, 14, 64, 3, STEEL[4])
    cv.rect(6, 19, 24, 14, STEEL[0]); cv.rect(8, 21, 20, 10, rgb('#22292d'))
    cv.rect(36, 19, 24, 14, STEEL[0]); cv.rect(38, 21, 20, 10, rgb('#22292d'))
    cv.rect(31, 4, 4, 12, STEEL[3]); cv.rect(26, 4, 14, 3, STEEL[4])
    _wear(cv, seed, 8, 0.25, (2, 34, 64, 10))
    cv.finish(shadow=(34, 49, 62, 4))
    return cv


def steel_shelf(seed: int = 13) -> Cv:
    cv = Cv(52, 72)
    for x in (3, 47):
        cv.rect(x, 8, 3, 60, STEEL[2])
    for i, y in enumerate((14, 30, 46, 60)):
        cv.tex_rect(3, y, 47, 4, STEEL, seed + i, 3, 0.5)
        r = rng(seed + i)
        for k in range(4):                                             # caixas
            w = r.randint(8, 12)
            cv.tex_rect(6 + k * 11, y - 11, w, 11, PAPER, seed + k + i, 2, 0.5)
            cv.rect(6 + k * 11, y - 7, w, 1, PAPER[1])
    _wear(cv, seed, 6, 0.15, (3, 56, 46, 12))
    cv.finish(shadow=(26, 69, 46, 4))
    return cv


def cooler_door(seed: int = 14) -> Cv:
    cv = Cv(52, 72)
    cv.tex_rect(2, 4, 48, 66, STEEL, seed, 3, 0.45)
    cv.rect(6, 8, 40, 58, STEEL[1]); cv.rect(8, 10, 36, 54, STEEL[2])
    cv.rect(38, 34, 4, 14, STEEL[4]); cv.rect(38, 34, 1, 14, rgb('#e0e8ec'))
    cv.rect(10, 18, 22, 9, rgb('#e8e0c0')); text(cv, 12, 20, 'COLD', rgb('#2a2e33'))
    _wear(cv, seed, 10, 0.2, (4, 56, 44, 12))
    cv.finish(shadow=None)
    return cv


# ── Loja, farmácia, roupas ────────────────────────────────────

def register_counter(seed: int = 15) -> Cv:
    cv = Cv(72, 52)
    cv.tex_rect(2, 18, 68, 28, WOOD, seed, 3, 0.5)
    cv.rect(2, 18, 68, 4, WOOD_PALE[3]); cv.rect(2, 44, 68, 2, WOOD[0])
    cv.tex_rect(8, 6, 22, 14, STEEL, seed + 1, 2, 0.5)                 # caixa registradora
    cv.rect(10, 8, 18, 5, rgb('#1d3a2a')); text(cv, 12, 9, '0.00', rgb('#7fe06a'))
    cv.rect(10, 15, 18, 3, STEEL[3])
    cv.rect(44, 12, 14, 8, rgb('#a8271d')); text(cv, 46, 14, 'OPEN', WHITE)
    cv.tex_rect(36, 10, 6, 8, PAPER, seed + 2, 2, 0.5)
    _wear(cv, seed, 5, 0.2, (2, 38, 68, 8))
    cv.finish(shadow=(36, 49, 64, 4))
    return cv


def display_case(seed: int = 16) -> Cv:
    cv = Cv(72, 48)
    cv.tex_rect(2, 18, 68, 26, WOOD, seed, 3, 0.5)
    cv.poly([(4, 6), (68, 6), (70, 18), (2, 18)], rgb('#6d8c94'))
    cv.line(6, 8, 30, 8, rgb('#bfe0e6')); cv.line(44, 9, 60, 9, rgb('#a0c4cc'))
    r = rng(seed)
    for k in range(6):                                                  # coisas dentro
        cv.rect(8 + k * 10, 12, r.randint(4, 7), r.randint(3, 5), rgb(r.choice(['#c9a64a', '#a8271d', '#3a5a8a', '#6a8a4a'])))
    cv.poly([(12, 11), (20, 8), (22, 12)], rgb('#ffffff', 70))
    cv.poly([(40, 8), (46, 16), (42, 16)], rgb('#101820'))
    _wear(cv, seed, 4, 0.2, (2, 38, 68, 6))
    cv.finish(shadow=(36, 45, 64, 4))
    return cv


def clothes_rack(seed: int = 17) -> Cv:
    cv = Cv(60, 66)
    cv.rect(4, 8, 52, 3, STEEL[3]); cv.rect(4, 8, 52, 1, STEEL[4])
    for x in (8, 50):
        cv.rect(x, 8, 3, 54, STEEL[2]); cv.rect(x - 3, 60, 9, 3, STEEL[1])
    r = rng(seed)
    for k in range(9):
        c = ramp(*[r.choice(['#5a3a2a', '#2f4a5a', '#5a2f3a', '#3a4a2a', '#4a4a4a', '#6a5a3a'])] * 5)
        x = 12 + k * 4
        cv.poly([(x, 12), (x + 3, 12), (x + 4, 34 + r.randint(0, 6)), (x - 1, 34 + r.randint(0, 6))], c[2])
        cv.px(x + 1, 11, STEEL[4])
    moss_patch(cv, 6, 44, 48, 16, seed, 0.15)
    cv.finish(shadow=(30, 63, 50, 4))
    return cv


def mannequin(seed: int = 18) -> Cv:
    cv = Cv(26, 64)
    skin = ramp('#4a3f38', '#665a50', '#847668', '#a29484', '#c0b2a0')
    cv.tex_ell(9, 4, 8, 9, skin, seed, 2, 0.5)
    cv.tex_poly([(5, 15), (21, 15), (19, 38), (7, 38)], [rgb('#3a4a5a'), rgb('#506478'), rgb('#6a8196'), rgb('#869eb2'), rgb('#a0b8cc')], seed + 1, 3, 0.5)
    cv.rect(12, 13, 2, 3, skin[2]); cv.rect(12, 38, 2, 22, STEEL[2]); cv.rect(6, 59, 14, 3, STEEL[1])
    _wear(cv, seed, 3, 0.3, (5, 30, 16, 12))
    cv.finish(shadow=(13, 61, 18, 4))
    return cv


def fitting_mirror(seed: int = 19) -> Cv:
    cv = Cv(34, 62)
    cv.tex_rect(2, 2, 30, 56, WOOD, seed, 2, 0.5)
    cv.rect(5, 5, 24, 50, rgb('#5a7076')); cv.poly([(6, 6), (14, 6), (6, 24)], rgb('#a0b6bc'))
    cv.poly([(18, 30), (28, 30), (28, 52), (22, 54)], rgb('#101820'))
    cv.finish(shadow=None)
    return cv


def vending(seed: int = 20) -> Cv:
    cv = Cv(40, 70)
    cv.tex_rect(3, 4, 34, 62, ramp('#3a0f0d', '#5e1a15', '#822821', '#a3382d', '#c04a3c'), seed, 3, 0.5)
    cv.rect(6, 8, 22, 40, rgb('#26343a'))
    r = rng(seed)
    for row in range(4):
        for col in range(4):
            cv.rect(8 + col * 5, 11 + row * 9, 4, 6, rgb(r.choice(['#c9a64a', '#3a8a5a', '#d9632a', '#e8e4d0', '#4a6ab4'])))
    cv.rect(30, 12, 5, 8, rgb('#101214')); cv.rect(30, 24, 5, 3, STEEL[3]); cv.rect(8, 53, 20, 8, rgb('#14171a'))
    cv.poly([(9, 9), (16, 9), (9, 22)], rgb('#ffffff', 70))
    _wear(cv, seed, 7, 0.25, (3, 54, 34, 12))
    cv.finish(shadow=(20, 67, 32, 4))
    return cv


# ── Lanchonete e restaurante ──────────────────────────────

def diner_booth(seed: int = 21) -> Cv:
    cv = Cv(72, 60)
    cv.tex_rect(4, 6, 64, 14, VINYL_RED, seed, 3, 0.55)                # encosto de cima
    cv.rect(4, 6, 64, 2, VINYL_RED[4])
    cv.tex_rect(18, 22, 36, 14, WOOD, seed + 1, 3, 0.5)                # mesa
    cv.rect(18, 22, 36, 2, WOOD_PALE[3]); cv.rect(34, 26, 4, 6, SIGN_RED[3])
    cv.tex_rect(4, 40, 64, 14, VINYL_RED, seed + 2, 3, 0.55)           # banco de baixo
    cv.rect(4, 40, 64, 2, VINYL_RED[4])
    cv.rect(10, 46, 8, 1, rgb('#101214')); cv.px(40, 30, rgb('#101214'))
    for x in (4, 66):
        cv.rect(x, 20, 3, 22, VINYL_RED[1])
    _stain(cv, seed, 8, rgb('#2a1a14'))
    cv.finish(shadow=(36, 57, 64, 4))
    return cv


def diner_counter(seed: int = 22) -> Cv:
    cv = Cv(104, 48)
    cv.tex_rect(2, 14, 100, 28, WOOD, seed, 3, 0.5)
    cv.rect(2, 12, 100, 5, STEEL[3]); cv.rect(2, 12, 100, 1, STEEL[4])      # tampo cromado
    cv.rect(2, 40, 100, 2, STEEL[1])
    cv.tex_rect(8, 4, 20, 10, [rgb('#5a727a'), rgb('#7a949c'), rgb('#9ab4bc'), rgb('#bad0d6'), rgb('#e0eef0')], seed + 1, 2, 0.5)    # vitrine de tortas
    for k in range(3):
        cv.ell(10 + k * 6, 8, 5, 4, rgb(['#c9a64a', '#a8271d', '#e8e4d0'][k]))
    cv.rect(70, 6, 4, 8, STEEL[2]); cv.ell(66, 4, 12, 4, STEEL[4])
    _wear(cv, seed, 6, 0.2, (2, 34, 100, 8))
    cv.finish(shadow=(52, 45, 96, 4))
    return cv


def bar_stool(seed: int = 23) -> Cv:
    cv = Cv(20, 34)
    cv.tex_ell(2, 4, 16, 8, VINYL_RED, seed, 2, 0.5)
    cv.rect(9, 11, 3, 16, STEEL[2]); cv.ell(3, 26, 14, 5, STEEL[1])
    cv.finish(shadow=(10, 31, 14, 3))
    return cv


def jukebox(seed: int = 24) -> Cv:
    cv = Cv(44, 66)
    cv.tex_poly([(4, 14), (8, 6), (36, 6), (40, 14), (40, 60), (4, 60)], ramp('#3a1a0d', '#5e2f15', '#824821', '#a3622d', '#c0803c'), seed, 3, 0.5)
    cv.rect(10, 14, 24, 22, rgb('#1d3a3a')); cv.rect(12, 16, 20, 4, rgb('#e8c84a')); cv.rect(14, 24, 16, 8, rgb('#a8271d'))
    cv.rect(10, 40, 24, 4, rgb('#d9632a')); cv.rect(10, 48, 24, 6, rgb('#14171a'))
    cv.px(14, 18, WHITE); cv.px(28, 19, WHITE)
    _wear(cv, seed, 6, 0.2, (4, 50, 36, 10))
    cv.finish(shadow=(22, 63, 36, 4))
    return cv


def bar_counter(seed: int = 25) -> Cv:
    cv = Cv(112, 52)
    cv.tex_rect(2, 16, 108, 30, ramp('#1a0f0a', '#2f1d12', '#47301d', '#634629', '#80603a'), seed, 3, 0.5)
    cv.rect(2, 12, 108, 6, WOOD_PALE[3]); cv.rect(2, 12, 108, 1, WOOD_PALE[4])
    for x in range(10, 104, 10):
        cv.rect(x, 22, 6, 18, rgb('#14100c'))
    for k in range(6):                                                  # garrafas no balcão
        cv.rect(12 + k * 16, 4, 3, 8, rgb(['#3a6a3a', '#6a3a1a', '#9ab4c0', '#3a3a6a'][k % 4])); cv.rect(12 + k * 16, 2, 3, 3, rgb('#101214'))
    _wear(cv, seed, 5, 0.2, (2, 38, 108, 8))
    cv.finish(shadow=(56, 49, 100, 4))
    return cv


def wine_rack(seed: int = 26) -> Cv:
    cv = Cv(60, 70)
    cv.tex_rect(2, 6, 56, 60, WOOD, seed, 3, 0.5)
    for row in range(5):
        for col in range(5):
            cv.ell(6 + col * 10, 10 + row * 11, 8, 8, rgb('#14100c'))
            cv.ell(8 + col * 10, 12 + row * 11, 4, 4, rgb(['#3a6a3a', '#6a1a1a', '#9ab4c0'][(row + col) % 3]))
    _wear(cv, seed, 4, 0.25, (2, 52, 56, 12))
    cv.finish(shadow=(30, 67, 50, 4))
    return cv


# ── Escritório, escola, delegacia ──────────────────────────────

def cubicle(seed: int = 27) -> Cv:
    cv = Cv(64, 64)
    cv.tex_rect(2, 4, 4, 52, [rgb('#4a4a44'), rgb('#68685f'), rgb('#86867a'), rgb('#a4a496'), rgb('#c0c0b0')], seed, 2, 0.5)
    cv.tex_rect(2, 4, 60, 4, [rgb('#4a4a44'), rgb('#68685f'), rgb('#86867a'), rgb('#a4a496'), rgb('#c0c0b0')], seed + 1, 2, 0.5)
    cv.tex_rect(8, 18, 52, 14, WOOD_PALE, seed + 2, 3, 0.5)             # mesa
    cv.tex_rect(14, 8, 18, 14, STEEL, seed + 3, 2, 0.5)                 # monitor
    cv.rect(16, 10, 14, 9, rgb('#1d3a2a')); cv.rect(17, 11, 5, 1, rgb('#7fe06a'))
    cv.rect(20, 22, 10, 3, STEEL[3])
    cv.tex_rect(36, 34, 18, 16, ramp('#14171a', '#22262a', '#32383d', '#454c52', '#5a6168'), seed + 4, 2, 0.5)   # cadeira
    cv.rect(44, 50, 3, 6, STEEL[1])
    cv.tex_rect(46, 8, 10, 8, PAPER, seed + 5, 2, 0.5)
    _wear(cv, seed, 4, 0.2, (4, 46, 54, 12))
    cv.finish(shadow=(32, 61, 56, 4))
    return cv


def file_cabinet(seed: int = 28) -> Cv:
    cv = Cv(32, 60)
    cv.tex_rect(3, 6, 26, 50, STEEL, seed, 3, 0.5)
    for y in (10, 24, 38):
        cv.rect(5, y, 22, 11, STEEL[1]); cv.rect(5, y, 22, 1, STEEL[4]); cv.rect(12, y + 4, 8, 2, STEEL[4])
    cv.rect(8, y + 4 - 28, 3, 2, PAPER[3])
    _wear(cv, seed, 7, 0.2, (3, 44, 26, 10))
    cv.finish(shadow=(16, 57, 26, 4))
    return cv


def school_desk(seed: int = 29) -> Cv:
    cv = Cv(34, 44)
    cv.tex_rect(3, 4, 28, 14, WOOD_PALE, seed, 2, 0.5)                   # tampo
    cv.rect(3, 4, 28, 2, WOOD_PALE[4]); cv.rect(3, 17, 28, 1, WOOD[0])
    cv.rect(5, 18, 2, 10, STEEL[2]); cv.rect(27, 18, 2, 10, STEEL[2])
    cv.tex_rect(8, 28, 18, 8, WOOD, seed + 1, 2, 0.5)                    # assento
    cv.rect(10, 36, 2, 5, STEEL[2]); cv.rect(22, 36, 2, 5, STEEL[2])
    _stain(cv, seed, 4, rgb('#2a2018'))
    cv.finish(shadow=(17, 41, 28, 3))
    return cv


def blackboard(seed: int = 30) -> Cv:
    cv = Cv(112, 54)
    cv.tex_rect(2, 2, 108, 46, WOOD, seed, 3, 0.5)
    cv.rect(6, 6, 100, 38, rgb('#1d2d26')); cv.rect(6, 6, 100, 1, rgb('#2f4a3c'))
    text(cv, 12, 12, 'SEMPRE VIGILANTE', rgb('#d8d8cc')); text(cv, 12, 20, 'NAO ENTRE', rgb('#c9c9bd'))
    cv.line(12, 30, 60, 30, rgb('#d8d8cc')); cv.line(14, 34, 40, 34, rgb('#b8b8ac'))
    cv.rect(10, 44, 20, 3, WOOD_PALE[3]); cv.rect(14, 43, 5, 1, rgb('#ffffff'))
    for _ in range(40):                                                  # giz apagado
        cv.px(rng(seed + _).randint(8, 104), rng(seed + _ + 1).randint(8, 42), rgb('#33463c'))
    cv.finish(shadow=None)
    return cv


def lockers(seed: int = 31) -> Cv:
    cv = Cv(64, 66)
    for i in range(3):
        x = 3 + i * 20
        cv.tex_rect(x, 6, 18, 56, LOCKER_BLUE, seed + i, 2, 0.5)
        cv.rect(x, 6, 18, 1, LOCKER_BLUE[4]); cv.rect(x + 3, 12, 12, 2, LOCKER_BLUE[0]); cv.rect(x + 3, 16, 12, 2, LOCKER_BLUE[0])
        cv.rect(x + 13, 36, 2, 5, STEEL[4]); cv.rect(x + 8, 28, 3, 3, STEEL[3])
    _wear(cv, seed, 9, 0.2, (3, 48, 58, 12))
    cv.finish(shadow=(32, 63, 58, 4))
    return cv


def jail_bars(seed: int = 32) -> Cv:
    cv = Cv(64, 72)
    cv.rect(2, 4, 60, 4, STEEL[2]); cv.rect(2, 62, 60, 4, STEEL[2])
    for x in range(6, 60, 7):
        cv.rect(x, 8, 3, 54, STEEL[1]); cv.rect(x, 8, 1, 54, STEEL[4])
    cv.rect(26, 28, 12, 10, STEEL[0]); cv.ell(30, 31, 4, 4, rgb('#8a7a30'))
    _wear(cv, seed, 12, 0.2, (2, 52, 60, 14))
    cv.finish(shadow=(32, 69, 56, 4))
    return cv


def reception_desk(seed: int = 33) -> Cv:
    cv = Cv(112, 56)
    cv.tex_rect(2, 20, 108, 30, WOOD, seed, 3, 0.5)
    cv.tex_rect(2, 14, 108, 8, WOOD_PALE, seed + 1, 3, 0.5)
    cv.rect(2, 14, 108, 1, WOOD_PALE[4])
    cv.ell(12, 8, 8, 5, STEEL[4]); cv.px(16, 7, STEEL[1])                # sininho
    cv.rect(60, 6, 12, 10, rgb('#2a2e33')); cv.rect(62, 8, 8, 5, rgb('#6a7a40'))
    cv.tex_rect(86, 8, 14, 8, PAPER, seed + 2, 2, 0.5)
    cv.rect(30, 26, 8, 14, rgb('#14100c')); cv.rect(72, 26, 8, 14, rgb('#14100c'))
    _wear(cv, seed, 5, 0.2, (2, 42, 108, 8))
    cv.finish(shadow=(56, 53, 100, 4))
    return cv


def key_board(seed: int = 34) -> Cv:
    cv = Cv(44, 42)
    cv.tex_rect(2, 2, 40, 36, WOOD, seed, 2, 0.5)
    for r_ in range(2):
        for c_ in range(5):
            cv.rect(6 + c_ * 7, 8 + r_ * 14, 2, 2, rgb('#8a7a30')); cv.rect(5 + c_ * 7, 11 + r_ * 14, 4, 6, STEEL[2])
    cv.finish(shadow=None)
    return cv


def mailboxes(seed: int = 35) -> Cv:
    cv = Cv(72, 36)
    cv.tex_rect(2, 4, 68, 28, STEEL, seed, 3, 0.5)
    for r_ in range(2):
        for c_ in range(6):
            x, y = 5 + c_ * 11, 7 + r_ * 12
            cv.rect(x, y, 9, 10, STEEL[1]); cv.rect(x, y, 9, 1, STEEL[4]); cv.rect(x + 3, y + 3, 3, 1, rgb('#101214'))
    _wear(cv, seed, 9, 0.2, (2, 24, 68, 8))
    cv.finish(shadow=None)
    return cv


def elevator_door(seed: int = 36) -> Cv:
    cv = Cv(56, 76)
    cv.tex_rect(2, 4, 52, 70, STEEL, seed, 3, 0.45)
    cv.rect(6, 10, 22, 60, STEEL[1]); cv.rect(28, 10, 22, 60, STEEL[1]); cv.rect(27, 10, 2, 60, rgb('#0f1214'))
    cv.rect(24, 4, 8, 4, rgb('#101214')); text(cv, 25, 5, '3', rgb('#a8271d'))
    cv.poly([(8, 12), (24, 12), (8, 30)], rgb('#ffffff', 70))
    cv.rect(26, 28, 4, 40, rgb('#050607'))                               # vão aberto
    _wear(cv, seed, 11, 0.25, (4, 58, 48, 14))
    cv.finish(shadow=None)
    return cv


def car_lift(seed: int = 37) -> Cv:
    cv = Cv(92, 70)
    for x in (6, 78):
        cv.tex_rect(x, 6, 8, 56, ramp('#3a3f10', '#5e6618', '#848f22', '#aab630', '#c8d548'), seed + x, 2, 0.5)
    cv.rect(6, 14, 80, 6, STEEL[2]); cv.rect(6, 14, 80, 1, STEEL[4])
    cv.rect(18, 46, 56, 5, STEEL[1]); cv.rect(14, 62, 64, 3, STEEL[0])
    _wear(cv, seed, 8, 0.2, (6, 52, 80, 12))
    cv.finish(shadow=(46, 66, 84, 5))
    return cv


def tire_rack(seed: int = 38) -> Cv:
    cv = Cv(64, 70)
    cv.rect(4, 6, 3, 58, STEEL[2]); cv.rect(57, 6, 3, 58, STEEL[2])
    for y in (20, 38, 56):
        cv.rect(4, y, 56, 3, STEEL[1])
        for k in range(3):
            cv.ell(8 + k * 17, y - 14, 14, 14, rgb('#101012')); cv.ell(12 + k * 17, y - 10, 6, 6, STEEL[1])
    _wear(cv, seed, 5, 0.2, (4, 56, 56, 10))
    cv.finish(shadow=(32, 67, 56, 4))
    return cv


def wall_painting(seed: int = 39, kind: int = 0) -> Cv:
    cv = Cv(40, 34)
    cv.tex_rect(2, 2, 36, 28, WOOD, seed, 2, 0.5)
    sky = [rgb('#7a9ab4'), rgb('#b48a5a'), rgb('#6a8a5a')][kind % 3]
    cv.rect(5, 5, 30, 22, sky)
    cv.poly([(5, 27), (14, 14), (22, 22), (28, 16), (35, 27)], [rgb('#3a4a3a'), rgb('#5a4a3a'), rgb('#2a3a4a')][kind % 3])
    cv.ell(24, 8, 6, 6, rgb('#f0e0a0'))
    cv.poly([(20, 5), (35, 5), (35, 12)], rgb('#000000', 50))
    _stain(cv, seed, 3)
    cv.finish(shadow=None)
    return cv


def potted_plant(seed: int = 40) -> Cv:
    cv = Cv(28, 40)
    cv.tex_poly([(7, 22), (21, 22), (19, 36), (9, 36)], ramp('#3a1a10', '#5e2f1a', '#824824', '#a3622f', '#c08040'), seed, 2, 0.5)
    cv.rect(6, 21, 16, 3, rgb('#a3622f'))
    for k in range(7):
        x = 14 + (k - 3) * 2
        cv.line(14, 22, x, 6 + abs(k - 3) * 3, rgb('#5a4a2a') if k % 2 else rgb('#4a3a1a'))
    cv.rect(7, 22, 14, 2, rgb('#2a2010'))
    cv.finish(shadow=(14, 37, 18, 3))
    return cv


def old_tv(seed: int = 41) -> Cv:
    cv = Cv(34, 40)
    cv.tex_rect(3, 14, 28, 20, ramp('#2a1a10', '#47301d', '#634629', '#80603a', '#9c7a4a'), seed, 2, 0.5)
    cv.rect(6, 17, 18, 14, rgb('#2a3a3a')); cv.rect(7, 18, 6, 2, rgb('#8aa4a4')); cv.rect(26, 18, 3, 3, rgb('#14100c')); cv.rect(26, 24, 3, 3, rgb('#14100c'))
    cv.line(12, 14, 6, 4, STEEL[3]); cv.line(20, 14, 28, 4, STEEL[3])
    cv.rect(8, 34, 4, 3, WOOD[0]); cv.rect(22, 34, 4, 3, WOOD[0])
    cv.finish(shadow=(17, 37, 26, 3))
    return cv


def hospital_screen(seed: int = 42) -> Cv:
    """Biombo de hospital (tecido azul claro com rasgos)."""
    cv = Cv(68, 62)
    for i in range(3):
        x = 4 + i * 20
        cv.tex_rect(x, 8, 18, 46, [rgb('#4a6a7a'), rgb('#6a8a9a'), rgb('#8aaab8'), rgb('#a8c4cc'), rgb('#c8dce0')], seed + i, 2, 0.5)
        cv.rect(x, 8, 18, 1, STEEL[3])
    cv.rect(4, 54, 58, 2, STEEL[2])
    _stain(cv, seed, 12, rgb('#6a2a22'))
    cv.finish(shadow=(34, 58, 60, 4))
    return cv


def build(sh: Sheet) -> None:
    tg = ['pós-apocalipse', 'interior', 'Nova York']
    items = [
        ('vaso', 'Vaso sanitário', toilet(), 11, 'stand', 'banheiro'), ('pia-banheiro', 'Pia de banheiro', bath_sink(), 14, 'stand', 'banheiro'),
        ('banheira', 'Banheira', bathtub(), 32, 'stand', 'banheiro'), ('chuveiro', 'Box de chuveiro com cortina', shower(), 17, 'stand', 'banheiro'),
        ('espelho-banheiro', 'Espelho de banheiro', bath_mirror(), 0, 'wall', 'banheiro'), ('maquina-lavar', 'Máquina de lavar', washer(), 14, 'stand', 'lavanderia'),
        ('geladeira', 'Geladeira', fridge(), 14, 'stand', 'cozinha'), ('freezer', 'Freezer horizontal', freezer_chest(), 30, 'stand', 'cozinha'),
        ('coifa', 'Coifa de cozinha industrial', stove_hood(), 0, 'wall', 'cozinha'), ('fogao-industrial', 'Fogão industrial', industrial_stove(), 22, 'stand', 'cozinha'),
        ('mesa-aco', 'Mesa de aço', steel_table(), 30, 'stand', 'cozinha'), ('pia-industrial', 'Pia industrial dupla', steel_sink(), 30, 'stand', 'cozinha'),
        ('prateleira-aco', 'Prateleira de aço com caixas', steel_shelf(), 22, 'stand', 'estoque'), ('porta-camara-fria', 'Porta da câmara fria', cooler_door(), 0, 'wall', 'cozinha'),
        ('balcao-caixa', 'Balcão com caixa registradora', register_counter(), 32, 'stand', 'loja'), ('vitrine-balcao', 'Vitrine balcão', display_case(), 32, 'stand', 'loja'),
        ('arara-roupas', 'Arara de roupas', clothes_rack(), 24, 'stand', 'loja'), ('manequim', 'Manequim', mannequin(), 8, 'stand', 'loja'),
        ('espelho-provador', 'Espelho de provador', fitting_mirror(), 0, 'wall', 'loja'), ('maquina-vendas', 'Máquina de vendas', vending(), 16, 'stand', 'loja'),
        ('cabine-lanchonete', 'Cabine de lanchonete', diner_booth(), 30, 'stand', 'restaurante'), ('balcao-lanchonete', 'Balcão de lanchonete', diner_counter(), 46, 'stand', 'restaurante'),
        ('banqueta', 'Banqueta de balcão', bar_stool(), 5, 'stand', 'restaurante'), ('jukebox', 'Jukebox', jukebox(), 16, 'stand', 'restaurante'),
        ('balcao-bar', 'Balcão de bar', bar_counter(), 48, 'stand', 'restaurante'), ('adega', 'Adega de vinhos', wine_rack(), 26, 'stand', 'restaurante'),
        ('baia-escritorio', 'Baia de escritório com computador', cubicle(), 28, 'stand', 'escritório'), ('arquivo-metal', 'Arquivo de aço', file_cabinet(), 12, 'stand', 'escritório'),
        ('carteira', 'Carteira escolar', school_desk(), 12, 'stand', 'escola'), ('lousa', 'Lousa', blackboard(), 0, 'wall', 'escola'),
        ('armarios-escola', 'Armários de vestiário', lockers(), 28, 'stand', 'escola'), ('grade-cela', 'Grade de cela', jail_bars(), 28, 'stand', 'delegacia'),
        ('balcao-recepcao', 'Balcão de recepção', reception_desk(), 48, 'stand', 'recepção'), ('quadro-chaves', 'Quadro de chaves', key_board(), 0, 'wall', 'recepção'),
        ('caixas-correio-hall', 'Caixas de correio do prédio', mailboxes(), 0, 'wall', 'recepção'), ('porta-elevador', 'Porta de elevador', elevator_door(), 0, 'wall', 'recepção'),
        ('elevador-carro', 'Elevador de carro (oficina)', car_lift(), 40, 'stand', 'oficina'), ('rack-pneus', 'Rack de pneus', tire_rack(), 28, 'stand', 'oficina'),
        ('planta-vaso', 'Planta seca em vaso', potted_plant(), 10, 'stand', 'decoração'), ('tv-antiga', 'TV antiga', old_tv(), 14, 'stand', 'decoração'),
        ('biombo-hospital', 'Biombo hospitalar', hospital_screen(), 28, 'stand', 'decoração'),
    ]
    for slug, label, cv, half, kind, tag in items:
        sh.add(cv, slug, label, CAT, [tag, 'móvel'] + tg, kind=kind, solids=[solid(half, 8)] if kind == 'stand' and half else None, sort=3)
    for i in range(3):
        sh.add(wall_painting(39 + i, i), f'quadro-parede-{i + 1}', f'Quadro de parede {i + 1}', CAT, ['quadro', 'decoração'] + tg, kind='wall', sort=2)
