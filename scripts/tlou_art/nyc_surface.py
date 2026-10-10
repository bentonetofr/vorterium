"""Zonas de superfície do mundo "Nova York": a avenida que dobra, a estrada que morre, a mata com a escola e o rio."""
from __future__ import annotations

from .nyc_buildings import *  # noqa: F401,F403
from .nyc_buildings import front, hlane_cars, vcar, vlane_cars
from .nyc_kit import NZ

OUT = {'place': 'outdoor', 'particles': True, 'clouds': True, 'wind': 0.3}


def outdoor(z: NZ, wind: float = 0.3) -> None:
    z.lighting = {**OUT, 'wind': wind}
    z.sound = {'auto': True, 'layers': {'wind': wind}}


# ── Rua 2: a avenida sobe e faz a curva para a direita ──────────────────────

def build_rua2() -> tuple[NZ, dict]:
    z = NZ('nyc-rua-2', 'Avenida (a curva)', 72, 64, 'tlou-concreto', 2101)
    z.paint('tlou-asfalto', 6, 35, 19, 64)                       # trecho vertical
    z.paint('tlou-asfalto', 6, 21, 72, 34)                       # trecho horizontal (a curva é o canto)
    z.paint('tlou-calcada', 0, 35, 5, 64); z.paint('tlou-calcada', 20, 35, 24, 64)   # calçadas do trecho vertical
    z.paint('tlou-calcada', 0, 16, 72, 20); z.paint('tlou-calcada', 25, 35, 72, 39)  # calçadas do trecho horizontal
    z.paint('tlou-calcada', 0, 21, 5, 34)
    z.paint('tlou-asfalto', 25, 52, 72, 63)                      # beco no fim dos prédios do sul
    z.paint('tlou-asfalto', 0, 12, 3, 15)
    z.wear_ground((0, 0, 72, 64), 'tlou-asfalto', 111)
    z.noise('tlou-mato-invasor', 3.0, 0.66, 141, (0, 16, 72, 64), only='tlou-calcada')
    z.noise('tlou-grama-seca', 4.0, 0.68, 143, (0, 0, 72, 64), only='tlou-concreto')
    z.disc('tlou-lama', 60, 58, 2.6, 5)

    skip_corner = z.skip_rect([(6, 21, 20, 35)])
    z.road_lines_v(12, 35, 63, lanes=(9, 15), edges=(6, 18))
    z.road_lines_h(27, 20, 71, lanes=(23, 31), edges=(21, 33))
    z.road_lines_h(27, 6, 19, lanes=(23, 31), edges=(21, 33))
    for tx in range(6, 19):                                      # faixa de pedestres antes da curva
        if tx != 12:
            z.put('faixa-pedestre-ew', tx + 0.5, 40.5); z.put('faixa-pedestre-ew', tx + 0.5, 41.5)
    for ty in range(22, 34):                                     # e outra depois da curva
        if ty != 27:
            z.put('faixa-pedestre-ns', 44.5, ty + 1); z.put('faixa-pedestre-ns', 45.5, ty + 1)
    z.put('seta-chao', 9.5, 50.5); z.put('seta-chao', 33.5, 24.5); z.put('seta-chao', 55.5, 29.5, True)
    for tx, ty in ((9.5, 55.5), (15.5, 46.5), (30.5, 25.5), (52.5, 30.5), (64.5, 24.5)):
        z.put('bueiro', tx, ty)

    vlane_cars(z, [38, 45, 50, 56, 61], [(21, 35)], cx=12.5, p=0.4)
    hlane_cars(z, [10, 18, 26, 34, 41, 52, 58, 66], 27.5, 0.42)
    z.put('onibus-escolar', 30.0, 31.2)

    # prédios do norte, virados para a avenida
    front(z, 4, 19, 8, 'wall-49', 'ceil-25', 'banco', None, door=None, boards=[8.5, 15.0], hera=[5.5, 12.0], escapes=[18.0])
    wy, _ = front(z, 22, 42, 8, 'wall-17', 'ceil-11', 'policia', None, door=32.0, hera=[24.0], escapes=[41.0])
    police = (32.0, 8 + 4.9)
    wy, _ = front(z, 46, 62, 8, 'wall-33', 'ceil-16', 'escritorio', 'toldo-azul', door=54.0, escapes=[47.5, 60.5], hera=[50.0])
    offices = (54.0, 8 + 4.9)
    front(z, 64, 71, 8, 'wall-177', 'ceil-30', None, None, door=None, boards=[67.0], hera=[69.0])
    # prédios do sul, virados para o beco
    wy, _ = front(z, 28, 44, 44, 'wall-33', 'ceil-16', 'moda', 'toldo-vermelho', door=36.0, boards=[31.0], hera=[41.0])
    moda = (36.0, 44 + 4.9)
    front(z, 50, 66, 44, 'wall-1', 'ceil-26', 'diner', None, door=58.0, boards=[58.0, 53.0], escapes=[64.0], hera=[55.0])

    # calçadas e rua
    for tx in (8, 26, 44, 60):
        z.put('poste-luz', tx, 20.4)
    for tx in (30, 48, 66):
        z.put('poste-luz', tx, 38.6)
    for ty in (40, 52, 60):
        z.put('poste-luz', 4.6, ty); z.put('poste-luz', 22.4, ty + 3)
    z.put('semaforo', 20.4, 34.4); z.put('semaforo', 42.4, 20.6); z.put('semaforo', 47.2, 34.4)
    z.put('placa-pare', 20.8, 39.0); z.put('placa-velocidade', 23.0, 20.2); z.put('placa-rua', 48.6, 20.6)
    z.put('placa-mao-unica', 4.2, 37.6); z.put('placa-estacionar', 36.4, 38.0); z.put('placa-saida', 62.0, 38.6)
    for tx, ty in ((24.0, 19.0), (31.0, 18.8), (58.0, 19.2), (66.0, 38.4), (40.0, 38.0)):
        z.put('hidrante' if tx % 2 == 0 else 'lixeira-nyc', tx, ty)
    z.put('carrinho-hotdog', 38.0, 19.0); z.put('chamine-vapor', 21.4, 27.0); z.put('entrada-metro', 52.0, 38.0)
    z.put('caixa-correio', 45.0, 19.6); z.put('parquimetro', 33.0, 38.4); z.put('parquimetro', 34.5, 38.4)
    z.put('poste-eletrico', 2.4, 44.0); z.put('poste-eletrico', 70.4, 20.0)
    for tx, ty in ((2.0, 38.0), (3.2, 56.0), (22.2, 41.0), (71.0, 36.0), (28.0, 18.4)):
        z.put(z.rng.choice(TREES_SMALL + BUSHES), tx, ty)
    z.put('arvore-morta', 1.6, 27.0); z.put('arvore-morta', 23.0, 61.0)

    # becos
    for bx in (30, 56):
        z.put('cacamba', bx, 56.4); z.put('sacos-lixo', bx + 3.0, 56.0); z.put('caixotes-pilha', bx + 6.0, 57.0)
        z.put('lixeira-nyc', bx - 2.0, 54.6); z.put('muro-beco', bx + 9.0, 55.0)
    z.put('carro-amarelo', 46.0, 59.6, True); z.put('van', 66.0, 61.0); z.put('pneus', 27.0, 60.0)
    z.strew(WEEDS + GROUND_BITS, 24, (25.5, 52.6, 71.0, 63.0))
    z.strew(WEEDS + GROUND_BITS, 90, (6.2, 21.6, 71.0, 34.0), avoid=[(6, 21, 20, 35)])
    z.strew(WEEDS + GROUND_BITS, 50, (6.2, 35.0, 19.0, 63.0))
    z.strew(WEEDS + ['raizes-asfalto', 'rachadura-ervas'], 36, (0.5, 16.2, 71.5, 20.4))
    z.strew(WEEDS + ['raizes-asfalto', 'rachadura-ervas'], 36, (25.5, 35.2, 71.5, 39.4))

    z.light('r2-poste-a', 26.0, 19.0, 130, '#cfe4ff', 0.22, 0.05); z.light('r2-poste-b', 66.0, 38.0, 130, '#cfe4ff', 0.22, 0.05)
    outdoor(z)
    z.spawn = {'x': 12 * TILE, 'y': 58 * TILE}
    return z, {'police': police, 'offices': offices, 'moda': moda}


