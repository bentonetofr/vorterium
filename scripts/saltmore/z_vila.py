"""A vila de Pedraverde: muralha de pedra, praça com chafariz e feira, estalagem, capela com torre, ferreiro, hortas, celeiro e casas.

É uma vila grande: três ruas de terra se juntam na praça, cada casa tem caminho até a rua, e a mata volta logo depois do muro.
"""
from __future__ import annotations

import math

from .kit import (R_COAL, BUSHES_DARK, FERNS, FLOWERS, OAKS_BIG, OAKS_MID, PINES, R_GRAY, Building, carve, crop_field, find, forest, one, ring,
                  rock_cluster, scatter, undergrowth)
from . import npcs
from .lib import TILE, Path, Zone, fbm, obj_size

W, H = 100, 116
GATE_X = 50
WALL_L, WALL_R, WALL_T, WALL_B = 9, 91, 6, 109

# estilos de casa: parede, moldura da parede, telhado, moldura do telhado
STONE = dict(wall='wall-50', wall_trim='ceil-8', roof='floor-73', roof_trim='ceil-8')
STONE_DARK = dict(wall='wall-53', wall_trim='ceil-25', roof='floor-72', roof_trim='ceil-25')
STONE_BEAMS = dict(wall='wall-52', wall_trim='ceil-8', roof='floor-74', roof_trim='ceil-8')
TUDOR = dict(wall='wall-197', wall_trim='ceil-3', roof='floor-12', roof_trim='ceil-3')
TUDOR_GRID = dict(wall='wall-202', wall_trim='ceil-3', roof='floor-35', roof_trim='ceil-8')
TUDOR_X = dict(wall='wall-206', wall_trim='ceil-3', roof='floor-73', roof_trim='ceil-8')
TIMBER = dict(wall='wall-227', wall_trim='ceil-3', roof='floor-7', roof_trim='ceil-3')
BRICK = dict(wall='wall-17', wall_trim='ceil-11', roof='floor-12', roof_trim='ceil-11')

DOORS = ['wd@192,768', 'wd@0,768', 'wd@512,512', 'wd@0,512', 'wd@64,512', 'wd@256,768', 'wd@192,512', 'wd@384,768']
WIN_PLAIN = ['wd@611,162', 'wd@130,64', 'wd@16,26', 'wd@96,26', 'wd@354,64']
WIN_FLOWER = ['wd@448,32', 'wd@130,160', 'wd@320,220']

ROADS = {
    'main': Path([(50, 3), (50, 10), (47, 18), (45, 28), (47, 38), (50, 46), (50, 54), (53, 64), (58, 74), (55, 86), (51, 97), (50, 112)]),
    'west': Path([(43, 54), (36, 57), (30, 61), (26, 66), (22, 71)]),
    'garden': Path([(34, 58), (30, 50), (29, 42), (27, 36), (22, 32)]),
    'north-west': Path([(46, 20), (38, 21), (30, 22), (22, 21), (16, 22)]),
    'north-east': Path([(49, 15), (56, 16), (62, 21), (66, 24)]),
    'east': Path([(57, 55), (64, 55), (70, 58), (76, 58), (80, 60)]),
    'south-west': Path([(55, 82), (47, 86), (39, 90), (33, 95), (30, 99), (24, 99.8), (19, 99.8)]),
    'south-east': Path([(57, 80), (64, 85), (70, 90), (74, 91)]),
    'chapel': Path([(47, 24), (56, 25), (64, 25), (72, 26)]),
}


def _inside(x: float, y: float) -> bool:
    return WALL_L + 0.5 < x < WALL_R - 0.5 and WALL_T + 0.5 < y < WALL_B - 0.5


def _road_dist(x: float, y: float) -> float:
    return min(r.dist(x, y) for r in ROADS.values())


