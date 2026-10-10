"""Peças de construção do mundo "Nova York": catálogo de tamanhos, fileiras de móveis, ruas, fachadas e interiores.

Tudo em TILES (32 px). Os mundos são montados em `world_nyc.py` com isto.
"""
from __future__ import annotations

import json
import os
import random

from .px import fbm
from .worlds import Zone, TILE, person, SHORT, LONG, SHIRT_PLAID, SHIRT_DIRTY, SHIRT_CAMO, LEGS_DIRTY, LEGS_CAMO  # noqa: F401

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'vortable', 'assets'))
_CAT = json.load(open(os.path.join(ASSETS, 'catalog', 'objects.json'), encoding='utf-8'))
DIM: dict[str, tuple[int, int]] = {o['id']: (o['w'], o['h']) for o in _CAT['objects']}

# ── ids dos móveis e da cidade (conferidos contra o catálogo) ──
TABLE_LONG = 'furn-dark-wood@0,233'
TABLE_ROUND = 'furn-dark-wood@225,227'
DINING = 'furn-dark-wood@264,855'
WORKTBL = 'furn-dark-wood@272,896'
CHAIR = 'furn-dark-wood@419,551'
DESK = 'furn-dark-wood@482,552'
DESK2 = 'furn-dark-wood@320,503'
SHELF = 'furn-dark-wood@0,928'
SHELF_LOW = 'furn-dark-wood@66,960'
BED = 'furn-dark-wood@8,452'
BED_THIN = 'furn-dark-wood@8,536'
WARDROBE = 'furn-dark-wood@102,64'
LOCKER = 'furn-dark-wood@418,65'
CABINET = 'furn-dark-wood@354,81'
SOFA = 'uph-azul@128,224'
SOFA2 = 'uph-azul@197,160'
SINK = 'int@64,103'
STOVE = 'int@128,108'
COUNTER = 'int@96,108'
BOOKS = 'int@32,192'
DISHES = 'int@64,192'
MSHELF = 'farm-goods@160,262'
MCOUNTER = 'med-deco@288,960'
CHEST = 'med-deco@226,960'
NOTICE = 'med-deco@225,160'
WIN = 'wd@528,25'
WIN2 = 'wd@608,25'
DOOR = 'wd@795,10'
STAIR_UP = 'stairs@0,0'
STAIR_DOWN = 'stairs@0,64'
CELL_BED = 'dun@6,168'
TREES_BIG = ['trees-green@301,512', 'trees-green@491,515', 'trees-green@672,515', 'trees-green@835,533', 'trees-green@0,535',
             'trees-green@161,530', 'trees-green@681,354', 'trees-green@418,352', 'trees-green@583,224', 'trees-green@709,224']
TREES_MID = ['trees-green@128,104', 'trees-green@231,104', 'trees-green@320,102', 'trees-green@544,96', 'trees-green@66,230',
             'trees-green@164,224', 'trees-green@264,224', 'trees-green@384,224', 'trees-green@485,226', 'trees-green@129,352',
             'trees-green@321,352', 'trees-green@556,356', 'trees-green@0,102', 'trees-green@64,96', 'trees-green@582,0']
TREES_SMALL = ['trees-green@8,232', 'trees-green@0,356', 'trees-green@64,356', 'trees-green@518,1', 'trees-green@65,0',
               'trees-green@672,8', 'trees-green@256,0']
BUSHES = ['trees-green@11,11', 'trees-green@131,2', 'trees-green@200,7', 'trees-green@224,368', 'trees-green@0,64']
TREES_DEAD = ['trees-dead@3,139', 'trees-dead@131,133', 'trees-dead@140,393', 'trees-dead@519,29']
CARS = ['carro-vermelho', 'carro-azul', 'carro-branco', 'carro-amarelo', 'carro-verde', 'van']
WEEDS = ['mato-alto-1', 'mato-alto-2', 'arbusto-invasor', 'arbusto-seco', 'mato-denso']
GROUND_BITS = ['raizes-asfalto', 'rachadura-ervas', 'folhas-secas', 'poca-1', 'poca-2', 'papeis', 'vidro-quebrado', 'latas-garrafas']
SPORES = ['corpo-fungo', 'casulo', 'bulbo-esporos', 'micelio-1', 'micelio-2', 'micelio-3', 'tentaculos-chao', 'tronco-fungo-1', 'tronco-fungo-2']


