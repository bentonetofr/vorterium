"""Objetos: a natureza retomando as cidades (mato, hera, árvores mortas, poças, raízes)."""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

from .objects_ruins import crack, jag
from .palettes import *  # noqa: F403
from .px import Cv, rgb, rng, scatter
from .sheet import Sheet, solid

CAT = 'Apocalipse: Natureza'
TAGS = ['pós-apocalipse', 'natureza']


def blade(cv: Cv, x: int, y: int, h: int, lean: int, rp) -> None:
    for i in range(h):
        t = i / max(1, h - 1)
        cv.px(x + round(lean * t * t), y - i, rp[min(len(rp) - 1, 1 + int(t * (len(rp) - 1)))])


def grass_tuft(seed: int, w: int = 30, h: int = 28, rp=MOSS, n: int = 22) -> Cv:
    cv = Cv(w, h)
    r = rng(seed)
    for _ in range(n):
        x = r.randint(3, w - 4)
        blade(cv, x, h - 3, r.randint(h // 2, h - 6), r.randint(-4, 4), rp)
        blade(cv, x + 1, h - 3, r.randint(h // 2, h - 6), r.randint(-4, 4), rp)
    cv.finish(shadow=(w // 2, h - 2, w - 6, 5), outline=False)
    return cv


def bush(seed: int, w: int = 40, h: int = 32, rp=MOSS, dead: bool = False) -> Cv:
    cv = Cv(w, h)
    r = rng(seed)
    if dead:
        for _ in range(11):
            x0 = r.randint(8, w - 8)
            cv.line(x0, h - 4, x0 + r.randint(-9, 9), r.randint(4, h // 2), WOOD[2], 1)
        for _ in range(26):
            cv.px(r.randint(5, w - 5), r.randint(5, h - 8), LEAF_DEAD[r.randint(1, 4)])
    else:
        for k in range(7):
            cv.tex_ell(r.randint(2, w - 20), r.randint(4, h - 18), r.randint(14, 22), r.randint(12, 18), rp, seed + k, 2.5, 0.5)
    cv.finish(shadow=(w // 2, h - 3, w - 6, 6))
    return cv


def ivy_wall(seed: int, w: int = 44, h: int = 58) -> Cv:
    """Hera descendo pela parede."""
    cv = Cv(w, h)
    r = rng(seed)
    for k in range(7):
        x = r.randint(4, w - 5)
        y = r.randint(2, 10)
        for i in range(r.randint(18, h - 10)):
            x += r.choice((-1, 0, 0, 1)) if i % 3 == 0 else 0
            y += 1
            cv.px(x, y, MOSS[1])
            if r.random() < 0.38:
                s = r.randint(1, 2)
                tone = MOSS[r.randint(2, 4)]
                cv.rect(x + r.choice((-2, 1)), y, s + 1, s, tone)
    for k in range(16):
        cv.rect(r.randint(3, w - 6), r.randint(2, h - 8), 3, 2, MOSS[r.randint(2, 4)])
    cv.finish(outline=False)
    return cv


def dead_tree(seed: int = 40) -> Cv:
    cv = Cv(64, 112)
    r = rng(seed)
    cv.tex_poly([(26, 106), (29, 56), (28, 36), (38, 34), (38, 58), (42, 106)], WOOD, seed, 3, 0.5)
    cv.poly([(26, 106), (22, 109), (46, 109), (42, 106)], WOOD[1])
    for (x0, y0, x1, y1, th) in ((33, 46, 12, 22, 3), (34, 40, 54, 16, 3), (31, 66, 8, 54, 2), (36, 72, 58, 56, 2),
                                  (33, 34, 28, 8, 3), (36, 34, 46, 6, 2), (12, 22, 6, 14, 1), (54, 16, 60, 10, 1), (28, 8, 22, 4, 1)):
        cv.line(x0, y0, x1, y1, WOOD[1], th)
        if th > 1:
            cv.line(x0, y0 - 1, x1, y1 - 1, WOOD[3], 1)
    crack(cv, 33, 60, 20, seed + 1, WOOD[0])
    for _ in range(8):
        cv.px(r.randint(28, 40), r.randint(40, 100), MOSS[r.randint(1, 3)])
    cv.finish(shadow=(34, 108, 40, 7))
    return cv


def broken_trunk(seed: int = 50) -> Cv:
    cv = Cv(48, 44)
    cv.tex_poly([(14, 40), (16, 14), (20, 8), (24, 14), (28, 6), (32, 14), (34, 40)], WOOD, seed, 3, 0.5)
    cv.poly([(14, 40), (10, 42), (38, 42), (34, 40)], WOOD[1])
    cv.line(20, 8, 24, 14, WOOD[4]); cv.line(28, 6, 32, 14, WOOD[4])
    crack(cv, 24, 18, 14, seed + 1, WOOD[0])
    r = rng(seed)
    for _ in range(14):
        cv.px(r.randint(14, 34), r.randint(20, 40), MOSS[r.randint(1, 3)])
    cv.finish(shadow=(24, 41, 30, 5))
    return cv


def puddle(seed: int, w: int = 44, h: int = 22) -> Cv:
    cv = Cv(w, h)
    pts = jag(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 12, 0.22, seed)
    cv.poly(pts, rgb('#22343a', 215))
    cv.poly(jag(w / 2 - 2, h / 2 - 1, w / 3, h / 3, 10, 0.2, seed + 1), rgb('#3a5560', 160))
    cv.line(w // 3, h // 2 - 2, w // 3 + 6, h // 2 - 2, rgb('#9bb8bd', 150))
    cv.line(w // 2 + 2, h // 2 + 2, w // 2 + 7, h // 2 + 2, rgb('#9bb8bd', 110))
    cv.finish(outline=False)
    return cv


def leaves(seed: int, w: int = 40, h: int = 22) -> Cv:
    cv = Cv(w, h)
    r = rng(seed)
    for _ in range(34):
        x, y = r.randint(2, w - 4), r.randint(2, h - 4)
        tone = LEAF_DEAD[r.randint(1, 4)]
        cv.rect(x, y, 2, 1, tone)
        if r.random() < 0.5:
            cv.px(x + 1, y + 1, LEAF_DEAD[0])
    cv.finish(outline=False)
    return cv


def roots_asphalt(seed: int = 60) -> Cv:
    cv = Cv(56, 32)
    r = rng(seed)
    cv.poly(jag(28, 16, 24, 11, 11, 0.25, seed), rgb('#171512'))
    for k in range(7):
        a = r.uniform(0, math.tau)
        x, y = 28 + math.cos(a) * 3, 16 + math.sin(a) * 2
        for i in range(r.randint(10, 24)):
            a += r.uniform(-0.3, 0.3)
            x += math.cos(a); y += math.sin(a) * 0.7
            cv.px(round(x), round(y), WOOD[2]); cv.px(round(x), round(y) - 1, WOOD[3])
    for _ in range(14):
        cv.px(r.randint(6, 50), r.randint(5, 26), MOSS[r.randint(2, 4)])
    cv.finish(outline=False)
    return cv


def pavement_weeds(seed: int = 70) -> Cv:
    cv = Cv(48, 24)
    r = rng(seed)
    crack(cv, 8, 2, 20, seed, rgb('#14120e'))
    crack(cv, 30, 2, 18, seed + 1, rgb('#14120e'))
    for _ in range(6):
        x = r.randint(6, 42)
        for k in range(r.randint(3, 6)):
            blade(cv, x + k, 20, r.randint(5, 9), r.randint(-3, 3), MOSS)
    cv.finish(outline=False)
    return cv


def build(sh: Sheet) -> None:
    for i, rp in enumerate((MOSS, MOSS_DRY)):
        sh.add(grass_tuft(300 + i * 5, 30, 28, rp), f'mato-alto-{i + 1}', f'Mato alto {"verde" if i == 0 else "seco"}', CAT, ['mato', 'capim'] + TAGS, sort=2,
               group='mato-alto-1' if i else None, variant='Seco' if i else None)
    sh.add(grass_tuft(320, 40, 34, MOSS, 34), 'mato-denso', 'Mato denso', CAT, ['mato', 'capim'] + TAGS, solids=[solid(14, 6)], sort=3)
    sh.add(bush(330, 44, 34, MOSS), 'arbusto-invasor', 'Arbusto invadindo', CAT, ['arbusto', 'mato'] + TAGS, solids=[solid(16, 8)], sort=3)
    sh.add(bush(335, 44, 34, MOSS_DRY, dead=True), 'arbusto-seco', 'Arbusto seco', CAT, ['arbusto', 'seco'] + TAGS, solids=[solid(14, 7)], sort=3)
    for i, (w, h) in enumerate(((44, 58), (36, 50))):
        sh.add(ivy_wall(340 + i * 9, w, h), f'hera-parede-{i + 1}', f'Hera na parede {i + 1}', CAT, ['hera', 'parede', 'trepadeira'] + TAGS, kind='wall', sort=0,
               group='hera-parede-1' if i else None, variant=f'Variação {i + 1}' if i else None)
    sh.add(dead_tree(), 'arvore-morta', 'Árvore morta', CAT, ['árvore', 'morta'] + TAGS, solids=[solid(7, 5)], sort=4)
    sh.add(broken_trunk(), 'tronco-quebrado', 'Tronco quebrado', CAT, ['tronco', 'árvore'] + TAGS, solids=[solid(10, 6)], sort=3)
    sh.add(puddle(360, 44, 22), 'poca-1', 'Poça d\'água 1', CAT, ['poça', 'água', 'chuva'] + TAGS, kind='floor', sort=0)
    sh.add(puddle(364, 30, 16), 'poca-2', 'Poça d\'água 2', CAT, ['poça', 'água', 'chuva'] + TAGS, kind='floor', sort=0,
           group='poca-1', variant='Pequena')
    sh.add(leaves(370), 'folhas-secas', 'Folhas secas', CAT, ['folhas', 'outono'] + TAGS, kind='floor', sort=0)
    sh.add(roots_asphalt(), 'raizes-asfalto', 'Raízes rachando o asfalto', CAT, ['raízes', 'asfalto', 'rachadura'] + TAGS, kind='floor', sort=0)
    sh.add(pavement_weeds(), 'rachadura-ervas', 'Rachadura com ervas daninhas', CAT, ['rachadura', 'ervas'] + TAGS, kind='floor', sort=0)