# ── Estrada 1: o asfalto se acaba e vira estrada de terra na mata ─────────────────

def build_estrada1() -> tuple[NZ, dict]:
    z = NZ('nyc-estrada-1', 'Estrada (o asfalto acaba)', 96, 52, 'grass-dark', 2201)
    z.paint('tlou-mato-invasor', 0, 0, 96, 52)
    z.noise('grass', 5.0, 0.6, 211, (0, 0, 96, 52), only='tlou-mato-invasor')
    z.paint('tlou-asfalto', 0, 19, 36, 32)                       # a estrada, larga no começo
    z.paint('tlou-asfalto', 36, 20, 52, 31)
    z.paint('tlou-terra', 52, 22, 96, 29)                        # depois estreita e vira terra
    z.paint('tlou-calcada', 0, 15, 30, 18)                       # restos de calçada na frente do motel
    z.paint('tlou-concreto', 0, 6, 30, 14); z.paint('tlou-concreto', 38, 8, 58, 16)
    # o asfalto vai se estragando até sumir
    z.noise('tlou-asfalto-rachado', 4.0, 0.52, 221, (0, 19, 52, 32), only='tlou-asfalto')
    z.noise('tlou-asfalto-musgo', 3.4, 0.55, 223, (14, 19, 52, 32), only='tlou-asfalto')
    z.noise('tlou-mato-invasor', 3.0, 0.5, 225, (30, 19, 52, 32), only='tlou-asfalto')
    z.noise('tlou-mato-invasor', 3.0, 0.62, 227, (0, 19, 30, 32), only='tlou-asfalto')
    z.noise('tlou-mato-invasor', 2.6, 0.58, 229, (52, 22, 96, 29), only='tlou-terra')
    z.noise('tlou-lama', 3.5, 0.66, 231, (54, 22, 96, 29), only='tlou-terra')
    z.noise('tlou-folhas-secas', 4.0, 0.7, 233, (0, 0, 96, 52), only='tlou-mato-invasor')

    z.paint_line('amarela-dupla', 'h', 25, 0, 24)                # as faixas somem junto
    z.paint_line('faixa-branca', 'h', 21, 0, 22)
    z.paint_line('faixa-branca', 'h', 29, 0, 22)
    z.paint_line('amarela-borda', 'h', 19, 0, 18)
    z.paint_line('amarela-borda', 'h', 31, 0, 18)
    for tx in range(0, 36, 12):
        z.put('bueiro', tx + 6.5, 24.5)

    hlane_cars(z, [6, 14, 24, 33, 41], 25.5, 0.45)
    z.put('carro-azul', 58.0, 27.4); z.put('van', 70.0, 24.4, True); z.put('carro-verde', 82.0, 28.4)
    z.put('onibus-escolar', 46.0, 30.0)

    # motel e posto, virados para a estrada
    front(z, 4, 26, 6, 'wall-129', 'ceil-9', 'motel', 'toldo-vermelho', door=15.0, boards=[7.0, 24.0], hera=[10.5, 21.0])
    motel = (15.0, 6 + 4.9)
    front(z, 40, 56, 8, 'wall-1', 'ceil-26', 'posto', None, door=48.0, boards=[43.0], hera=[53.0], windows=True)
    garage = (48.0, 8 + 4.9)
    z.put('placa-posto', 38.4, 17.0); z.put('barril-enferrujado', 58.0, 16.0); z.put('barril-enferrujado', 59.0, 16.4)
    z.put('cacamba', 36.0, 15.6); z.put('pneus', 39.0, 17.6); z.put('carro-branco', 49.0, 18.6)
    z.put('poste-eletrico', 28.0, 18.0); z.put('poste-eletrico', 64.0, 20.0); z.put('placa-saida', 31.0, 18.2)
    z.put('placa-velocidade', 10.0, 17.8); z.put('placa-pare', 34.0, 33.0); z.put('placa-trem', 70.0, 21.0)
    z.put('hidrante', 3.0, 17.4); z.put('caixa-correio-rural', 62.0, 31.0); z.put('placa-perigo', 76.0, 31.0)

    avoid = [(0, 5, 31, 19), (37, 7, 59, 19), (0, 18, 53, 33), (52, 21, 96, 30)]
    z.trees(140, (0.5, 0.5, 95.5, 51.5), avoid)
    z.trees(60, (52, 14, 96, 36), [(52, 21, 96, 30)], mix=(0.25, 0.4, 0.15, 0.2))
    z.strew(TREES_DEAD, 8, (30, 4, 95, 18), avoid)
    z.strew(WEEDS + GROUND_BITS, 70, (0.5, 19.3, 51.0, 32.0))
    z.strew(WEEDS + ['rachadura-ervas', 'folhas-secas'], 60, (52.0, 21.8, 95.0, 29.2))
    z.strew(['tronco-quebrado', 'pilha-lenha', 'arvore-morta'], 6, (60, 34, 95, 50))

    outdoor(z, 0.4)
    z.light('e1-poste', 28.0, 17.0, 120, '#cfe4ff', 0.2, 0.05)
    z.spawn = {'x': 3 * TILE, 'y': 25 * TILE}
    return z, {'motel': motel, 'garage': garage}


