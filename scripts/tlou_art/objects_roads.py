"""Objetos de rua no estilo dos EUA: faixas pintadas no asfalto, placas de trânsito e peças típicas americanas.

As faixas são objetos de chão de 32×32 (um ladrilho): é só emendar uma ao lado da outra. Cada uma tem versão
com o tinta gasta para não repetir. As placas e peças seguem o desenho limpo, de contornos escuros e cores
fortes, com musgo nascendo na base.
"""
from __future__ import annotations

from PIL import Image

from .objects_ruins import moss_patch, rust_streaks, wheel
from .palettes import *  # noqa: F403
from .px import Cv, _hash, rgb, rng, scatter, text, text_width
from .sheet import Sheet, solid

CAT_PAINT = 'Apocalipse: Faixas de rua'
CAT_SIGN = 'Apocalipse: Placas (EUA)'
CAT_US = 'Apocalipse: Rua americana'

PAINT_W = ramp('#aab2b6', '#c4cbcd', '#dde1e2', '#eceff0', '#f8f9f9')
PAINT_Y = ramp('#8a5f10', '#b98318', '#dba526', '#efc23c', '#fbd95e')
POLE = ramp('#2a2e32', '#3d4348', '#555d63', '#6f7980', '#8a949a')
SIGN_RED = ramp('#4a0f0c', '#7a1a14', '#a8271d', '#c93a2c', '#e0523f')
SIGN_GREEN = ramp('#0e3a22', '#14532f', '#1c6e3f', '#268a50', '#34a863')
SIGN_BLUE = ramp('#0f2a52', '#183d78', '#22529e', '#3068bd', '#4682d6')
SIGN_YG = ramp('#5c6a0c', '#8a9c14', '#b4c91f', '#d2e630', '#e6f45a')
BUS_Y = ramp('#6a4f00', '#9a7400', '#c79b0c', '#e8b92a', '#f7d24f')
BLACKISH = rgb('#15171a')
WHITE = rgb('#eceff0')


# ── Faixas no chão ────────────────────────────────────────

