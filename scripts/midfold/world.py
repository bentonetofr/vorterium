"""MIDFOLD: seis zonas de campos planos, trilha de terra, estrada de lajotas cinzas e árvores imensas.

Z1 → Z2 → Z3 → Z4 da esquerda pra direita (terra); em Z4 a trilha vira pra baixo e encontra a estrada de lajotas que corta a zona de
cima a baixo; Z5 e Z6 seguem pra baixo pela estrada; Z6 termina num acampamento (a estrada segue pro sul, sem saída).
"""
from __future__ import annotations

import math
import os

from saltmore.kit import R_GRAY
from saltmore.lib import OBJ, ROOT, TILE, Path, Zone, fbm, link, write_world
from saltmore.world import validate

from . import trees

MAP = os.path.join(ROOT, 'public', 'vortable', 'maps', 'midfold.mundo.json')

GRASS = 'grass-light'
PAVER = 'floor-75'                       # lajotas cinzas de pedra
EDGE_FLOOR = ['plants@11,487', 'rock-cinza@263,100']                                  # musgo e seixos com grama (rasteiros)
EDGE_TUFTS = ['plants@46,333', 'plants@73,331', 'plants@97,333', 'plants@145,339', 'plants@174,332', 'plants@497,289']   # ervinhas
PEBBLE_SET = [i for i in R_GRAY['flat'] if OBJ[i]['w'] <= 20 and OBJ[i]['h'] <= 18]
W, H_ROW, H_COL = 112, 72, 88          # zonas da fileira (Z1–Z4) e da descida (Z5–Z6)
EXIT_HALF = 4.5                          # meia-altura/largura das saídas
PORTAL = 2.6

# alturas (y) em que a trilha cruza as bordas entre zonas da esquerda pra direita
Y_START, Y_12, Y_23, Y_34 = 38.0, 33.0, 42.0, 31.0
# x em que a estrada cruza as bordas entre as zonas de cima pra baixo
X_ROAD_TOP, X_45, X_56, X_END = 58.0, 52.0, 60.0, 57.0


def _trail(z: Zone, path: Path, width: float, seed: int) -> None:
    z.trail(path, width, 'dirt', wobble=0.35, seed=seed, keep_extra=3.0)
    z.brush('dirt-light', path.pts[::2], width * 0.33, 0.45, seed + 7, only={'dirt'})


def _road(z: Zone, path: Path, width: float, seed: int) -> None:
    """A estrada principal: faixa estreita de lajotas cinzas no meio de uma faixa larga de terra clara que se desmancha na grama.
    A beira das lajotas (reta, por ser de tile inteiro) é quebrada com musgo, ervinhas e seixos com grama por cima."""
    z.brush('dirt', path.pts[::2], width / 2 + 1.3, 0.75, seed, only={GRASS, 'grass'})
    z.brush('dirt-light', path.pts[::2], width / 2 - 0.3, 0.6, seed + 1, only={'dirt'})
    z.brush(PAVER, path.pts, width / 2 - 1.4, 0.0, seed + 3)
    rng = z.rng
    breakers = EDGE_FLOOR + EDGE_TUFTS * 2
    for ty in range(z.h):
        for tx in range(z.w):
            cs = [z.terrain_at(tx + dx, ty + dy) == PAVER for dx in (0, 1) for dy in (0, 1)]
            if 0 < sum(cs) < 4:
                for _ in range(2 if rng.random() < 0.6 else 1):
                    z.put(rng.choice(breakers), tx + rng.uniform(0.0, 1.0), ty + rng.uniform(0.2, 1.1), rng.random() < 0.5)
            else:
                ds = [z.terrain_at(tx + dx, ty + dy) in ('dirt', 'dirt-light') for dx in (0, 1) for dy in (0, 1)]
                gs = [z.terrain_at(tx + dx, ty + dy) in (GRASS, 'grass') for dx in (0, 1) for dy in (0, 1)]
                if any(ds) and any(gs) and rng.random() < 0.45:           # a grama entrando na terra da beira
                    z.put(rng.choice(EDGE_TUFTS), tx + rng.uniform(0.0, 1.0), ty + rng.uniform(0.2, 1.1), rng.random() < 0.5)
    # algumas pedrinhas soltas na terra dos lados
    for _ in range(int(len(path.pts) * 0.4 * 0.8)):
        px, py = path.pts[rng.randrange(len(path.pts))]
        off = rng.choice((-1, 1)) * rng.uniform(width / 2 - 1.2, width / 2 + 0.6)
        z.put(rng.choice(PEBBLE_SET), px + off, py + rng.uniform(-0.6, 0.6), rng.random() < 0.5)
    z.reserve_path(path, width / 2 + 3.0)


