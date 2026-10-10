"""Ferramentas de pixel art do gerador de arte "Last of Us" do Vortable.

Tudo aqui é desenho por código (sem imagens de terceiros): formas preenchidas com
textura de ruído, contorno de 1 px, sombra no chão. O estilo segue o do resto do
catálogo (LPC): visão 3/4, luz vindo de cima à esquerda, 3 a 5 tons por material.
"""
from __future__ import annotations

import math
import random

from PIL import Image, ImageDraw

RGBA = tuple[int, int, int, int]


def rgb(h: str, a: int = 255) -> RGBA:
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def mix(a: RGBA, b: RGBA, t: float) -> RGBA:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)  # type: ignore[return-value]


def ramp(*hexes: str) -> list[RGBA]:
    """Rampa do mais escuro ao mais claro."""
    return [rgb(h) for h in hexes]


# ── Ruído ────────────────────────────────────────────────

def _hash(ix: int, iy: int, seed: int) -> float:
    n = (ix * 374761393 + iy * 668265263 + seed * 144665) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    n ^= n >> 16
    return (n & 0xFFFF) / 65535.0


def vnoise(x: float, y: float, seed: int = 0, period: int | None = None) -> float:
    """Ruído de valor suave (0 a 1). Com `period` (em células), repete sem emenda."""
    x0, y0 = math.floor(x), math.floor(y)
    fx, fy = x - x0, y - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)

    def h(ix: int, iy: int) -> float:
        if period:
            ix %= period
            iy %= period
        return _hash(ix, iy, seed)

    a, b = h(x0, y0), h(x0 + 1, y0)
    c, d = h(x0, y0 + 1), h(x0 + 1, y0 + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def fbm(x: float, y: float, seed: int = 0, octaves: int = 3, period: int | None = None) -> float:
    total, amp, norm, f = 0.0, 1.0, 0.0, 1
    for o in range(octaves):
        total += vnoise(x * f, y * f, seed + o * 17, period * f if period else None) * amp
        norm += amp
        amp *= 0.5
        f *= 2
    return total / norm


# ── Tela ─────────────────────────────────────────────────

OUTLINE = rgb('#17140f')
SHADOW = (0, 0, 0, 78)


class Cv:
    """Um sprite em construção (RGBA)."""

    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    # primitivas lisas
    def px(self, x: int, y: int, c: RGBA) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), c)

    def get(self, x: int, y: int) -> RGBA:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.im.getpixel((x, y))  # type: ignore[return-value]
        return (0, 0, 0, 0)

    def rect(self, x: int, y: int, w: int, h: int, c: RGBA) -> None:
        self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: RGBA, width: int = 1) -> None:
        self.d.line([x0, y0, x1, y1], fill=c, width=width)

    def ell(self, x: int, y: int, w: int, h: int, c: RGBA) -> None:
        self.d.ellipse([x, y, x + w - 1, y + h - 1], fill=c)

    def poly(self, pts: list[tuple[int, int]], c: RGBA) -> None:
        self.d.polygon(pts, fill=c)

    # preenchimento com textura
    def tex_poly(self, pts: list[tuple[int, int]], rp: list[RGBA], seed: int = 1, scale: float = 3.0,
                 light: float = 0.45, grain: float = 0.18) -> None:
        mask = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(mask).polygon(pts, fill=255)
        self._tex(mask, rp, seed, scale, light, grain)

    def tex_rect(self, x: int, y: int, w: int, h: int, rp: list[RGBA], seed: int = 1, scale: float = 3.0,
                 light: float = 0.45, grain: float = 0.18) -> None:
        mask = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(mask).rectangle([x, y, x + w - 1, y + h - 1], fill=255)
        self._tex(mask, rp, seed, scale, light, grain)

    def tex_ell(self, x: int, y: int, w: int, h: int, rp: list[RGBA], seed: int = 1, scale: float = 3.0,
                light: float = 0.45, grain: float = 0.18) -> None:
        mask = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(mask).ellipse([x, y, x + w - 1, y + h - 1], fill=255)
        self._tex(mask, rp, seed, scale, light, grain)

    def _tex(self, mask: Image.Image, rp: list[RGBA], seed: int, scale: float, light: float, grain: float) -> None:
        bbox = mask.getbbox()
        if not bbox:
            return
        x0, y0, x1, y1 = bbox
        bw, bh = max(1, x1 - x0), max(1, y1 - y0)
        n = len(rp)
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mask.getpixel((x, y)) < 128:
                    continue
                v = fbm(x / scale, y / scale, seed)
                # luz de cima à esquerda: mais claro no canto superior esquerdo
                l = 1.0 - ((x - x0) / bw * 0.4 + (y - y0) / bh * 0.6)
                t = v * (1 - light) + l * light
                t += (_hash(x, y, seed + 99) - 0.5) * grain
                self.px(x, y, rp[max(0, min(n - 1, int(t * n)))])

    # acabamento
    def outline(self, c: RGBA = OUTLINE, corners: bool = False) -> None:
        src = self.im.copy()
        w, h = self.w, self.h
        for y in range(h):
            for x in range(w):
                if src.getpixel((x, y))[3] > 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (-1, 1), (1, -1), (-1, -1)) if corners else ()):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] > 200:
                        self.px(x, y, c)
                        break

    def finish(self, shadow: tuple[int, int, int, int] | None = None, outline: bool = True) -> 'Cv':
        """Contorno e (opcional) sombra elíptica no chão: (cx, base_y, largura, altura)."""
        if outline:
            self.outline()
        if shadow:
            cx, by, sw, sh = shadow
            under = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
            ImageDraw.Draw(under).ellipse([cx - sw // 2, by - sh // 2, cx + sw // 2, by + sh // 2], fill=SHADOW)
            under.alpha_composite(self.im)
            self.im = under
            self.d = ImageDraw.Draw(self.im)
        return self

    def paste(self, other: 'Cv', x: int, y: int) -> None:
        self.im.alpha_composite(other.im, (x, y))
        self.d = ImageDraw.Draw(self.im)

    def flipped(self) -> 'Cv':
        o = Cv(self.w, self.h)
        o.im = self.im.transpose(Image.FLIP_LEFT_RIGHT)
        o.d = ImageDraw.Draw(o.im)
        return o


# ── Letrinhas 3×5 (placas e pichações) ──────────────────

_FONT = {
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110',
    'E': '111100110100111', 'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101',
    'I': '111010010010111', 'J': '001001001101010', 'K': '101101110101101', 'L': '100100100100111',
    'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100',
    'Q': '010101101111011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010',
    'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101',
    'Y': '101101010010010', 'Z': '111001010100111', '?': '110001010000010', '!': '010010010000010',
    '-': '000000111000000', ' ': '000000000000000', '.': '000000000000010', '0': '111101101101111',
    '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
    '5': '111100110001110', '6': '011100111101111', '7': '111001010100100', '8': '111101111101111',
    '9': '111101111001110',
}


def text(cv: Cv, x: int, y: int, s: str, c: RGBA, gap: int = 1) -> int:
    """Escreve `s` (maiúsculas) em letrinhas 3×5; devolve a largura usada."""
    cx = x
    for ch in s.upper():
        g = _FONT.get(ch)
        if g is None:
            ch = ' '
            g = _FONT[' ']
        for i, bit in enumerate(g):
            if bit == '1':
                cv.px(cx + i % 3, y + i // 3, c)
        cx += 3 + gap
    return cx - x - gap


def text_width(s: str, gap: int = 1) -> int:
    return len(s) * (3 + gap) - gap


# ── Utilidades ───────────────────────────────────────────

def rng(seed: int) -> random.Random:
    return random.Random(seed)


def scatter(cv: Cv, r: random.Random, n: int, area: tuple[int, int, int, int], colors: list[RGBA],
            only_on_opaque: bool = True, size: int = 1) -> None:
    x0, y0, x1, y1 = area
    for _ in range(n):
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        if only_on_opaque and cv.get(x, y)[3] < 200:
            continue
        c = r.choice(colors)
        if size == 1:
            cv.px(x, y, c)
        else:
            cv.rect(x, y, size, size, c)
