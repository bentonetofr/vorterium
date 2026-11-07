"""O campo de batalha: um grande pasto plano, do lado direito da estrada da zona 5, cheio de espadas e corpos, como se a
batalha tivesse acabado de acontecer. Dois exércitos (vermelho e azul) que se encontraram numa linha de choque."""
from __future__ import annotations

import math

from saltmore.lib import Path, Zone, fbm

CORPOS_V = [f'batalha@soldado-{i}' for i in range(1, 7)]
CORPOS_A = [f'batalha@soldado-{i}' for i in range(7, 13)]
ESPADA_CRAVADA = [f'batalha@espada-cravada-{i}' for i in range(1, 5)]
ESPADA_CAIDA = [f'batalha@espada-caida-{i}' for i in range(1, 5)] + ['batalha@espada-quebrada']
ESCUDOS_V, ESCUDOS_A = ['batalha@escudo-vermelho'], ['batalha@escudo-azul']
ESCUDO_PARTIDO = 'batalha@escudo-partido'
ELMO = 'batalha@elmo-caido'
SANGUE = [f'batalha@sangue-{i}' for i in (1, 2, 3)]
FLECHAS = ['med-deco@229,1541', 'med-deco@195,1539']
LANCA = 'med-deco@150,1574'
ARCO = 'med-deco@194,1512'
ESTANDARTE_V, ESTANDARTE_A = 'batalha@estandarte-vermelho', 'batalha@estandarte-azul'


