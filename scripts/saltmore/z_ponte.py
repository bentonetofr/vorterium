"""A estrada do vale e a ponte da cidade: campos de trigo, posto de pedágio, o rio largo, a ponte de pedra e o portão da cidade."""
from __future__ import annotations

import math

from .kit import (R_COAL, BUSHES_DARK, FLOWERS, LOGS, OAKS_MID, R_GRAY, Building, carve, crop_field, find, forest, one, rock_cluster, scatter,
                  undergrowth)
from . import npcs
from .lib import TILE, Path, Zone, fbm

W, H = 72, 100
ROAD = Path([(50, 0), (50, 8), (46, 16), (43, 26), (46, 36), (51, 45), (51, 54), (51, 60)])
ROAD_S = Path([(51, 83), (51, 90)])
RIVER = Path([(0, 70.5), (14, 72), (28, 70), (44, 71), (58, 72), (72, 70.5)])
BX0, BX1, BY0, BY1 = 48, 54, 61, 82            # a ponte: tiles do tabuleiro (7 de largura)
WALL_Y = 89
WALL_TOP, WALL_BOT = 84, 92                       # a muralha da cidade: topo das torres e pé da parede


def build() -> Zone:
    z = Zone('saltmore-ponte', 'Estrada e ponte da cidade', W, H, 'grass-dark', 901)
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'sunShadows': True, 'wind': 0.32}
    z.sound = {'auto': True, 'layers': {'stream': 0.35, 'lake': 0.3, 'forest': 0.3}}
    rng = z.rng

    # ── chão ──
    z.noise('grass', 6.0, 0.74, 901, only={'grass-dark'})
    z.noise('grass-light', 5.0, 0.8, 903, (0, 8, W, 60), only={'grass'})

    # ── os campos de trigo dos dois lados da estrada ──
    fields = [(6, 12, 30, 24, 'milho'), (6, 28, 28, 40, 'batata'), (60, 18, 70, 32, 'milho'), (58, 36, 70, 48, 'cenoura')]
    for x0, y0, x1, y1, crop in fields:
        crop_field(z, x0, y0, x1, y1, crop, gap=(x1 + 1, (y0 + y1) // 2, x1 + 1, (y0 + y1) // 2 + 1) if x0 < 40 else (x0 - 1, (y0 + y1) // 2, x0 - 1, (y0 + y1) // 2 + 1),
                   row_gap=2.0 if crop == 'milho' else 1.6, step=1.2 if crop == 'milho' else 1.0)
    z.put(one(r'^espantalho$', pack='medieval'), 18.0, 18.0)
    z.put(one(r'^espantalho$', pack='medieval'), 65.0, 25.0)
    z.put(one(r'^fardos de feno$', pack='medieval'), 24.0, 26.0, radius=1.4)
    z.put(one(r'^monte de feno$', pack='medieval'), 10.0, 26.4)
    z.put(one(r'^carroca de feno$', pack='medieval'), 63.0, 34.6, True)
    z.put(one(r'^cocho de agua$', pack='medieval'), 9.0, 42.5)

    # ── o rio: margem de seixos, água rasa, água, e o leito fundo no meio ──
    z.brush('pebbles', RIVER.pts, 11.5, 0.5, 905, only={'grass-dark', 'grass', 'grass-light'})
    z.brush('sand', RIVER.pts[::2], 10.0, 0.7, 907, only={'pebbles'})
    z.brush('pebbles', RIVER.pts[::2], 9.0, 0.6, 909, only={'sand'})
    z.brush('water-light', RIVER.pts, 8.2, 0.25, 911)
    z.brush('water', RIVER.pts, 7.0, 0.22, 913)
    z.brush('water-deep', RIVER.pts, 1.6, 0.3, 915)
    z.reserve_path(RIVER, 11.0)

    # ── a estrada: terra e seixos, larga; vira calçamento perto da ponte ──
    z.trail(ROAD, 5.2, 'dirt', wobble=0.3, seed=917, keep_extra=1.2)
    z.trail(ROAD_S, 5.2, 'cobble-light', wobble=0.1, seed=919)
    z.noise('dirt-soft', 2.6, 0.7, 921, only={'dirt'})
    z.noise('pebbles', 2.0, 0.76, 923, only={'dirt'})
    z.brush('dirt-light', ROAD.pts[::3], 0.9, 0.4, 925, only={'dirt', 'dirt-soft', 'pebbles'})
    z.paint_tiles('cobble-light', 47, 50, 55, 60)               # a cabeceira da ponte

    # ── a ponte de pedra: tabuleiro, muretas, lampiões e estandartes ──
    z.paint_tiles('cobble-light', BX0, BY0, BX1, BY1)
    z.fence('fence-8', BX0 - 1, BY0 + 1, BX0 - 1, BY1 - 1)
    z.fence('fence-8', BX1 + 1, BY0 + 1, BX1 + 1, BY1 - 1)
    z.reserve_rect(BX0 - 2, BY0 - 2, BX1 + 3, BY1 + 3)
    for ty in (BY0 + 2.2, BY0 + 8.0, BY0 + 13.8, BY1 - 1.6):
        z.put(one(r'^poste com tocha$', pack='lpc-base'), BX0 - 0.3, ty)
        z.put(one(r'^poste com tocha$', pack='lpc-base'), BX1 + 1.4, ty)
        z.light(f'ponte-{int(ty)}-e', BX0 - 0.3, ty - 1.4, 100, '#ffb15a', 0.3, 0.3)
        z.light(f'ponte-{int(ty)}-d', BX1 + 1.4, ty - 1.4, 100, '#ffb15a', 0.3, 0.3)
    z.put(one(r'^estandarte (azul|verde)$', pack='medieval'), BX0 + 0.5, BY0 + 1.0)
    z.put(one(r'^estandarte (vermelho|dourado)$', pack='medieval'), BX1 + 0.5, BY0 + 1.0)
    z.put(one(r'^placa de direcao$', pack='medieval', nth=0), BX0 - 2.0, BY0 - 1.0)
    # barcos presos às margens e um cais de madeira na margem oeste
    z.paint_tiles('floor-wood', 18, 61, 20, 66)
    z.fence('fence-2', 17, 62, 17, 65)
    z.fence('fence-2', 21, 62, 21, 65)
    z.put(one(r'^barco na agua 1$', pack='farm'), 23.2, 66.4)
    z.put(one(r'^barco a remo 1$', pack='farm'), 12.4, 62.6)
    z.put(one(r'^barco a remo 2$', pack='farm'), 63.4, 62.2, True)
    z.put(one(r'^barril em pe$', pack='lpc-base'), 16.2, 61.2)
    z.put(one(r'^balde com agua$', pack='lpc-base'), 21.8, 60.6)
    z.put(one(r'^cestos empilhados$', pack='interior'), 15.4, 60.4)
    z.put(one(r'^varal vazio$', pack='medieval'), 11.2, 58.2)
    z.reserve_rect(10, 56, 25, 68)
    # juncos e vitórias-régias nas margens
    aquatic = find(r'junco|nenufar|vitoria|lirio', pack='plants', category='Plantas aquáticas') or find(r'junco', pack='plants')
    for _ in range(46):
        tx = rng.uniform(1, W - 1)
        ty = RIVER.pts[min(len(RIVER.pts) - 1, int(tx / W * len(RIVER.pts)))][1] + rng.choice((-1, 1)) * rng.uniform(6.8, 8.6)
        if not (BX0 - 3 <= tx <= BX1 + 4) and not (16 <= tx <= 25 and 58 <= ty <= 69):
            z.put(rng.choice(aquatic), tx, ty, rng.random() < 0.5)

    # ── o posto de pedágio, antes da ponte ──
    t = Building(z, 38, 50, 7, roof_d=3, wall_h=3, wall='wall-197', wall_trim='ceil-3', roof='floor-73', roof_trim='ceil-8')
    t.door(3.5, 'wd@0,768')
    t.window(1.4, 'wd@611,162')
    t.window(5.6, 'wd@130,160')
    z.put(one(r'^postes com corda$', pack='medieval'), 53.6, 52.0)
    z.put(one(r'^placa de aviso$', pack='medieval'), 46.4, 52.6)
    z.put(one(r'^barril em pe$', pack='lpc-base'), 36.4, t.base + 0.2)
    z.put(one(r'^caixote$', pack='medieval'), 45.4, t.base + 0.1)
    z.put(one(r'^lamparina$', pack='medieval'), 38.4, t.base + 0.15)
    z.brush('dirt', [(41.5, t.base + 1.2), (44, t.base + 1.0), (47, t.base + 0.8)], 0.9, 0.2, 931)

    # ── marcos de estrada, um oratório, uma carroça de mercador e seu acampamento ──
    for ty in (14.0, 34.0):
        z.put(one(r'^marco de pedra$', pack='medieval'), 47.4 + (ty > 20) * 6.0, ty)
    z.put(one(r'^cruz de madeira$', pack='medieval', nth=0), 36.5, 41.0)
    z.put(one(r'^pilha de pedras$', sheet='rock-cinza'), 37.6, 41.8)
    z.put(one(r'^carroca coberta$', pack='medieval'), 58.4, 56.6, True)
    z.put(one(r'^tenda pequena$', pack='medieval'), 64.2, 55.0)
    z.put(one(r'^brasas$', pack='medieval'), 61.2, 58.6)
    z.put(one(r'^lenha de fogueira$', pack='medieval'), 60.0, 58.8)
    z.put(one(r'^caixotes empilhados$', pack='farm'), 57.0, 54.0)
    z.reserve_rect(55, 51, 68, 62)

    # ── a cidade do outro lado: muralha, torres, o portão, a rua e telhados ──
    z.paint_tiles('cobble-light', 4, 86, 68, 99)
    z.noise('cobble-sand', 4.0, 0.58, 933, (4, 86, 68, 100), only={'cobble-light'})
    z.paint_tiles('cobble-light', 47, 83, 55, WALL_BOT + 6)
    z.reserve_rect(0, 83, W, H)
    # a muralha: torres de cada lado do vão e panos de muro até as bordas
    towerL = Building(z, 43, WALL_TOP, 6, roof_d=3, wall_h=4, wall='wall-53', wall_trim='ceil-25', roof='floor-72', roof_trim='ceil-25')
    towerR = Building(z, 55, WALL_TOP, 6, roof_d=3, wall_h=4, wall='wall-53', wall_trim='ceil-25', roof='floor-72', roof_trim='ceil-25')
    for tw in (towerL, towerR):
        tw.window(3.0, 'wd@194,17', dy=-2.4)
    for x0, x1 in ((0, 43), (61, 72)):
        wall = Building(z, x0, WALL_TOP + 2, x1 - x0, roof_d=2, wall_h=3, wall='wall-50', wall_trim='ceil-8', roof='floor-73', roof_trim='ceil-8', overhang=0)
        for wx in range(x0 + 3, x1 - 1, 9):
            wall.window(wx - x0, 'wd@16,26')
    z.put('wd@961,466', 51.5, WALL_BOT + 0.9)
    z.put(one(r'^estandarte (azul|verde)$', pack='medieval'), 49.8, WALL_BOT - 0.5)
    z.put(one(r'^estandarte (vermelho|dourado)$', pack='medieval'), 53.6, WALL_BOT - 0.5)
    z.put(one(r'^poste com tocha$', pack='lpc-base'), 49.0, WALL_BOT + 2.2)
    z.put(one(r'^poste com tocha$', pack='lpc-base'), 54.6, WALL_BOT + 2.2)
    z.light('portao-e', 49.0, WALL_BOT + 0.8, 120, '#ffb15a', 0.4, 0.3)
    z.light('portao-d', 54.6, WALL_BOT + 0.8, 120, '#ffb15a', 0.4, 0.3)
    # os primeiros telhados da cidade, lá dentro
    for x0, w, sty in ((6, 9, ('wall-50', 'floor-73')), (20, 8, ('wall-197', 'floor-12')), (36, 7, ('wall-52', 'floor-74')),
                       (62, 8, ('wall-199', 'floor-35'))):
        b = Building(z, x0, 94, w, roof_d=2, wall_h=2, wall=sty[0], wall_trim='ceil-8', roof=sty[1], roof_trim='ceil-8')
        b.window(w * 0.3, 'wd@611,162', dy=-0.9)
        b.window(w * 0.7, 'wd@130,64', dy=-0.9)

    # ── a mata, só nas bordas e entre os campos ──
    def density(x: float, y: float) -> float:
        d = ROAD.dist(x, y)
        if y > 56 or d < 3.6:
            return 0.0
        for fx0, fy0, fx1, fy1, _ in fields:
            if fx0 - 3 <= x <= fx1 + 4 and fy0 - 3 <= y <= fy1 + 4:
                return 0.0
        edge = max(0.0, 1.0 - min(x, W - x) / 14.0)
        base = 0.15 + 0.85 * edge
        if y < 10:
            base = max(base, 0.9)
        return min(1.0, base * (0.6 + 0.55 * fbm(x / 7.0, y / 7.0, 9, 2)) * min(1.0, (d - 3.6) / 4.0))

    forest(z, density, pines=0.45, oaks=0.4, small=0.1, dead=0.02, big_chance=0.06, seed=13, cell=2.1)
    # as margens do rio e a beira da cidade levam salgueiros e carvalhos soltos
    for _ in range(18):
        tx, ty = rng.uniform(3, W - 3), rng.uniform(52, 66)
        if RIVER.dist(tx, ty) > 9.0 and not (BX0 - 6 <= tx <= BX1 + 6) and z.free_disc(tx, ty, 1.8):
            z.put(rng.choice(OAKS_MID), tx, ty, rng.random() < 0.5, radius=1.6)

    def under(x: float, y: float) -> float:
        if ROAD.dist(x, y) < 2.6 or y > 83:
            return 0.0
        return min(1.0, 0.3 + 0.7 * fbm(x / 4.0, y / 4.0, 15, 2))
    undergrowth(z, under, n_per_100=6.0, box=(1, 1, W - 1, 83), seed=17, kinds=list(BUSHES_DARK) + list(FLOWERS[:20]))
    scatter(z, list(FLOWERS[:30]), 30, (2, 4, W - 2, 56), 0.25, near=ROAD, near_min=2.8, near_max=9)
    for _ in range(14):
        tx, ty = rng.uniform(3, W - 3), rng.uniform(4, 56)
        if ROAD.dist(tx, ty) > 5 and z.free_disc(tx, ty, 1.0):
            rock_cluster(z, tx, ty, 1.4, rng.randint(1, 3), [R_DARK, R_COAL], (0.05, 0.3, 0.45, 0.2))

    # ── gente: pescador no cais, sargento do pedágio, mercador no acampamento, guardas da cidade ──
    z.npc('ponte-pescador', 'Tam', 'Pescador', npcs.fisherman(), 19.4, 63.4, 'down')
    z.npc('ponte-sargento', 'Sargento Hale', 'Guarda do pedágio', npcs.guard('light', 'dark_brown', 'blue'), 48.6, 55.0, 'right')
    z.npc('ponte-mercador', 'Bertram', 'Mercador viajante', npcs.merchant_m(), 62.4, 58.4, 'left')
    z.npc('ponte-guarda-1', 'Guarda da cidade', 'Guarda do portão', npcs.guard('tan', 'black', 'blue'), 49.2, WALL_BOT + 1.8, 'up')
    z.npc('ponte-guarda-2', 'Guarda da cidade', 'Guarda do portão', npcs.guard('olive', 'dark_brown', 'blue'), 54.0, WALL_BOT + 1.8, 'up')

    # ── saídas ──
    z.portal('estrada-norte', 'Voltar pra vila', 50 - 2.5, 0.3, 5, 2.6, ('saltmore-vila', 'portao-sul'))
    z.portal('cidade', 'Entrar na cidade (continua...)', 51.5 - 2.0, WALL_BOT + 1.1, 4, 2.2, None)
    z.spawn = {'x': 50 * TILE, 'y': 3 * TILE}
    return z