# ── Estrada 2: mata fechada, a escola no centro ────────────────────────────────────

def build_mata() -> tuple[NZ, dict]:
    z = NZ('nyc-mata', 'Mata fechada (a escola)', 112, 84, 'grass-dark', 2301)
    z.paint('tlou-mato-invasor', 0, 0, 112, 84)
    z.noise('grass', 5.0, 0.58, 311, (0, 0, 112, 84), only='tlou-mato-invasor')
    z.noise('tlou-folhas-secas', 4.0, 0.68, 313, (0, 0, 112, 84), only='tlou-mato-invasor')
    z.paint('tlou-terra', 0, 38, 42, 44)                         # a trilha que chega da estrada
    z.paint('tlou-terra', 40, 38, 58, 56)
    z.paint('tlou-calcada', 38, 26, 76, 38)                      # pátio da escola
    z.paint('tlou-concreto', 38, 18, 76, 25)
    z.paint('tlou-terra', 76, 24, 100, 31)                       # trilha para o galpão
    z.paint('tlou-terra', 20, 12, 27, 38)                        # trilha para a cabana
    z.paint('tlou-terra', 76, 30, 82, 56)
    z.noise('tlou-mato-invasor', 3.0, 0.52, 321, (0, 36, 44, 46), only='tlou-terra')
    z.noise('tlou-mato-invasor', 3.0, 0.56, 323, (38, 26, 76, 38), only='tlou-calcada')
    z.noise('tlou-asfalto-rachado', 4.0, 0.6, 325, (38, 26, 76, 38), only='tlou-calcada')
    z.noise('tlou-lama', 3.5, 0.68, 327, (0, 36, 100, 58), only='tlou-terra')

    # a escola: grande, no centro
    wy, end = front(z, 40, 74, 14, 'wall-17', 'ceil-11', 'escola', None, door=57.0, escapes=[44.0, 70.0], hera=[43.0, 50.0, 64.0, 72.0], windows=True)
    z.put('toldo-vermelho', 57.0, wy - 0.15)
    school = (57.0, 14 + 4.9)
    z.put('bandeira-eua', 49.0, 27.0); z.put('banco-pracas', 52.0, 28.2); z.put('banco-pracas', 64.0, 28.2)
    z.put('onibus-escolar', 46.0, 35.0); z.put('onibus-escolar', 66.0, 35.6, True)
    z.put('placa-escola', 54.0, 33.6); z.put('placa-velocidade', 61.0, 33.8)
    z.put('lixeira-nyc', 42.0, 26.5); z.put('lixeira-nyc', 72.0, 26.5); z.put('hidrante', 74.0, 33.0)
    z.strew(WEEDS + GROUND_BITS, 40, (38.5, 26.5, 75.5, 37.5))
    z.strew(['papeis', 'vidro-quebrado', 'latas-garrafas'], 14, (41, 20, 73, 24))

    # cabana (noroeste) e galpão (leste)
    front(z, 8, 22, 6, 'wall-225', 'ceil-3', None, None, door=15.0, hera=[10.0, 19.0], boards=[12.0])
    cabin = (15.0, 6 + 4.9)
    front(z, 84, 100, 12, 'wall-1', 'ceil-26', None, None, door=92.0, boards=[87.0], hera=[97.0])
    shed = (92.0, 12 + 4.9)
    z.put('carro-verde', 20.0, 20.0); z.put('pilha-lenha', 6.0, 16.0); z.put('barril-agua', 23.0, 17.0)
    z.put('van', 96.0, 22.0); z.put('cacamba', 82.0, 22.0); z.put('pneus', 88.0, 23.0)

    avoid = [(0, 36, 44, 46), (38, 12, 78, 40), (6, 5, 24, 18), (82, 11, 102, 24), (38, 36, 60, 58), (76, 22, 102, 32), (74, 30, 84, 58),
             (18, 11, 28, 40)]
    z.trees(330, (0.5, 0.5, 111.5, 83.5), avoid)
    z.strew(TREES_DEAD, 10, (0, 0, 111, 83), avoid)
    z.strew(WEEDS + ['folhas-secas', 'raizes-asfalto'], 110, (0.5, 0.5, 111.0, 83.0), avoid)
    z.strew(['tronco-quebrado', 'pilha-lenha', 'arvore-morta', 'arbusto-seco'], 14, (0, 0, 111, 83), avoid)
    z.strew(WEEDS, 24, (1, 38, 43, 45))
    z.put('carro-azul', 12.0, 41.0); z.put('placa-perigo', 30.0, 37.4)

    outdoor(z, 0.45)
    z.spawn = {'x': 4 * TILE, 'y': 41 * TILE}
    return z, {'school': school, 'cabin': cabin, 'shed': shed}