def build(z: Zone, road: Path, box: tuple[float, float, float, float], front: tuple[tuple[float, float], tuple[float, float]]) -> None:
    rng = z.rng
    x0, y0, x1, y1 = box
    (fx0, fy0), (fx1, fy1) = front
    fdx, fdy = fx1 - fx0, fy1 - fy0
    flen = math.hypot(fdx, fdy)

    def side(x: float, y: float) -> tuple[float, float]:
        """(distância assinada até a linha de choque, que ondula; > 0 = lado azul)."""
        d = ((x - fx0) * fdy - (y - fy0) * fdx) / flen
        return d + (fbm(x / 6.0, y / 6.0, 91, 2) - 0.5) * 7.0, d

    def density(x: float, y: float) -> float:
        d, _ = side(x, y)
        edge = min(1.0, min(x - x0, x1 - x, y - y0, y1 - y) / 6.0)          # rareia nas bordas do campo
        core = math.exp(-(d * d) / (2 * 8.5 ** 2))
        return max(0.0, edge) * (0.12 + 0.88 * core) * (0.55 + 0.45 * fbm(x / 5.0, y / 5.0, 77, 2))

    def inside(x: float, y: float) -> bool:
        return x0 <= x <= x1 and y0 <= y <= y1 and road.dist(x, y) > 8.5

    # ── o chão: o pasto pisoteado, com lama e terra revirada perto da linha de choque ──
    for vy in range(int(y0), int(y1) + 1):
        for vx in range(int(x0), int(x1) + 1):
            if not inside(vx, vy):
                continue
            d, _ = side(vx, vy)
            heat = math.exp(-(d * d) / (2 * 9.0 ** 2))
            n = fbm(vx / 2.6, vy / 2.6, 55, 3)
            if heat > 0.3 and n < 0.1 + 0.2 * heat:
                z.corners[z.at(vx, vy)] = 'dirt-weeds'                  # pasto arrancado, com terra
            if heat > 0.6 and n < 0.07:
                z.corners[z.at(vx, vy)] = 'dirt-soft'                   # terra revirada onde foi mais feio
    z.reserve_rect(x0 - 1, y0 - 1, x1 + 2, y1 + 2)

    placed: list[tuple[float, float]] = []

    def free(x: float, y: float, r: float) -> bool:
        return inside(x, y) and all((x - px) ** 2 + (y - py) ** 2 > r * r for px, py in placed)

    # ── manchas de sangue (por baixo de tudo) ──
    cell = 3.0
    ty = y0 + 2
    while ty < y1 - 1:
        tx = x0 + 2
        while tx < x1 - 1:
            x, y = tx + rng.uniform(-1.2, 1.2), ty + rng.uniform(-1.2, 1.2)
            if inside(x, y) and rng.random() < density(x, y) * 0.8:
                z.put(rng.choice(SANGUE), x, y, rng.random() < 0.5)
            tx += cell
        ty += cell

    # ── soldados tombados ──
    cell = 3.2
    bodies: list[tuple[float, float, int]] = []
    ty = y0 + 2
    row = 0
    while ty < y1 - 1:
        tx = x0 + 2 + (cell / 2 if row % 2 else 0)
        while tx < x1 - 1:
            x, y = tx + rng.uniform(-1.3, 1.3), ty + rng.uniform(-1.1, 1.1)
            if rng.random() < density(x, y) * 0.8 and free(x, y, 1.5):
                d, _ = side(x, y)
                # perto da linha os dois lados se misturam; longe, cada um fica no seu canto
                blue = (d + rng.uniform(-3.5, 3.5)) > 0
                z.put(rng.choice(CORPOS_A if blue else CORPOS_V), x, y, rng.random() < 0.5)
                placed.append((x, y))
                bodies.append((x, y, 1 if blue else 0))
            tx += cell
        ty += cell * 0.85
        row += 1

    # ── espadas, escudos, elmos, flechas e lanças, em volta dos corpos e soltos pelo campo ──
    def near(x: float, y: float, spread: float) -> tuple[float, float]:
        a = rng.uniform(0, math.tau)
        r = rng.uniform(1.3, spread)
        return x + math.cos(a) * r, y + math.sin(a) * r * 0.7

    for bx, by, blue in bodies:
        if rng.random() < 0.4:
            x, y = near(bx, by, 2.6)
            if free(x, y, 0.7):
                z.put(rng.choice(ESPADA_CRAVADA), x, y, rng.random() < 0.5)
                placed.append((x, y))
        if rng.random() < 0.45:
            x, y = near(bx, by, 2.8)
            if free(x, y, 0.8):
                z.put(rng.choice(ESPADA_CAIDA), x, y, rng.random() < 0.5)
        if rng.random() < 0.3:
            x, y = near(bx, by, 2.6)
            if free(x, y, 0.8):
                z.put(rng.choice(ESCUDOS_A if blue else ESCUDOS_V) if rng.random() < 0.8 else ESCUDO_PARTIDO, x, y, rng.random() < 0.5)
        if rng.random() < 0.25:
            x, y = near(bx, by, 2.4)
            z.put(ELMO, x, y, rng.random() < 0.5)
        if rng.random() < 0.22:
            x, y = near(bx, by, 3.0)
            z.put(rng.choice(FLECHAS), x, y, rng.random() < 0.5)
        if rng.random() < 0.12:
            x, y = near(bx, by, 3.0)
            z.put(LANCA, x, y, rng.random() < 0.5)

    # espadas e armas soltas (quem fugiu largou o que tinha), mais rareadas
    for _ in range(int((x1 - x0) * (y1 - y0) * 0.035)):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if inside(x, y) and rng.random() < 0.25 + density(x, y):
            roll = rng.random()
            if roll < 0.5:
                z.put(rng.choice(ESPADA_CRAVADA), x, y, rng.random() < 0.5)
            elif roll < 0.8:
                z.put(rng.choice(ESPADA_CAIDA), x, y, rng.random() < 0.5)
            elif roll < 0.9:
                z.put(rng.choice(FLECHAS), x, y, rng.random() < 0.5)
            else:
                z.put(ARCO, x, y, rng.random() < 0.5)

    # um estandarte caído de cada exército, atrás das suas fileiras (a normal da linha aponta pro lado azul)
    nx, ny = fdy / flen, -fdx / flen
    for t, sgn, kind in ((0.3, -1, ESTANDARTE_V), (0.7, 1, ESTANDARTE_A)):
        cx, cy = fx0 + fdx * t + nx * sgn * 13, fy0 + fdy * t + ny * sgn * 13
        if inside(cx, cy):
            z.put(kind, cx, cy, False)
