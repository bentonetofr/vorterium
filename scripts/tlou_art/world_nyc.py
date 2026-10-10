"""Mundo "NOVA YORK — ZONA MORTA": cidade em ruínas no clima de The Last of Us, com dezenas de zonas.

Gera `public/vortable/maps/nova-york.mundo.json`. Roteiro:
  Rua 1 (avenida na vertical, becos, prédios) -> Rua 2 (a avenida faz uma curva para a direita) -> Estrada 1 (o asfalto
  morre e vira estrada de terra na mata) -> Estrada 2 (mata fechada, a escola no centro) -> Escola (andares e subsolo) ->
  Metrô (esporos por toda parte) -> Rio (margem) -> Restaurante (vários andares).
Lá fora nunca tem esporos. Os esporos só aparecem dentro do subsolo da escola e no metrô.
"""
from __future__ import annotations

import json
import os

from .nyc_buildings import *  # noqa: F401,F403
from .nyc_buildings import H3, NZ, Style, front, hlane_cars, link, vcar, vlane_cars
from .nyc_inner import entry, fashion_store, motel, metro_zone, offices, police, restaurant, school, stair_pair, cabin_home, gas_station, warehouse
from .nyc_kit import check_ids
from .nyc_surface import build_estrada1, build_mata, build_rua2, river_zone

MAP = 'maps/nova-york.mundo.json'


# ── Zona: Rua 1 ───────────────────────────────────────────────────

