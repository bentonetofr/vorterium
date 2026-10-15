"""A trilha da floresta sombria: mata fechada, um santuário esquecido, o acampamento de caçadores e uma carroça tombada."""
from __future__ import annotations

import math

from .kit import (R_COAL, BUSHES_DARK, DEAD_TREES, FERNS, FLOWERS, LOGS, MUSHROOMS, OAKS_BIG, PINES, R_DARK, R_GRAY, carve, find, forest, one, ring,
                  rock_cluster, scatter, undergrowth)
from .lib import TILE, Path, Zone, fbm

W, H = 72, 112
MAIN = Path([(43, 0), (43, 7), (38, 13), (31, 20), (25, 28), (28, 36), (37, 42), (46, 48), (51, 56), (47, 64), (38, 70), (30, 76), (25, 84),
             (29, 92), (38, 98), (46, 104), (46, 112)])
SHRINE_SPUR = Path([(26, 28), (20, 29.5), (14, 31.5)])
CAMP_SPUR = Path([(51, 56), (56, 56.5), (60, 57)])

# clareiras (cx, cy, rx, ry): santuário, acampamento, anel de cogumelos, lagoa, carroça
HOLES = [(11, 32, 8.5, 6.5), (61, 57, 8.5, 6.5), (60, 92, 5.5, 4.5), (12, 87, 8.0, 6.5), (34, 77, 5.0, 3.5), (36, 40, 4.5, 3.0)]


