"""Interiores grandes do mundo "Nova York": delegacia, escritórios, escola, restaurante e o metrô infectado."""
from __future__ import annotations

from .nyc_buildings import *  # noqa: F401,F403
from .nyc_buildings import link, stairs
from .nyc_kit import NZ, person

ENTRY_Y = 23.6        # alpendre de baixo do corredor (corredor de y 14 a 25)


def spans(widths: list[int], gap: int = 2, x: int = 1) -> list[tuple[int, int]]:
    out = []
    for w in widths:
        out.append((x, x + w))
        x += w + gap
    return out


def two_row(zid: str, name: str, seed: int, st: Style, rooms: list[tuple[int, int, object]], corr_y1: int = 25,
            lockers: bool = False, hall_kind: str | None = None) -> NZ:
    """Andar tipo corredor: salas em cima (y 1 a 13), corredor embaixo (y 14 a corr_y1), passagens nas portas."""
    xend = rooms[-1][1]
    z = interior(zid, name, xend + 2, corr_y1 + 3, seed)
    box(z, st, 1, 14, xend, corr_y1)
    for i, (x0, x1, fn) in enumerate(rooms):
        box(z, st, x0, 1, x1, 13)
        doorway(z, st, (x0 + x1) // 2, 14, 17)
        fn(z, x0, 1, x1, 13, seed + i)
    furnish_corridor(z, 1, 14, xend, corr_y1, seed + 99, lockers)
    z.spawn = {'x': (xend // 2) * TILE, 'y': (corr_y1 - 3) * TILE}
    return z


def stair_pair(lo: NZ, hi: NZ, sx: float, key: str, name_lo: str, name_hi: str, y_up: float = 19.4, y_dn: float = 22.3) -> None:
    stairs(lo, sx, y_dn, up=True); stairs(hi, sx, y_dn, up=False)
    link(lo, f'sobe-{key}', (sx, y_up, 3, 1.4), f'Subir: {name_hi}', hi, f'desce-{key}', (sx, y_dn, 3, 1.4), f'Descer: {name_lo}')


def entry(z: NZ, street: NZ, spid: str, door: tuple[float, float], street_name: str, in_x: float, name: str, y: float = ENTRY_Y) -> None:
    link(street, spid, (door[0], door[1], 3, 1.6), f'Entrar: {name}', z, f'saida-{spid}', (in_x, y, 4, 1.6), f'Sair: {street_name}')


# ── Delegacia (2 andares) ────────────────────────────────────────────

def police() -> list[NZ]:
    r = spans([19, 13, 15])
    f1 = two_row('nyc-delegacia-1', 'Delegacia — térreo', 4001, POLICE, [
        (r[0][0], r[0][1], furnish_lobby), (r[1][0], r[1][1], furnish_office), (r[2][0], r[2][1], furnish_storage)])
    f2 = two_row('nyc-delegacia-2', 'Delegacia — celas e comando', 4002, POLICE, [
        (r[0][0], r[0][1], furnish_cells), (r[1][0], r[1][1], furnish_office), (r[2][0], r[2][1], furnish_storage)])
    for z in (f1, f2):
        z.strew(['caixa-municao', 'kit-medico', 'mochila-chao'], 3, (3, 6, 50, 24))
    f2.put('armario-ferro', 44.0, 6.6); f2.put('armario-ferro', 46.0, 6.6); f2.put('cofre', 48.0, 6.6)
    stair_pair(f1, f2, 49.5, 'del', 'Delegacia — térreo', 'Delegacia — celas e comando')
    return [f1, f2]


# ── Edifício de escritórios (2 andares) ──────────────────────────────────

def offices() -> list[NZ]:
    r = spans([13, 13, 13, 13])
    f1 = two_row('nyc-escritorio-1', 'Edifício Hudson — térreo', 4101, OFFICE, [
        (r[0][0], r[0][1], furnish_lobby), (r[1][0], r[1][1], furnish_office), (r[2][0], r[2][1], furnish_office), (r[3][0], r[3][1], furnish_storage)])
    f2 = two_row('nyc-escritorio-2', 'Edifício Hudson — 2º andar', 4102, OFFICE, [
        (r[0][0], r[0][1], furnish_office), (r[1][0], r[1][1], furnish_office), (r[2][0], r[2][1], furnish_meeting), (r[3][0], r[3][1], furnish_office)])
    stair_pair(f1, f2, 56.5, 'esc', 'Edifício Hudson — térreo', 'Edifício Hudson — 2º andar')
    return [f1, f2]


def furnish_meeting(z: NZ, x0: int, y0: int, x1: int, y1: int, seed: int) -> None:
    fb = z.room_floor_box(x0, y0, x1, y1)
    z.interior_windows(x0, x1, y0, H3, 6.0)
    cx = (x0 + x1) / 2
    z.put(TABLE_LONG, cx - 1.6, y0 + H3 + 5.4); z.put(TABLE_LONG, cx + 1.6, y0 + H3 + 5.4)
    for dx in (-3.0, -0.8, 1.2, 3.2):
        z.put(CHAIR, cx + dx, y0 + H3 + 3.6); z.put(CHAIR, cx + dx, y0 + H3 + 7.6, True)
    z.put(NOTICE, cx, y0 + H3 + 1.2)
    decay(z, fb, 6, 2)


# ── Lojas e prédios isolados ─────────────────────────────────────────

def fashion_store() -> NZ:
    z = interior('nyc-moda', 'Loja de roupas Fashion Ave', 44, 28, 4201)
    box(z, SHOP, 1, 1, 30, 25); box(z, SHOP, 33, 1, 42, 25)
    side_door(z, SHOP, 31, 32, 10, 14)
    fb = z.room_floor_box(1, 1, 30, 25)
    north_wall_row(z, [SHELF, WARDROBE, CABINET] * 6, 1.6, 29.6, 1)
    z.interior_windows(1, 30, 1, H3, 7.0)
    for i in range(3):
        z.row(SHELF_LOW, 4.0, 12.0, fb[1] + 4.5 + i * 3.4, 0.3); z.row(SHELF_LOW, 17.0, 27.0, fb[1] + 4.5 + i * 3.4, 0.3)
    z.row(MCOUNTER, 20.0, 29.0, 23.4, 0.0)
    furnish_storage(z, 33, 1, 42, 25, 4202)
    decay(z, fb, 10, 3)
    z.spawn = {'x': 15 * TILE, 'y': 22 * TILE}
    return z


def motel() -> NZ:
    r = spans([10, 10, 10, 10, 10], 2)
    z = two_row('nyc-motel', 'Motel Roadside', 4301, MOTEL, [(a, b, furnish_motel_room) for a, b in r], corr_y1=25)
    z.put('carrinho', 12.0, 22.6); z.put('hera-parede-1', 20.0, 18.4); z.put('hera-parede-2', 40.0, 18.4)
    return z


def gas_station() -> NZ:
    z = interior('nyc-posto', 'Posto de gasolina e oficina', 46, 30, 4401)
    box(z, SHOP, 1, 1, 23, 27); box(z, SHED, 26, 1, 44, 27)
    side_door(z, SHOP, 24, 25, 12, 16)
    furnish_shop(z, 1, 1, 23, 27, 4402, 'deli')
    fb = z.room_floor_box(26, 1, 44, 27)
    north_wall_row(z, [MSHELF] * 8, 26.6, 43.6, 1, gap=0.05)
    z.interior_windows(26, 44, 1, H3, 8.0, lit=False)
    z.grid('pneus', 29.0, fb[1] + 4.0, 40.0, fb[1] + 5.0, 4.0, 5.0)
    z.put('carro-azul', 35.0, 20.0); z.put('gerador', 42.0, 24.0); z.put('bancada', 30.0, 25.0); z.put('caixa-ferramentas', 33.0, 25.0)
    z.put('barril-enferrujado', 42.0, 8.6); z.put('barril-enferrujado', 43.0, 9.0)
    decay(z, fb, 10, 2)
    z.spawn = {'x': 12 * TILE, 'y': 24 * TILE}
    return z


def cabin_home() -> NZ:
    z = interior('nyc-cabana', 'Cabana abandonada', 32, 24, 4501)
    box(z, CABIN, 1, 1, 30, 21)
    fb = z.room_floor_box(1, 1, 30, 21)
    north_wall_row(z, [BED, CABINET, SHELF, STOVE, SINK, COUNTER], 1.6, 29.6, 1)
    z.interior_windows(1, 30, 1, H3, 8.0)
    z.put(TABLE_ROUND, 8.0, 14.0); z.put(CHAIR, 6.0, 14.4); z.put(CHAIR, 10.0, 14.4, True)
    z.put(SOFA2, 22.0, 15.0); z.put('fogueira-apagada', 16.0, 17.0); z.put('mochila-chao', 26.0, 19.5); z.put('kit-medico', 4.0, 19.4)
    z.put('saco-dormir', 12.0, 19.6); z.put('pilha-lenha', 28.0, 11.0); z.put('radio', 18.5, 8.5)
    decay(z, fb, 7, 4)
    z.spawn = {'x': 15 * TILE, 'y': 18 * TILE}
    return z


def warehouse() -> NZ:
    z = interior('nyc-galpao', 'Galpão', 44, 28, 4601)
    box(z, SHED, 1, 1, 42, 25)
    fb = z.room_floor_box(1, 1, 42, 25)
    north_wall_row(z, [MSHELF] * 20, 1.6, 41.6, 1, gap=0.05)
    z.interior_windows(1, 42, 1, H3, 8.0, lit=False)
    z.grid('caixotes-pilha', 4.0, fb[1] + 4.0, 38.0, fb[1] + 11.0, 6.0, 4.5)
    z.grid('caixote', 6.5, fb[1] + 5.2, 36.0, fb[1] + 12.5, 6.0, 4.5)
    z.put('gerador', 38.0, 22.5); z.put('bancada', 8.0, 22.5); z.put('caixa-ferramentas', 11.0, 22.8); z.put('cofre', 40.0, 6.8)
    z.put('van', 24.0, 22.4); z.put('barril-agua', 3.0, 22.6); z.put('barril-enferrujado', 4.0, 23.0)
    decay(z, fb, 12, 4)
    z.spawn = {'x': 22 * TILE, 'y': 20 * TILE}
    return z


# ── Escola (3 andares + 2 subsolos) ─────────────────────────────────────

def school() -> dict[str, NZ]:
    r = spans([13, 13, 13, 13])
    # térreo: salas em cima, corredor, e embaixo cantina, saguão e secretaria
    t = interior('nyc-escola-1', 'Escola P.S. 114 — térreo', 62, 48, 5001)
    box(t, SCHOOL_HALL, 1, 14, 60, 26)
    for i, (x0, x1) in enumerate(r):
        box(t, SCHOOL, x0, 1, x1, 13)
        doorway(t, SCHOOL, (x0 + x1) // 2, 14, 17)
        (furnish_classroom if i != 3 else furnish_library)(t, x0, 1, x1, 13, 5100 + i)
    furnish_corridor(t, 1, 14, 60, 26, 5110, lockers=True)
    south = [(1, 20, furnish_restaurant_hall), (23, 38, furnish_lobby), (41, 60, furnish_office)]
    for x0, x1, fn in south:
        box(t, SCHOOL if fn is not furnish_lobby else SCHOOL_HALL, x0, 27, x1, 45)
        doorway(t, SCHOOL, (x0 + x1) // 2, 27, 30)
        fn(t, x0, 27, x1, 45, 5120 + x0)
    t.put('bandeira-eua', 30.0, 33.0)
    t.spawn = {'x': 30 * TILE, 'y': 42 * TILE}

    def hall(zid: str, name: str, seed: int, funcs: list, y1: int = 26) -> NZ:
        z = interior(zid, name, 62, y1 + 3, seed)
        box(z, SCHOOL_HALL, 1, 14, 60, y1)
        for i, (x0, x1) in enumerate(r):
            box(z, SCHOOL, x0, 1, x1, 13)
            doorway(z, SCHOOL, (x0 + x1) // 2, 14, 17)
            funcs[i](z, x0, 1, x1, 13, seed + i)
        furnish_corridor(z, 1, 14, 60, y1, seed + 90, lockers=True)
        z.spawn = {'x': 30 * TILE, 'y': (y1 - 3) * TILE}
        return z

    f2 = hall('nyc-escola-2', 'Escola P.S. 114 — 2º andar', 5200, [furnish_classroom] * 4)
    f3 = hall('nyc-escola-3', 'Escola P.S. 114 — 3º andar', 5300, [furnish_classroom, furnish_library, furnish_office, furnish_storage])
    for z in (f2, f3):
        z.put('hera-parede-1', 16.0, 18.4); z.put('hera-parede-2', 46.0, 18.4)

    # subsolo 1: caldeira e depósitos, os primeiros esporos
    b1 = interior('nyc-escola-sub-1', 'Escola — porão e caldeira', 56, 36, 5400)
    box(b1, BASEMENT, 1, 1, 24, 14); box(b1, BASEMENT, 27, 1, 54, 14)
    box(b1, BASEMENT, 1, 15, 54, 33)
    for cx in (12, 40):
        doorway(b1, BASEMENT, cx, 15, 18)
    furnish_storage(b1, 1, 1, 24, 14, 5401); furnish_storage(b1, 27, 1, 54, 14, 5402)
    fb = b1.room_floor_box(1, 15, 54, 33)
    b1.put('gerador', 8.0, 22.0); b1.put('gerador', 11.0, 22.0); b1.put('bancada', 16.0, 22.4); b1.put('caixa-ferramentas', 19.0, 22.6)
    b1.strew(['barril-enferrujado', 'caixotes-pilha', 'pneus'], 10, (3, 20, 50, 31))
    b1.noise('tlou-micelio', 3.0, 0.62, 5410, (30, 15, 54, 33), only=BASEMENT.floor)
    b1.noise('tlou-micelio', 3.0, 0.56, 5411, (38, 16, 54, 33), only='tlou-micelio')
    b1.strew(SPORES, 14, (34, 19, 53, 32)); b1.strew(['cordyceps-parede-1', 'cordyceps-parede-2'], 4, (36, 15, 53, 16))
    b1.strew(['nuvem-esporos', 'esporos-flutuando'], 5, (36, 19, 52, 31))
    b1.light('sub1-esp', 46, 24, 150, '#8bd45a', 0.35, 0.15)
    b1.lighting = {'place': 'underground', 'tint': '#33503b', 'particles': True}
    b1.sound = {'auto': True, 'layers': {'spooky': 0.4, 'cave': 0.3}}
    b1.spawn = {'x': 6 * TILE, 'y': 30 * TILE}

    # subsolo 2: o túnel de serviço, esporos pesados
    b2 = interior('nyc-escola-sub-2', 'Escola — túnel de serviço', 60, 32, 5500)
    box(b2, BASEMENT, 1, 1, 58, 29, 3)
    b2.paint('tlou-micelio', 1, 8, 58, 29)
    b2.noise('tlou-concreto', 4.0, 0.62, 5510, (2, 6, 58, 29), only='tlou-micelio')
    b2.noise('tlou-lama', 3.5, 0.66, 5511, (2, 6, 58, 29), only='tlou-micelio')
    b2.strew(SPORES, 70, (3, 6, 57, 28)); b2.strew(['cordyceps-parede-1', 'cordyceps-parede-2', 'cordyceps-parede-3'], 12, (4, 4, 57, 5.4))
    b2.strew(['fungo-teto'], 6, (4, 6, 57, 12)); b2.strew(['nuvem-esporos', 'esporos-flutuando', 'bulbo-esporos'], 20, (4, 8, 57, 28))
    b2.put('arvore-fungo', 36.0, 18.0)
    b2.strew(['caixotes-pilha', 'barril-enferrujado', 'mochila-chao', 'kit-medico', 'caixa-municao'], 8, (3, 10, 56, 28))
    for i, (tx, ty) in enumerate(((12, 12), (30, 22), (46, 14), (52, 24), (20, 24))):
        b2.light(f'sub2-{i}', tx, ty, 150, '#8bd45a', 0.45, 0.2)
    b2.lighting = {'place': 'underground', 'tint': '#3c5c46', 'particles': True}
    b2.sound = {'auto': True, 'layers': {'spooky': 0.6, 'cave': 0.4}}
    b2.spawn = {'x': 5 * TILE, 'y': 14 * TILE}
    b2.npc('esc-estalador-1', 'Estalador', 'Infectado cego', person('male', SHORT, 'chestnut', SHIRT_DIRTY('bege'), LEGS_DIRTY('cargo'),
           infection=('tlou/infection/estalador',), grime=('tlou/grime/sujeira', 'lama')), 22, 18, 'left')
    b2.npc('esc-estalador-2', 'Estalador', 'Infectado cego', person('female', LONG, 'dark_brown', SHIRT_DIRTY('cinza'), LEGS_DIRTY('jeans'),
           infection=('tlou/infection/estalador',), grime=('tlou/grime/sujeira', 'pesada')), 44, 20, 'up')
    return {'t': t, 'f2': f2, 'f3': f3, 'b1': b1, 'b2': b2}


# ── Metrô: esporos por toda parte ─────────────────────────────────────

def metro_zone(zid: str, name: str, w: int, h: int, seed: int, spores: int, platforms: bool = True,
               wagons: int = 2, estalador: int = 0, corredor: int = 0) -> NZ:
    """Estação/túnel horizontal: parede em cima, plataforma, duas vias com trilhos, plataforma embaixo."""
    z = interior(zid, name, w, h, seed)
    BASE = Style('tlou-concreto', 'wall-49', 'ceil-25')
    z.room(1, 0, w - 1, h - 1, BASE.floor, BASE.wall, BASE.ceil, 4)
    top = 5                                                    # primeira linha de piso
    plat_h = 5 if platforms else 3
    # plataformas (piso de pedra) em cima e embaixo, vias no meio
    z.paint('floor-29', 2, top, w - 2, top + plat_h)
    z.paint('floor-29', 2, h - 1 - plat_h, w - 2, h - 2)
    z.noise('tlou-lama', 3.5, 0.6, seed + 1, (2, top + plat_h + 1, w - 2, h - plat_h - 2), only=BASE.floor)
    z.noise('tlou-micelio', 3.0, 0.5 if spores > 40 else 0.58, seed + 2, (2, top, w - 2, h - 2))
    ty0, ty1 = top + plat_h + 1, h - 1 - plat_h - 1
    tracks = [ty0 + 2, ty1 - 3] if ty1 - ty0 > 8 else [ty0 + 1]
    for ty in tracks:
        for tx in range(2, w - 2):
            z.put('trilho-h', tx + 0.5, ty + 1)
    for i in range(wagons):
        z.put('vagao-metro', 14 + i * 30 + z.rng.uniform(-2, 2), tracks[i % len(tracks)] + 2.4, i % 2 == 1)
    for tx in range(8, w - 6, 9):                              # pilares
        z.put('pilar-quebrado', tx + 0.5, top + plat_h + 0.2); z.put('pilar-quebrado', tx + 0.5, h - plat_h + 0.2)
    if platforms:
        z.put('placa-rua', 6.0, top + 1.2)
    z.strew(['banco-pracas'], 2 if platforms else 0, (6, top + 1.8, w - 8, top + 3.4))
    z.strew(['caixotes-pilha', 'barril-enferrujado', 'mochila-chao', 'caixa-municao', 'kit-medico', 'papeis', 'vidro-quebrado'], 10 if platforms else 6, (3, top + 1.5, w - 3, h - 2))
    # esporos por toda parte
    z.strew(SPORES, spores, (3, top + 0.5, w - 3, h - 2))
    z.strew(['cordyceps-parede-1', 'cordyceps-parede-2', 'cordyceps-parede-3'], max(6, spores // 6), (3, 3.6, w - 3, 4.6))
    z.strew(['nuvem-esporos', 'esporos-flutuando'], spores // 3, (3, top, w - 3, h - 3))
    z.strew(['fungo-teto', 'bulbo-esporos'], spores // 5, (3, top + 1, w - 3, h - 3))
    for i, tx in enumerate(range(10, w - 6, 16)):
        z.light(f'{zid}-l{i}', tx, top + 2.5 + (i % 2) * (h - top - 7), 150, '#8bd45a', 0.4, 0.2)
        z.light(f'{zid}-m{i}', tx + 8, h // 2, 110, '#ffd9a0', 0.15, 0.4)
    z.lighting = {'place': 'underground', 'tint': '#3c5c46', 'particles': True}
    z.sound = {'auto': True, 'layers': {'spooky': 0.6, 'cave': 0.45}}
    z.spawn = {'x': 5 * TILE, 'y': (top + 2) * TILE}
    for i in range(estalador):
        z.npc(f'{zid}-est{i}', 'Estalador', 'Infectado cego (escuta tudo)',
              person('male' if i % 2 == 0 else 'female', SHORT if i % 2 == 0 else LONG, 'chestnut' if i % 2 == 0 else 'dark_brown',
                     SHIRT_DIRTY('cinza'), LEGS_DIRTY('jeans'), infection=('tlou/infection/estalador',), grime=('tlou/grime/sujeira', 'pesada')),
              16 + 18 * i, top + 3.5 if i % 2 == 0 else h - 5, 'down')
    for i in range(corredor):
        z.npc(f'{zid}-cor{i}', 'Corredor', 'Infectado (corre atrás do barulho)',
              person('male', SHORT, 'black', SHIRT_PLAID('marrom'), LEGS_DIRTY('preta'), infection=('tlou/infection/veias',)),
              30 + 14 * i, h - 5, 'up')
    return z


# ── Restaurante (salão, cozinha, 2 andares e terraço) ──────────────────────

def restaurant() -> dict[str, NZ]:
    t = interior('nyc-rest-1', 'Restaurante The Arbor — salão', 66, 44, 6001)
    box(t, RESTA, 1, 1, 42, 41); box(t, RESTA, 45, 1, 64, 19); box(t, RESTA, 45, 20, 64, 41)
    side_door(t, RESTA, 43, 44, 14, 18); side_door(t, RESTA, 43, 44, 28, 32); doorway(t, RESTA, 55, 20, 23)
    furnish_restaurant_hall(t, 1, 1, 42, 41, 6002); furnish_lobby(t, 45, 1, 64, 19, 6003); furnish_storage(t, 45, 20, 64, 41, 6004)
    t.put('bandeira-eua', 4.0, 38.0)
    t.spawn = {'x': 21 * TILE, 'y': 38 * TILE}

    k = interior('nyc-rest-cozinha', 'Restaurante The Arbor — cozinha', 54, 34, 6100)
    box(k, RESTA, 1, 1, 36, 31); box(k, RESTA, 39, 1, 52, 31)
    side_door(k, RESTA, 37, 38, 14, 18)
    furnish_kitchen(k, 1, 1, 36, 31, 6101); furnish_storage(k, 39, 1, 52, 31, 6102)
    k.put('cofre', 50.0, 8.0); k.put('kit-medico', 41.0, 28.0); k.put('mochila-chao', 44.0, 27.5)
    k.spawn = {'x': 18 * TILE, 'y': 28 * TILE}

    f2 = interior('nyc-rest-2', 'Restaurante The Arbor — 2º andar', 66, 44, 6200)
    box(f2, RESTA, 1, 1, 42, 41); box(f2, RESTA, 45, 1, 64, 19); box(f2, RESTA, 45, 20, 64, 41)
    side_door(f2, RESTA, 43, 44, 14, 18); side_door(f2, RESTA, 43, 44, 28, 32); doorway(f2, RESTA, 55, 20, 23)
    furnish_restaurant_hall(f2, 1, 1, 42, 41, 6201); furnish_lobby(f2, 45, 1, 64, 19, 6202); furnish_office(f2, 45, 20, 64, 41, 6203)
    f2.spawn = {'x': 21 * TILE, 'y': 38 * TILE}

    f3 = interior('nyc-rest-3', 'Restaurante The Arbor — salão de eventos', 66, 40, 6300)
    box(f3, RESTA, 1, 1, 42, 37); box(f3, RESTA, 45, 1, 64, 18); box(f3, RESTA, 45, 19, 64, 37)
    side_door(f3, RESTA, 43, 44, 12, 16); side_door(f3, RESTA, 43, 44, 26, 30); doorway(f3, RESTA, 55, 19, 22)
    furnish_restaurant_hall(f3, 1, 1, 42, 37, 6301); furnish_meeting(f3, 45, 1, 64, 18, 6302)
    furnish_office(f3, 45, 19, 64, 37, 6303)
    f3.spawn = {'x': 21 * TILE, 'y': 34 * TILE}

    r = NZ('nyc-rest-terraco', 'Restaurante The Arbor — terraço', 66, 40, 'tlou-concreto', 6400)
    r.paint('floor-3', 6, 6, 60, 34)
    r.paint('tlou-calcada', 0, 0, 66, 5); r.paint('tlou-calcada', 0, 35, 66, 40)
    r.noise('tlou-mato-invasor', 3.0, 0.6, 6401, (0, 0, 60, 40), only='floor-3')
    r.noise('tlou-mato-invasor', 3.0, 0.5, 6402, (0, 0, 60, 40), only='tlou-calcada')
    r.noise('tlou-folhas-secas', 4.0, 0.62, 6403, (0, 0, 60, 40), only='floor-3')
    for tx in range(8, 52, 11):
        r.put(TABLE_ROUND, tx, 14.0); r.put(CHAIR, tx - 1.6, 13.8); r.put(CHAIR, tx + 1.6, 13.8, True)
        r.put(TABLE_ROUND, tx, 25.0); r.put(CHAIR, tx - 1.6, 24.8); r.put(CHAIR, tx + 1.6, 24.8, True)
    for tx in (3.0, 57.0):
        r.put(z_tree(r), tx, 8.0); r.put(z_tree(r), tx, 30.0)
    r.put('mesa-mapa', 30.0, 19.5); r.put('radio', 31.8, 19.0); r.put('cofre', 33.2, 19.4); r.put('mochila-chao', 28.0, 19.8)
    r.put('fogueira', 30.0, 31.0); r.put('saco-dormir', 26.4, 31.6); r.put('saco-dormir', 33.6, 31.6, True); r.put('lampiao', 28.0, 28.4)
    r.put('bandeira-eua', 52.0, 8.4)
    r.strew(WEEDS + ['folhas-secas', 'rachadura-ervas', 'papeis'], 40, (1, 1, 59, 39))
    r.strew(TREES_SMALL + BUSHES, 16, (0.5, 0.5, 59.5, 39.5), [(5, 5, 55, 35)])
    r.light('terraco-fogueira', 30.0, 30.4, 170, '#ff9a4a', 0.65, 0.35)
    r.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'wind': 0.6}
    r.sound = {'auto': True, 'layers': {'wind': 0.6}}
    r.spawn = {'x': 6 * TILE, 'y': 20 * TILE}
    return {'t': t, 'k': k, 'f2': f2, 'f3': f3, 'r': r}


def z_tree(z: NZ) -> str:
    return z.rng.choice(TREES_SMALL + BUSHES)