def build_rua1() -> tuple[NZ, dict]:
    z = NZ('nyc-rua-1', 'Avenida (primeiro quarteirão)', 48, 72, 'tlou-concreto', 2001)
    z.paint('tlou-asfalto', 17, 0, 30, 72)                       # a avenida
    z.paint('tlou-calcada', 12, 0, 16, 72); z.paint('tlou-calcada', 31, 0, 35, 72)
    for y0 in (4, 24, 44):                                       # becos entre as fachadas
        z.paint('tlou-asfalto', 0, y0 + 8, 12, y0 + 19); z.paint('tlou-asfalto', 31, y0 + 8, 47, y0 + 19)
    z.paint('tlou-asfalto', 0, 52, 12, 71)
    z.wear_ground((0, 0, 48, 72), 'tlou-asfalto', 31)
    z.noise('tlou-mato-invasor', 3.0, 0.66, 41, (12, 0, 35, 72), only='tlou-calcada')
    z.noise('tlou-grama-seca', 4.0, 0.7, 43, (0, 0, 12, 72), only='tlou-concreto')
    z.noise('tlou-grama-seca', 4.0, 0.7, 47, (35, 0, 47, 72), only='tlou-concreto')
    z.disc('tlou-lama', 8, 18, 2.4, 3); z.disc('tlou-lama', 41, 57, 2.6, 5)

    skip = z.skip_rect([(17, 30, 31, 33)])
    z.road_lines_v(23, 0, 71, lanes=(20, 26), edges=(17, 29), skip=skip)
    for tx in range(17, 30):                                     # faixa de pedestres no cruzamento
        if tx != 23:
            z.put('faixa-pedestre-ew', tx + 0.5, 31.5); z.put('faixa-pedestre-ew', tx + 0.5, 32.5)
    for ty in range(0, 72, 11):
        z.put('bueiro', 19.5, ty + 5.5)
        if ty + 10.5 < 71:
            z.put('bueiro', 27.5, ty + 10.5)
    z.put('seta-chao', 21.5, 60.5); z.put('seta-chao', 25.5, 12.5, True)

    sk = [(29.0, 35.0)]
    vlane_cars(z, [6, 12, 17, 22, 27, 38, 43, 48, 54], sk)
    z.put('carro-v-amarelo-costas', 19.6, 40.0); z.put('carro-v-azul-frente', 26.2, 21.0)

    # ── prédios da esquerda ──
    wy, end = front(z, 1, 11, 4, 'wall-33', 'ceil-16', 'farmacia', 'toldo-verde', door=6.0, boards=[3.0], hera=[2.2], escapes=[9.0])
    farm_door = (6.0, 4 + 4.9)
    wy, end = front(z, 1, 11, 24, 'wall-177', 'ceil-30', 'deli', 'toldo-vermelho', door=6.0, boards=[10.0], hera=[2.6])
    deli_door = (6.0, 24 + 4.9)
    wy, end = front(z, 1, 11, 44, 'wall-17', 'ceil-11', None, None, door=6.0, escapes=[2.4, 9.6], hera=[4.2])
    apt_door = (6.0, 44 + 4.9)
    # ── prédios da direita ──
    front(z, 36, 46, 4, 'wall-49', 'ceil-25', 'hotel', None, door=41.0, boards=[41.0], escapes=[38.0, 44.0])
    front(z, 36, 46, 24, 'wall-33', 'ceil-16', 'moda', 'toldo-azul', door=41.0, boards=[41.0, 38.0], hera=[44.5])
    front(z, 36, 46, 44, 'wall-1', 'ceil-26', 'diner', 'toldo-azul', door=41.0, escapes=[44.8], hera=[37.4])
    diner_door = (41.0, 44 + 4.9)

    # ── calçadas ──
    for ty in (8, 20, 36, 49, 63):
        z.put('poste-luz', 12.8, ty); z.put('poste-luz', 34.2, ty + 5)
    z.put('semaforo', 16.2, 30.4); z.put('semaforo', 31.4, 34.2)
    z.put('placa-pare', 31.8, 29.0); z.put('placa-velocidade', 13.6, 14.0); z.put('placa-mao-unica', 33.8, 20.0)
    z.put('placa-rua', 14.0, 33.6); z.put('placa-estacionar', 32.6, 47.0); z.put('placa-escola', 14.2, 56.0)
    z.put('hidrante', 15.6, 18.0); z.put('hidrante', 32.4, 49.0); z.put('caixa-correio', 15.2, 40.0)
    z.put('lixeira-nyc', 13.4, 22.0); z.put('lixeira-nyc', 34.0, 38.0); z.put('lixeira-nyc', 13.2, 64.0); z.put('lixeira-nyc', 33.6, 12.0)
    z.put('parquimetro', 15.4, 26.0); z.put('parquimetro', 15.4, 27.4); z.put('parquimetro', 31.8, 56.0)
    z.put('carrinho-hotdog', 14.0, 47.0); z.put('chamine-vapor', 30.4, 15.0)
    z.put('entrada-metro', 32.6, 42.0); z.put('poste-eletrico', 34.4, 24.0); z.put('bandeira-eua', 33.2, 8.4)
    z.put('banco-pracas', 14.4, 60.0); z.put('banco-pracas', 33.0, 62.0)
    for tx, ty in ((13.6, 11.5), (14.0, 28.5), (33.4, 28.0), (33.6, 52.0), (13.5, 52.0), (33.4, 17.0)):
        z.put(z.rng.choice(TREES_SMALL + BUSHES), tx, ty)
    z.put('arvore-morta', 13.0, 40.0); z.put('arvore-morta', 34.4, 31.0)

    # ── becos: caçambas, lixo, muros e mato ──
    for y0 in (4, 24, 44):
        by = y0 + 11.5
        z.put('cacamba', 3.2, by + 5.0); z.put('sacos-lixo', 6.4, by + 4.2); z.put('caixotes-pilha', 9.0, by + 4.6)
        z.put('muro-beco', 1.2, by + 2.0); z.put('cacamba', 44.4, by + 6.0, True); z.put('sacos-lixo', 40.0, by + 5.0)
        z.put('caixote-aberto', 37.0, by + 3.6); z.put('pneus', 43.4, by + 2.6)
        z.put('lixeira-nyc', 5.2, by + 1.8); z.put('lixeira-nyc', 38.4, by + 1.8)
        z.strew(WEEDS + GROUND_BITS, 14, (0.5, y0 + 8.5, 12.0, y0 + 19.0))
        z.strew(WEEDS + GROUND_BITS, 14, (36.0, y0 + 8.5, 47.0, y0 + 19.0))
    z.put('carro-amarelo', 8.0, 57.0); z.put('carro-azul', 4.4, 62.0, True); z.put('van', 40.0, 64.0)
    z.put('cavalete', 7.0, 56.0); z.put('placa-perigo', 10.8, 60.0)
    z.put('arvore-morta', 2.0, 68.0); z.put('arvore-morta', 46.0, 67.0)

    # vegetação invadindo a rua e as calçadas (nunca esporos)
    z.strew(WEEDS + GROUND_BITS, 60, (17.2, 1.0, 29.8, 71.0), avoid=[(17, 30, 30, 34)])
    z.strew(WEEDS + ['raizes-asfalto', 'rachadura-ervas'], 30, (12.2, 1.0, 16.6, 71.0))
    z.strew(WEEDS + ['raizes-asfalto', 'rachadura-ervas'], 30, (31.2, 1.0, 35.0, 71.0))

    z.light('r1-poste-a', 12.8, 7.0, 130, '#cfe4ff', 0.22, 0.05); z.light('r1-poste-b', 34.2, 31.0, 130, '#cfe4ff', 0.22, 0.05)
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'wind': 0.3}
    z.sound = {'auto': True, 'layers': {'wind': 0.3}}
    z.spawn = {'x': 24 * TILE, 'y': 66 * TILE}
    info = {'farm': farm_door, 'deli': deli_door, 'apt': apt_door, 'diner': diner_door}
    return z, info