def build() -> Zone:
    z = Zone('saltmore-floresta', 'Trilha da floresta sombria', W, H, 'grass-dark', 501)
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.3}
    z.sound = {'auto': True, 'layers': {'forest': 0.5, 'wind': 0.25}}
    rng = z.rng

    # ── chão: musgo, folhas, terra mole ──
    z.noise('stone-moss', 3.0, 0.8, 71, only={'grass-dark'})
    z.noise('grass', 6.0, 0.72, 73, only={'grass-dark'})
    z.noise('dirt-weeds', 3.5, 0.72, 75, only={'grass', 'grass-dark'})
    z.trail(MAIN, 4.0, 'dirt', wobble=0.45, seed=15)
    z.trail(SHRINE_SPUR, 2.2, 'dirt-soft', wobble=0.5, seed=17)
    z.trail(CAMP_SPUR, 2.4, 'dirt-soft', wobble=0.5, seed=19)
    z.noise('dirt-soft', 2.4, 0.68, 77, only={'dirt'})
    z.noise('pebbles', 2.0, 0.74, 79, only={'dirt'})
    z.brush('dirt-light', MAIN.pts[::3], 0.9, 0.5, 21, only={'dirt', 'dirt-soft', 'pebbles'})

    # ── lagoa/brejo ao sudoeste ──
    z.disc('swamp', 12, 87, 6.8, 0.9, 25, only={'grass-dark', 'grass', 'stone-moss', 'dirt-weeds'})
    z.disc('water-light', 12, 87, 3.6, 0.8, 27)
    z.disc('water', 12, 87.3, 2.0, 0.6, 29)
    z.reserve_disc(12, 87, 6.5)
    aquatic = find(r'junco|nenufar|vitoria|lirio', pack='plants', category='Plantas aquáticas') or find(r'junco', pack='plants')
    for _ in range(14):
        a = rng.uniform(0, math.tau)
        z.put(rng.choice(aquatic), 12 + math.cos(a) * rng.uniform(3.6, 6.0), 87 + math.sin(a) * rng.uniform(3.2, 5.4), rng.random() < 0.5)

    # ── o santuário esquecido (oeste) ──
    z.disc('stone-moss', 11, 32, 5.2, 0.7, 31, only={'grass-dark', 'grass', 'dirt-weeds'})
    z.disc('stone-brown', 11, 31.5, 2.8, 0.6, 33)
    z.reserve_rect(5, 25, 18, 39)
    ring(z, [one(r'^menir( pontudo| fino)?$', sheet='rock-cinza'), one(r'^pedra em pe$', sheet='rock-cinza')], 11, 31.5, 5.0, 7, 0.3, ry=3.6, start=0.3, radius=0.6)
    z.put(one(r'^estatua encapuzada$', pack='medieval'), 11, 30.6)
    z.put(one(r'^pedestal de pedra$', pack='medieval'), 8.6, 32.6)
    z.put(one(r'^bacia de pedra$', pack='medieval'), 13.2, 33.2)
    z.put(one(r'^totem de pedra$', pack='medieval'), 14.8, 29.2)
    for dx, dy in ((-1.2, 1.8), (1.0, 2.1), (0.2, 0.8), (-2.6, 0.4)):
        z.put(rng.choice(FLOWERS), 11 + dx, 32 + dy)
    z.put(one(r'^tronco oco caido$', pack='plants'), 6.5, 36.5, True)
    z.put(one(r'^placa de direcao$', pack='medieval', nth=0), 24.3, 27.2)

    # ── o acampamento de caçadores (leste): abandonado às pressas ──
    z.disc('dirt', 61, 57.5, 4.4, 0.9, 41, only={'grass-dark', 'grass', 'dirt-weeds', 'stone-moss', 'dirt-soft'})
    z.reserve_rect(53, 50, 70, 64)
    z.put(one(r'^tenda pequena$', pack='medieval'), 64.5, 55.4)
    z.put(one(r'^tenda de ponta$', pack='medieval'), 58.0, 52.6)
    z.put(one(r'^tripe de fogueira$', pack='medieval'), 60.4, 58.6)
    z.put(one(r'^brasas$', pack='medieval'), 60.4, 58.2)
    z.put(one(r'^caldeirao$', pack='dungeon'), 61.9, 58.8)
    z.put(one(r'^lenha de fogueira$', pack='medieval'), 58.9, 59.2)
    z.put(one(r'^suporte de lancas$', pack='medieval'), 66.6, 59.8)
    z.put(one(r'^alvo de arco e flecha$', pack='medieval'), 55.4, 61.4)
    z.put(one(r'^alvo de palha$', pack='medieval'), 68.0, 52.8)
    z.put(one(r'^cesto de flechas$', pack='medieval'), 63.2, 60.6)
    z.put(one(r'^feixe de flechas$', pack='medieval'), 62.4, 61.1)
    z.put(one(r'^flechas cravadas$', pack='medieval'), 56.6, 62.6)
    z.put(one(r'^caixote$', pack='medieval'), 66.4, 57.2)
    z.put(one(r'^pilha de barris$', pack='interior'), 67.6, 58.1)
    z.put(one(r'^ossos espalhados$', pack='dungeon'), 59.2, 55.6)
    z.put(one(r'^caveira$', pack='dungeon'), 62.4, 55.9)
    z.put(one(r'^catre com manta$', pack='dungeon'), 56.9, 56.2)
    z.put(one(r'^machadinha$', pack='medieval'), 63.6, 59.4)

    # ── a carroça tombada, perto da trilha ──
    z.put(one(r'^carroca coberta$', pack='medieval'), 36.6, 77.6, True)
    z.put(one(r'^rodas de carroca$', pack='medieval'), 40.2, 79.0)
    z.put(one(r'^caixotes empilhados$', pack='farm'), 31.0, 78.2)
    z.put(one(r'^saco de graos 1$', pack='farm'), 33.2, 79.6)
    z.put(one(r'^saco de farinha 2$', pack='farm'), 39.4, 76.3)
    z.put(one(r'^flechas cravadas$', pack='medieval'), 35.2, 80.0)
    z.put(one(r'^ossos espalhados$', pack='dungeon'), 32.6, 80.8)
    z.reserve_rect(28, 74, 43, 82)

    # ── o tronco gigante atravessado na trilha, na curva ──
    z.put(one(r'^tronco oco caido$', pack='plants'), 38.5, 43.2)
    z.put(one(r'^tronco caido com musgo$', pack='plants'), 33.0, 40.4)

    # ── anel de cogumelos (sudeste) ──
    ring(z, MUSHROOMS[:8], 60, 92, 3.0, 11, 0.25, ry=2.2, radius=0.3)
    z.put(one(r'^cogumelos roxos$', pack='plants'), 60, 92)
    z.reserve_rect(54, 87, 67, 98)
    z.noise('stone-moss', 1.8, 0.5, 91, (50, 86, 68, 98), only={'grass-dark', 'grass', 'dirt-weeds'})

    # ── o marco de pedras perto da saída ──
    z.put(one(r'^pilha de pedras$', sheet='rock-cinza'), 49.4, 102.6)
    z.put(one(r'^pilha de pedras 2$', sheet='rock-cinza'), 49.9, 103.1)
    z.put(one(r'^placa dupla$', pack='medieval'), 41.6, 101.2)

    # ── a mata: fechada, escura, com manchas de pinheiral e carvalhal ──
    def density(x: float, y: float) -> float:
        d = min(MAIN.dist(x, y), SHRINE_SPUR.dist(x, y) + 1.0, CAMP_SPUR.dist(x, y) + 1.0)
        if d < 3.3:
            return 0.0
        ramp = min(1.0, (d - 3.3) / 4.5)
        clump = 0.6 + 0.55 * fbm(x / 7.0, y / 7.0, 7, 2)
        return min(1.0, 1.0 * ramp * clump * carve(x, y, HOLES))

    forest(z, density, pines=0.5, oaks=0.38, small=0.08, dead=0.04, big_chance=0.07, colossal_chance=0.012, seed=5, cell=2.0)
    # árvores mortas e troncos caídos, perto das clareiras
    for cx, cy, rx, ry in HOLES:
        for _ in range(3):
            a = rng.uniform(0, math.tau)
            tx, ty = cx + math.cos(a) * (rx + 1.2), cy + math.sin(a) * (ry + 1.2)
            if z.free_disc(tx, ty, 0.9):
                z.put(rng.choice(DEAD_TREES), tx, ty, rng.random() < 0.5, radius=0.9)

    def under(x: float, y: float) -> float:
        d = MAIN.dist(x, y)
        return 0.0 if d < 2.4 else min(1.0, 0.35 + 0.65 * fbm(x / 4.0, y / 4.0, 11, 2))
    undergrowth(z, under, n_per_100=11.0, box=(1, 2, W - 1, H - 1), seed=5)
    scatter(z, list(LOGS) + list(find(r'^(toco|toco \d)$', pack='plants')), 22, (3, 4, W - 3, H - 4), 0.5, near=MAIN, near_min=3.5, near_max=16)
    scatter(z, list(FLOWERS[:30]), 26, (3, 4, W - 3, H - 4), 0.25, near=MAIN, near_min=2.4, near_max=8)
    # pedras cobertas de musgo
    for _ in range(26):
        tx, ty = rng.uniform(3, W - 3), rng.uniform(3, H - 3)
        if MAIN.dist(tx, ty) > 4.0:
            rock_cluster(z, tx, ty, 1.5, rng.randint(1, 3), [R_DARK, R_COAL, R_GRAY], (0.05, 0.3, 0.45, 0.2))

    # ── saídas ──
    z.portal('trilha-norte', 'Voltar pra clareira da cabana', 43 - 4.5, 0.3, 9, 2.6, ('saltmore-clareira', 'trilha-sul'))
    z.portal('trilha-sul', 'Seguir a trilha', 46 - 4.5, H - 2.8, 9, 2.6, ('saltmore-riacho', 'trilha-norte'))
    z.spawn = {'x': 43 * TILE, 'y': 3 * TILE}
    return z