class Village:
    def __init__(self) -> None:
        self.z = Zone('saltmore-vila', 'Vila de Pedraverde', W, H, 'grass-dark', 801)
        self.z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.3}
        self.z.sound = {'auto': True, 'layers': {'forest': 0.3, 'wind': 0.2}}
        self.rng = self.z.rng
        self.houses: list[Building] = []
        self._pending_yard: list[Building] = []

    # ── ajudantes ────────────────────────────────────────────────
    def house(self, x0: int, y0: int, w: int, style: dict, *, roof_d: int = 4, wall_h: int = 3, door_dx: float | None = None,
              door: str | None = None, windows: bool = True, flowers: bool = True, link: str | None = 'main', overhang: int = 1) -> Building:
        z, rng = self.z, self.rng
        b = Building(z, x0, y0, w, roof_d=roof_d, wall_h=wall_h, overhang=overhang, **style)
        ddx = w / 2 if door_dx is None else door_dx
        b.door(ddx, door or rng.choice(DOORS))
        if windows:
            x = 1.7
            while x < w - 1.0:
                if abs(x - ddx) > 1.9:
                    pool = WIN_FLOWER if (flowers and rng.random() < 0.4) else WIN_PLAIN
                    b.window(x, rng.choice(pool))
                x += 3.4 if w < 12 else 3.8
        self.houses.append(b)
        self._pending_yard.append(b)
        # degrau e caminho até a rua
        z.put(one(r'^tapete de porta$', pack='lpc-base'), x0 + ddx, b.base + 0.4)
        z.reserve_rect(x0 + ddx - 1.2, b.base, x0 + ddx + 1.2, b.base + 1.6)
        if link:
            self.door_path(x0 + ddx, b.base + 1.2, ROADS[link])
        return b

    def yard(self, b: Building, n: int = 3) -> None:
        """Tralhas de quintal nas laterais e na frente da casa: lenha, barris, baldes, feno, varal, flores."""
        z, rng = self.z, self.rng
        door_x = None
        kinds = [r'^lenha empilhada( 2)?$', r'^pilha de lenha grande$', r'^barril em pe$', r'^balde( 2| 3)?$', r'^caixote$', r'^cesto|^cestos empilhados$',
                 r'^monte de feno$', r'^varal com roupas$', r'^banco comprido$', r'^toras$']
        spots = [(b.x0 - 1.6, b.bottom + 0.8), (b.x1 + 2.0, b.bottom + 0.8), (b.x0 - 1.4, b.bottom - 1.4), (b.x1 + 1.8, b.bottom - 1.4),
                 (b.x0 + 1.2, b.bottom + 2.2), (b.x1 - 1.2, b.bottom + 2.2)]
        rng.shuffle(spots)
        done = 0
        for tx, ty in spots:
            if done >= n:
                break
            if not self.z.free_disc(tx, ty, 0.6) or not (WALL_L + 2 < tx < WALL_R - 2):
                continue
            try:
                kind = one(rng.choice(kinds))
            except KeyError:
                continue
            z.put(kind, tx + rng.uniform(-0.3, 0.3), ty, rng.random() < 0.5, radius=0.6)
            done += 1
        # flores no pé da parede
        for _ in range(3):
            fx = b.x0 + rng.uniform(0.8, b.w - 0.8)
            z.put(rng.choice(FLOWERS), fx, b.bottom + 0.35 + rng.uniform(0, 0.25), radius=0.15)

    def door_path(self, x: float, y: float, road: Path, width: float = 1.9) -> None:
        z = self.z
        cand = [p for p in road.pts if p[1] >= y - 0.6]
        if not cand:
            return
        best = min(cand, key=lambda p: math.hypot(p[0] - x, p[1] - y))
        mid = ((x + best[0]) / 2 + self.rng.uniform(-0.6, 0.6), (y + best[1]) / 2 + self.rng.uniform(-0.6, 0.6))
        p = Path([(x, y), mid, best], step=0.4)
        z.brush('dirt', p.pts, width / 2, 0.3, 211, only=None)
        z.reserve_path(p, width / 2 + 0.6)

    def prop(self, pattern: str, tx: float, ty: float, flip: bool = False, z: int | None = None, pack: str | None = None,
             reserve: float | None = None) -> None:
        kind = one(pattern, pack=pack)
        self.z.put(kind, tx, ty, flip, z)
        w, h = obj_size(kind)
        self.z.spots.append((tx, ty, reserve if reserve is not None else max(0.35, min(w, 120) / TILE * 0.38)))

    # ── a vila ───────────────────────────────────────────────────
    def build(self) -> Zone:
        z, rng = self.z, self.rng
        self.ground()
        self.wall()
        self.plaza()
        self.north()
        self.middle()
        self.east()
        self.west()
        self.south()
        for b in self._pending_yard:
            self.yard(b, 3)
        self.nature()
        self.finish()
        return z

    def ground(self) -> None:
        z = self.z
        z.noise('grass', 6.0, 0.7, 801, only={'grass-dark'})
        z.noise('grass-light', 5.0, 0.8, 803, (WALL_L, WALL_T, WALL_R, WALL_B), only={'grass'})
        # as ruas de terra, mais largas perto da praça
        widths = {'main': 4.6, 'west': 3.0, 'garden': 2.6, 'north-west': 2.6, 'north-east': 2.6, 'east': 3.0, 'south-west': 2.6,
                  'south-east': 2.6, 'chapel': 2.4}
        for name, r in ROADS.items():
            z.trail(r, widths[name], 'dirt', wobble=0.3, seed=221 + len(name), keep_extra=1.0)
        z.noise('dirt-soft', 2.6, 0.7, 223, only={'dirt'})
        z.noise('pebbles', 2.0, 0.76, 225, only={'dirt'})
        for r in ROADS.values():
            z.brush('dirt-light', r.pts[::3], 0.8, 0.4, 227, only={'dirt', 'dirt-soft', 'pebbles'})
        # fora do muro: terra de entrada nos dois portões e a estrada que chega
        z.disc('dirt', GATE_X, 3, 5.0, 0.7, 229, only={'grass-dark', 'grass'})

    def wall(self) -> None:
        z = self.z
        east = [(53, WALL_T), (72, WALL_T), (72, WALL_T - 1), (WALL_R - 1, WALL_T - 1), (WALL_R - 1, 60), (WALL_R + 1, 60), (WALL_R + 1, 100), (WALL_R - 2, 100),
                (WALL_R - 2, WALL_B), (53, WALL_B)]
        west = [(47, WALL_B), (WALL_L + 1, WALL_B), (WALL_L + 1, 100), (WALL_L - 1, 100), (WALL_L - 1, 50), (WALL_L + 1, 50), (WALL_L + 1, WALL_T - 1),
                (30, WALL_T - 1), (30, WALL_T), (47, WALL_T)]
        for poly in (east, west):
            for (ax, ay), (bx, by) in zip(poly, poly[1:]):
                z.fence('fence-8', min(ax, bx), min(ay, by), max(ax, bx), max(ay, by))
        # um trecho caído da muralha, a sudoeste: pedras no chão
        z.clear_fence(9, 78, 9, 82)
        for i, ty in enumerate((77.6, 78.8, 80.0, 81.2, 82.4)):
            z.put(self.rng.choice(R_GRAY['small'] + R_GRAY['mid']), 8.8 + self.rng.uniform(-0.4, 0.6), ty, self.rng.random() < 0.5, radius=0.4)
        # os portões: arco de pedra no vão, braseiros e estandartes
        for gy, name in ((WALL_T, 'norte'), (WALL_B, 'sul')):
            z.put('wd@961,466', GATE_X + 0.5, gy + 1.4)
            z.put(one(r'^estandarte (verde|azul)$', pack='medieval'), GATE_X - 2.6, gy + 0.8)
            z.put(one(r'^estandarte (dourado|vermelho)$', pack='medieval'), GATE_X + 3.6, gy + 0.8)
            z.put(one(r'^poste com tocha$', pack='lpc-base'), GATE_X - 3.4, gy + 2.0)
            z.put(one(r'^poste com tocha$', pack='lpc-base'), GATE_X + 4.4, gy + 2.0)
            z.reserve_rect(GATE_X - 4.5, gy - 1.5, GATE_X + 5.5, gy + 3)
        # torres de vigia nos cantos de dentro (estacas altas e mastros com panos)
        for tx, ty in ((WALL_L + 2.2, WALL_T + 2.0), (WALL_R - 2.2, WALL_T + 2.0), (WALL_L + 2.2, WALL_B - 1.2), (WALL_R - 2.2, WALL_B - 1.2)):
            z.put(one(r'^mastro 2$', pack='medieval'), tx, ty)
            z.reserve_disc(tx, ty, 1.5)

    def plaza(self) -> None:
        z, rng = self.z, self.rng
        cx, cy = 50, 54
        z.disc('cobble-sand', cx, cy, 9.2, 0.6, 231)
        z.disc('cobble-light', cx, cy - 0.5, 3.4, 0.4, 233)
        z.reserve_disc(cx, cy, 9.0)
        self.prop(r'^chafariz de pedra$', cx, cy + 1.0, pack='medieval', reserve=2.2)
        # bancos em volta, lampiões e o quadro de avisos
        bench = one(r'^banco comprido$', pack='dungeon')
        for ang, flip in ((0.9, False), (2.2, False), (4.3, True), (5.4, False)):
            bx, by = cx + math.cos(ang) * 5.8, cy + math.sin(ang) * 4.6
            z.put(bench, bx, by, flip, radius=1.3)
        z.put(one(r'^poste com tocha$', pack='lpc-base'), cx - 7.0, cy + 0.6)
        z.put(one(r'^poste com tocha$', pack='lpc-base'), cx + 7.0, cy + 0.6)
        z.put(one(r'^poste com tocha$', pack='lpc-base'), cx, cy - 7.4)
        self.prop(r'^quadro de avisos$', cx - 3.0, cy - 5.6, pack='medieval')
        self.prop(r'^placa de direcao$', cx + 4.0, cy - 6.6, pack='medieval')
        # a feira: barracas coloridas, balcões, caixotes e sacos
        stalls = [('branca', 42.5, 61.2), ('marrom', 50.5, 62.6), ('verde', 58.0, 61.4)]
        for color, sx, sy in stalls:
            self.prop(rf'^barraca de feira {color}$', sx, sy, pack='medieval', reserve=1.8)
        foods = find(r'^(monte de tomates|repolho|cenouras|alface 1|laranja|ma[cç]a|melancia|abobora|pilha de peixes|pernil 1|pernis|frango assado 1|batatas 2|milho)$', pack='farm')             + find(r'^(laranja|maca|melancia|abobora|cenoura|pera|cebola|tomate|morango)$', pack='market')
        for sx, sy in ((45.7, 60.4), (53.0, 61.0), (59.6, 60.0)):
            self.prop(r'^balcao de feira$', sx, sy, pack='medieval', reserve=0.9)
            for dx in (-0.7, 0.0, 0.7):
                z.put(rng.choice(foods), sx + dx, sy - 0.1, False, 26)
        self.prop(r'^caixotes de feira$', 40.0, 60.0, pack='medieval')
        self.prop(r'^saco de graos 1$', 53.7, 63.2)
        self.prop(r'^pilha de sacos$', 60.8, 62.4)
        self.prop(r'^tapete enrolado azul$', 46.6, 63.5, pack='medieval')
        self.prop(r'^barril em pe$', 38.4, 61.2, pack='lpc-base')
        self.prop(r'^carroca coberta$', 63.6, 58.6, True, pack='medieval')
        # o carvalho velho da praça
        z.put(rng.choice(OAKS_BIG), 41.5, 49.0, False, radius=2.0)
        z.reserve_disc(41.5, 48.0, 3.2)
        for dx, dy in ((-1.0, 0.8), (1.6, 1.0), (-2.2, -0.4)):
            z.put(rng.choice(FLOWERS), 41.5 + dx, 50.5 + dy)

    def middle(self) -> None:
        """As casas que faltavam no miolo da vila."""
        self.house(33, 36, 8, STONE, door_dx=4.0, link='main')
        self.house(57, 33, 7, TUDOR_GRID, door_dx=3.5, link='main')
        self.house(36, 70, 8, STONE_BEAMS, door_dx=4.0, link='south-west')
        self.house(82, 68, 6, TIMBER, roof_d=3, door_dx=3.0, link='east')
        self.house(12, 16, 6, TIMBER, roof_d=3, door_dx=3.0, link='north-west')
        self.house(82, 17, 6, STONE_DARK, roof_d=3, door_dx=3.0, link='chapel', windows=False)
        # lampiões ao longo da rua principal
        for ty in (12, 24, 36, 70, 82, 94, 104):
            tx = ROADS['main'].at((ty - 3) / 109)[0]
            self.z.put(one(r'^poste com tocha$', pack='lpc-base'), tx + 3.0, ty)

    def north(self) -> None:
        z, rng = self.z, self.rng
        # casas do norte
        self.house(16, 10, 9, STONE, door_dx=4.5, link='north-west')
        self.house(31, 11, 8, TUDOR, door_dx=3.5, link='north-west')
        # a capela e a torre
        ch = self.house(62, 9, 12, STONE_DARK, wall_h=4, door_dx=6.0, door='wd@896,800', windows=False, link='chapel')
        for dx in (2.2, 9.8):
            ch.window(dx, 'wd@354,64', dy=-1.7)
        z.put(one(r'^estandarte (branco)$', pack='medieval'), 62 + 6.0 - 3.2, ch.base - 2.0)
        z.put(one(r'^estandarte (branco)$', pack='medieval'), 62 + 6.0 + 3.2, ch.base - 2.0)
        tw = self.house(76, 8, 5, STONE_DARK, roof_d=3, wall_h=5, door_dx=2.5, windows=False, link=None, door='wd@705,722')
        tw.window(2.5, 'wd@194,17', dy=-3.4)
        z.put(one(r'^mastro$', pack='medieval'), 78.5, 8.8)
        z.put(one(r'^estandarte (preto|vermelho)$', pack='medieval'), 78.9, 5.2)
        self.door_path(78.5, tw.base + 1.2, ROADS['chapel'])
        # cemitério ao lado da capela, de cerca baixa
        gx0, gy0, gx1, gy1 = 64, 28, 80, 38
        z.reserve_rect(gx0 - 1, gy0 - 1, gx1 + 2, gy1 + 2)
        z.fence_box('fence-4', gx0, gy0, gx1, gy1, gaps=[(68, gy0, 70, gy0)])
        z.paint_tiles('grass', gx0, gy0, gx1, gy1)
        graves = find(r'^lapide (baixa|baixa 2|redonda|redonda 2|com brasao|gasta|gasta 2|quebrada|quebrada 2|caida|partida)$', pack='medieval')
        crosses = [one(r'^cruz de madeira$', pack='medieval'), one(r'^cruz de madeira 2$', pack='medieval')]
        for ty in (31.2, 34.0, 36.8):
            for tx in range(66, 79, 3):
                if rng.random() < 0.85:
                    z.put(rng.choice(graves + crosses), tx + rng.uniform(-0.3, 0.3), ty + rng.uniform(-0.2, 0.2), rng.random() < 0.5, radius=0.4)
        z.put(one(r'^cruz de pedra alta$', pack='medieval'), 72.0, 29.8)
        z.put(one(r'^jazigo duplo$', pack='medieval'), 77.5, 29.4)
        z.put(one(r'^cova aberta$', pack='medieval'), 66.4, 29.8)
        for _ in range(8):
            z.put(rng.choice(FLOWERS), rng.uniform(gx0 + 1, gx1 - 1), rng.uniform(gy0 + 2, gy1 - 1), radius=0.2)
        # o pomar de cerejeiras, a leste
        cherry = find(r'^cerejeira( 2)?$', sheet='atlas-cherry')
        for ty in (24.0, 31.0, 38.0, 45.0):
            for tx in (84.0, 88.0):
                z.put(rng.choice(cherry), tx + rng.uniform(-0.6, 0.6), ty + rng.uniform(-0.6, 0.6), rng.random() < 0.5, radius=1.4)
        z.reserve_rect(82, 22, WALL_R, 48)
        # a casinha de madeira e um poço pequeno
        self.prop(r'^casinha de madeira$', 36.0, 28.0, pack='medieval')
        self.prop(r'^poco de pedra$', 40.0, 29.5, pack='medieval')
        self.prop(r'^balde de poco$', 40.2, 29.3, pack='medieval')

    def east(self) -> None:
        z, rng = self.z, self.rng
        # a estalagem: o maior prédio da vila
        inn = self.house(66, 42, 15, TUDOR_GRID, roof_d=4, wall_h=3, door_dx=7.5, door='wd@896,800', windows=False, link='east')
        for dx in (2.2, 5.2, 9.8, 12.8):
            inn.window(dx, rng.choice(WIN_FLOWER + WIN_PLAIN))
        z.portal('estalagem', 'Entrar na Estalagem do Corvo', 66 + 7.5 - 1.5, inn.base - 0.3, 3.0, 1.8, ('saltmore-estalagem', 'porta-frente'))
        z.put('base-signs@8,4', 66 + 4.6, inn.base - 2.1)
        z.put(one(r'^placa pendurada 4$', pack='medieval'), 66 + 10.4, inn.base - 2.5)
        z.put(one(r'^lamparina 2$', pack='medieval'), 66 + 6.0, inn.base + 0.2)
        z.put(one(r'^lamparina 2$', pack='medieval'), 66 + 9.2, inn.base + 0.2)
        # mesas e bancos na frente, barris e um carregador de lenha
        for tx, ty in ((68.6, 57.2), (74.0, 58.4), (79.4, 57.0)):
            z.put(one(r'^mesa redonda$', pack='dungeon'), tx, ty, radius=0.6)
            z.put(one(r'^cadeira de lado$', pack='dungeon'), tx - 1.3, ty + 0.3, radius=0.3)
            z.put(one(r'^cadeira de lado 2$', pack='dungeon'), tx + 1.3, ty + 0.5, True, radius=0.3)
        self.prop(r'^pilha de barris$', 63.8, 51.0, pack='interior')
        self.prop(r'^pilha de lenha grande$', 83.6, 50.8, pack='medieval')
        self.prop(r'^carroca de madeira$', 84.4, 56.4, pack='medieval')
        # casas do leste
        self.house(70, 66, 9, STONE_BEAMS, door_dx=4.5, link='east')
        self.house(66, 80, 10, TUDOR_X, door_dx=4.5, link='south-east')
        self.prop(r'^varal com roupas$', 82.0, 78.0, pack='medieval')
        self.prop(r'^lenha empilhada$', 78.8, 76.4, pack='medieval')

    def west(self) -> None:
        z, rng = self.z, self.rng
        # a casa do jardineiro e as hortas
        self.house(14, 27, 8, TIMBER, door_dx=4.0, link='garden')
        for x0, y0, x1, y1, crop in ((12, 40, 25, 47, 'tomate'), (12, 49, 25, 56, 'cenoura'), (28, 26, 35, 31, 'alcachofra')):
            crop_field(z, x0, y0, x1, y1, crop, gap=(x1 + 1, (y0 + y1) // 2, x1 + 1, (y0 + y1) // 2 + 1))
        self.prop(r'^espantalho$', 18.5, 44.0, pack='medieval')
        self.prop(r'^cocho de agua$', 26.6, 48.2, pack='medieval')
        self.prop(r'^carrinho de mao$', 27.4, 53.6, pack='medieval')
        # o ferreiro
        sm = self.house(14, 60, 10, STONE_DARK, roof_d=3, wall_h=3, door_dx=5.0, link='west', door='wd@0,768')
        z.put('base-signs@40,4', 14 + 5.0, sm.base - 2.4)
        z.paint_tiles('gravel-dark', 12, 69, 30, 76)
        z.put(one(r'^fogueira$', pack='medieval'), 20.0, 72.0)
        z.put(one(r'^fornalha de ferro dupla$', pack='interior'), 16.4, 71.2)
        z.put(one(r'^caixa de ferramentas$', pack='interior'), 23.6, 72.4)
        z.put(one(r'^caixa de laminas$', pack='interior'), 25.0, 71.4)
        z.put(one(r'^suporte de lancas$', pack='medieval'), 28.0, 71.6)
        z.put(one(r'^balde com agua$', pack='lpc-base'), 18.6, 74.4)
        z.put(one(r'^pilha de lenha grande$', pack='medieval'), 12.6, 66.6)
        z.put(one(r'^alvo de palha$', pack='medieval'), 28.8, 75.0)
        z.reserve_rect(11, 68, 31, 77)

    def south(self) -> None:
        z, rng = self.z, self.rng
        self.house(26, 76, 9, STONE, door_dx=4.5, link='south-west')
        # o celeiro, com o curral na frente
        barn = self.house(12, 88, 14, TIMBER, roof_d=5, wall_h=4, door_dx=7.0, door='wd@128,768', windows=False, link='south-west')
        z.put('wd@354,64', 12 + 2.5, barn.base - 2.0)
        z.put('wd@354,64', 12 + 11.5, barn.base - 2.0)
        z.fence_box('fence-3', 11, 101, 36, 107, gaps=[(20, 101, 24, 101)])
        z.paint_tiles('dirt-soft', 12, 102, 35, 106)
        z.reserve_rect(10, 100, 38, 108)
        for tx, ty in ((15.0, 105.4), (30.0, 105.0)):
            z.put(one(r'^cocho de feno$', pack='medieval'), tx, ty, radius=1.0)
        z.put(one(r'^cocho de agua$', pack='medieval'), 24.0, 106.0, radius=1.0)
        z.put(one(r'^monte de feno$', pack='medieval'), 18.0, 103.4, radius=0.9)
        z.put(one(r'^fardo de feno redondo$', pack='medieval'), 33.0, 103.2, radius=0.8)
        z.put(one(r'^fardos de feno$', pack='medieval'), 28.6, 91.4, radius=1.4)
        z.put(one(r'^carroca de feno$', pack='medieval'), 30.4, 87.0, True, radius=1.4)
        z.put(one(r'^arado$', pack='medieval'), 36.6, 98.4, radius=1.0)
        # o campo de milho, a sudeste
        crop_field(z, 66, 94, 85, 104, 'milho', gap=(65, 98, 65, 99), row_gap=2.0, step=1.2)
        z.put(one(r'^espantalho$', pack='medieval'), 76.0, 100.0)
        z.put(one(r'^fardos de feno$', pack='medieval'), 83.4, 90.4, radius=1.4)
        # o posto da guarda, junto ao portão sul
        g = self.house(56, 99, 6, STONE_DARK, roof_d=3, wall_h=3, door_dx=3.0, door='wd@384,768', link=None, windows=False)
        g.window(1.2, 'wd@611,162')
        self.prop(r'^suporte de lancas$', 55.0, g.base + 0.5, pack='medieval')
        self.prop(r'^barril em pe$', 61.8, g.base + 0.6, pack='lpc-base')
        self.prop(r'^postes com corda$', 54.0, 107.2, pack='medieval')
        self.door_path(56 + 3.0, g.base + 1.2, ROADS['main'])

    def nature(self) -> None:
        z, rng = self.z, self.rng
        # fora do muro: mata fechada de novo; dentro: árvores soltas, moitas e flores
        def outside_density(x: float, y: float) -> float:
            if _inside(x, y):
                return 0.0
            d = min(_road_dist(x, y), 99)
            if d < 3.4 and y < WALL_T + 8:
                return 0.0
            if y < WALL_T + 0.5 or y > WALL_B - 0.5:
                if abs(x - GATE_X) < 6:
                    return 0.0
            clump = 0.6 + 0.55 * fbm(x / 7.0, y / 7.0, 9, 2)
            return min(1.0, 1.0 * clump)
        forest(z, outside_density, pines=0.55, oaks=0.32, small=0.08, dead=0.03, big_chance=0.06, colossal_chance=0.012, seed=11, cell=2.1)
        # árvores esparsas dentro da vila (copas grandes de sombra)
        for _ in range(26):
            tx, ty = rng.uniform(WALL_L + 2, WALL_R - 2), rng.uniform(WALL_T + 3, WALL_B - 3)
            if _road_dist(tx, ty) > 3.6 and z.free_disc(tx, ty, 2.2):
                z.put(rng.choice(OAKS_MID), tx, ty, rng.random() < 0.5, radius=1.6)

        def inside_ground(x: float, y: float) -> float:
            if not _inside(x, y) or _road_dist(x, y) < 2.4:
                return 0.0
            return min(1.0, 0.25 + 0.6 * fbm(x / 4.0, y / 4.0, 21, 2))
        undergrowth(z, inside_ground, n_per_100=5.0, box=(WALL_L, WALL_T, WALL_R, WALL_B), kinds=list(BUSHES_DARK) + list(FERNS) + list(FLOWERS[:25]), seed=11)
        scatter(z, list(FLOWERS[:30]), 40, (WALL_L + 1, WALL_T + 2, WALL_R - 1, WALL_B - 2), 0.25, near=None)

        def out_ground(x: float, y: float) -> float:
            return 0.0 if (_inside(x, y) or _road_dist(x, y) < 2.4) else min(1.0, 0.3 + 0.7 * fbm(x / 4.0, y / 4.0, 23, 2))
        undergrowth(z, out_ground, n_per_100=10.0, box=(1, 1, W - 1, H - 1), seed=13)
        for _ in range(16):
            tx, ty = rng.uniform(3, W - 3), rng.uniform(3, H - 3)
            if not _inside(tx, ty) and z.free_disc(tx, ty, 1.0):
                rock_cluster(z, tx, ty, 1.4, rng.randint(1, 3), [R_DARK, R_COAL, R_GRAY], (0.05, 0.3, 0.45, 0.2))

    def people(self) -> None:
        z = self.z
        z.npc('vila-guarda-n1', 'Brann', 'Guarda do portão norte', npcs.guard(), 47.4, 9.4, 'down')
        z.npc('vila-guarda-n2', 'Haldor', 'Guarda do portão norte', npcs.guard('olive', 'black', 'blue'), 52.8, 9.4, 'down')
        z.npc('vila-guarda-s1', 'Dorian', 'Guarda do portão sul', npcs.guard('light', 'ginger', 'green'), 47.6, 105.6, 'up')
        z.npc('vila-guarda-s2', 'Wulf', 'Guarda do portão sul', npcs.guard('tan', 'gray', 'blue'), 52.6, 105.6, 'up')
        z.npc('vila-estalajadeira', 'Marla', 'Dona da estalagem', npcs.innkeeper(), 71.6, 54.4, 'down')
        z.npc('vila-ferreiro', 'Tobren', 'Ferreiro', npcs.blacksmith(), 22.4, 73.4, 'left')
        z.npc('vila-mercadora', 'Ysolt', 'Mercadora da feira', npcs.merchant_f(), 44.4, 62.6, 'left')
        z.npc('vila-mercador', 'Olric', 'Mercador da feira', npcs.merchant_m(), 56.2, 62.8, 'right')
        z.npc('vila-hortela', 'Edda', 'Hortelã', npcs.farmer_f(), 26.6, 43.4, 'down')
        z.npc('vila-lavrador', 'Corwin', 'Lavrador', npcs.farmer_m(), 64.2, 98.9, 'right')
        z.npc('vila-velho-do-poco', 'Garrick', 'Velho do poço', npcs.old_man(), 41.8, 31.2, 'left')
        z.npc('vila-padre', 'Irmão Alaric', 'Padre da capela', npcs.priest(), 66.4, 20.6, 'down')
        z.npc('vila-crianca', 'Pip', 'Criança', npcs.child(), 47.2, 58.4, 'right')
        z.npc('vila-velha-do-banco', 'Hilda', 'Anciã', npcs.old_woman(), 55.8, 57.0, 'left')

    def finish(self) -> None:
        z = self.z
        self.people()
        # luzes quentes nas janelas e fogo do ferreiro
        z.light('ferreiro-forja', 20.0, 71.0, 150, '#ff9a4a', 0.5, 0.35)
        z.light('praca', 50, 52.5, 230, '#ffd9a0', 0.16, 0.05)
        z.light('portao-norte-e', GATE_X - 3.4, WALL_T + 0.8, 110, '#ffb15a', 0.35, 0.3)
        z.light('portao-norte-d', GATE_X + 4.4, WALL_T + 0.8, 110, '#ffb15a', 0.35, 0.3)
        z.light('portao-sul-e', GATE_X - 3.4, WALL_B + 0.8, 110, '#ffb15a', 0.35, 0.3)
        z.light('portao-sul-d', GATE_X + 4.4, WALL_B + 0.8, 110, '#ffb15a', 0.35, 0.3)
        z.portal('trilha-norte', 'Portão norte (a encosta)', GATE_X - 2.0, 0.4, 5, 2.6, ('saltmore-encosta', 'trilha-sul'))
        z.portal('portao-sul', 'Portão sul (rumo à ponte)', GATE_X - 2.0, H - 2.8, 5, 2.6, ('saltmore-ponte', 'estrada-norte'))
        z.spawn = {'x': GATE_X * TILE, 'y': 5 * TILE}


def build() -> Zone:
    return Village().build()
