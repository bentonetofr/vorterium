"""Monstro de cabeças do Vortable: um "corpo" completo, desenhado por código, pra ser um inimigo grande.

A criatura (do desenho do usuário): um gigante curvado, de barriga pálida e braços grossos de garras curvas, com uma juba
de cachos em espiral por cima dos ombros. No meio da juba, a cabeça principal é de jacaré, de boca aberta e cheia de
dentes; mais cabeças menores brotam da juba (uma de máscara quadrada à esquerda, outra pequena na ponta direita) e um
rostinho aparece até no pé direito. Espirais e faixas enroladas enfeitam braços e pernas.

Cada folha segue o padrão do personagem (LPC): linhas 0 = de costas, 1 = olhando pra esquerda, 2 = de frente, 3 = olhando pra
direita; colunas = quadros (caminhar 9, correr 8, parado 2). Fica no quadro de 64x64 com os pés na linha 61 e é ampliado pelo
motor (altura `MONSTRO_ESCALA`), então é pixel grosso de propósito.

O corpo usa a cabeça vazia que o cachorro criou (`tlou/head/nenhuma`).
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw

from .dog import ANIMS, BASE, BODIES, SHEETS
from .px import RGBA, Cv, _hash, mix, ramp, rgb

SEED = 313
MONSTRO_ESCALA = 1.9          # quanto o motor amplia o monstro (aparência.height)

# ── Cores ─────────────────────────────────────────────────
#   skin = a pele (barriga e membros); mane = a juba e os cachos; teeth = dentes e garras.
SKINS: dict[str, dict] = {
    'pergaminho': {            # como o desenho: pele de osso, juba de pedra cinza
        'skin': ramp('#4d4a45', '#7a766d', '#a39e92', '#c6c0b0', '#e2dccb'),
        'mane': ramp('#1d2224', '#2f3b3d', '#455659', '#617577', '#85999a'),
        'eye': rgb('#f0c43c'),
    },
    'musgo': {
        'skin': ramp('#3c4533', '#5d6b4d', '#7f8f69', '#a2b384', '#c5d3a6'),
        'mane': ramp('#16241a', '#233b27', '#355437', '#4d7050', '#6f9570'),
        'eye': rgb('#e8e04a'),
    },
    'brasa': {
        'skin': ramp('#4a3834', '#76554b', '#9f7467', '#c49685', '#e0baa8'),
        'mane': ramp('#2a1010', '#4a1a18', '#6e2a24', '#933d33', '#b95a4a'),
        'eye': rgb('#ffb02e'),
    },
    'noite': {
        'skin': ramp('#2b2f3d', '#434a5f', '#5f6882', '#808aa6', '#a6b0cb'),
        'mane': ramp('#0c0f1a', '#161c30', '#222b4a', '#33406a', '#4b5b92'),
        'eye': rgb('#7fe4ff'),
    },
}
TEETH = ramp('#7d7561', '#b4ab94', '#d8d0b8', '#ede6d0', '#fbf6e6')
MOUTH = ramp('#2a0c0c', '#4a1414', '#6e2020')
INK = rgb('#101214')


def _lerp(a: RGBA, b: RGBA, t: float) -> RGBA:
    return mix(a, b, t)


class Draw:
    """Um quadro em construção: formas com textura, contorno por peça e espirais."""

    def __init__(self, pal: dict, seed: int):
        self.cv = Cv(64, 64)
        self.pal = pal
        self.seed = seed

    # máscaras ---------------------------------------------------------------
    @staticmethod
    def mask(fn) -> Image.Image:
        m = Image.new('L', (64, 64), 0)
        fn(ImageDraw.Draw(m))
        return m

    def fill(self, m: Image.Image, rp: list[RGBA], light: float = 0.55, scale: float = 3.4, grain: float = 0.1,
             edge: bool = True, seed_off: int = 0) -> None:
        self.cv._tex(m, rp, self.seed + seed_off, scale, light, grain)
        if edge:
            self.edge(m, _lerp(rp[0], INK, 0.35 if rp is self.pal['skin'] else 0.6))

    def edge(self, m: Image.Image, c: RGBA) -> None:
        p = m.load()
        for y in range(64):
            for x in range(64):
                if p[x, y] < 128:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < 64 and 0 <= ny < 64) or p[nx, ny] < 128:
                        self.cv.px(x, y, c)
                        break

    # formas simples ---------------------------------------------------------
    def ell(self, cx: float, cy: float, rx: float, ry: float, rp: list[RGBA], **kw) -> Image.Image:
        m = self.mask(lambda d: d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=255))
        self.fill(m, rp, **kw)
        return m

    def poly(self, pts: list[tuple[float, float]], rp: list[RGBA], **kw) -> Image.Image:
        m = self.mask(lambda d: d.polygon([(round(x), round(y)) for x, y in pts], fill=255))
        self.fill(m, rp, **kw)
        return m

    def limb(self, pts: list[tuple[float, float]], widths: list[float], rp: list[RGBA], **kw) -> Image.Image:
        """Uma perna ou braço grosso: círculos ao longo dos pontos (largura que muda)."""
        def go(d: ImageDraw.ImageDraw) -> None:
            steps = 14
            for i in range(len(pts) - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                w0, w1 = widths[i], widths[i + 1]
                for s in range(steps + 1):
                    t = s / steps
                    x, y, w = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t
                    d.ellipse([round(x - w / 2), round(y - w / 2), round(x + w / 2), round(y + w / 2)], fill=255)
        m = self.mask(go)
        self.fill(m, rp, **kw)
        return m

    # detalhes ---------------------------------------------------------------
    def px(self, x: float, y: float, c: RGBA, within: Image.Image | None = None) -> None:
        xi, yi = round(x), round(y)
        if within is not None and (not (0 <= xi < 64 and 0 <= yi < 64) or within.getpixel((xi, yi)) < 128):
            return
        self.cv.px(xi, yi, c)

    def swirl(self, cx: float, cy: float, r: float, c: RGBA, turns: float = 1.6, flip: bool = False,
              within: Image.Image | None = None, start: float = 0.0) -> None:
        """Espiral que sai do centro e abre (o enfeite de nuvem da juba)."""
        n = int(r * turns * 9) + 6
        for i in range(n):
            t = i / n
            a = start + t * turns * 2 * math.pi * (-1 if flip else 1)
            rr = r * t
            self.px(cx + math.cos(a) * rr, cy + math.sin(a) * rr, c, within)

    def band(self, x0: float, y0: float, x1: float, y1: float, bend: float, c: RGBA, within: Image.Image | None = None) -> None:
        """Faixa enrolada (uma linha curva) de (x0,y0) a (x1,y1), curvada pra baixo em `bend` px no meio."""
        n = int(abs(x1 - x0) + abs(y1 - y0)) * 2 + 2
        for i in range(n + 1):
            t = i / n
            self.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + math.sin(t * math.pi) * bend, c, within)

    def claw(self, x: float, y: float, dx: float, dy: float, length: float, base: float = 1.6, c: list[RGBA] | None = None) -> None:
        """Garra: triângulo fino de (x, y) na direção (dx, dy)."""
        c = c or TEETH
        n = math.hypot(dx, dy) or 1
        ux, uy = dx / n, dy / n
        px_, py_ = -uy, ux
        steps = int(length * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            w = base * (1 - t)
            for s in (-1, 0, 1):
                if abs(s) > w + 0.2:
                    continue
                col = c[3] if s <= 0 else c[2]
                if t > 0.7:
                    col = c[4]
                self.cv.px(round(x + ux * length * t + px_ * s * 0.7), round(y + uy * length * t + py_ * s * 0.7), col)
        self.cv.px(round(x + ux * length * 0.15 - px_ * 1.2), round(y + uy * length * 0.15 - py_ * 1.2), INK)

    def tooth(self, x: float, y: float, up: bool, size: int = 2) -> None:
        for i in range(size):
            w = size - i
            for k in range(w if w > 1 else 1):
                self.cv.px(round(x + k - (w - 1) / 2), round(y + (i if up else -i)), TEETH[4 if k == 0 else 3])

    def eye(self, x: float, y: float, c: RGBA, slit: bool = True, big: bool = False) -> None:
        self.cv.px(round(x), round(y), c)
        self.cv.px(round(x) + 1, round(y), c)
        if big:
            self.cv.px(round(x), round(y) - 1, c)
            self.cv.px(round(x) + 1, round(y) - 1, c)
        if slit:
            self.cv.px(round(x) + 1, round(y), INK)
        self.cv.px(round(x) - 1, round(y), INK)
        self.cv.px(round(x) + 2, round(y), INK)

    def cloud(self, cx: float, cy: float, r: float, rp: list[RGBA], seed_off: int, flip: bool = False) -> None:
        """Um cacho da juba: bolota com uma espiral escura dentro."""
        m = self.ell(cx, cy, r, r * 0.92, rp, light=0.65, scale=2.2, seed_off=seed_off)
        self.swirl(cx + 0.3, cy, r * 0.62, rp[0], turns=1.35, flip=flip, within=m, start=seed_off * 0.9)
        self.px(cx - r * 0.5, cy - r * 0.55, rp[4], m)


# ── Passo ─────────────────────────────────────────────────

def _gait(anim: str, f: int) -> dict[str, float]:
    if anim == 'idle':
        return {'bob': 0.0, 'mane': 1.0 if f else 0.0, 'll': 0.0, 'lr': 0.0, 'al': 0.0, 'ar': 0.0, 'sx': 0.0, 'breath': 1.0 if f else 0.0}
    if anim == 'walk' and f == 0:
        return {'bob': 0.0, 'mane': 0.0, 'll': 0.0, 'lr': 0.0, 'al': 0.0, 'ar': 0.0, 'sx': 0.0, 'breath': 0.0}
    n = 8
    i = (f - 1) if anim == 'walk' else f
    ph = 2 * math.pi * i / n
    run = anim == 'run'
    lift = 3.2 if run else 2.2
    swing = 4.0 if run else 2.6
    return {
        'bob': (1.4 if run else 1.0) * abs(math.cos(ph)),
        'mane': 0.8 * math.sin(2 * ph + 1.2),
        'll': max(0.0, math.sin(ph)) * lift, 'lr': max(0.0, -math.sin(ph)) * lift,
        'al': -math.sin(ph) * swing, 'ar': math.sin(ph) * swing,
        'sx': math.sin(ph) * (1.4 if run else 0.8),
        'breath': 0.0,
    }


# ── De frente ─────────────────────────────────────────────

def _front(pal: dict, anim: str, f: int) -> Cv:
    g = _gait(anim, f)
    d = Draw(pal, SEED)
    skin, mane = pal['skin'], pal['mane']
    eye = pal['eye']
    b = round(g['bob'])                 # corpo desce um pouco no meio do passo
    mb = round(g['bob'] + g['mane'])
    ll, lr = round(g['ll']), round(g['lr'])
    al, ar = round(g['al']), round(g['ar'])
    sx = round(g['sx'])

    # juba de trás (a massa atrás dos ombros e da cabeça)
    back = d.ell(32, 14 + mb, 24, 9.5, mane, light=0.5, seed_off=3)
    # braços (atrás do tronco)
    for side in (-1, 1):
        sw = al if side < 0 else ar
        cx = 32 + side * 16
        hx = 32 + side * (21.5 if side > 0 else 20.5)
        pts = [(cx, 24 + b), (cx + side * 2.5, 36 + b + sw // 2), (hx, 47 + b + sw)]
        arm = d.limb(pts, [10, 8.5, 7.5], skin, light=0.72, seed_off=7 + side)
        d.swirl(cx + side * 2, 32 + b + sw // 3, 2.8, skin[1], turns=1.3, flip=side > 0, within=arm)   # espiral no braço
        d.band(hx - 3.5, 41 + b + sw, hx + 3.5, 41 + b + sw, 1.2, skin[1], arm)
        d.band(hx - 3.5, 44 + b + sw, hx + 3.5, 44 + b + sw, 1.0, skin[1], arm)
        # mão: palma e dedos curvos com garras
        hy = 50 + b + sw
        d.ell(hx, hy, 4.6, 3.4, skin, light=0.72, seed_off=11 + side)
        for k, off in enumerate((-3.6, -1.2, 1.2, 3.6)):
            fx = hx + off
            d.limb([(fx, hy + 2), (fx + side * 0.8 + off * 0.1, hy + 5)], [2.0, 1.6], skin, edge=False, light=0.6)
            d.claw(fx + side * 0.8 + off * 0.1, hy + 5, side * 0.45 + (off * 0.1), 1, 3.0, 1.0)
    # pernas
    for side in (-1, 1):
        lift = ll if side < 0 else lr
        cx = 32 + side * 8.5 + (sx if side < 0 else -sx)
        pts = [(cx + side * 0.5, 40 + b), (cx + side * 0.6, 49 + b - lift // 2), (cx + side * 1.2, 56 - lift)]
        leg = d.limb(pts, [12.5, 10, 8.5], skin, light=0.7, seed_off=19 + side)
        d.band(cx - 4.5, 47 + b - lift // 3, cx + 4.5, 47 + b - lift // 3, 1.8, skin[0], leg)          # faixas enroladas na canela
        d.band(cx - 4.2, 51 + b - lift // 2, cx + 4.2, 51 + b - lift // 2, 1.6, skin[0], leg)
        d.swirl(cx - side * 1.5, 43 + b, 2.8, skin[0], turns=1.3, flip=side < 0, within=leg)
        fy = 58 - lift
        foot = d.ell(cx + side * 1.8, fy, 7.2, 3.6, skin, light=0.7, seed_off=23 + side)
        for off in (-5.2, -1.4, 2.6):                                                                    # 3 garras apontando pra baixo
            d.claw(cx + side * 1.8 + off + 0.6, fy + 2.4, off * 0.12, 1, 3.4 if lift == 0 else 2.6, 1.1)
    # rostinho no pé direito (de quem olha): o pé da direita
    fy = 58 - lr
    fcx = 32 + 8.5 - sx + 1.8
    d.ell(fcx + 5.5, fy - 0.5, 3.4, 2.7, mane, light=0.6, seed_off=31)
    d.px(fcx + 4.4, fy - 1.3, eye)
    d.px(fcx + 6.4, fy - 1.3, eye)
    d.px(fcx + 5.4, fy + 0.8, TEETH[4])
    d.px(fcx + 4.4, fy + 1.0, TEETH[3])

    # tronco e barriga
    belly = d.ell(32, 33 + b, 13.5, 12.5, skin, light=0.72, seed_off=41)
    d.band(22, 28 + b, 42, 28 + b, 2.0, skin[1], belly)                                                    # peito
    d.px(32, 36 + b, skin[0], belly)
    d.px(32, 37 + b, skin[1], belly)
    d.band(22, 41 + b, 42, 41 + b, 2.6, skin[0], belly)                                                    # dobras da barriga
    d.band(24, 44 + b, 40, 44 + b, 1.8, skin[0], belly)
    # pano (tanga enrolada)
    cloth = d.poly([(21, 43 + b), (43, 43 + b), (41, 49 + b), (32, 52 + b), (23, 49 + b)], mane, light=0.55, seed_off=47)
    d.band(22, 45 + b, 42, 45 + b, 1.4, mane[4], cloth)
    d.swirl(32, 48 + b, 2.6, mane[0], turns=1.2, within=cloth)

    # juba da frente: cachos em volta do pescoço e dos ombros
    cl = [(12, 18), (17, 11), (23, 8), (26, 17), (47, 17), (53, 19), (49, 24), (14, 24), (20, 22), (44, 23), (31, 21), (37, 22)]
    for i, (x, y) in enumerate(cl):
        d.cloud(x, y + mb, 4.1 if i % 3 else 4.7, mane, 50 + i, flip=i % 2 == 0)

    # cabeça da esquerda: máscara quadrada, dentro da juba
    sq = d.poly([(9, 11 + mb), (21, 10 + mb), (22, 21 + mb), (10, 22 + mb)], mane, light=0.6, seed_off=70)
    for ex in (11.5, 17.5):
        d.cv.rect(round(ex), 14 + mb, 3, 2, INK)
        d.px(ex + 1, 14 + mb, eye)
    d.cv.rect(14, 18 + mb, 2, 1, INK)
    d.cv.rect(12, 20 + mb, 7, 1, mane[0])
    # cabeça pequena da ponta direita
    sm = d.ell(57, 13 + mb, 4.6, 3.6, mane, light=0.6, seed_off=77)
    d.px(57.5, 11.6 + mb, eye, sm)
    d.px(55.3, 14.5 + mb, TEETH[4], sm)
    d.px(58.8, 14.8 + mb, TEETH[4], sm)
    # espiral solta no alto
    d.swirl(42, 6 + mb, 3.8, mane[3], turns=1.5, flip=True)
    d.swirl(42, 6 + mb, 3.8, mane[1], turns=1.5, flip=True, start=0.5)

    # cabeça principal: jacaré de boca aberta, olhando pra baixo e pra direita
    hx, hy = 38, 10 + mb
    skull = d.poly([(hx - 6, hy + 1), (hx - 3, hy - 4), (hx + 5, hy - 5), (hx + 10, hy - 1), (hx + 12, hy + 3), (hx - 1, hy + 4)], mane, light=0.65, seed_off=90)
    d.poly([(hx - 2, hy + 3), (hx + 12, hy + 3), (hx + 15, hy + 6), (hx + 1, hy + 8)], MOUTH, light=0.4, seed_off=91)           # a boca aberta
    low = d.poly([(hx - 2, hy + 8), (hx + 15, hy + 7), (hx + 12, hy + 12), (hx + 0, hy + 12)], mane, light=0.6, seed_off=92)    # queixo
    for i in range(5):                                                                                                       # dentes
        d.tooth(hx + 0 + i * 2.8, hy + 4, up=True, size=2 + (i % 2))
    for i in range(4):
        d.tooth(hx + 2 + i * 3.0, hy + 8, up=False, size=2)
    d.eye(hx + 3, hy - 2, eye, big=True)
    d.cv.line(hx, hy - 4, hx + 7, hy - 3, mane[0])                                                                          # sobrancelha
    d.px(hx + 11, hy, mane[0], skull)
    d.px(hx + 9, hy - 1, mane[0], skull)
    for k in range(3):                                                                                                       # placas de escama no topo
        d.px(hx - 3 + k * 3, hy - 4, mane[4], skull)

    d.cv.outline(INK)
    return d.cv


# ── De costas ─────────────────────────────────────────────

def _back(pal: dict, anim: str, f: int) -> Cv:
    g = _gait(anim, f)
    d = Draw(pal, SEED)
    skin, mane = pal['skin'], pal['mane']
    b = round(g['bob'])
    mb = round(g['bob'] + g['mane'])
    ll, lr = round(g['ll']), round(g['lr'])
    al, ar = round(g['al']), round(g['ar'])
    sx = round(g['sx'])
    for side in (-1, 1):
        sw = al if side < 0 else ar
        cx = 32 + side * 16
        hx = 32 + side * 21
        arm = d.limb([(cx, 24 + b), (cx + side * 2.5, 36 + b + sw // 2), (hx, 47 + b + sw)], [10, 8.5, 7.5], skin, light=0.72, seed_off=7 + side)
        d.band(hx - 3.5, 41 + b + sw, hx + 3.5, 41 + b + sw, 1.2, skin[1], arm)
        hy = 50 + b + sw
        d.ell(hx, hy, 4.6, 3.4, skin, light=0.72, seed_off=11 + side)
        for off in (-3.6, -1.2, 1.2, 3.6):
            d.claw(hx + off, hy + 3, off * 0.1, 1, 3.0, 1.0)
    for side in (-1, 1):
        lift = ll if side < 0 else lr
        cx = 32 + side * 8.5 + (sx if side < 0 else -sx)
        leg = d.limb([(cx, 40 + b), (cx + side * 0.6, 49 + b - lift // 2), (cx + side * 1.2, 56 - lift)], [12.5, 10, 8.5], skin, light=0.7, seed_off=19 + side)
        d.band(cx - 4.5, 47 + b - lift // 3, cx + 4.5, 47 + b - lift // 3, 1.8, skin[0], leg)
        d.band(cx - 4.2, 51 + b - lift // 2, cx + 4.2, 51 + b - lift // 2, 1.6, skin[0], leg)
        fy = 58 - lift
        d.ell(cx + side * 1.8, fy, 7.2, 3.6, skin, light=0.7, seed_off=23 + side)
        for off in (-5.2, -1.4, 2.6):
            d.claw(cx + side * 1.8 + off + 0.6, fy + 2.4, off * 0.12, 1, 3.4 if lift == 0 else 2.6, 1.1)
    torso = d.ell(32, 33 + b, 13.5, 13, skin, light=0.72, seed_off=41)
    cloth = d.poly([(20, 42 + b), (44, 42 + b), (42, 49 + b), (32, 52 + b), (22, 49 + b)], mane, light=0.55, seed_off=47)
    d.swirl(32, 46 + b, 3, mane[0], turns=1.2, within=cloth)
    # espinha de placas escuras
    for i in range(7):
        y = 22 + b + i * 3
        d.cv.rect(30, y, 4, 2, mane[1 + i % 2])
        d.px(31, y, mane[4])
    # juba cobrindo as costas
    d.ell(32, 15 + mb, 24, 10, mane, light=0.5, seed_off=3)
    cl = [(12, 17), (16, 10), (23, 6), (31, 4), (39, 5), (46, 8), (51, 13), (54, 19), (13, 23), (21, 20), (30, 19), (38, 20), (46, 21), (50, 25), (23, 12), (32, 11), (41, 12), (32, 25), (20, 26), (44, 26)]
    for i, (x, y) in enumerate(cl):
        d.cloud(x, y + mb, 4.1 if i % 3 else 4.7, mane, 50 + i, flip=i % 2 == 0)
    d.swirl(32, 4 + mb, 3.6, mane[3], turns=1.5)
    d.cv.outline(INK)
    return d.cv


# ── De lado (olhando pra esquerda) ────────────────────────

def _side(pal: dict, anim: str, f: int) -> Cv:
    g = _gait(anim, f)
    d = Draw(pal, SEED)
    skin, mane = pal['skin'], pal['mane']
    eye = pal['eye']
    b = round(g['bob'])
    mb = round(g['bob'] + g['mane'])
    ll, lr = round(g['ll']), round(g['lr'])
    al, ar = round(g['al']), round(g['ar'])
    sx = round(g['sx'] * 1.6)

    # braço de trás e perna de trás
    far = d.limb([(36, 25 + b), (39, 36 + b - ar // 2), (38 - ar, 47 + b)], [8, 7, 6.5], _dark(skin), light=0.62, seed_off=5)
    d.ell(38 - ar, 50 + b, 4.2, 3.2, _dark(skin), light=0.62, seed_off=6)
    cx2 = 37 + sx
    d.limb([(cx2 + 1, 42 + b), (cx2 + 2, 49 + b - lr // 2), (cx2 + 1, 56 - lr)], [11, 9, 8], _dark(skin), light=0.66, seed_off=9)
    d.ell(cx2 - 1, 58 - lr, 6, 3.4, _dark(skin), light=0.66, seed_off=10)
    for off in (-5, -2.4, 0.4):
        d.claw(cx2 - 1 + off, 60 - lr, -0.45, 1, 3.0, 1.0)

    # juba de trás
    d.ell(38, 15 + mb, 18, 10, mane, light=0.5, seed_off=3)
    # tronco curvado pra frente
    torso = d.ell(31, 34 + b, 13, 13, skin, light=0.72, seed_off=41)
    d.band(20, 41 + b, 33, 41 + b, 2.2, skin[0], torso)
    d.band(21, 44 + b, 32, 44 + b, 1.6, skin[0], torso)
    d.px(21, 37 + b, skin[0], torso)
    cloth = d.poly([(21, 43 + b), (40, 43 + b), (38, 49 + b), (30, 52 + b), (22, 49 + b)], mane, light=0.55, seed_off=47)
    d.swirl(29, 47 + b, 2.6, mane[0], turns=1.2, within=cloth)
    # perna da frente
    cx = 27 - sx
    leg = d.limb([(cx + 1, 41 + b), (cx - 0.5, 49 + b - ll // 2), (cx - 1.5, 56 - ll)], [12.5, 10, 8.5], skin, light=0.72, seed_off=19)
    d.band(cx - 4, 47 + b - ll // 3, cx + 4, 47 + b - ll // 3, 1.6, skin[0], leg)
    d.band(cx - 4, 51 + b - ll // 2, cx + 4, 51 + b - ll // 2, 1.4, skin[0], leg)
    d.swirl(cx + 0.5, 43 + b, 2.6, skin[0], turns=1.3, within=leg)
    foot = d.ell(cx - 3, 58 - ll, 7, 3.6, skin, light=0.72, seed_off=23)
    for off in (-6, -3, -0.2):
        d.claw(cx - 3 + off, 60 - ll, -0.5, 1, 3.2, 1.0)
    # rostinho no pé
    d.ell(cx - 8.5, 57 - ll, 3, 2.5, mane, light=0.6, seed_off=31)
    d.px(cx - 9.5, 56.2 - ll, eye)
    d.px(cx - 10.5, 58 - ll, TEETH[4])
    # braço da frente
    arm = d.limb([(29, 25 + b), (27, 36 + b + al // 2), (26 + al // 2, 47 + b + al)], [9.5, 8.5, 7.5], skin, light=0.72, seed_off=7)
    d.swirl(27, 31 + b, 3.0, skin[0], turns=1.3, within=arm)
    d.band(22 + al // 2, 42 + b + al, 30 + al // 2, 42 + b + al, 1.2, skin[1], arm)
    hx, hy = 26 + al // 2, 50 + b + al
    d.ell(hx, hy, 4.6, 3.4, skin, light=0.72, seed_off=11)
    for off in (-3.6, -1.4, 0.8, 3.0):
        d.limb([(hx + off, hy + 2), (hx + off - 0.6, hy + 4.6)], [2.2, 1.8], skin, edge=False, light=0.5)
        d.claw(hx + off - 0.6, hy + 4.6, -0.4, 1, 3.0, 1.0)

    # juba da frente
    cl = [(41, 12), (47, 17), (44, 23), (36, 22), (29, 23), (50, 22), (37, 12), (32, 17)]
    for i, (x, y) in enumerate(cl):
        d.cloud(x, y + mb, 4.1 if i % 3 else 4.7, mane, 50 + i, flip=i % 2 == 0)
    # cabeça pequena de trás (máscara) e cabeça principal de jacaré apontando pra esquerda
    sq = d.poly([(33, 8 + mb), (41, 8 + mb), (42, 18 + mb), (34, 19 + mb)], mane, light=0.6, seed_off=70)
    d.cv.rect(36, 12 + mb, 3, 2, INK)
    d.px(37, 12 + mb, eye)
    d.cv.rect(36, 16 + mb, 4, 1, mane[0])
    hx, hy = 24, 10 + mb
    skull = d.poly([(hx + 8, hy + 1), (hx + 5, hy - 4), (hx - 3, hy - 4), (hx - 9, hy), (hx - 12, hy + 3), (hx + 1, hy + 4)], mane, light=0.65, seed_off=90)
    d.poly([(hx + 2, hy + 3), (hx - 12, hy + 3), (hx - 15, hy + 6), (hx - 1, hy + 8)], MOUTH, light=0.4, seed_off=91)
    d.poly([(hx + 2, hy + 8), (hx - 15, hy + 7), (hx - 12, hy + 12), (hx - 0, hy + 12)], mane, light=0.6, seed_off=92)
    for i in range(5):
        d.tooth(hx - i * 2.8, hy + 4, up=True, size=2 + (i % 2))
    for i in range(4):
        d.tooth(hx - 2 - i * 3.0, hy + 8, up=False, size=2)
    d.eye(hx - 5, hy - 2, eye, big=True)
    d.cv.line(hx - 9, hy - 3, hx - 3, hy - 4, mane[0])
    d.swirl(44, 7 + mb, 3.6, mane[3], turns=1.5, flip=True)
    d.cv.outline(INK)
    return d.cv


def _dark(rp: list[RGBA], t: float = 0.28) -> list[RGBA]:
    return [mix(c, rgb('#000000'), t) for c in rp]


def frame(skin: str, anim: str, row: int, f: int) -> Image.Image:
    pal = SKINS[skin]
    cv = _front(pal, anim, f) if row == 2 else _back(pal, anim, f) if row == 0 else _side(pal, anim, f)
    if row == 3:
        cv = cv.flipped()
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    wide = 44 if row in (1, 3) else 48
    ImageDraw.Draw(sh).ellipse([32 - wide // 2, BASE - 2, 32 + wide // 2, BASE + 2], fill=(0, 0, 0, 70))
    sh.alpha_composite(cv.im)
    return sh


def sheet(skin: str, anim: str) -> Image.Image:
    n = ANIMS[anim]
    out = Image.new('RGBA', (n * 64, 256), (0, 0, 0, 0))
    for row in range(4):
        for f in range(n):
            out.alpha_composite(frame(skin, anim, row, f), (f * 64, row * 64))
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    """Folhas do monstro (`tlou/monsters/cabecas/<anim>/<variante>.png`) e o item do catálogo."""
    base_rel = 'tlou/monsters/cabecas/'
    for anim in ANIMS:
        d = os.path.join(assets, SHEETS, base_rel, anim)
        os.makedirs(d, exist_ok=True)
        for skin in SKINS:
            sheet(skin, anim).save(os.path.join(d, f'{skin}.png'), optimize=True)
    items = [
        {'id': 'tlou/body/monstro-cabecas', 'slot': 'body', 'name': 'Monstro de cabeças', 'layers': [{'z': 10, 'paths': {b: base_rel for b in BODIES}}],
         'bodies': list(BODIES), 'anims': list(ANIMS), 'variants': list(SKINS)},
    ]
    return [], items


def preview(assets: str, out: str, scale: int = 4) -> None:
    """Folha de contato: a primeira variante em andar (4 direções, 3 quadros), e as outras de frente."""
    frames = (0, 3, 6)
    names = list(SKINS)
    full = sheet(names[0], 'walk')
    big = Image.new('RGBA', (len(frames) * 64 + 10 + 4 * 64 + 10, 4 * 64 + 6), (62, 56, 48, 255))
    for row in range(4):
        for k, fr in enumerate(frames):
            big.alpha_composite(full.crop((fr * 64, row * 64, fr * 64 + 64, row * 64 + 64)), (k * 64, row * 64))
    x0 = len(frames) * 64 + 10
    for i, n in enumerate(names):
        big.alpha_composite(sheet(n, 'walk').crop((0, 2 * 64, 64, 3 * 64)), (x0 + i * 64, 0))
        big.alpha_composite(sheet(n, 'walk').crop((3 * 64, 0, 4 * 64, 64)), (x0 + i * 64, 70))
    big = big.resize((big.width * scale // 2, big.height * scale // 2), Image.NEAREST)
    big.save(out)