# ── Interiores: apartamentos (3 andares), bodega, farmácia, lanchonete ──────────

def apartment(prefix: str, name: str, seed: int, floors: int = 3) -> list[NZ]:
    """Prédio residencial: cada andar é uma zona com três apartamentos em cima e o corredor embaixo."""
    out = []
    for f in range(floors):
        z = interior(f'{prefix}-{f + 1}', f'{name} — {f + 1}º andar' if f else f'{name} — térreo', 44, 28, seed + f)
        st = APT
        box(z, st, 1, 1, 13, 13); box(z, st, 16, 1, 28, 13); box(z, st, 31, 1, 42, 13)
        cx0, cy0, cx1, cy1 = 1, 14, 42, 25
        box(z, st, cx0, cy0, cx1, cy1)
        for cx in (7, 22, 36):
            doorway(z, st, cx, 14, 17)
        furnish_unit(z, 16, 1, 28, 13, seed + 10 * f + 1, 0.5 + 0.2 * f)
        furnish_unit(z, 31, 1, 42, 13, seed + 10 * f + 2, 0.7)
        if f == 0:
            furnish_lobby(z, 1, 1, 13, 13, seed + 3)
        else:
            furnish_unit(z, 1, 1, 13, 13, seed + 10 * f + 3, 0.6)
        furnish_corridor(z, cx0, cy0, cx1, cy1, seed + f)
        z.put('hera-parede-1', 20.0, 18.4); z.put('hera-parede-2', 30.0, 18.4)
        z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
        z.spawn = {'x': 22 * TILE, 'y': 22 * TILE}
        out.append(z)
    return out


def link_apartment(zs: list[NZ], street: NZ, street_pid: str, door: tuple[float, float], street_name: str) -> None:
    a1 = zs[0]
    link(street, street_pid, (door[0], door[1], 3, 1.6), f'Entrar: {street_name}', a1, 'saida', (8, 23.6, 4, 1.6), 'Sair para a rua')
    for i, z in enumerate(zs):
        stairs(z, 40.5, 22.3, up=True) if i < len(zs) - 1 else stairs(z, 40.5, 22.3, up=False)
    for i in range(len(zs) - 1):
        link(zs[i], 'sobe', (40.5, 19.4, 3, 1.4), 'Subir a escada', zs[i + 1], 'desce', (40.5, 22.3, 3, 1.4), 'Descer a escada')