# ── Rio: a margem, o cais e o caminho até o restaurante ───────────────────────────

def river_zone(zid: str, name: str, w: int, seed: int, piers: list[int], boats: list[tuple], facades: list[dict]) -> NZ:
    h = 68
    z = NZ(zid, name, w, h, 'tlou-concreto', seed)
    z.paint('water', 0, 40, w, h)                                 # o rio
    z.paint('water-deep', 0, 52, w, h)
    z.noise('water-deep', 8.0, 0.5, seed + 3, (0, 44, w, 52), only='water')
    z.paint('sand', 0, 37, w, 40)                                 # barranco de areia
    z.noise('tlou-mato-invasor', 3.0, 0.55, seed + 5, (0, 37, w, 40), only='sand')
    z.paint('tlou-calcada', 0, 26, w, 36)                         # calçadão
    z.paint('cobble-light', 0, 23, w, 26)
    z.noise('tlou-mato-invasor', 3.0, 0.6, seed + 7, (0, 23, w, 37), only='tlou-calcada')
    z.noise('tlou-asfalto-rachado', 4.0, 0.62, seed + 9, (0, 23, w, 37), only='tlou-calcada')
    z.noise('tlou-folhas-secas', 4.0, 0.7, seed + 11, (0, 0, w, 23), only='tlou-concreto')
    for px in piers:                                              # píeres de madeira avançando no rio
        z.paint('floor-3', px, 37, px + 4, 47)
    z.paint_line('amarela-borda', 'h', 25, 0, w - 1)
    for f in facades:
        front(z, f['x0'], f['x1'], f['y0'], f['wall'], f['ceil'], f.get('sign'), f.get('awning'), door=f.get('door'),
              boards=f.get('boards'), escapes=f.get('escapes'), hera=f.get('hera'))
    for i in range(3, w - 3, 11):
        z.put('poste-luz', i + 0.5, 28.0)
        z.put('banco-pracas', i + 5.0, 27.8, i % 2 == 0)
    for i in range(6, w - 4, 15):
        z.put(z.rng.choice(TREES_SMALL + BUSHES), i, 24.5)
    for bx, by, fl in boats:
        z.put('barco-remo', bx, by, fl)
    for px in piers:
        z.put('barril-agua', px + 0.8, 38.0); z.put('caixote', px + 3.0, 40.0); z.put('pilha-lenha', px + 3.2, 44.0)
        z.put('lampiao', px + 0.6, 41.0)
    z.strew(['tronco-quebrado', 'arbusto-seco', 'mato-alto-1', 'mato-alto-2', 'folhas-secas'], 40, (1, 24, w - 1, 36.5))
    z.strew(['arvore-morta', 'tronco-quebrado', 'sacos-lixo', 'latas-garrafas', 'pneus'], 14, (1, 37.5, w - 1, 39.6))
    z.strew(['papeis', 'vidro-quebrado', 'latas-garrafas', 'rachadura-ervas'], 30, (1, 26, w - 1, 36))
    z.trees(20, (0.5, 1, w - 0.5, 22), [(f['x0'] - 2, f['y0'] - 1, f['x1'] + 2, f['y0'] + 9) for f in facades], mix=(0.2, 0.4, 0.2, 0.2))
    z.light('rio-poste', w / 2, 27.4, 160, '#cfe4ff', 0.2, 0.05)
    outdoor(z, 0.6)
    z.spawn = {'x': 3 * TILE, 'y': 31 * TILE}
    return z
