"""O riacho da cascata: o paredão com a queda d'água, a lagoa com o píer e o barco, e a ponte de madeira da trilha."""
from __future__ import annotations

import math

from .kit import (R_COAL, DEAD_TREES, FERNS, FLOWERS, LOGS, MUSHROOMS, R_DARK, R_GRAY, carve, find, forest, one, ring, rock_cluster, scatter,
                  undergrowth)
from .lib import TILE, Path, Zone, fbm

W, H = 72, 96
MAIN = Path([(46, 0), (44, 8), (41, 16), (39, 24), (40, 31), (40.5, 36), (40.5, 44), (39, 50), (35, 58), (35, 66), (40, 74), (45, 82), (46, 90), (46, 96)])
SPUR = Path([(40, 20.5), (34, 19.8), (27.5, 19.5)])                     # até o píer
STREAM = Path([(24.5, 22.5), (30, 25), (35, 31), (39, 36), (43, 40), (50, 41), (57, 40.5), (64, 43), (72, 45)])
POOL = (18.0, 20.0)

HOLES = [(POOL[0], POOL[1], 11, 9), (30, 18, 7, 4.5)]


def build() -> Zone:
    z = Zone('saltmore-riacho', 'Riacho da cascata', W, H, 'grass-dark', 601)
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.28}
    z.sound = {'auto': True, 'layers': {'waterfall': 0.55, 'stream': 0.45, 'forest': 0.3}}
    rng = z.rng

    # ── chão ──
    z.noise('grass', 6.0, 0.72, 81, only={'grass-dark'})
    z.noise('stone-moss', 3.0, 0.8, 83, only={'grass-dark', 'grass'})
    z.disc('gravel-dark', 17, 8, 9, 0.8, 85, only={'grass-dark', 'grass'})
    z.paint('gravel-dark', 3, 0, 33, 6)
    z.noise('stone-moss', 3.5, 0.56, 87, (2, 0, 36, 16), only={'gravel-dark', 'grass-dark'})

    # ── a lagoa embaixo da queda: margem de seixos, água rasa, funda ──
    px, py = POOL
    z.disc('pebbles', px, py, 9.2, 0.7, 91, only={'grass-dark', 'grass', 'gravel-dark', 'stone-moss'})
    z.disc('water-light', px, py, 7.0, 0.5, 93)
    z.disc('water', px, py, 5.7, 0.45, 95)
    z.disc('water-deep', px, py + 0.4, 3.2, 0.5, 97)
    z.reserve_disc(px, py, 9.5)
    # a queda: uma fita de água rasa descendo do paredão
    fall = Path([(17.5, 5), (17.2, 9), (17.8, 13), (18, 16)])
    z.brush('water-light', fall.pts, 1.5, 0.3, 99)
    z.brush('water', fall.pts[-8:], 1.3, 0.3, 101)

    # ── o riacho: margens, água rasa, água, e o leito fundo ──
    z.trail(STREAM, 6.2, 'pebbles', wobble=0.6, seed=103, keep_extra=2.0)
    z.brush('gravel', STREAM.pts[::2], 4.6, 0.7, 105, only={'pebbles'})
    z.brush('water-light', STREAM.pts, 3.5, 0.4, 107)
    z.brush('water', STREAM.pts, 2.7, 0.35, 109)
    # a saída da lagoa liga no riacho
    z.brush('water-light', [(24.5, 22.2), (26, 22.6), (28, 23.6)], 3.0, 0.3, 113)
    z.brush('water', [(24.5, 22.2), (26, 22.6), (28, 23.6)], 2.2, 0.3, 115)

    # ── a trilha: terra, e a ponte de madeira com guarda-corpos ──
    z.trail(MAIN, 4.0, 'dirt', wobble=0.4, seed=117)
    z.trail(SPUR, 2.2, 'dirt-soft', wobble=0.5, seed=119)
    z.noise('dirt-soft', 2.4, 0.68, 121, only={'dirt'})
    z.noise('pebbles', 2.0, 0.74, 123, only={'dirt'})
    z.brush('dirt-light', MAIN.pts[::3], 0.9, 0.5, 125, only={'dirt', 'dirt-soft', 'pebbles'})
    BX0, BX1, BY0, BY1 = 39, 41, 35, 45                                   # tiles do tabuleiro
    z.paint_tiles('floor-wood', BX0, BY0, BX1, BY1)
    z.fence('fence-2', BX0 - 1, BY0 + 1, BX0 - 1, BY1 - 1)
    z.fence('fence-2', BX1 + 1, BY0 + 1, BX1 + 1, BY1 - 1)
    z.reserve_rect(BX0 - 2, BY0 - 1, BX1 + 3, BY1 + 2)
    z.put(one(r'^lamparina$', pack='medieval'), BX0 - 0.7, BY0 + 0.9)
    z.put(one(r'^lamparina 2$', pack='medieval'), BX1 + 1.7, BY1 - 0.4)
    z.put(one(r'^placa de direcao 2$', pack='medieval'), BX1 + 2.8, BY0 - 1.0)

    # ── o píer e os barcos ──
    z.paint_tiles('floor-wood', 20, 19, 26, 20)
    z.fence('fence-2', 20, 18, 25, 18)
    z.fence('fence-2', 20, 21, 25, 21)
    z.put(one(r'^barco na agua 1$', pack='farm'), 22.0, 24.2)
    z.put(one(r'^barco a remo 2$', pack='farm'), 28.6, 16.8)
    z.put(one(r'^barril em pe$', pack='lpc-base'), 27.2, 21.8)
    z.put(one(r'^balde com agua$', pack='lpc-base'), 28.0, 21.2)
    z.put(one(r'^varal vazio$', pack='medieval'), 31.8, 17.4)
    z.put(one(r'^placa de aviso$', pack='medieval'), 33.8, 18.4)
    z.put(one(r'^toco com machado$', pack='medieval'), 30.2, 21.2)
    z.put(one(r'^tronco caido$', pack='plants'), 32.6, 22.4)
    z.reserve_rect(25, 14, 36, 25)

    # ── plantas de água: juncos e vitórias-régias ──
    aquatic = find(r'junco|nenufar|vitoria|lirio', pack='plants', category='Plantas aquáticas') or find(r'junco', pack='plants')
    for _ in range(26):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(5.2, 7.4)
        tx, ty = px + math.cos(a) * r, py + math.sin(a) * r * 0.9
        if not (20 <= tx <= 27 and 17.5 <= ty <= 22):
            z.put(rng.choice(aquatic), tx, ty, rng.random() < 0.5)
    on_bridge = lambda x, y: BX0 - 3 <= x <= BX1 + 4 and BY0 - 2 <= y <= BY1 + 3
    for i, (sx, sy) in enumerate(STREAM.pts[::9]):
        for _ in range(2):
            side = rng.choice((-1, 1))
            tx, ty = sx + rng.uniform(-0.6, 0.6), sy + side * rng.uniform(3.2, 4.3)
            if not on_bridge(tx, ty):
                z.put(rng.choice(aquatic), tx, ty, rng.random() < 0.5)

    # ── o paredão da queda: rochas grandes e escuras ──
    for _ in range(120):
        tx, ty = rng.uniform(1, 34), rng.uniform(0.5, 14)
        if abs(tx - 17.5) < 2.6 and ty > 4:
            continue                                                 # deixa o canal da queda livre
        rock_cluster(z, tx, ty, 1.6, 2, [R_DARK, R_DARK, R_COAL, R_GRAY], (0.35, 0.35, 0.2, 0.1), reserve=False)
    for _ in range(26):
        tx = rng.choice([rng.uniform(5.5, 14), rng.uniform(21, 29)])
        rock_cluster(z, tx, rng.uniform(13, 17.5), 1.8, 2, [R_DARK, R_DARK, R_COAL, R_GRAY], reserve=False)
    # pedras na água e nas margens
    for sx, sy in STREAM.pts[::7]:
        if rng.random() < 0.7 and not on_bridge(sx, sy):
            rock_cluster(z, sx + rng.uniform(-1.5, 1.5), sy + rng.uniform(-2.2, 2.2), 0.8, 1, [R_GRAY], (0, 0, 0.7, 0.3), reserve=False)
    # laje de pedra a céu aberto, na curva
    z.put(one(r'^laje de pedra$', sheet='rock-cinza'), 36.2, 33.2)
    z.put(one(r'^pedra redonda$', sheet='rock-cinza'), 33.2, 28.8)

    # ── a mata ──
    def density(x: float, y: float) -> float:
        d = min(MAIN.dist(x, y), SPUR.dist(x, y) + 0.6)
        if d < 3.2:
            return 0.0
        if STREAM.dist(x, y) < 5.2 or math.hypot(x - px, y - py) < 10.2:
            return 0.0
        ramp = min(1.0, (d - 3.2) / 4.5)
        clump = 0.6 + 0.55 * fbm(x / 7.0, y / 7.0, 9, 2)
        top = 0.0 if (y < 14 and x < 36) else 1.0                    # o paredão é só pedra
        return min(1.0, ramp * clump * carve(x, y, HOLES[1:]) * top)

    forest(z, density, pines=0.5, oaks=0.38, small=0.1, dead=0.02, big_chance=0.05, colossal_chance=0.008, seed=7, cell=2.0)

    def under(x: float, y: float) -> float:
        if MAIN.dist(x, y) < 2.4 or STREAM.dist(x, y) < 3.6 or math.hypot(x - px, y - py) < 8.0:
            return 0.0
        return min(1.0, 0.3 + 0.7 * fbm(x / 4.0, y / 4.0, 13, 2))
    undergrowth(z, under, n_per_100=7.5, box=(1, 2, W - 1, H - 1), seed=7)
    scatter(z, list(LOGS), 10, (3, 18, W - 3, H - 4), 0.5, near=MAIN, near_min=3.5, near_max=15)
    scatter(z, list(FLOWERS[:30]), 30, (3, 18, W - 3, H - 4), 0.25, near=MAIN, near_min=2.4, near_max=8)
    scatter(z, list(FLOWERS[:30]), 14, (2, 14, 14, 30), 0.25, near=None)

    # ── luz: o brilho frio da queda ──
    z.light('queda', 17.8, 15.5, 190, '#bfe8ff', 0.35, 0.05)
    z.light('lagoa', px, py + 1, 220, '#7fb8d8', 0.22, 0.0)

    # ── saídas ──
    z.portal('trilha-norte', 'Voltar pra floresta', 46 - 4.5, 0.3, 9, 2.6, ('saltmore-floresta', 'trilha-sul'))
    z.portal('trilha-sul', 'Seguir a trilha', 46 - 4.5, H - 2.8, 9, 2.6, ('saltmore-encosta', 'trilha-norte'))
    z.spawn = {'x': 46 * TILE, 'y': 3 * TILE}
    return z