def size(kind: str) -> tuple[int, int]:
    return DIM.get(kind if '@' in kind else f'tlou@{kind}', (32, 32))


def check_ids(kinds: list[str]) -> None:
    for k in kinds:
        kid = k if '@' in k else f'tlou@{k}'
        assert kid in DIM, f'objeto inexistente no catálogo: {kid}'


class NZ(Zone):
    """Zona com ajudantes de rua, fachada, interior e vegetação."""

    # ── Móveis em fileira ──────────────────────────────────
    def row(self, kind: str, x0: float, x1: float, base_y: float, gap: float = 0.1, flip_alt: bool = False) -> int:
        """Põe `kind` lado a lado de x0 a x1 (tiles), com a base em base_y. Devolve quantos."""
        w = size(kind)[0] / TILE
        x = x0 + w / 2
        n = 0
        while x + w / 2 <= x1 + 1e-6:
            self.put(kind, x, base_y, flip_alt and n % 2 == 1)
            x += w + gap
            n += 1
        return n

    def col(self, kind: str, y0: float, y1: float, x: float, gap: float = 0.1, flip: bool = False) -> int:
        h = size(kind)[1] / TILE
        y = y0 + h
        n = 0
        while y <= y1 + 1e-6:
            self.put(kind, x, y, flip)
            y += h + gap
            n += 1
        return n

    def grid(self, kind: str, x0: float, y0: float, x1: float, y1: float, dx: float, dy: float, flip_alt: bool = False) -> None:
        y = y0
        r = 0
        while y <= y1 + 1e-6:
            x = x0
            while x <= x1 + 1e-6:
                self.put(kind, x, y, flip_alt and r % 2 == 1)
                x += dx
            y += dy
            r += 1

    # ── Terreno ──────────────────────────────────────────
    def wear_ground(self, box: tuple[int, int, int, int], only: str, seed: int, grass: float = 0.7, moss: float = 0.68) -> None:
        """Mato e musgo tomando conta do chão (só por cima de `only`)."""
        self.noise('tlou-mato-invasor', 3.0, grass, seed, box, only=only)
        self.noise('tlou-asfalto-musgo', 4.0, moss, seed + 7, box, only=only)
        self.noise('tlou-asfalto-rachado', 5.0, 0.58, seed + 13, box, only=only)

    def strew(self, kinds: list[str], n: int, box: tuple[float, float, float, float], avoid=None) -> None:
        self.scatter(kinds, n, box, avoid)

    def trees(self, n: int, box: tuple[float, float, float, float], avoid: list[tuple] | None = None, mix: tuple[float, float, float, float] = (0.2, 0.45, 0.2, 0.15)) -> int:
        """Mata fechada: árvores grandes, médias, pequenas e arbustos (sem mexer onde está `avoid`)."""
        x0, y0, x1, y1 = box
        placed = 0
        tries = 0
        pools = (TREES_BIG, TREES_MID, TREES_SMALL, BUSHES)
        spots: list[tuple[float, float]] = []
        while placed < n and tries < n * 40:
            tries += 1
            tx, ty = self.rng.uniform(x0, x1), self.rng.uniform(y0, y1)
            if avoid and any(ax0 <= tx <= ax1 and ay0 <= ty <= ay1 for ax0, ay0, ax1, ay1 in avoid):
                continue
            if any((tx - sx) ** 2 + (ty - sy) ** 2 < 2.4 ** 2 for sx, sy in spots):
                continue
            pool = self.rng.choices(pools, weights=mix)[0]
            self.put(self.rng.choice(pool), tx, ty, self.rng.random() < 0.5)
            spots.append((tx, ty))
            placed += 1
        return placed

    # ── Ruas ─────────────────────────────────────────────
    def road_paint(self, vx0: int, vy0: int, vx1: int, vy1: int, terrain: str = 'tlou-asfalto') -> None:
        self.paint(terrain, vx0, vy0, vx1, vy1)

    def skip_rect(self, rects: list[tuple[float, float, float, float]]):
        return lambda tx, ty: any(x0 <= tx + 0.5 <= x1 and y0 <= ty + 0.5 <= y1 for x0, y0, x1, y1 in rects)

    def road_lines_v(self, cx: int, y0: int, y1: int, lanes: tuple[int, ...] = (), edges: tuple[int, ...] = (), skip=None) -> None:
        self.paint_line('amarela-dupla', 'v', cx, y0, y1, skip)
        for lx in lanes:
            self.paint_line('faixa-branca', 'v', lx, y0, y1, skip)
        for ex in edges:
            self.paint_line('amarela-borda', 'v', ex, y0, y1, skip)

    def road_lines_h(self, cy: int, x0: int, x1: int, lanes: tuple[int, ...] = (), edges: tuple[int, ...] = (), skip=None) -> None:
        self.paint_line('amarela-dupla', 'h', cy, x0, x1, skip)
        for ly in lanes:
            self.paint_line('faixa-branca', 'h', ly, x0, x1, skip)
        for ey in edges:
            self.paint_line('amarela-borda', 'h', ey, x0, x1, skip)

    def cars(self, spots: list[tuple[float, float]]) -> None:
        for i, (tx, ty) in enumerate(spots):
            self.put(self.rng.choice(CARS), tx, ty, self.rng.random() < 0.5)

    # ── Fachadas (prédios vistos de frente, face sul) ──────────────
    def facade(self, x0: int, x1: int, y0: int, wall: str, ceil: str, floor: str = 'tlou-concreto', porch: int = 3, height: int = 4) -> tuple[float, float]:
        """Fachada: faixa de parede + calçada coberta embaixo. Devolve (y do pé da parede, y do fim do alpendre) em tiles."""
        # só a faixa da parede entra como cômodo: o motor trata a borda de qualquer cômodo como parede sólida, e um alpendre
        # dentro do cômodo prende quem sai do prédio. O alpendre é só chão, aberto pra rua.
        self.room(x0, y0, x1, y0 + height, floor, wall, ceil, height)
        self.paint(floor, x0, y0 + height + 1, x1, y0 + height + porch)
        return y0 + height + 0.55, y0 + height + porch

    def windows(self, x0: float, x1: float, wall_y: float, every: float = 5.0, skip: tuple[float, float] | None = None, kind: str | None = None) -> None:
        x = x0 + 2.0
        while x <= x1 - 2.0:
            if not (skip and skip[0] <= x <= skip[1]):
                self.put(kind or (WIN if int(x) % 2 == 0 else WIN2), x, wall_y)
            x += every

    def boarded(self, x: float, wall_y: float) -> None:
        self.put('porta-tapada', x, wall_y + 0.05)

    def door_portal(self, pid: str, name: str, cx: float, y_top: float, to: tuple[str, str], w: float = 3, h: float = 1.6) -> None:
        self.portal(pid, name, cx - w / 2, y_top, w, h, to)

    # ── Interior ──────────────────────────────────────────────
    def void_base(self) -> None:
        self.base = 'void'

    def hdoor(self, gap_x0: int, gap_x1: int, fy0: int, fy1: int, floor: str) -> None:
        """Passagem entre duas salas lado a lado: piso nos vértices do vão (linhas fy0..fy1)."""
        self.door(gap_x0, gap_x1, fy0, fy1, floor)

    def room_floor_box(self, x0: int, y0: int, x1: int, y1: int, height: int = 3) -> tuple[float, float, float, float]:
        """Caixa útil do piso, em tiles: (x0, y0 do 1º pé de móvel, x1, y1)."""
        return x0 + 0.1, y0 + height + 1, x1 - 0.1, y1 - 0.1

    def clutter(self, box: tuple[float, float, float, float], n: int, kinds: list[str] | None = None) -> None:
        self.scatter(kinds or ['papeis', 'vidro-quebrado', 'latas-garrafas', 'entulho-pequeno', 'sacos-lixo'], n, box)

    def interior_windows(self, x0: int, x1: int, y0: int, height: int, every: float = 6.0, lit: bool = True, skip=None) -> None:
        wy = y0 + height + 0.45
        x = x0 + 3.0
        i = 0
        while x <= x1 - 2.5:
            if not (skip and skip[0] <= x <= skip[1]):
                self.put(WIN if i % 2 == 0 else WIN2, x, wy)
                if lit:
                    self.light(f'jan-{x0}-{y0}-{i}', x, y0 + height + 1.4, 120, '#9cc4ff', 0.3, 0.05)
            x += every
            i += 1
