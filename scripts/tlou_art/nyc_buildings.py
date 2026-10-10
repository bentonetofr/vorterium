"""Interiores do mundo "Nova York": apartamentos, lojas, delegacia, escritórios, escola, restaurante.

Cada andar é uma zona. Os cômodos são caixas (`room`) lado a lado, separadas por 2 vértices de vazio, ou empilhadas
(a parede de cima do cômodo de baixo faz a divisória), com passagens abertas no piso.
"""
from __future__ import annotations

from .nyc_kit import *  # noqa: F401,F403
from .nyc_kit import NZ

H3 = 3                     # altura das paredes internas (tiles)


class Style:
    def __init__(self, floor: str, wall: str, ceil: str):
        self.floor, self.wall, self.ceil = floor, wall, ceil


APT = Style('floor-2', 'wall-97', 'ceil-9')
SHOP = Style('floor-20', 'wall-161', 'ceil-9')
PHARM = Style('floor-22', 'wall-81', 'ceil-9')
OFFICE = Style('floor-24', 'wall-177', 'ceil-9')
POLICE = Style('floor-29', 'wall-49', 'ceil-25')
SCHOOL = Style('floor-22', 'wall-161', 'ceil-9')
SCHOOL_HALL = Style('floor-20', 'wall-177', 'ceil-9')
DINER = Style('floor-3', 'wall-209', 'ceil-3')
RESTA = Style('floor-23', 'wall-193', 'ceil-3')
MOTEL = Style('floor-4', 'wall-129', 'ceil-9')
CABIN = Style('floor-7', 'wall-225', 'ceil-3')
SHED = Style('floor-29', 'wall-1', 'ceil-25')
BASEMENT = Style('floor-29', 'wall-49', 'ceil-25')


def interior(zid: str, name: str, w: int, h: int, seed: int, hour_dark: bool = False) -> NZ:
    z = NZ(zid, name, w, h, 'void', seed)
    z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
    z.sound = {'auto': True}
    return z


def box(z: NZ, st: Style, x0: int, y0: int, x1: int, y1: int, h: int = H3) -> tuple[float, float, float, float]:
    z.room(x0, y0, x1, y1, st.floor, st.wall, st.ceil, h)
    return z.room_floor_box(x0, y0, x1, y1, h)


def doorway(z: NZ, st: Style, cx: int, y_top: int, y_bot: int, half: int = 2) -> None:
    z.door(cx - half, cx + half, y_top, y_bot, st.floor)


def side_door(z: NZ, st: Style, gx0: int, gx1: int, ytop: int, ybot: int) -> None:
    """Passagem lateral entre duas salas: os vértices da porta entram no cômodo (senão a borda de cômodo bloqueia), com a
    coluna da direita começando uma linha abaixo (senão o motor lê os dois vértices como parede)."""
    z.door(gx0, gx1, ytop, ybot, st.floor)
    style = z.rooms[z.at(gx0 - 1, ytop)]
    for y in range(ytop, ybot + 1):
        z.rooms[z.at(gx0, y)] = style
        if y > ytop:
            z.rooms[z.at(gx1, y)] = style


def decay(z: NZ, fb: tuple[float, float, float, float], n: int, weeds: int = 0) -> None:
    z.clutter(fb, n)
    if weeds:
        z.strew(['mato-alto-1', 'mato-alto-2', 'arbusto-invasor', 'raizes-asfalto', 'rachadura-ervas'], weeds, fb)


def stairs(z: NZ, tx: float, ty: float, up: bool = True) -> None:
    z.put(STAIR_UP if up else STAIR_DOWN, tx, ty)


def north_wall_row(z: NZ, kinds: list[str], x0: float, x1: float, y0: int, h: int = H3, gap: float = 0.15) -> None:
    """Fileira de móveis encostada na parede de cima do cômodo."""
    fy = y0 + h + 1.0
    x = x0
    for k in kinds:
        w, hh = size(k)
        by = fy + hh / TILE * 0.55
        if x + w / TILE > x1 + 1e-6:
            break
        z.put(k, x + w / TILE / 2, by)
        x += w / TILE + gap


# ── Móveis por tipo de cômodo ───────────────────────────────────────

def furnish_unit(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int, ruined: float = 0.5) -> None:
    """Apartamento: quarto, sala e cozinha no mesmo cômodo."""
    fb = z.room_floor_box(x0, y0, x1, y1)
    north_wall_row(z, [WARDROBE, BED, CABINET, SHELF], x0 + 0.6, x1 - 0.4, y0)
    z.interior_windows(x0, x1, y0, H3, 6.5)
    mid_y = (fb[1] + fb[3]) / 2 + 0.6
    z.put(SOFA, x0 + 4.2, mid_y + 1.2); z.put(TABLE_LONG, x0 + 4.4, mid_y + 3.0)
    z.put(TABLE_ROUND, x1 - 4.0, mid_y + 1.4); z.put(CHAIR, x1 - 6.0, mid_y + 1.8); z.put(CHAIR, x1 - 2.0, mid_y + 1.8, True)
    kx = x1 - 6.5
    for i, k in enumerate([SINK, COUNTER, STOVE]):
        z.put(k, kx + i * 1.0 + 0.5, y1 - 0.4)
    z.put(DISHES, x0 + 1.4, y1 - 0.5)
    decay(z, fb, int(8 * ruined) + 3, int(5 * ruined))


