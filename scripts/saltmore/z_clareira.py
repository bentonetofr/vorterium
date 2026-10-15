"""A clareira da cabana: o lado de fora, a horta morta, o poço, um túmulo e o começo da trilha, sob a montanha."""
from __future__ import annotations

import math

from .kit import (R_COAL, BUSHES_DARK, DEAD_TREES, FLOWERS, FERNS, LOGS, MUSHROOMS, OAKS_BIG, PINES, R_DARK, R_DARK_SNOW, R_GRAY, R_GRAY_SNOW,
                  STUMPS, Building, find, forest, one, rock_cluster, undergrowth)
from .lib import TILE, Path, Zone, fbm

W, H = 72, 84
TRAIL = Path([(36, 28.5), (37, 33), (34, 38), (28, 44), (27, 50), (33, 56), (42, 60), (47, 66), (46, 72), (43, 78), (43, 84)])


def build() -> Zone:
    z = Zone('saltmore-clareira', 'Clareira da cabana', W, H, 'grass-dark', 401)
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.35}
    z.sound = {'auto': True, 'layers': {'wind': 0.3, 'forest': 0.35}}
    rng = z.rng

    # ── chão ──
    # a montanha lá em cima: neve suja, cascalho escuro, pedra com musgo
    z.paint('snow', 0, 0, W, 5)
    z.noise('snow', 6.0, 0.44, 11, (0, 5, W, 13))
    z.noise('snow-gray', 4.0, 0.5, 13, (0, 3, W, 15), only={'snow', 'grass-dark'})
    z.noise('gravel-dark', 5.0, 0.42, 21, (0, 9, W, 22), only={'grass-dark'})
    z.noise('stone-moss', 4.5, 0.56, 31, (0, 6, W, 24), only={'grass-dark', 'gravel-dark'})
    # pátio da cabana: terra com mato num círculo irregular
    z.disc('dirt', 36, 26.5, 6.2, 0.9, 3, only={'grass-dark'})
    z.noise('dirt-weeds', 3.0, 0.5, 33, (24, 18, 48, 36), only={'dirt'})
    z.noise('grass', 7.0, 0.74, 41, (0, 20, W, H), only={'grass-dark'})

    # ── a cabana de toras: telhado marrom por cima, fachada de madeira ──
    b = Building(z, 31, 17, 10, roof_d=3, wall_h=3, wall='wall-227', wall_trim='ceil-3', roof='floor-7', roof_trim='ceil-3')
    door_x = b.door(5.0, 'wd@192,768')
    b.window(1.8, 'wd@611,162')
    b.window(8.2, 'wd@130,64')
    # alpendre: tábuas gastas, banco, lamparina e barril da chuva
    z.paint_tiles('cobble-sand', 33, 24, 37, 25)
    z.put(one(r'^barril em pe$', pack='lpc-base'), 31.4, b.base + 0.4)
    z.put(one(r'^balde com agua$', pack='lpc-base'), 32.5, b.base + 0.6)
    z.put(one(r'^banco comprido$', pack='dungeon'), 41.2, b.base + 0.55)
    z.put(one(r'^lamparina$', pack='medieval'), 33.1, b.base + 0.15)
    z.portal('porta-cabana', 'Entrar na cabana', door_x - 1.5, b.base - 0.3, 3.0, 1.8, ('saltmore-cabana', 'porta-frente'))

    # ── a trilha começa no degrau da porta ──
    z.trail(TRAIL, 4.4, 'dirt', wobble=0.4, seed=9)
    z.noise('pebbles', 2.2, 0.66, 51, (0, 24, W, H), only={'dirt'})
    z.noise('dirt-soft', 2.6, 0.7, 53, (0, 24, W, H), only={'dirt'})
    # pisadas gastas: terra clara no centro
    z.brush('dirt-light', TRAIL.pts[::2], 1.0, 0.5, 61, only={'dirt', 'dirt-soft', 'pebbles'})

    # ── horta morta, de cerca quebrada ──
    z.paint_tiles('farm-plowed', 12, 20, 22, 28)
    z.fence_box('fence-3', 11, 19, 23, 29, gaps=[(17, 29, 19, 29), (23, 23, 23, 24), (11, 24, 11, 24)])
    z.reserve_rect(10, 18, 25, 31)
    crops = find(r'^plantacao de (tomate|batata|cenoura|milho|pimentao) ?[1-5]?$', pack='farm')
    for ty in (21.4, 23.4, 25.4, 27.4):
        for tx in range(13, 22, 2):
            if rng.random() < 0.8:
                z.put(rng.choice(crops[:12]), tx + rng.uniform(-0.15, 0.15), ty + 0.5)
    z.put(one(r'^espantalho$', pack='medieval'), 17.5, 24.0)
    z.put(one(r'^carrinho de mao$', pack='medieval'), 24.8, 31.0, True)
    z.put(one(r'^balde$', pack='medieval', nth=0), 14.0, 29.8)
    for tx, ty in ((13, 19.6), (21, 29.4), (19, 20.0)):
        z.put(rng.choice(FERNS), tx, ty)

    # ── poço, lenha, varal, carroça quebrada ──
    z.put(one(r'^poco com roldana$', pack='medieval'), 26.0, 37.0)
    z.reserve_disc(26, 36, 3.2)
    z.put(one(r'^toco com machado$', pack='medieval'), 45.4, 27.5)
    z.put(one(r'^pilha de lenha grande$', pack='medieval'), 47.8, 25.6)
    z.put(one(r'^toras cortadas$', pack='medieval'), 46.2, 29.0)
    z.put(one(r'^lenha empilhada 2$', pack='medieval'), 48.9, 27.4)
    z.put(one(r'^varal vazio$', pack='medieval'), 44.0, 21.6)
    z.put(one(r'^carroca de madeira$', pack='medieval'), 53.0, 33.0)
    z.put(one(r'^rodas de carroca$', pack='medieval'), 55.8, 34.3)
    z.put(one(r'^caixote$', pack='medieval'), 51.4, 34.4)
    z.reserve_rect(44, 20, 58, 36)

    # ── o túmulo solitário, na beira da mata ──
    gx, gy = 58.0, 41.0
    z.put(one(r'^cruz de madeira$', pack='medieval', nth=0), gx, gy)
    z.put(one(r'^lapide baixa$', pack='medieval', nth=0), gx + 1.4, gy + 1.0)
    z.put(one(r'^cruz de madeira 2$', pack='medieval'), gx - 1.6, gy + 0.6)
    z.reserve_disc(gx, gy + 0.5, 3.0)
    for dx, dy in ((-0.8, 1.6), (0.5, 2.0), (2.1, 0.2), (-2.2, 1.9)):
        z.put(rng.choice(FLOWERS), gx + dx, gy + dy)

    # ── a placa na bifurcação da trilha e o primeiro tronco caído ──
    z.put(one(r'^placa de direcao$', pack='medieval', nth=0), 31.5, 41.2)
    z.put(one(r'^tronco oco caido$', pack='plants'), 37.6, 47.0)
    z.put(one(r'^tronco caido com musgo$', pack='plants'), 22.0, 54.5, True)

    # ── a montanha ao norte: rochedos grandes, com neve em cima ──
    cliff = Path([(0, 8), (14, 10), (30, 9), (46, 8), (60, 10), (72, 8)])
    z.reserve_path(cliff, 0.2)
    for _ in range(36):
        tx = rng.uniform(0, W)
        ty = rng.uniform(3, 11)
        snow = ty < 7.5
        rock_cluster(z, tx, ty, 2.4, 3, [R_GRAY_SNOW if snow else R_DARK], reserve=False)
    for _ in range(30):
        tx = rng.uniform(0, W)
        rock_cluster(z, tx, rng.uniform(11, 20), 3.2, 3, [R_DARK, R_DARK, R_COAL, R_GRAY], reserve=True)
    # paredões nas laterais
    for side_x in (1.5, W - 2.5):
        for ty in range(10, H - 6, 3):
            rock_cluster(z, side_x + rng.uniform(-1, 1), ty + rng.uniform(-1, 1), 2.4, 3, [R_DARK, R_DARK, R_COAL, R_GRAY], reserve=False)

    # ── a mata ──
    cab_ell = lambda x, y: ((x - 36.5) / 22.0) ** 2 + ((y - 27.0) / 14.0) ** 2

    def density(x: float, y: float) -> float:
        d = TRAIL.dist(x, y)
        if d < 3.4:
            return 0.0
        ramp = min(1.0, (d - 3.4) / 5.0)
        clear = cab_ell(x, y)
        base = 0.92
        if clear < 1.0:
            base *= max(0.0, (clear - 0.35) / 0.65) ** 1.4          # a clareira: quase sem árvores
        clump = 0.55 + 0.6 * fbm(x / 8.0, y / 8.0, 7, 2)
        top = min(1.0, max(0.18, (y - 6) / 9.0))                     # escasso na neve
        return min(1.0, base * ramp * clump * top)

    forest(z, density, pines=0.6, oaks=0.22, small=0.1, dead=0.05, big_chance=0.03, seed=3)
    # perto da cabana: umas mortas, pra dar o ar de abandono
    for tx, ty in ((26.5, 22.5), (49.5, 20.0), (54.0, 28.5), (19.5, 33.5)):
        z.put(rng.choice(DEAD_TREES), tx, ty, rng.random() < 0.5, radius=0.9)

    def ground(x: float, y: float) -> float:
        d = TRAIL.dist(x, y)
        return 0.0 if d < 2.6 else min(1.0, 0.25 + 0.7 * fbm(x / 5.0, y / 5.0, 19, 2))
    undergrowth(z, ground, n_per_100=9.0, box=(1, 14, W - 1, H - 1), seed=5)
    undergrowth(z, lambda x, y: 0.9 if TRAIL.dist(x, y) > 2.4 and TRAIL.dist(x, y) < 6 else 0.0, n_per_100=3.0,
                box=(2, 22, W - 2, H - 2), kinds=list(FLOWERS[:20]), seed=8)

    # ── saída ──
    z.portal('trilha-sul', 'Seguir a trilha', 43 - 4.5, H - 2.8, 9, 2.6, ('saltmore-floresta', 'trilha-norte'))
    z.spawn = {'x': int(door_x * TILE), 'y': int((b.base + 2.0) * TILE)}
    return z