def build() -> list[Zone]:
    zones: list[Zone] = []

    # ── Z1: o começo da trilha ──
    p1 = Path([(0, Y_START), (10, Y_START + 1.5), (24, Y_START - 3), (40, Y_START - 6), (56, Y_START - 3), (72, Y_START + 4),
               (88, Y_START + 1), (100, Y_12 + 1), (W, Y_12)])
    z1 = Zone('midfold-campo-1', 'Campos de Midfold: a trilha começa', W, H_ROW, GRASS, 11)
    # ── Z2 ──
    p2 = Path([(0, Y_12), (14, Y_12 + 2), (28, Y_12 + 6), (44, Y_12 + 3), (60, Y_12 - 3), (76, Y_12 - 1), (92, Y_23 - 6), (104, Y_23 - 2), (W, Y_23)])
    z2 = Zone('midfold-campo-2', 'Campos de Midfold: pasto aberto', W, H_ROW, GRASS, 12)
    # ── Z3 ──
    p3 = Path([(0, Y_23), (12, Y_23 - 2), (26, Y_23 - 8), (42, Y_23 - 10), (58, Y_23 - 5), (74, Y_23 + 3), (90, Y_23 - 1), (102, Y_34 + 3), (W, Y_34)])
    z3 = Zone('midfold-campo-3', 'Campos de Midfold: as árvores imensas', W, H_ROW, GRASS, 13)
    # ── Z4: a trilha vira pra baixo e encontra a estrada ──
    p4 = Path([(0, Y_34), (12, Y_34 + 1), (26, Y_34 - 2), (40, Y_34 + 2), (50, Y_34 + 5), (X_ROAD_TOP - 1, 40)])
    road4 = Path([(X_ROAD_TOP, 0), (X_ROAD_TOP + 2, 12), (X_ROAD_TOP - 1, 24), (X_ROAD_TOP - 3, 36), (X_ROAD_TOP - 2, 48), (X_ROAD_TOP + 2, 58), (X_45 + 4, 66), (X_45, H_ROW)])
    z4 = Zone('midfold-encruzilhada', 'Campos de Midfold: a estrada', W, H_ROW, GRASS, 14)
    # ── Z5 ──
    road5 = Path([(X_45, 0), (X_45 - 3, 12), (X_45 - 6, 26), (X_45 - 2, 40), (X_45 + 4, 54), (X_56 + 4, 70), (X_56, H_COL)])
    z5 = Zone('midfold-descida-1', 'Campos de Midfold: a descida', W, H_COL, GRASS, 15)
    # ── Z6 ──
    road6 = Path([(X_56, 0), (X_56 + 3, 12), (X_56 - 2, 26), (X_56 - 6, 40), (X_56 - 4, 54), (X_END - 1, 70), (X_END, H_COL)])
    z6 = Zone('midfold-acampamento', 'Campos de Midfold: o acampamento', W, H_COL, GRASS, 16)

    for z in (z1, z2, z3, z4, z5, z6):
        z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.35}
        z.sound = {'auto': True, 'layers': {'wind': 0.35}}

    for z, p in ((z1, p1), (z2, p2), (z3, p3)):
        _trail(z, p, 4.2, 50 + z.seed)
    _trail(z4, p4, 4.2, 70)
    # a trilha desemboca na estrada: um alargamento de terra na junção (a pedra vem por cima)
    jx, jy = p4.pts[-1]
    z4.brush('dirt-light', [(jx - 3, jy - 0.5), (jx - 1, jy)], 3.4, 0.3, 77)
    for z, p in ((z4, road4), (z5, road5), (z6, road6)):
        _road(z, p, 6.4, 90 + z.seed)

    # ── o acampamento (primeiro, pra reservar o chão antes das árvores) ──
    from . import camp
    camp.build(z6, road6)

    for z in (z1, z2, z3, z4, z5, z6):
        trees.populate(z)

    # ── saídas ──
    link(z1, 'leste', (W - PORTAL / 2, Y_12 - EXIT_HALF, PORTAL, EXIT_HALF * 2), 'Seguir a trilha',
         z2, 'oeste', (PORTAL / 2, Y_12 - EXIT_HALF, PORTAL, EXIT_HALF * 2), 'Voltar pela trilha')
    link(z2, 'leste', (W - PORTAL / 2, Y_23 - EXIT_HALF, PORTAL, EXIT_HALF * 2), 'Seguir a trilha',
         z3, 'oeste', (PORTAL / 2, Y_23 - EXIT_HALF, PORTAL, EXIT_HALF * 2), 'Voltar pela trilha')
    link(z3, 'leste', (W - PORTAL / 2, Y_34 - EXIT_HALF, PORTAL, EXIT_HALF * 2), 'Seguir a trilha',
         z4, 'oeste', (PORTAL / 2, Y_34 - EXIT_HALF, PORTAL, EXIT_HALF * 2), 'Voltar pela trilha')
    link(z4, 'sul', (X_45, H_ROW - PORTAL, 11, PORTAL), 'Seguir a estrada',
         z5, 'norte', (X_45, 0, 11, PORTAL), 'Voltar pela estrada')
    link(z5, 'sul', (X_56, H_COL - PORTAL, 11, PORTAL), 'Seguir a estrada',
         z6, 'norte', (X_56, 0, 11, PORTAL), 'Voltar pela estrada')

    z1.spawn = {'x': 5 * TILE, 'y': round(Y_START * TILE)}
    return [z1, z2, z3, z4, z5, z6]


LAYOUT = {'midfold-campo-1': (0, 0), 'midfold-campo-2': (1, 0), 'midfold-campo-3': (2, 0), 'midfold-encruzilhada': (3, 0),
          'midfold-descida-1': (3, 1), 'midfold-acampamento': (3, 2)}


def generate(check: bool = True) -> None:
    zones = build()
    if check:
        validate(zones)
    layout = {z.id: LAYOUT[z.id] for z in zones}
    write_world(MAP, 'mundo-midfold', 'MIDFOLD', zones, layout, 'midfold-campo-1', {'hour': 12.0})


if __name__ == '__main__':
    generate()
