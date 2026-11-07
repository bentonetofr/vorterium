"""Mecha de cabelo preta: uma peça que se põe por cima do cabelo espetado (`hair/spiked`).

A mecha é recortada do próprio desenho do cabelo (cada quadro da caminhada, cada direção) e pintada de preto, então
acompanha o balanço do cabelo sem sobrar nem faltar pixel. Fica na frente da franja, do lado esquerdo de quem olha de frente
(o lado direito do personagem). De costas não aparece. Só a folha "walk" é gravada (o motor usa a walk pra parado e correndo).
"""
from __future__ import annotations

import os

from PIL import Image

from .px import rgb
from .weapons import BODIES, FRAMES, SHEETS

Z_STREAK = 121
HAIR_SHEET = 'hair/spiked/adult/'

SLOTS = [{'id': 'streak', 'label': 'Mecha de cabelo', 'group': 'Cabelo'}]

# do escuro ao claro, em cima da luminosidade do pixel de cabelo que ela cobre
BLACK = [rgb('#07070b'), rgb('#101017'), rgb('#1a1a23'), rgb('#262631'), rgb('#33333f')]


def _lum(p) -> float:
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def _keep(row: int, x: int, y: int, box) -> bool:
    """Está dentro da mecha? `box` = caixa do cabelo no quadro (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    ry = (y - y0) / max(1, h)                      # 0 = topo do cabelo, 1 = ponta da franja
    if row == 0:                                   # de costas: sem mecha
        return False
    if row == 2:                                   # de frente: faixa do meio da franja pro lado esquerdo, em diagonal
        rx = (x - x0) / max(1, w)
        return 0.18 <= rx <= 0.55 and ry >= 0.28 + (0.55 - rx) * 0.25
    # de lado: a franja que cai pra frente (esquerda quando olha pra esquerda, direita quando olha pra direita)
    rx = (x - x0) / max(1, w)
    front = rx if row == 1 else 1 - rx
    return front <= 0.4 and ry >= 0.3


def sheet(assets: str) -> Image.Image:
    src = Image.open(os.path.join(assets, SHEETS, HAIR_SHEET, 'walk.png')).convert('RGBA')
    out = Image.new('RGBA', src.size, (0, 0, 0, 0))
    for r in range(4):
        for c in range(FRAMES):
            fr = src.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64))
            box = fr.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
            if not box:
                continue
            px = fr.load()
            dst = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            dp = dst.load()
            for y in range(64):
                for x in range(64):
                    p = px[x, y]
                    if p[3] > 20 and _keep(r, x, y, box):
                        k = min(len(BLACK) - 1, int(_lum(p) / 256 * len(BLACK) * 1.25))
                        dp[x, y] = (*BLACK[k][:3], 255)
            out.alpha_composite(dst, (c * 64, r * 64))
    return out


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    img = sheet(assets)
    paths = {}
    for body in BODIES:
        rel = f'tlou/streak/preta/{body}/'
        d = os.path.join(assets, SHEETS, rel)
        os.makedirs(d, exist_ok=True)
        img.save(os.path.join(d, 'walk.png'), optimize=True)
        paths[body] = rel
    item = {'id': 'tlou/streak/mecha-preta', 'slot': 'streak', 'name': 'Mecha preta (sobre o cabelo espetado)',
            'layers': [{'z': Z_STREAK, 'paths': paths}], 'bodies': list(BODIES), 'anims': ['walk']}
    return SLOTS, [item]