def corner_store(zid: str, name: str, seed: int, kind: str) -> NZ:
    z = interior(zid, name, 40, 28, seed)
    st = SHOP if kind == 'deli' else PHARM
    box(z, st, 1, 1, 27, 25); box(z, st, 30, 1, 38, 13)
    box(z, st, 30, 14, 38, 25)
    side_door(z, st, 28, 29, 8, 11)
    furnish_shop(z, 1, 1, 27, 25, seed, kind)
    doorway(z, st, 34, 14, 17)
    furnish_storage(z, 30, 1, 38, 13, seed + 1)
    furnish_office(z, 30, 14, 38, 25, seed + 2) if kind == 'pharmacy' else furnish_storage(z, 30, 14, 38, 25, seed + 2)
    z.spawn = {'x': 14 * TILE, 'y': 22 * TILE}
    return z


def diner(zid: str, name: str, seed: int) -> NZ:
    z = interior(zid, name, 46, 30, seed)
    st = DINER
    box(z, st, 1, 1, 31, 27); box(z, st, 34, 1, 44, 27)
    side_door(z, st, 32, 33, 12, 16)
    furnish_restaurant_hall(z, 1, 1, 31, 27, seed)
    furnish_kitchen(z, 34, 1, 44, 27, seed + 1)
    z.row(MCOUNTER, 4.0, 12.0, 11.2, 0.0)
    z.spawn = {'x': 15 * TILE, 'y': 24 * TILE}
    return z


# ── Montagem ────────────────────────────────────────────────────────