def furnish_classroom(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    z.put(NOTICE, (x0 + x1) / 2 - 2.0, y0 + H3 + 1.15)
    z.put(NOTICE, (x0 + x1) / 2 + 2.0, y0 + H3 + 1.15)
    z.interior_windows(x0, x1, y0, H3, 6.0)
    z.put(WORKTBL, (x0 + x1) / 2, y0 + H3 + 3.0); z.put(CHAIR, (x0 + x1) / 2, y0 + H3 + 2.2)
    z.grid(DESK, x0 + 2.2, y0 + H3 + 5.3, x1 - 2.0, y1 - 0.6, 2.8, 2.7)
    z.put(LOCKER, x0 + 0.9, y1 - 0.3); z.put(LOCKER, x0 + 1.8, y1 - 0.3)
    decay(z, fb, 7, 3)


def furnish_shop(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int, kind: str = 'deli') -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    shelf = MSHELF if kind != 'pharmacy' else SHELF
    north_wall_row(z, [shelf] * 12, x0 + 0.6, x1 - 0.4, y0, gap=0.05)
    z.interior_windows(x0, x1, y0, H3, 7.0)
    for i in range(3):                                           # corredores de prateleiras
        y = fb[1] + 4.6 + i * 3.2
        z.row(SHELF_LOW if kind == 'pharmacy' else MSHELF, x0 + 3.0, x0 + 3.0 + 4.4, y, 0.2)
        z.row(SHELF_LOW if kind == 'pharmacy' else MSHELF, x0 + 10.0, x1 - 2.0, y, 0.2)
    z.row(MCOUNTER, x1 - 8.0, x1 - 1.0, y1 - 1.4, 0.0)
    z.put('caixote-aberto', x0 + 1.4, y1 - 0.7); z.put('caixotes-pilha', x0 + 2.6, y1 - 0.6); z.put('caixa-municao', x0 + 4.0, y1 - 0.5)
    decay(z, fb, 10, 3)


def furnish_office(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    z.interior_windows(x0, x1, y0, H3, 6.0)
    north_wall_row(z, [SHELF, SHELF, CABINET, SHELF], x0 + 0.5, x1 - 0.4, y0)
    z.grid(DESK2, x0 + 3.2, y0 + H3 + 5.0, x1 - 3.0, y1 - 1.0, 4.2, 3.4)
    z.put(CHEST, x1 - 1.6, y1 - 0.5)
    decay(z, fb, 9, 3)


def furnish_cells(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    for i in range(3):
        z.put(CELL_BED, x0 + 2.0 + i * 3.2, y0 + H3 + 3.0)
    z.interior_windows(x0, x1, y0, H3, 7.0)
    decay(z, fb, 5, 2)


def furnish_restaurant_hall(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    z.interior_windows(x0, x1, y0, H3, 6.0)
    for ty in (fb[1] + 3.6, fb[1] + 7.0, fb[1] + 10.4):
        x = x0 + 4.0
        while x < x1 - 8.0:
            z.put(TABLE_ROUND, x, ty)
            z.put(CHAIR, x - 1.6, ty - 0.2); z.put(CHAIR, x + 1.6, ty - 0.2, True)
            x += 5.2
    z.row(MCOUNTER, x1 - 8.0, x1 - 0.8, y0 + H3 + 3.0, 0.0)
    z.put(SHELF, x1 - 1.4, y0 + H3 + 1.8); z.put(SHELF, x1 - 3.5, y0 + H3 + 1.8)
    decay(z, fb, 12, 4)


def furnish_kitchen(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    north_wall_row(z, [STOVE, STOVE, COUNTER, SINK, COUNTER, STOVE, DISHES, DISHES, COUNTER], x0 + 0.5, x1 - 0.4, y0)
    z.interior_windows(x0, x1, y0, H3, 7.0)
    for i in range(2):
        z.row(WORKTBL, x0 + 3.0, x1 - 3.0, fb[1] + 4.5 + i * 3.4, 0.5)
    z.put(CHEST, x1 - 1.6, y1 - 0.5); z.put(MSHELF, x0 + 1.4, y1 - 0.4)
    decay(z, fb, 8, 2)


def furnish_motel_room(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    north_wall_row(z, [BED, CABINET, WARDROBE], x0 + 0.5, x1 - 0.4, y0)
    z.put(DESK, x1 - 1.4, y1 - 0.6)
    z.interior_windows(x0, x1, y0, H3, 6.0, lit=False)
    decay(z, fb, 4, 1)


def furnish_lobby(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int, sign: bool = True) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    z.interior_windows(x0, x1, y0, H3, 7.0)
    z.row(MCOUNTER, x0 + 3.0, x0 + 3.0 + 6.0, y0 + H3 + 3.0, 0.0)
    z.row(SOFA, x1 - 12.0, x1 - 1.0, y1 - 0.6, 0.2)
    z.put(TABLE_LONG, x1 - 7.0, y1 - 2.5)
    decay(z, fb, 8, 3)


def furnish_corridor(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int, lockers: bool = False) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    z.interior_windows(x0, x1, y0, H3, 7.0)
    if lockers:
        north_wall_row(z, [LOCKER] * 40, x0 + 0.4, x1 - 0.4, y0, gap=0.0)
    decay(z, fb, 10, 3)


def furnish_library(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    north_wall_row(z, [SHELF] * 12, x0 + 0.5, x1 - 0.4, y0, gap=0.05)
    z.interior_windows(x0, x1, y0, H3, 7.5)
    for i in range(2):
        z.row(SHELF, x0 + 3.0, x1 - 3.0, fb[1] + 5.0 + i * 3.6, 1.0)
    z.put(TABLE_LONG, (x0 + x1) / 2, y1 - 1.0); z.put(CHAIR, (x0 + x1) / 2 - 2.0, y1 - 0.4)
    decay(z, fb, 9, 3)


def furnish_storage(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    north_wall_row(z, [MSHELF] * 12, x0 + 0.5, x1 - 0.4, y0, gap=0.05)
    z.grid('caixote', x0 + 2.0, fb[1] + 4.0, x1 - 2.0, y1 - 1.0, 3.0, 2.4)
    z.put('barril-agua', x0 + 1.2, y1 - 0.5); z.put('barril-enferrujado', x1 - 1.2, y1 - 0.5)
    decay(z, fb, 6, 2)


def link(a: NZ, ida: str, ra: tuple, na: str, b: NZ, idb: str, rb: tuple, nb: str) -> None:
    """Liga duas zonas por saídas que se apontam. r = (cx, y de cima, largura, altura) em tiles."""
    a.portal(ida, na, ra[0] - ra[2] / 2, ra[1], ra[2], ra[3], (b.id, idb))
    b.portal(idb, nb, rb[0] - rb[2] / 2, rb[1], rb[2], rb[3], (a.id, ida))


# ── Fachadas ─────────────────────────────────────────────────────

def front(z: NZ, x0: int, x1: int, y0: int, wall: str, ceil: str, sign: str | None = None, awning: str | None = None,
          door: float | None = None, boards: list[float] | None = None, escapes: list[float] | None = None,
          windows: bool = True, hera: list[float] | None = None) -> tuple[float, float]:
    """Prédio visto de frente: parede, letreiro, toldo, janelas, porta e escada de incêndio. Devolve (pé da parede, fim do alpendre)."""
    wy, end = z.facade(x0, x1, y0, wall, ceil)
    cx = (x0 + x1) / 2
    if windows:
        z.windows(x0, x1, wy, 5.0, skip=(door - 2.0, door + 2.0) if door is not None else None)
    if sign:
        z.put(f'letreiro-{sign}', cx, y0 + 2.0)
    if awning and door is not None:
        z.put(awning, door, wy - 0.15)
    if door is not None:
        z.put(DOOR, door, wy + 0.1)
    for b in boards or []:
        z.boarded(b, wy)
    for e in escapes or []:
        z.put('escada-incendio', e, wy)
    for h in hera or []:
        z.put('hera-parede-1' if int(h) % 2 else 'hera-parede-2', h, wy)
    return wy, end


def vcar(z: NZ, x: float, y: float, going_up: bool, key: str | None = None) -> None:
    key = key or z.rng.choice(['vermelho', 'azul', 'branco', 'amarelo', 'verde', 'van'])
    z.put(f'carro-v-{key}-{"costas" if going_up else "frente"}', x, y)


def vlane_cars(z: NZ, ys: list[float], skip_y: list[tuple[float, float]] | None = None, cx: float = 23.5, p: float = 0.38) -> None:
    """Carros abandonados nas quatro faixas de uma avenida na vertical, com o centro em cx."""
    for i, y in enumerate(ys):
        for lane_x, up in ((cx - 4.7 + z.rng.uniform(-0.2, 0.2), True), (cx - 1.6, True), (cx + 1.8, False), (cx + 4.9 + z.rng.uniform(-0.2, 0.2), False)):
            if z.rng.random() < p and not (skip_y and any(a <= y <= b for a, b in skip_y)):
                vcar(z, lane_x, y + z.rng.uniform(-1.2, 1.2), up)




def hlane_cars(z: NZ, xs: list[float], cy: float, p: float = 0.4) -> None:
    """Carros de lado numa avenida na horizontal (centro em cy): leste vai à direita, oeste à esquerda."""
    for x in xs:
        for ly, east in ((cy - 3.6, False), (cy - 1.4, False), (cy + 1.4, True), (cy + 3.6, True)):
            if z.rng.random() < p:
                z.put(z.rng.choice(CARS), x + z.rng.uniform(-1.5, 1.5), ly + 0.6, not east)