def _wear(cv: Cv, seed: int, p: float) -> Cv:
    """Tinta gasta: some com pixels soltos e com falhas maiores."""
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.get(x, y)[3] and (_hash(x, y, seed) < p or _hash(x // 3, y // 3, seed + 5) < p * 0.25):
                cv.px(x, y, (0, 0, 0, 0))
    return cv


def _bar(cv: Cv, x: int, y: int, w: int, h: int, rp: list, seed: int) -> None:
    cv.rect(x, y, w, h, rp[3])
    cv.rect(x, y, w, 1, rp[4])
    cv.rect(x, y + h - 1, w, 1, rp[2])
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if _hash(xx, yy, seed) > 0.9:
                cv.px(xx, yy, rp[1])


def dash(vertical: bool, seed: int) -> Cv:
    cv = Cv(32, 32)
    if vertical:
        _bar(cv, 14, 6, 4, 20, PAINT_W, seed)
    else:
        _bar(cv, 6, 14, 20, 4, PAINT_W, seed)
    return _wear(cv, seed, 0.05)


def double_yellow(vertical: bool, seed: int) -> Cv:
    cv = Cv(32, 32)
    for off in (11, 18):
        if vertical:
            _bar(cv, off, 0, 3, 32, PAINT_Y, seed + off)
        else:
            _bar(cv, 0, off, 32, 3, PAINT_Y, seed + off)
    return _wear(cv, seed, 0.04)


def edge_yellow(vertical: bool, seed: int) -> Cv:
    cv = Cv(32, 32)
    if vertical:
        _bar(cv, 14, 0, 3, 32, PAINT_Y, seed)
    else:
        _bar(cv, 0, 14, 32, 3, PAINT_Y, seed)
    return _wear(cv, seed, 0.05)


def crosswalk(ns: bool, seed: int) -> Cv:
    """Faixa de pedestres: `ns` = a pessoa anda de norte a sul (as listras ficam deitadas)."""
    cv = Cv(32, 32)
    for i in range(4):
        if ns:
            _bar(cv, 3, 2 + i * 8, 26, 5, PAINT_W, seed + i)
        else:
            _bar(cv, 2 + i * 8, 3, 5, 26, PAINT_W, seed + i)
    return _wear(cv, seed, 0.05)


def stop_line(vertical: bool, seed: int) -> Cv:
    cv = Cv(32, 32)
    if vertical:
        _bar(cv, 13, 0, 6, 32, PAINT_W, seed)
    else:
        _bar(cv, 0, 13, 32, 6, PAINT_W, seed)
    return _wear(cv, seed, 0.05)


def arrow(seed: int) -> Cv:
    cv = Cv(32, 32)
    cv.rect(3, 13, 16, 6, PAINT_W[3])
    cv.poly([(18, 7), (29, 16), (18, 25)], PAINT_W[3])
    cv.line(3, 13, 18, 13, PAINT_W[4]); cv.line(18, 7, 29, 16, PAINT_W[4])
    return _wear(cv, seed, 0.06)


def manhole(seed: int = 5) -> Cv:
    cv = Cv(32, 32)
    cv.tex_ell(4, 5, 24, 22, IRON, seed, 2, 0.5)
    cv.d.ellipse([4, 5, 27, 26], outline=IRON[0])
    cv.d.ellipse([7, 8, 24, 23], outline=IRON[3])
    for i in range(-3, 4):
        cv.line(10, 16 + i * 2, 21, 16 + i * 2, IRON[1])
    for i in range(-3, 4):
        cv.line(16 + i * 2, 10, 16 + i * 2, 22, IRON[1])
    rust_streaks(cv, 6, 7, 20, 16, seed, 6)
    return cv


# ── Placas ──────────────────────────────────────────────────

def _pole(cv: Cv, cx: int, y0: int, y1: int, w: int = 3, seed: int = 1) -> None:
    cv.tex_rect(cx - w // 2, y0, w, y1 - y0, POLE, seed, 2, 0.5)
    cv.px(cx - w // 2, y0 + 2, POLE[4])


def _big(cv: Cv, x: int, y: int, s: str, c, scale: int) -> int:
    tmp = Cv(text_width(s), 5)
    text(tmp, 0, 0, s, c)
    im = tmp.im.resize((tmp.w * scale, tmp.h * scale), Image.NEAREST)
    cv.im.alpha_composite(im, (x, y))
    return tmp.w * scale


def _wear_sign(cv: Cv, x: int, y: int, w: int, h: int, seed: int, rust: int = 2, moss: float = 0.3) -> None:
    rust_streaks(cv, x, y, w, h, seed, rust)
    r = rng(seed)
    for _ in range(3):
        cv.px(x + r.randint(0, w - 1), y + r.randint(0, h - 1), rgb('#101214'))   # furinhos
    moss_patch(cv, x - 1, y + h - 4, w + 2, 8, seed + 1, moss)


def speed_limit(seed: int = 301) -> Cv:
    cv = Cv(32, 76)
    _pole(cv, 16, 36, 72, 3, seed)
    cv.rect(4, 3, 24, 34, WHITE); cv.d.rectangle([5, 4, 26, 35], outline=BLACKISH)
    text(cv, 8, 7, 'SPEED', BLACKISH); text(cv, 8, 13, 'LIMIT', BLACKISH)
    _big(cv, 8, 21, '35', BLACKISH, 2)
    _wear_sign(cv, 4, 3, 24, 34, seed)
    cv.finish(shadow=(16, 72, 20, 5))
    return cv


def stop_sign(seed: int = 311) -> Cv:
    cv = Cv(34, 76)
    _pole(cv, 17, 28, 72, 3, seed)
    o = [(10, 1), (24, 1), (32, 9), (32, 23), (24, 31), (10, 31), (2, 23), (2, 9)]
    cv.poly(o, WHITE)
    i = [(11, 3), (23, 3), (30, 10), (30, 22), (23, 29), (11, 29), (4, 22), (4, 10)]
    cv.poly(i, SIGN_RED[3])
    text(cv, 10, 13, 'STOP', WHITE)
    cv.line(11, 3, 23, 3, SIGN_RED[4])
    _wear_sign(cv, 3, 3, 28, 26, seed)
    cv.finish(shadow=(17, 72, 20, 5))
    return cv


def one_way(seed: int = 321) -> Cv:
    cv = Cv(38, 62)
    _pole(cv, 19, 20, 58, 3, seed)
    cv.rect(2, 3, 34, 18, BLACKISH); cv.d.rectangle([3, 4, 34, 19], outline=WHITE)
    cv.rect(7, 8, 14, 3, WHITE); cv.poly([(20, 5), (30, 9), (20, 14)], WHITE)
    text(cv, 7, 14, 'ONE WAY', WHITE)
    _wear_sign(cv, 2, 3, 34, 18, seed, 3)
    cv.finish(shadow=(19, 58, 20, 5))
    return cv


def do_not_enter(seed: int = 331) -> Cv:
    cv = Cv(32, 72)
    _pole(cv, 16, 28, 68, 3, seed)
    cv.ell(3, 2, 26, 26, WHITE); cv.ell(5, 4, 22, 22, SIGN_RED[3])
    cv.rect(8, 13, 16, 4, WHITE)
    _wear_sign(cv, 4, 3, 24, 24, seed)
    cv.finish(shadow=(16, 68, 20, 5))
    return cv


def no_parking(seed: int = 341) -> Cv:
    cv = Cv(30, 72)
    _pole(cv, 15, 32, 68, 3, seed)
    cv.rect(2, 2, 26, 32, WHITE); cv.d.rectangle([3, 3, 26, 32], outline=SIGN_RED[3])
    _big(cv, 7, 6, 'NO', SIGN_RED[3], 2)
    text(cv, 8, 19, 'PARK', BLACKISH); text(cv, 6, 26, 'HERE', BLACKISH)
    _wear_sign(cv, 2, 2, 26, 32, seed)
    cv.finish(shadow=(15, 68, 18, 5))
    return cv


def hospital_sign(seed: int = 351) -> Cv:
    cv = Cv(32, 72)
    _pole(cv, 16, 28, 68, 3, seed)
    cv.rect(3, 2, 26, 26, WHITE); cv.rect(4, 3, 24, 24, SIGN_BLUE[2])
    _big(cv, 11, 8, 'H', WHITE, 3)
    cv.rect(4, 3, 24, 1, SIGN_BLUE[4])
    _wear_sign(cv, 4, 3, 24, 24, seed)
    cv.finish(shadow=(16, 68, 20, 5))
    return cv


def school_crossing(seed: int = 361) -> Cv:
    cv = Cv(36, 76)
    _pole(cv, 18, 32, 72, 3, seed)
    o = [(18, 1), (34, 14), (34, 32), (2, 32), (2, 14)]
    cv.poly(o, BLACKISH)
    i = [(18, 3), (32, 15), (32, 30), (4, 30), (4, 15)]
    cv.poly(i, SIGN_YG[3])
    for cx in (12, 22):                                  # duas crianças
        cv.ell(cx - 1, 9, 4, 4, BLACKISH)
        cv.rect(cx, 13, 2, 7, BLACKISH)
        cv.line(cx, 14, cx - 3, 18, BLACKISH); cv.line(cx + 1, 14, cx + 4, 18, BLACKISH)
        cv.line(cx, 20, cx - 2, 26, BLACKISH); cv.line(cx + 1, 20, cx + 3, 26, BLACKISH)
    cv.rect(4, 37, 28, 9, SIGN_YG[3]); cv.d.rectangle([4, 37, 31, 45], outline=BLACKISH)
    text(cv, 7, 39, 'SCHOOL', BLACKISH)
    _wear_sign(cv, 4, 3, 28, 28, seed)
    cv.finish(shadow=(18, 72, 20, 5))
    return cv


def street_name(seed: int = 371) -> Cv:
    cv = Cv(46, 64)
    _pole(cv, 23, 14, 60, 3, seed)
    cv.rect(2, 2, 42, 12, WHITE); cv.rect(3, 3, 40, 10, SIGN_GREEN[2])
    text(cv, 8, 6, 'MAIN ST', WHITE)
    cv.rect(3, 3, 40, 1, SIGN_GREEN[4])
    _wear_sign(cv, 2, 2, 42, 12, seed, 4)
    cv.finish(shadow=(23, 60, 22, 5))
    return cv


def railroad_crossing(seed: int = 381) -> Cv:
    cv = Cv(44, 72)
    _pole(cv, 22, 28, 68, 3, seed)
    cv.poly([(4, 4), (9, 2), (40, 24), (35, 27)], WHITE)
    cv.poly([(40, 4), (35, 2), (4, 24), (9, 27)], WHITE)
    cv.line(9, 3, 38, 24, rgb('#101214')); cv.line(35, 3, 6, 24, rgb('#101214'))
    cv.rect(18, 12, 9, 3, rgb('#b8281e'))
    _wear_sign(cv, 4, 3, 36, 24, seed)
    cv.finish(shadow=(22, 68, 22, 5))
    return cv


def exit_sign(seed: int = 391) -> Cv:
    cv = Cv(76, 80)
    for x in (14, 60):
        _pole(cv, x, 28, 76, 4, seed + x)
    cv.rect(2, 2, 72, 30, WHITE); cv.rect(3, 3, 70, 28, SIGN_GREEN[2])
    cv.rect(3, 3, 70, 1, SIGN_GREEN[4])
    text(cv, 9, 8, 'EXIT 12', WHITE); text(cv, 9, 16, 'HIGHWAY 9', WHITE)
    cv.rect(52, 7, 14, 3, WHITE); cv.poly([(63, 4), (70, 8), (63, 13)], WHITE)
    cv.rect(9, 24, 18, 2, WHITE)
    _wear_sign(cv, 2, 2, 72, 30, seed, 4)
    cv.finish(shadow=(38, 76, 62, 5))
    return cv


def billboard(seed: int = 401) -> Cv:
    cv = Cv(104, 100)
    for x in (18, 84):
        _pole(cv, x, 40, 96, 5, seed + x)
    cv.rect(2, 4, 100, 42, WHITE)
    cv.rect(4, 6, 96, 38, rgb('#1b2a3d'))
    cv.rect(4, 6, 96, 2, rgb('#2c4366'))
    _big(cv, 22, 12, 'FEDRA', rgb('#e8e2cf'), 3)
    text(cv, 20, 31, 'STAY INSIDE. STAY SAFE.', rgb('#cfc7b0'))
    cv.rect(20, 28, 64, 1, rgb('#c93a2c'))
    # rasgado e mofo
    cv.poly([(70, 30), (100, 24), (100, 44), (78, 44)], rgb('#101820'))
    for x in range(72, 100, 3):
        cv.px(x, 30 + (x % 5), rgb('#5a6068'))
    r = rng(seed)
    for _ in range(18):
        x, y = r.randint(6, 96), r.randint(8, 40)
        for k in range(r.randint(3, 9)):
            if cv.get(x, y + k)[3] > 200:
                cv.px(x, y + k, rgb('#0e1620'))
    _wear_sign(cv, 4, 6, 96, 38, seed, 4, 0.25)
    cv.finish(shadow=(52, 96, 84, 6))
    return cv


def graffiti_light(seed: int = 411) -> Cv:
    cv = Cv(76, 34)
    r = rng(seed)
    col = rgb('#e8d96a')
    text(cv, 3, 3, 'LOOK FOR', col); text(cv, 3, 11, 'THE LIGHT', col)
    cv.line(2, 18, 72, 18, col)
    for (cx, cy) in ((60, 6), (66, 10)):                 # vagalumes
        cv.px(cx, cy, rgb('#fff6a0')); cv.px(cx + 1, cy, rgb('#e8d96a')); cv.px(cx, cy + 1, rgb('#e8d96a'))
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.get(x, y)[3] and r.random() < 0.12:
                cv.px(x, y, (0, 0, 0, 0))
    for _ in range(8):                                   # escorridos
        x = r.randint(4, 70)
        for k in range(r.randint(3, 8)):
            cv.px(x, 19 + k, rgb('#b9ab52'))
    return cv


# ── Peças americanas ─────────────────────────────────────────

def utility_pole(seed: int = 421) -> Cv:
    cv = Cv(48, 112)
    cv.tex_rect(21, 6, 6, 102, WOOD, seed, 2, 0.5)
    cv.px(21, 20, WOOD[4])
    cv.tex_rect(4, 10, 40, 4, WOOD_PALE, seed + 1, 2, 0.5)           # travessa
    cv.tex_rect(10, 22, 28, 3, WOOD_PALE, seed + 2, 2, 0.5)
    for x in (6, 17, 30, 41):
        cv.rect(x, 6, 2, 4, rgb('#6b7a80'))                          # isoladores
    for x in (12, 34):
        cv.rect(x, 18, 2, 4, rgb('#6b7a80'))
    cv.tex_rect(26, 30, 12, 16, IRON, seed + 3, 2, 0.5)               # transformador
    cv.rect(28, 28, 8, 2, IRON[2])
    cv.d.rectangle([26, 30, 37, 45], outline=IRON[0])
    for k in range(5):                                                 # fios caídos
        cv.px(6 + k, 8 + k // 2, rgb('#0e0e0e'))
    for x in range(41, 47):
        cv.px(x, 8 + (x - 41) * 2, rgb('#0e0e0e'))
    cv.tex_rect(19, 100, 10, 8, WOOD, seed + 4, 2, 0.5)
    for k in range(6):                                                 # fita de cartaz
        cv.px(22 + k % 3, 60 + k * 2, WHITE)
    rust_streaks(cv, 26, 30, 12, 16, seed + 5, 5)
    moss_patch(cv, 18, 92, 14, 14, seed + 6, 0.6)
    cv.finish(shadow=(24, 108, 22, 5))
    return cv


def flag_pole(seed: int = 431) -> Cv:
    cv = Cv(38, 92)
    _pole(cv, 6, 6, 88, 3, seed)
    cv.ell(4, 2, 5, 5, rgb('#d9b94a'))
    r = rng(seed)
    # bandeira rasgada, pendurada de lado pelo vento
    fw, fh = 26, 16
    for y in range(fh):
        stripe = rgb('#a8271d') if (y // 2) % 2 == 0 else rgb('#dcdfe0')
        edge = fw - (3 if y % 5 == 0 else 0) - (r.randint(0, 3) if y > 10 else 0)
        for x in range(edge):
            wave = 1 if (x // 6) % 2 else 0
            c = stripe
            if x < 11 and y < 9:
                c = rgb('#1c3a6e')
                if (x + y) % 3 == 0 and x > 0 and y > 0:
                    c = rgb('#dcdfe0')
            if y < 3 and x > 8:
                c = rgb('#d6d8d8') if (y // 2) % 2 else rgb('#8f2118')
            cv.px(8 + x, 8 + y + wave, c)
    for x in range(8, 8 + fw):
        cv.px(x, 8 + fh + 1, rgb('#00000040'))
    for k in range(5):                                                 # fiapos
        cv.px(34 - k % 2, 22 + k, rgb('#8f2118'))
    moss_patch(cv, 2, 78, 10, 10, seed, 0.6)
    cv.finish(shadow=(6, 88, 14, 5))
    return cv


def rural_mailbox(seed: int = 441) -> Cv:
    cv = Cv(28, 44)
    box = ramp('#101214', '#1b1e22', '#2a2e33', '#3a3f45', '#4c525a')
    cv.tex_rect(11, 18, 4, 22, WOOD, seed, 2, 0.5)
    cv.tex_poly([(2, 12), (4, 6), (22, 6), (24, 12), (24, 19), (2, 19)], box, seed, 2, 0.5)
    cv.rect(23, 4, 2, 9, rgb('#b8281e')); cv.rect(21, 3, 4, 3, rgb('#d9442e'))   # bandeirinha levantada
    cv.rect(3, 12, 3, 1, box[4])
    text(cv, 6, 13, '17', WHITE)
    rust_streaks(cv, 3, 7, 20, 11, seed + 1, 5)
    moss_patch(cv, 6, 34, 14, 7, seed + 2, 0.6)
    cv.finish(shadow=(13, 40, 18, 5))
    return cv


def gas_sign(seed: int = 451) -> Cv:
    cv = Cv(48, 120)
    _pole(cv, 24, 36, 116, 5, seed)
    cv.rect(2, 3, 44, 38, WHITE); cv.rect(3, 4, 42, 36, SIGN_RED[2])
    cv.rect(3, 4, 42, 2, SIGN_RED[4])
    _big(cv, 10, 9, 'GAS', WHITE, 3)
    cv.rect(6, 28, 36, 10, BLACKISH)
    text(cv, 8, 31, 'REG', rgb('#7fe06a')); text(cv, 22, 31, '3.49', rgb('#7fe06a'))
    for y in range(4, 40):
        for x in range(3, 45):
            if cv.get(x, y)[3] and _hash(x, y, seed) > 0.97:
                cv.px(x, y, rgb('#2a0d0b'))
    _wear_sign(cv, 3, 4, 42, 36, seed, 4, 0.2)
    cv.finish(shadow=(24, 116, 26, 5))
    return cv


def parking_meter(seed: int = 461) -> Cv:
    cv = Cv(16, 40)
    cv.tex_rect(6, 12, 4, 24, POLE, seed, 2, 0.5)
    cv.tex_rect(2, 2, 12, 14, IRON_LIGHT, seed + 1, 2, 0.5)
    cv.rect(4, 4, 8, 5, rgb('#2c4349')); cv.px(5, 5, rgb('#86a8ac'))
    cv.rect(7, 11, 2, 2, rgb('#b8281e'))
    rust_streaks(cv, 2, 2, 12, 14, seed + 2, 4)
    cv.finish(shadow=(8, 36, 12, 4))
    return cv


def school_bus(seed: int = 471) -> Cv:
    cv = Cv(148, 66)
    body = BUS_Y
    cv.tex_poly([(4, 12), (126, 12), (136, 20), (144, 24), (144, 50), (4, 50)], body, seed, 5, 0.55)
    cv.rect(4, 12, 122, 3, body[4])
    # janelas
    for i in range(8):
        x = 10 + i * 14
        cv.rect(x, 18, 11, 10, GLASS[1]); cv.rect(x, 18, 11, 1, GLASS[4]); cv.px(x + 1, 20, GLASS[4])
    cv.poly([(128, 16), (136, 22), (140, 28), (128, 28)], GLASS[2])
    cv.px(130, 18, GLASS[4])
    # faixas pretas e letreiro
    cv.rect(4, 31, 140, 2, BLACKISH); cv.rect(4, 40, 140, 2, BLACKISH)
    text(cv, 36, 35, 'SCHOOL BUS', BLACKISH)
    cv.rect(122, 31, 1, 11, body[1])
    cv.rect(98, 34, 3, 1, body[1])
    # placa de PARE dobrável (aberta) e luzes
    cv.rect(142, 31, 3, 2, rgb('#d9442e')); cv.rect(6, 17, 3, 2, rgb('#d9442e'))
    # para-choques e rodas
    cv.rect(2, 46, 6, 5, IRON_LIGHT[1]); cv.rect(140, 46, 6, 5, IRON_LIGHT[1])
    wheel(cv, 30, 50, 8)
    wheel(cv, 108, 50, 8, flat=True)
    cv.rect(4, 50, 140, 2, rgb('#101012'))
    r = rng(seed)
    for _ in range(9):
        x0 = r.randint(8, 128)
        cv.tex_ell(x0, r.randint(36, 47), r.randint(6, 14), r.randint(3, 5), RUST, seed + x0, 1.5, 0.3)
    rust_streaks(cv, 6, 14, 136, 34, seed + 3, 20)
    moss_patch(cv, 8, 10, 60, 8, seed + 4, 0.35)
    moss_patch(cv, 90, 40, 40, 10, seed + 5, 0.3)
    cv.finish(shadow=(74, 62, 140, 8))
    return cv


# ── Folha ────────────────────────────────────────────────────

def build(sh: Sheet) -> None:
    tg = ['pós-apocalipse', 'EUA']
    for vertical, key, label in ((False, 'h', 'horizontal'), (True, 'v', 'vertical')):
        for i, tag in enumerate(('', '-b')):
            sd = 11 + i * 17 + (50 if vertical else 0)
            var = f' (gasta {i + 1})' if i else ''
            sh.add(dash(vertical, sd), f'faixa-branca-{key}{tag}', f'Faixa branca tracejada {label}{var}', CAT_PAINT,
                   ['faixa', 'linha', 'branca', 'rua'] + tg, kind='floor', sort=0)
            sh.add(double_yellow(vertical, sd + 3), f'amarela-dupla-{key}{tag}', f'Faixa amarela dupla {label}{var}', CAT_PAINT,
                   ['faixa', 'linha', 'amarela', 'rua'] + tg, kind='floor', sort=0)
            sh.add(edge_yellow(vertical, sd + 5), f'amarela-borda-{key}{tag}', f'Faixa amarela simples {label}{var}', CAT_PAINT,
                   ['faixa', 'linha', 'amarela', 'rua'] + tg, kind='floor', sort=0)
    sh.add(stop_line(False, 61), 'linha-parada-h', 'Linha de parada (horizontal)', CAT_PAINT, ['parada', 'linha', 'rua'] + tg, kind='floor', sort=0)
    sh.add(stop_line(True, 62), 'linha-parada-v', 'Linha de parada (vertical)', CAT_PAINT, ['parada', 'linha', 'rua'] + tg, kind='floor', sort=0)
    sh.add(crosswalk(True, 71), 'faixa-pedestre-ns', 'Faixa de pedestres (norte-sul)', CAT_PAINT, ['pedestre', 'faixa', 'rua'] + tg, kind='floor', sort=0)
    sh.add(crosswalk(False, 72), 'faixa-pedestre-ew', 'Faixa de pedestres (leste-oeste)', CAT_PAINT, ['pedestre', 'faixa', 'rua'] + tg, kind='floor', sort=0)
    sh.add(arrow(81), 'seta-chao', 'Seta pintada no chão (para a direita)', CAT_PAINT, ['seta', 'rua'] + tg, kind='floor', sort=0)
    sh.add(manhole(), 'bueiro', 'Tampa de bueiro', CAT_PAINT, ['bueiro', 'rua'] + tg, kind='floor', sort=0)

    sh.add(speed_limit(), 'placa-velocidade', 'Placa de velocidade (SPEED LIMIT 35)', CAT_SIGN, ['placa', 'velocidade', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(stop_sign(), 'placa-pare', 'Placa PARE (STOP)', CAT_SIGN, ['placa', 'pare', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(one_way(), 'placa-mao-unica', 'Placa de mão única (ONE WAY)', CAT_SIGN, ['placa', 'sentido', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(do_not_enter(), 'placa-proibido-entrar', 'Placa de entrada proibida', CAT_SIGN, ['placa', 'proibido', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(no_parking(), 'placa-estacionar', 'Placa de proibido estacionar', CAT_SIGN, ['placa', 'estacionar', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(hospital_sign(), 'placa-hospital', 'Placa de hospital (H azul)', CAT_SIGN, ['placa', 'hospital', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(school_crossing(), 'placa-escola', 'Placa de zona escolar', CAT_SIGN, ['placa', 'escola', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(street_name(), 'placa-rua', 'Placa de nome de rua (MAIN ST)', CAT_SIGN, ['placa', 'rua'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(railroad_crossing(), 'placa-trem', 'Placa de passagem de trem', CAT_SIGN, ['placa', 'trem', 'trânsito'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(exit_sign(), 'placa-saida', 'Placa verde de saída de estrada (EXIT)', CAT_SIGN, ['placa', 'estrada', 'saída'] + tg, solids=[solid(26, 4)], sort=3)

    sh.add(utility_pole(), 'poste-eletrico', 'Poste elétrico de madeira', CAT_US, ['poste', 'fio', 'luz'] + tg, solids=[solid(4, 4)], sort=3)
    sh.add(flag_pole(), 'bandeira-eua', 'Mastro com bandeira rasgada', CAT_US, ['bandeira', 'mastro'] + tg, solids=[solid(3, 3)], sort=3)
    sh.add(rural_mailbox(), 'caixa-correio-rural', 'Caixa de correio rural americana', CAT_US, ['correio', 'caixa'] + tg, solids=[solid(5, 4)], sort=3)
    sh.add(gas_sign(), 'placa-posto', 'Letreiro de posto de gasolina (GAS)', CAT_US, ['posto', 'gasolina', 'letreiro'] + tg, solids=[solid(4, 4)], sort=3)
    sh.add(parking_meter(), 'parquimetro', 'Parquímetro', CAT_US, ['parquímetro', 'rua'] + tg, solids=[solid(4, 3)], sort=3)
    sh.add(billboard(), 'outdoor-fedra', 'Outdoor da FEDRA (propaganda do governo)', CAT_US, ['outdoor', 'propaganda', 'FEDRA'] + tg, solids=[solid(36, 4)], sort=4)
    sh.add(school_bus(), 'onibus-escolar', 'Ônibus escolar amarelo abandonado', CAT_US, ['ônibus', 'escolar', 'veículo'] + tg, solids=[solid(62, 14)], sort=5)
    sh.add(graffiti_light(), 'pichacao-luz', 'Pichação "LOOK FOR THE LIGHT"', CAT_US, ['pichação', 'vagalume', 'parede'] + tg, kind='wall', sort=2)