def build() -> dict:
    zones: list[NZ] = []
    layout: dict[str, dict] = {}

    def add(z: NZ, x: int, y: int) -> NZ:
        zones.append(z)
        layout[z.id] = {'x': x, 'y': y}
        return z

    # ── superfície: a avenida, a curva, a estrada e a mata ──
    rua1, d1 = build_rua1(); add(rua1, 0, 0)
    rua2, d2 = build_rua2(); add(rua2, 0, -1)
    est1, d3 = build_estrada1(); add(est1, 1, -1)
    mata, d4 = build_mata(); add(mata, 2, -1)
    link(rua1, 'norte', (23.5, 0.0, 13, 1.6), 'Seguir a avenida para o norte', rua2, 'sul', (12.5, 62.4, 13, 1.6), 'Voltar pela avenida')
    link(rua2, 'leste', (71.2, 21.0, 1.6, 13), 'Seguir a avenida para o leste', est1, 'oeste', (0.8, 19.0, 1.6, 13), 'Voltar para a cidade')
    link(est1, 'leste', (95.2, 21.5, 1.6, 8), 'Seguir a estrada para a mata', mata, 'oeste', (0.8, 38.0, 1.6, 6), 'Voltar pela estrada')

    # ── rua 1: apartamentos, bodega, farmácia, lanchonete ──
    apt = apartment('nyc-apt-a', 'Edifício Brooks', 3000)
    for i, z in enumerate(apt):
        add(z, -2, i)
    link_apartment(apt, rua1, 'porta-apt', d1['apt'], 'Edifício Brooks')
    farm = add(corner_store('nyc-farmacia', 'Farmácia Duane Reade', 3100, 'pharmacy'), -1, -1)
    entry(farm, rua1, 'porta-farmacia', d1['farm'], 'a rua', 14, 'a farmácia')
    deli = add(corner_store('nyc-bodega', 'Bodega do Sal', 3200, 'deli'), -1, 0)
    entry(deli, rua1, 'porta-bodega', d1['deli'], 'a rua', 14, 'a bodega')
    dn = add(diner('nyc-diner', 'Lanchonete Empire Diner', 3300), 1, 0)
    entry(dn, rua1, 'porta-diner', d1['diner'], 'a rua', 15, 'a lanchonete', y=25.6)

    # ── rua 2: delegacia, escritórios, loja de roupas ──
    pol = police()
    for i, z in enumerate(pol):
        add(z, -2, -1 - i)
    entry(pol[0], rua2, 'porta-delegacia', d2['police'], 'a avenida', 24, 'a delegacia')
    off = offices()
    for i, z in enumerate(off):
        add(z, -1, -2 - i)
    entry(off[0], rua2, 'porta-escritorios', d2['offices'], 'a avenida', 30, 'o edifício Hudson')
    mod = add(fashion_store(), -3, -1)
    entry(mod, rua2, 'porta-moda', d2['moda'], 'o beco', 15, 'a loja de roupas')

    # ── estrada: motel e posto ──
    mo = add(motel(), 1, -2)
    entry(mo, est1, 'porta-motel', d3['motel'], 'a estrada', 30, 'o motel')
    gs = add(gas_station(), 1, -3)
    entry(gs, est1, 'porta-posto', d3['garage'], 'a estrada', 12, 'o posto', y=25.6)

    # ── mata: cabana, galpão, escola ──
    cab = add(cabin_home(), 2, -2)
    entry(cab, mata, 'porta-cabana', d4['cabin'], 'a mata', 15, 'a cabana', y=19.6)
    gal = add(warehouse(), 3, -2)
    entry(gal, mata, 'porta-galpao', d4['shed'], 'a mata', 22, 'o galpão')
    esc = school()
    add(esc['t'], 2, -3); add(esc['f2'], 2, -4); add(esc['f3'], 2, -5)
    entry(esc['t'], mata, 'porta-escola', d4['school'], 'o pátio', 30.5, 'a escola', y=43.6)
    stair_pair(esc['t'], esc['f2'], 57.5, 'e12', 'Escola — térreo', 'Escola — 2º andar')
    stair_pair(esc['f2'], esc['f3'], 57.5, 'e23', 'Escola — 2º andar', 'Escola — 3º andar')

    # ── subsolo da escola e o metrô ──
    add(esc['b1'], 3, -3); add(esc['b2'], 4, -3)
    stairs(esc['t'], 4.0, 42.6, up=False); stairs(esc['b1'], 4.0, 30.4, up=True)
    link(esc['t'], 'porao', (4.0, 41.6, 3, 1.4), 'Descer para o porão', esc['b1'], 'sobe-escola', (4.0, 29.6, 3, 1.4), 'Subir para a escola')
    link(esc['b1'], 'desce-tunel', (52.0, 27.0, 3, 1.4), 'Descer ao túnel de serviço', esc['b2'], 'sobe-tunel', (5.5, 8.0, 3, 1.4), 'Subir ao porão')
    m1 = add(metro_zone('nyc-metro-1', 'Metrô — Estação P.S. 114', 90, 36, 7001, 70, True, 2, 2, 1), 5, -3)
    m2 = add(metro_zone('nyc-metro-2', 'Metrô — túnel norte', 120, 28, 7002, 60, False, 3, 2, 2), 6, -3)
    m3 = add(metro_zone('nyc-metro-3', 'Metrô — Estação Houston St', 100, 40, 7003, 80, True, 3, 3, 1), 7, -3)
    m4 = add(metro_zone('nyc-metro-4', 'Metrô — túnel do rio', 110, 28, 7004, 50, False, 2, 2, 2), 8, -3)
    m5 = add(metro_zone('nyc-metro-5', 'Metrô — Estação Pier 40', 80, 34, 7005, 32, True, 1, 1, 0), 9, -3)
    link(esc['b2'], 'rachadura', (56.5, 12.0, 3, 8), 'Passar pela rachadura do túnel', m1, 'oeste', (3.5, 6.5, 3, 8), 'Voltar ao túnel da escola')
    for a_, b_, k in ((m1, m2, 1), (m2, m3, 2), (m3, m4, 3), (m4, m5, 4)):
        link(a_, f'leste-{k}', (a_.w - 3.5, 6.0, 3, a_.h - 8), 'Seguir pelo metrô', b_, f'oeste-{k}', (3.5, 6.0, 3, b_.h - 8), 'Voltar pelo metrô')

    # ── rio: o caminho até o restaurante ──
    fr1 = [dict(x0=8, x1=24, y0=8, wall='wall-17', ceil='ceil-11', sign='hotel', boards=[16.0], escapes=[10.0, 22.0], hera=[13.0]),
           dict(x0=34, x1=52, y0=8, wall='wall-33', ceil='ceil-16', sign='banco', boards=[43.0], hera=[38.0, 49.0])]
    fr2 = [dict(x0=10, x1=26, y0=8, wall='wall-177', ceil='ceil-30', sign='moda', awning='toldo-azul', boards=[18.0], hera=[12.0]),
           dict(x0=44, x1=62, y0=8, wall='wall-1', ceil='ceil-26', sign='diner', boards=[53.0], escapes=[46.0, 60.0], hera=[49.0])]
    fr3 = [dict(x0=18, x1=62, y0=8, wall='wall-209', ceil='ceil-3', sign='restaurante', awning='toldo-vermelho', door=40.0,
                hera=[20.0, 30.0, 52.0, 60.0], escapes=[22.0, 58.0])]
    r1 = add(river_zone('nyc-rio-1', 'Margem do rio — cais', 80, 8001, [14, 40, 66], [(25, 49.5, False), (58, 47.0, True)], fr1), 10, -3)
    r2 = add(river_zone('nyc-rio-2', 'Margem do rio — o calçadão', 80, 8002, [20, 52], [(34, 48.0, False), (70, 50.0, True)], fr2), 11, -3)
    r3 = add(river_zone('nyc-rio-3', 'Margem do rio — o restaurante', 80, 8003, [10, 70], [(30, 48.5, True)], fr3), 12, -3)
    r1.put('entrada-metro', 7.0, 30.0)
    link(m5, 'sobe-rio', (m5.w - 8.0, 6.0, 3, 1.4), 'Subir para a superfície', r1, 'escada-metro', (7.0, 30.2, 3, 1.4), 'Descer ao metrô')
    stairs(m5, m5.w - 8.0, 8.4, up=True)
    link(r1, 'leste', (79.2, 24.0, 1.6, 14), 'Seguir pela margem', r2, 'oeste', (0.8, 24.0, 1.6, 14), 'Voltar pela margem')
    link(r2, 'leste', (79.2, 24.0, 1.6, 14), 'Seguir pela margem', r3, 'oeste', (0.8, 24.0, 1.6, 14), 'Voltar pela margem')

    # ── restaurante: o fim do mapa ──
    rs = restaurant()
    add(rs['t'], 13, -3); add(rs['k'], 13, -2); add(rs['f2'], 13, -4); add(rs['f3'], 13, -5); add(rs['r'], 13, -6)
    entry(rs['t'], r3, 'porta-restaurante', (40.0, 8 + 4.9), 'a margem', 21.5, 'o restaurante', y=39.6)
    link(rs['t'], 'cozinha', (54.5, 36.0, 4, 1.6), 'Ir para a cozinha', rs['k'], 'despensa', (45.5, 28.0, 4, 1.6), 'Voltar ao salão')
    stair_pair(rs['t'], rs['f2'], 60.5, 'r12', 'Restaurante — salão', 'Restaurante — 2º andar', y_up=9.4, y_dn=12.4)
    stair_pair(rs['f2'], rs['f3'], 60.5, 'r23', 'Restaurante — 2º andar', 'Restaurante — eventos', y_up=9.4, y_dn=12.4)
    stair_pair(rs['f3'], rs['r'], 60.5, 'r3t', 'Restaurante — eventos', 'o terraço', y_up=9.4, y_dn=12.4)
    return finish(zones, layout, rua1.id)


def finish(zones: list[NZ], layout: dict, start: str) -> dict:
    return {
        'format': 'vortable-world', 'version': 1,
        'world': {'version': 1, 'id': 'mundo-nova-york', 'name': 'NOVA YORK: ZONA MORTA', 'start': start, 'layout': layout,
                  'sky': {'hour': 16.5, 'weather': 'cloudy'}},
        'zones': [z.data() for z in zones],
    }


def generate(public: str) -> None:
    bundle = build()
    path = os.path.join(public, MAP)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')))
    zs = bundle['zones']
    print(f'nova york: {len(zs)} zonas, {sum(len(z["objects"]) for z in zs)} objetos, {sum(len(z.get("npcs", [])) for z in zs)} NPCs -> {MAP}')
