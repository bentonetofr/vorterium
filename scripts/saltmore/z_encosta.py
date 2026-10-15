"""A encosta rochosa: o passo da montanha em ziguezague, o mirante, a emboscada, a torre em ruínas e o santuário do caminho."""
from __future__ import annotations

import math

from .kit import (R_COAL, DEAD_TREES, FLOWERS, LOGS, R_DARK, R_DARK_SNOW, R_GRAY, R_GRAY_SNOW, cliff_line, find, forest, one, rock_cluster,
                  scatter, undergrowth)
from .lib import TILE, Path, Zone, fbm

W, H = 72, 104
MAIN = Path([(46, 0), (46, 6), (38, 12), (26, 17), (19, 23), (26, 30), (42, 35), (53, 41), (57, 48), (50, 54), (35, 58), (23, 63), (21, 70),
             (30, 76), (45, 80), (55, 86), (55, 93), (51, 99), (50, 104)])
LOOKOUT = (60.0, 45.0)
TOWER = (58.0, 18.0)


def build() -> Zone:
    z = Zone('saltmore-encosta', 'Encosta rochosa', W, H, 'gravel-dark', 701)
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.6}
    z.sound = {'auto': True, 'layers': {'wind': 0.55, 'forest': 0.12}}
    rng = z.rng

    # ── chão: neve no alto, cascalho no meio, o verde voltando lá embaixo ──
    for vy in range(z.vh):
        for vx in range(z.vw):
            t = vy / H
            n = fbm(vx / 5.0, vy / 5.0, 131, 3)
            n2 = fbm(vx / 3.0, vy / 3.0, 137, 2)
            if t < 0.17 and n > 0.58 - (0.17 - t) * 1.2:
                z.corners[z.at(vx, vy)] = 'snow-gray' if n2 < 0.55 else 'snow'
            elif t > 0.52:
                g = (t - 0.52) / 0.48
                if n > 0.78 - g * 0.72:
                    z.corners[z.at(vx, vy)] = 'grass-dark' if n2 < 0.7 else 'grass'
    z.noise('gravel', 4.0, 0.58, 139, only={'gravel-dark'})
    z.noise('stone-moss', 3.5, 0.62, 141, (0, 30, W, H), only={'gravel-dark', 'gravel'})
    z.noise('pebbles', 2.5, 0.7, 143, (0, 20, W, H), only={'gravel-dark', 'gravel'})
    z.noise('gravel-black', 5.0, 0.74, 145, only={'gravel-dark'})

    # ── a trilha: terra clara pisada; degraus de pedra nos trechos íngremes ──
    z.trail(MAIN, 3.6, 'dirt', wobble=0.35, seed=147)
    z.noise('pebbles', 2.0, 0.7, 149, only={'dirt'})
    z.noise('dirt-soft', 2.5, 0.72, 151, only={'dirt'})
    z.brush('dirt-light', MAIN.pts[::3], 0.8, 0.4, 153, only={'dirt', 'dirt-soft', 'pebbles'})

    # ── os paredões: entre as pernas do ziguezague e nas laterais ──
    sets = [R_DARK, R_DARK, R_COAL]
    snow_sets = [R_DARK_SNOW, R_GRAY_SNOW]
    cliff_line(z, [(30, 21), (36, 24), (44, 27), (52, 30), (60, 33)], 2.5, snow_sets + sets, 1.0)
    cliff_line(z, [(28, 49), (36, 48), (44, 46), (48, 45)], 2.4, sets, 1.0)
    cliff_line(z, [(10, 38), (14, 45), (19, 50), (28, 53)], 2.4, sets, 1.0)
    cliff_line(z, [(30, 68), (38, 70), (46, 73), (54, 76)], 2.5, sets, 1.0)
    cliff_line(z, [(2, 4), (3, 20), (2, 40), (3, 60), (2, 80), (3, 100)], 2.2, sets + snow_sets, 1.3)
    cliff_line(z, [(69, 4), (68, 20), (70, 42), (68, 60), (70, 80), (69, 100)], 2.2, sets, 1.3)
    cliff_line(z, [(4, 4), (24, 3), (44, 3), (68, 4)], 2.0, snow_sets, 1.4)            # a crista lá no alto
    # blocos soltos, escombros de queda de pedra e seixos pela encosta
    for _ in range(90):
        tx, ty = rng.uniform(2, W - 2), rng.uniform(4, H - 6)
        snow = ty < 16
        rock_cluster(z, tx, ty, 1.3, rng.randint(1, 3), [R_GRAY_SNOW if snow else R_DARK, R_COAL if not snow else R_DARK_SNOW], (0.08, 0.3, 0.42, 0.2))

    # ── a torre em ruínas (nordeste): paredes caídas e entulho ──
    tx0, ty0 = TOWER
    z.disc('stone-moss', tx0, ty0, 6.0, 0.7, 161, only={'gravel-dark', 'gravel', 'snow', 'snow-gray', 'pebbles'})
    z.disc('cobble-light', tx0, ty0 + 0.8, 3.0, 0.9, 163)
    z.reserve_rect(tx0 - 7, ty0 - 6, tx0 + 7, ty0 + 6)
    for (x0, y0, x1, y1) in ((-5, -4, -2, -4), (2, -4, 5, -4), (-5, -4, -5, -1), (5, -4, 5, -1), (-5, 3, -3, 3), (3, 3, 5, 3)):
        z.fence('fence-8', int(tx0 + x0), int(ty0 + y0), int(tx0 + x1), int(ty0 + y1))
    ruin_bits = R_DARK['mid'] + R_DARK['small'] + find(r'^(coluna de rocha|coluna aspera|laje de pedra|bloco de pedra|pedra cortada)', sheet='rock-escura')
    for _ in range(14):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(2.0, 6.0)
        z.put(rng.choice(ruin_bits), tx0 + math.cos(a) * rr, ty0 + math.sin(a) * rr * 0.8, rng.random() < 0.5, radius=0.6)
    z.put(one(r'^mastro$', pack='medieval'), tx0 + 0.2, ty0 - 0.6)
    z.put(one(r'^estandarte preto$', pack='medieval'), tx0 + 0.1, ty0 - 4.0)
    z.put(one(r'^fogueira$', pack='medieval'), tx0 - 1.5, ty0 + 1.6)
    z.put(one(r'^lenha de fogueira$', pack='medieval'), tx0 + 1.3, ty0 + 1.4)
    z.put(one(r'^suporte de lancas$', pack='medieval'), tx0 + 3.2, ty0 - 1.0)
    z.put(one(r'^caveira$', pack='dungeon'), tx0 - 2.4, ty0 + 0.4)
    z.put(one(r'^ossos espalhados$', pack='dungeon'), tx0 + 2.0, ty0 + 2.4)
    z.put(one(r'^lapide quebrada$', pack='medieval'), tx0 - 3.4, ty0 - 2.4)

    # ── o mirante: tabuado de madeira com corrimão, vista pro vale ──
    lx, ly = LOOKOUT
    z.paint_tiles('floor-wood', int(lx - 4), int(ly - 3), int(lx + 3), int(ly + 2))
    z.reserve_rect(lx - 6, ly - 5, lx + 6, ly + 4)
    z.fence('fence-1', int(lx - 4), int(ly + 3), int(lx + 3), int(ly + 3))
    z.fence('fence-1', int(lx + 4), int(ly - 3), int(lx + 4), int(ly + 3))
    z.put(one(r'^banco comprido$', pack='dungeon'), lx - 1.5, ly - 1.2)
    z.put(one(r'^placa de aviso$', pack='medieval'), lx + 2.8, ly - 2.0)
    z.put(one(r'^lamparina 2$', pack='medieval'), lx - 3.4, ly + 2.4)
    z.put(one(r'^lamparina$', pack='medieval'), lx + 2.6, ly + 2.6)
    z.put(one(r'^caixote$', pack='medieval'), lx - 3.0, ly - 2.4)

    # ── a emboscada na curva de baixo: carroça tombada, flechas, ossos ──
    ax, ay = 17.0, 66.0
    z.reserve_rect(ax - 5, ay - 4, ax + 5, ay + 4)
    z.put(one(r'^carroca coberta$', pack='medieval'), ax + 0.2, ay - 0.5, True)
    z.put(one(r'^rodas de carroca$', pack='medieval'), ax + 3.8, ay + 0.8)
    z.put(one(r'^roda pequena$', pack='medieval'), ax - 3.6, ay + 1.6)
    z.put(one(r'^caixotes empilhados$', pack='farm'), ax - 2.6, ay - 1.6)
    z.put(one(r'^saco de farinha 1$', pack='farm'), ax + 2.4, ay + 1.8)
    z.put(one(r'^flechas cravadas$', pack='medieval'), ax - 1.2, ay + 2.6)
    z.put(one(r'^flechas cravadas$', pack='medieval'), ax + 1.8, ay - 2.6)
    z.put(one(r'^ossos espalhados$', pack='dungeon'), ax - 1.0, ay + 1.2)
    z.put(one(r'^caveira$', pack='dungeon'), ax + 3.2, ay - 1.4)

    # ── o santuário do caminho (pouco antes da descida): cruz alta e pedras com flores ──
    sx, sy = 33.0, 77.5
    z.reserve_disc(sx, sy, 3.2)
    z.put(one(r'^cruz de pedra alta$', pack='medieval'), sx, sy)
    z.put(one(r'^pedestal de pedra$', pack='medieval'), sx - 2.0, sy + 0.6)
    z.put(one(r'^pilha de pedras$', sheet='rock-cinza'), sx + 2.0, sy + 0.9)
    for dx, dy in ((-1.0, 1.2), (0.9, 1.5), (0.1, 2.0)):
        z.put(rng.choice(FLOWERS), sx + dx, sy + dy)

    # ── a placa de "Pedraverde" e o marco no fim da descida ──
    z.put(one(r'^placa dupla$', pack='medieval'), 52.4, 95.6)
    z.put(one(r'^pilha de pedras 2$', sheet='rock-cinza'), 51.0, 97.2)

    # ── árvores: ralas no alto, voltando no vale ──
    def density(x: float, y: float) -> float:
        d = MAIN.dist(x, y)
        if d < 3.0:
            return 0.0
        t = y / H
        base = 0.08 + max(0.0, t - 0.25) * 1.0
        return min(0.95, base * min(1.0, (d - 3.0) / 4.0) * (0.5 + 0.7 * fbm(x / 7.0, y / 7.0, 11, 2)))
    forest(z, density, pines=0.75, oaks=0.1, small=0.1, dead=0.1, big_chance=0.01, seed=9, cell=2.3)
    for _ in range(14):
        tx, ty = rng.uniform(4, W - 4), rng.uniform(6, 60)
        if MAIN.dist(tx, ty) > 3.2 and z.free_disc(tx, ty, 0.9):
            z.put(rng.choice(DEAD_TREES), tx, ty, rng.random() < 0.5, radius=0.9)

    def under(x: float, y: float) -> float:
        return 0.0 if MAIN.dist(x, y) < 2.4 else min(1.0, 0.1 + (y / H) * 0.9 * (0.4 + 0.6 * fbm(x / 4.0, y / 4.0, 15, 2)))
    undergrowth(z, under, n_per_100=6.0, box=(2, 6, W - 2, H - 1), seed=9)
    scatter(z, list(LOGS), 6, (3, 40, W - 3, H - 4), 0.5, near=MAIN, near_min=3.5, near_max=14)
    scatter(z, list(FLOWERS[:30]), 16, (3, 60, W - 3, H - 4), 0.25, near=MAIN, near_min=2.4, near_max=8)

    # ── saídas ──
    z.portal('trilha-norte', 'Voltar pro riacho', 46 - 4.5, 0.3, 9, 2.6, ('saltmore-riacho', 'trilha-sul'))
    z.portal('trilha-sul', 'Descer pra vila', 50 - 4.5, H - 2.8, 9, 2.6, ('saltmore-vila', 'trilha-norte'))
    z.spawn = {'x': 46 * TILE, 'y': 3 * TILE}
    return z
