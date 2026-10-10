"""Mobília por tipo de sala, no estilo de cada estabelecimento. Cada função recebe a planta (`Plan`), a sala (`Rect`) e um sorteio fixo."""
from __future__ import annotations

import random

from .nyc_floor import H3, Plan, Rect, TOP
from .nyc_kit import (BED, BED_THIN, BOOKS, CABINET, CELL_BED, CHAIR, CHEST, COUNTER, DESK, DESK2, DINING, DISHES, LOCKER, MCOUNTER, MSHELF, NOTICE, SHELF,
                      SHELF_LOW, SINK, SOFA, SOFA2, SPORES, STOVE, TABLE_LONG, TABLE_ROUND, WARDROBE, WORKTBL, WEEDS, GROUND_BITS, TILE, size)

COFFEE = 'furn-dark-wood@328,258'
PIANO = 'furn-dark-wood@0,849'
BUNK = 'furn-dark-wood@297,613'
BENCH = 'furn-dark-wood@334,232'
PAINTINGS = ['quadro-parede-1', 'quadro-parede-2', 'quadro-parede-3']
CLUTTER = ['papeis', 'vidro-quebrado', 'latas-garrafas', 'entulho-pequeno', 'sacos-lixo']


def rng_for(p: Plan, R: Rect) -> random.Random:
    return random.Random(f'{p.z.id}:{R.key}')


def mess(p: Plan, R: Rect, rn: random.Random, n: int = 6, weeds: int = 2, ruin: float = 1.0) -> None:
    """Papéis, vidro, lixo e um pouco de mato (só nas salas encostadas na rua) espalhados pela sala."""
    box = (R.x0 + 0.8, R.y0 + 1.2, R.x1 - 0.8, R.y1 - 0.4)
    if box[2] <= box[0] or box[3] <= box[1]:
        return
    p.z.scatter(CLUTTER, max(1, int(n * ruin)), box)
    if weeds:
        p.z.scatter(['mato-alto-1', 'mato-alto-2', 'raizes-asfalto', 'rachadura-ervas', 'arbusto-invasor'], weeds, box)


def lamp(p: Plan, R: Rect, color: str = '#ffd9a0', intensity: float = 0.38, radius: int = 190) -> None:
    p.light(R, color, intensity, radius, 0.12)


def corner_plants(p: Plan, R: Rect, rn: random.Random) -> None:
    for x, y in ((R.x0 + 0.9, R.y1 - 0.2), (R.x1 - 0.9, R.y1 - 0.2)):
        if rn.random() < 0.7:
            p.z.put('planta-vaso', x, y)


# ── Casa ──────────────────────────────────────────────────

def f_quarto(p: Plan, R: Rect, rn: random.Random) -> None:
    items = [WARDROBE, BED, CABINET] + ([SHELF] if R.w >= 13 else [])
    p.north(R, items, R.x0 + 0.6, R.x1 - 0.6)
    if R.w >= 14:
        p.z.put(BED_THIN, R.x1 - 1.6, R.y0 + 3.9)
    p.rug(R, 'rug-6', 3) if R.w >= 9 and R.h >= 8 else None
    p.z.put('tv-antiga', R.x0 + 1.4, R.y1 - 0.4)
    p.z.put(DESK, R.x1 - 1.4, R.y1 - 0.3, True)
    p.wall_decor(R, PAINTINGS, 1 if R.w < 14 else 2)
    corner_plants(p, R, rn)
    lamp(p, R, '#ffd9a0', 0.32)
    mess(p, R, rn, 5, 1)


def f_sala(p: Plan, R: Rect, rn: random.Random) -> None:
    cx = R.cx
    p.z.put('tv-antiga', cx, R.y0 + 1.5)
    p.north(R, [BOOKS, SHELF], R.x0 + 0.6, cx - 1.2)
    p.north(R, [BOOKS, SHELF], cx + 1.2, R.x1 - 0.6)
    p.rug(R, 'rug-10', 3)
    p.z.put(COFFEE, cx, R.cy + 0.9)
    p.z.put(SOFA, cx, R.cy + 3.0)
    p.z.put(SOFA2, R.x0 + 2.2, R.cy + 1.6)
    p.z.put(SOFA2, R.x1 - 2.2, R.cy + 1.6, True)
    corner_plants(p, R, rn)
    p.wall_decor(R, PAINTINGS, 2, -0.6)
    lamp(p, R, '#ffd9a0', 0.36)
    mess(p, R, rn, 6, 2)


def f_cozinha(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [SINK, COUNTER, STOVE, COUNTER, 'geladeira', DISHES, 'geladeira'][:max(3, int(R.w // 1.3))], R.x0 + 0.4, R.x1 - 0.4, gap=0.05)
    if R.h >= 7:
        p.z.put(DINING, R.cx, R.cy + 1.6)
        for dx in (-1.8, 0, 1.8):
            p.z.put(CHAIR, R.cx + dx, R.cy + 0.3); p.z.put(CHAIR, R.cx + dx, R.cy + 3.7, True)
    p.z.put('barril-agua', R.x1 - 0.9, R.y1 - 0.3)
    p.z.put('lixeira-nyc', R.x0 + 0.9, R.y1 - 0.3)
    lamp(p, R, '#ffe0b0', 0.34)
    mess(p, R, rn, 6, 1)


def f_banheiro(p: Plan, R: Rect, rn: random.Random) -> None:
    items = ['vaso', 'pia-banheiro']
    if R.w >= 6:
        items.append('banheira' if R.w >= 11 else 'chuveiro')
    p.north(R, items, R.x0 + 0.5, R.x1 - 0.5, gap=0.5)
    if R.h >= 8 and R.w >= 6:
        p.z.put('banheira', R.x0 + 2.4, R.y1 - 0.5)
        p.z.put('maquina-lavar', R.x1 - 1.1, R.cy + 0.6)
        p.z.put(CABINET, R.x1 - 1.4, R.y1 - 0.5)
    if R.w >= 6:
        p.z.put('espelho-banheiro', R.x0 + 2.8, R.y0 - 0.1)
    if R.h >= 7:
        p.z.put('vaso', R.x1 - 1.0, R.y1 - 0.2)
        p.z.put('lixeira-nyc', R.x0 + 1.0, R.y1 - 0.2)
    lamp(p, R, '#cfe4ff', 0.28, 150)
    mess(p, R, rn, 4, 0)


def f_lavanderia(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['maquina-lavar', 'maquina-lavar', 'maquina-lavar', 'maquina-lavar'], R.x0 + 0.5, R.x1 - 0.5, gap=0.2)
    p.z.put(TABLE_LONG, R.cx, R.cy + 1.5)
    p.south(R, ['caixotes-pilha', 'barril-agua', 'sacos-lixo'], R.x0 + 0.5)
    lamp(p, R, '#ffe0b0', 0.3)
    mess(p, R, rn, 5, 1)


def f_apto(p: Plan, R: Rect, rn: random.Random) -> None:
    """Apartamento de uma sala só: cama e armário de um lado, cozinha do outro, sala de estar no meio."""
    half = R.x0 + max(7.5, R.w * 0.55)
    p.north(R, [WARDROBE, BED, CABINET, SHELF], R.x0 + 0.5, half)
    p.north(R, [SINK, COUNTER, STOVE, 'geladeira', DISHES], half + 0.3, R.x1 - 0.4, gap=0.05)
    p.rug(R, 'rug-10', 3) if R.w >= 11 and R.h >= 8 else None
    p.z.put('tv-antiga', R.x0 + 1.5, R.y1 - 0.5)
    p.z.put(SOFA2, R.x0 + 4.2, R.cy + 2.4); p.z.put(COFFEE, R.x0 + 4.6, R.cy + 0.9)
    p.z.put(DINING, R.x1 - 3.6, R.cy + 2.2)
    for dx in (-1.6, 1.6):
        p.z.put(CHAIR, R.x1 - 3.6 + dx, R.cy + 0.9); p.z.put(CHAIR, R.x1 - 3.6 + dx, R.cy + 3.6, True)
    corner_plants(p, R, rn)
    p.wall_decor(R, PAINTINGS, 1, -0.6)
    lamp(p, R, '#ffd9a0', 0.36, 210)
    mess(p, R, rn, 6, 1)


# ── Entradas e circulação ──────────────────────────────────────

def f_lobby(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('balcao-recepcao', R.cx, R.y0 + 2.4) if R.w >= 13 else None
    p.z.put('caixas-correio-hall', R.x0 + 3.0, R.y0 - 0.3)
    p.z.put('porta-elevador', R.x1 - 3.0, R.y0 - 0.1)
    p.z.put('quadro-chaves', R.cx + 4.5, R.y0 - 0.4) if R.w >= 15 else None
    p.rug(R, 'rug-30', 3)
    p.east(R, [SOFA2, SOFA2], R.y0 + 4.5, R.y1 - 0.5)
    p.west(R, [SOFA2, 'planta-vaso'], R.y0 + 4.5, R.y1 - 0.5)
    p.z.put(COFFEE, R.cx, R.cy + 1.5)
    corner_plants(p, R, rn)
    p.wall_decor(R, PAINTINGS, 2, -0.5)
    lamp(p, R, '#ffd9a0', 0.4, 220)
    mess(p, R, rn, 8, 3)


def f_corredor(p: Plan, R: Rect, rn: random.Random) -> None:
    if R.w >= R.h:                                          # corredor horizontal
        p.wall_decor(R, PAINTINGS + ['quadro-chaves'], max(2, int(R.w // 7)), -0.6)
        p.south(R, [BENCH, 'planta-vaso', BENCH, 'lixeira-nyc', BENCH], R.x0 + 1.0, R.x1 - 1.0, gap=R.w / 10)
    else:                                                   # corredor vertical
        p.west(R, [BENCH, 'planta-vaso', BENCH], R.y0 + 0.5, R.y1 - 0.5, gap=1.4)
        p.east(R, ['lixeira-nyc', 'planta-vaso'], R.y0 + 1.0, R.y1 - 0.5, gap=2.0)
    if R.w >= 12:
        p.rug(R, 'rug-30', 2) if R.h >= 6 else None
    lamp(p, R, '#cfe4ff', 0.24, 200)
    mess(p, R, rn, int(R.w * R.h / 14) + 2, 3)


def f_hall_escada(p: Plan, R: Rect, rn: random.Random) -> None:
    """Saguão com a escada: a escada fica num canto (o portal vem por cima, em nyc_buildings)."""
    p.west(R, [BENCH, 'planta-vaso'], R.y0 + 1.0, R.y1 - 0.5, gap=1.5)
    p.wall_decor(R, PAINTINGS, 1, -0.6)
    lamp(p, R, '#cfe4ff', 0.25)
    mess(p, R, rn, 6, 2)


# ── Comércio ──────────────────────────────────────────────

def f_loja(p: Plan, R: Rect, rn: random.Random) -> None:
    """Mercadinho/bodega: geladeiras na parede de cima, corredores de gôndolas, balcão com caixa na frente."""
    p.north(R, ['geladeira', 'freezer', 'geladeira', 'geladeira', 'freezer', 'geladeira'], R.x0 + 0.5, R.x1 - 0.5, gap=0.15)
    rows = max(2, int((R.h - 7) // 3.4))
    for i in range(rows):
        y = R.y0 + 5.6 + i * 3.4
        p.z.put(MSHELF, R.x0 + 2.0, y); p.z.put(MSHELF, R.x0 + 4.2, y)
        x = R.x0 + 7.8
        while x < R.x1 - 5.0:
            p.z.put(MSHELF, x, y)
            x += 2.15
    p.z.put('balcao-caixa', R.x1 - 3.6, R.y1 - 0.6)
    p.z.put('maquina-vendas', R.x0 + 1.4, R.y1 - 0.3)
    p.z.put('carrinho', R.x1 - 7.5, R.y1 - 0.8)
    p.z.put('caixote-aberto', R.x0 + 4.0, R.y1 - 0.5); p.z.put('caixotes-pilha', R.x0 + 6.0, R.y1 - 0.4)
    p.wall_decor(R, ['quadro-chaves', NOTICE], 2, -0.6)
    lamp(p, R, '#fff0c0', 0.4, 230)
    mess(p, R, rn, 12, 3)


def f_farmacia(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [SHELF] * 20, R.x0 + 0.4, R.x1 - 0.4, gap=0.05)
    rows = max(1, int((R.h - 7) // 3.6))
    for i in range(rows):
        y = R.y0 + 6.0 + i * 3.6
        x = R.x0 + 2.2
        while x < R.x1 - 7.0:
            p.z.put(SHELF_LOW, x, y); p.z.put(SHELF_LOW, x + 0.95, y)
            x += 3.6
    p.z.put('vitrine-balcao', R.x1 - 3.8, R.y1 - 4.2); p.z.put('balcao-caixa', R.x1 - 3.8, R.y1 - 0.6)
    p.west(R, [CHAIR, CHAIR, CHAIR], R.y1 - 6.0, R.y1 - 0.3, gap=0.2)
    p.z.put('kit-medico', R.x0 + 2.6, R.y1 - 0.4); p.z.put('balcao-caixa', R.x0 + 7.0, R.y1 - 0.6, True)
    p.wall_decor(R, [NOTICE, 'quadro-chaves'], 2, -0.6)
    lamp(p, R, '#e0ffe8', 0.4, 230)
    mess(p, R, rn, 12, 3)


def f_estoque(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['prateleira-aco'] * 10, R.x0 + 0.4, R.x1 - 0.4, gap=0.05)
    rows = max(1, int((R.h - 5) // 3))
    for i in range(rows):
        y = R.y0 + 5.0 + i * 3.0
        for k in range(max(1, int((R.w - 3) // 3.2))):
            p.z.put('caixotes-pilha' if (i + k) % 2 == 0 else 'caixote', R.x0 + 2.0 + k * 3.2, y)
    p.z.put('barril-agua', R.x1 - 0.9, R.y1 - 0.3); p.z.put('barril-enferrujado', R.x1 - 2.0, R.y1 - 0.3)
    p.z.put('caixa-ferramentas', R.x0 + 1.2, R.y1 - 0.3)
    lamp(p, R, '#ffe0b0', 0.3)
    mess(p, R, rn, 8, 2)


def f_camara_fria(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('porta-camara-fria', R.cx, R.y0 - 0.1)
    p.north(R, ['prateleira-aco'] * 6, R.x0 + 0.4, R.cx - 2.0, gap=0.05)
    p.north(R, ['prateleira-aco'] * 6, R.cx + 2.0, R.x1 - 0.4, gap=0.05)
    p.west(R, ['freezer', 'caixotes-pilha'], R.y0 + 2.0, R.y1 - 0.5)
    lamp(p, R, '#cfe4ff', 0.34, 170)
    mess(p, R, rn, 5, 0)


def f_escritorio_sala(p: Plan, R: Rect, rn: random.Random) -> None:
    """Escritório pequeno: mesa, cadeiras, arquivos, estante."""
    p.north(R, ['arquivo-metal', 'arquivo-metal', SHELF, 'arquivo-metal'], R.x0 + 0.5, R.x1 - 0.5)
    p.z.put(DESK2, R.cx, R.cy + 1.4)
    p.z.put(CHAIR, R.cx - 0.8, R.cy + 2.6); p.z.put(CHAIR, R.cx + 0.8, R.cy + 0.1, True)
    p.z.put('baia-escritorio', R.x1 - 2.4, R.y1 - 0.4) if R.w >= 12 else None
    p.wall_decor(R, PAINTINGS, 1, -0.6)
    corner_plants(p, R, rn)
    lamp(p, R, '#ffe9c2', 0.36)
    mess(p, R, rn, 7, 1)


def f_baias(p: Plan, R: Rect, rn: random.Random) -> None:
    """Andar de escritório aberto: baias em fileiras."""
    p.north(R, ['arquivo-metal', 'arquivo-metal', 'arquivo-metal', 'maquina-vendas', 'arquivo-metal', 'arquivo-metal'], R.x0 + 0.5, R.x1 - 0.5)
    p.grid(R, 'baia-escritorio', 2.7, 2.6, ix=2.4, iy=5.4, bx=1.8, by=0.6, flip_alt=True)
    p.wall_decor(R, PAINTINGS, 3, -0.6)
    corner_plants(p, R, rn)
    lamp(p, R, '#e0eaff', 0.34, 230)
    mess(p, R, rn, 12, 3)


def f_reuniao(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('lousa', R.cx, R.y0 + 0.2) if R.w >= 14 else p.z.put(NOTICE, R.cx, R.y0 - 0.3)
    for dx in (-3.2, 0, 3.2):
        p.z.put(TABLE_LONG, R.cx + dx, R.cy + 1.8)
    for dx in (-4.2, -2.1, 0, 2.1, 4.2):
        p.z.put(CHAIR, R.cx + dx, R.cy + 0.4); p.z.put(CHAIR, R.cx + dx, R.cy + 4.0, True)
    p.south(R, ['planta-vaso', 'arquivo-metal'], R.x0 + 0.5)
    lamp(p, R, '#e0eaff', 0.34, 220)
    mess(p, R, rn, 6, 2)


def f_moda(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['arara-roupas'] * 12, R.x0 + 0.4, R.x1 - 0.4, gap=0.1)
    for i in range(max(1, int((R.h - 7) // 4))):
        y = R.y0 + 6.4 + i * 3.8
        x = R.x0 + 2.4
        while x < R.x1 - 7:
            p.z.put('arara-roupas', x, y) if (int(x) + i) % 2 else p.z.put('manequim', x, y)
            x += 2.7
    p.z.put('balcao-caixa', R.x1 - 3.6, R.y1 - 0.6)
    p.z.put('vitrine-balcao', R.x1 - 3.6, R.y1 - 4.4)
    p.wall_decor(R, ['espelho-provador', NOTICE], 3, -0.4)
    lamp(p, R, '#fff0c0', 0.4, 230)
    mess(p, R, rn, 10, 3)


def f_provadores(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('espelho-provador', R.cx, R.y0 - 0.2)
    p.south(R, ['arara-roupas', 'planta-vaso'], R.x0 + 0.5)
    p.z.put(CHAIR, R.x1 - 1.3, R.cy + 1.0, True)
    lamp(p, R, '#ffe9c2', 0.3, 140)
    mess(p, R, rn, 4, 0)


# ── Lanchonete, restaurante e bar ────────────────────────────────

def f_diner(p: Plan, R: Rect, rn: random.Random) -> None:
    """Salão de lanchonete americana: cabines na parede, balcão com banquetas, mesas no meio, jukebox."""
    n = int((R.w - 3) // 2.4)
    p.north(R, ['cabine-lanchonete'] * n, R.x0 + 0.8, R.x1 - 0.8, gap=0.1)
    cy = R.cy + 1.5
    p.z.put('balcao-lanchonete', R.x0 + 4.6, R.y1 - 4.4)
    for k in range(5):
        p.z.put('banqueta', R.x0 + 2.0 + k * 1.7, R.y1 - 1.6)
    p.z.put('jukebox', R.x1 - 1.6, R.y1 - 0.3)
    for i in range(2):
        for j in range(max(1, int((R.w - 12) // 4.6))):
            x, y = R.x0 + 12.5 + j * 4.6, R.cy + 0.4 + i * 3.4
            p.z.put(TABLE_ROUND, x, y); p.z.put(CHAIR, x - 1.6, y - 0.1); p.z.put(CHAIR, x + 1.6, y - 0.1, True)
    p.wall_decor(R, ['quadro-parede-1', 'quadro-parede-3', NOTICE], 3, -0.5)
    corner_plants(p, R, rn)
    lamp(p, R, '#ffd9a0', 0.42, 240)
    mess(p, R, rn, 10, 3)


def f_salao_rest(p: Plan, R: Rect, rn: random.Random) -> None:
    """Salão de restaurante: mesas redondas com cadeiras, bar com banquetas, adega, plantas."""
    p.north(R, ['adega', 'adega', 'balcao-bar'] if R.w >= 22 else ['adega', 'adega'], R.x0 + 0.8, R.x1 - 0.8, gap=0.3)
    cols = max(2, int((R.w - 4) // 5.4))
    rows = max(1, int((R.h - 9) // 4.2))
    for i in range(rows):
        for j in range(cols):
            x, y = R.x0 + 3.4 + j * 5.4, R.y0 + 6.8 + i * 4.2
            p.z.put(TABLE_ROUND, x, y)
            p.z.put(CHAIR, x - 1.7, y - 0.2); p.z.put(CHAIR, x + 1.7, y - 0.2, True)
            if (i + j) % 2 == 0:
                p.z.put(CHAIR, x, y + 1.3, True)
    for k in range(6):
        p.z.put('banqueta', R.x1 - 3.0 - k * 1.5, R.y0 + 5.4) if R.w >= 22 else None
    p.z.put('jukebox', R.x0 + 1.4, R.y1 - 0.3)
    corner_plants(p, R, rn)
    p.wall_decor(R, PAINTINGS, max(2, int(R.w // 9)), -0.5)
    p.rug(R, 'rug-30', 6) if R.w >= 18 and R.h >= 14 else None
    lamp(p, R, '#ffd9a0', 0.44, 260)
    mess(p, R, rn, 12, 3)


def f_bar(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['adega', 'adega', 'adega', 'adega'], R.x0 + 0.6, R.x1 - 0.6, gap=0.2)
    p.z.put('balcao-bar', R.cx, R.cy + 0.6)
    for k in range(int(R.w // 1.7) - 2):
        p.z.put('banqueta', R.x0 + 2.6 + k * 1.7, R.cy + 2.2)
    p.south(R, [SOFA2, COFFEE, SOFA2], R.x0 + 1.0, R.x1 - 1.0, gap=R.w / 6)
    lamp(p, R, '#ff9a4a', 0.4, 220)
    mess(p, R, rn, 8, 2)


def f_cozinha_ind(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['fogao-industrial'] * 3 + ['pia-industrial', 'fogao-industrial', 'geladeira', 'geladeira'], R.x0 + 0.5, R.x1 - 0.5, gap=0.1)
    p.z.put('porta-camara-fria', R.x1 - 3.0, R.y0 - 0.1) if R.w >= 20 else None
    for i in range(max(1, int((R.h - 6) // 3.6))):
        y = R.y0 + 6.4 + i * 3.6
        p.z.put('mesa-aco', R.cx - 2.0, y); p.z.put('mesa-aco', R.cx + 2.4, y)
    p.west(R, ['prateleira-aco', 'prateleira-aco'], R.y0 + 5.0, R.y1 - 0.5)
    p.south(R, ['pia-industrial', 'caixotes-pilha', 'barril-agua', 'lixeira-nyc'], R.x0 + 4.0, R.x1 - 0.5, gap=0.8)
    lamp(p, R, '#ffe9c2', 0.42, 230)
    mess(p, R, rn, 9, 1)


def f_despensa(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['prateleira-aco'] * 10, R.x0 + 0.4, R.x1 - 0.4, gap=0.05)
    p.z.put('freezer', R.x1 - 2.0, R.y1 - 0.4); p.z.put('freezer', R.x1 - 4.2, R.y1 - 0.4)
    for k in range(max(1, int((R.w - 8) // 3.0))):
        p.z.put('caixotes-pilha' if k % 2 else 'barril-agua', R.x0 + 2.0 + k * 3.0, R.cy + 1.0)
    p.z.put('adega', R.x0 + 2.4, R.y1 - 0.3)
    lamp(p, R, '#ffe0b0', 0.3)
    mess(p, R, rn, 7, 1)


# ── Delegacia ─────────────────────────────────────────────

def f_recepcao_del(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('balcao-recepcao', R.cx, R.y0 + 2.6)
    p.z.put('quadro-chaves', R.x0 + 3.0, R.y0 - 0.4); p.z.put(NOTICE, R.x1 - 3.0, R.y0 - 0.3)
    p.west(R, [BENCH, BENCH], R.y0 + 5.0, R.y1 - 0.5, gap=1.0)
    p.z.put('maquina-vendas', R.x1 - 1.6, R.y1 - 0.3)
    p.z.put('bandeira-eua', R.x0 + 1.2, R.y0 + 2.0)
    p.z.put('arquivo-metal', R.x1 - 3.4, R.y0 + 2.4)
    lamp(p, R, '#cfe4ff', 0.34, 220)
    mess(p, R, rn, 9, 2)


def f_investigacao(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['arquivo-metal', 'arquivo-metal', NOTICE, 'arquivo-metal', 'quadro-chaves'][:4], R.x0 + 0.5, R.x1 - 0.5)
    p.grid(R, 'baia-escritorio', 3.0, 2.8, ix=2.6, iy=5.4, bx=2.0, by=0.8, flip_alt=True)
    p.z.put('lousa', R.cx, R.y0 + 0.2) if R.w >= 16 else None
    lamp(p, R, '#e0eaff', 0.32, 220)
    mess(p, R, rn, 9, 2)


def f_interrogatorio(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('espelho-banheiro', R.cx, R.y0 - 0.1)
    p.z.put(TABLE_LONG, R.cx, R.cy + 1.0)
    for dx in (-1.4, 1.4):
        p.z.put(CHAIR, R.cx + dx, R.cy - 0.2); p.z.put(CHAIR, R.cx + dx, R.cy + 3.2, True)
    p.z.put('lixeira-nyc', R.x1 - 0.9, R.y1 - 0.3)
    lamp(p, R, '#e0eaff', 0.4, 150, )


def f_arquivo_sala(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['arquivo-metal'] * 12, R.x0 + 0.4, R.x1 - 0.4, gap=0.1)
    for i in range(max(1, int((R.h - 5) // 3))):
        y = R.y0 + 5.2 + i * 3.0
        for k in range(max(2, int((R.w - 4) // 2.2))):
            p.z.put('arquivo-metal', R.x0 + 2.0 + k * 1.1, y)
    p.z.put('caixotes-pilha', R.x1 - 1.4, R.y1 - 0.4)
    lamp(p, R, '#ffe9c2', 0.3, 170)
    mess(p, R, rn, 9, 1)


def f_armeiro(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['armario-ferro'] * 10, R.x0 + 0.4, R.x1 - 0.4, gap=0.1)
    p.z.put('cofre', R.x1 - 1.4, R.y1 - 0.4); p.z.put('caixa-municao', R.x0 + 2.0, R.cy + 1.5); p.z.put('caixa-municao', R.x0 + 3.2, R.cy + 1.5)
    p.z.put(TABLE_LONG, R.cx, R.cy + 2.0)
    p.z.put('mochila-chao', R.x0 + 1.4, R.y1 - 0.4); p.z.put('kit-medico', R.x1 - 3.4, R.y1 - 0.4)
    lamp(p, R, '#e0eaff', 0.3, 170)
    mess(p, R, rn, 6, 1)


def f_cela(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [CELL_BED, CELL_BED] if R.w >= 8 else [CELL_BED], R.x0 + 0.8, R.x1 - 0.8, gap=0.8)
    p.z.put('vaso', R.x1 - 1.0, R.y1 - 1.8); p.z.put('pia-banheiro', R.x1 - 2.6, R.y1 - 1.7)
    for k in range(max(1, int(R.w // 2))):
        p.z.put('grade-cela', R.x0 + 1.0 + k * 2.0, R.y1 + 0.1)
    lamp(p, R, '#cfe4ff', 0.26, 150)
    mess(p, R, rn, 4, 0)


def f_vestiario(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['armarios-escola'] * 8, R.x0 + 0.4, R.x1 - 0.4, gap=0.0)
    p.z.put(BENCH, R.cx, R.cy + 1.4); p.z.put(BENCH, R.cx, R.cy + 3.2)
    p.south(R, ['chuveiro', 'chuveiro', 'pia-banheiro', 'vaso'], R.x0 + 1.0, gap=0.6)
    lamp(p, R, '#cfe4ff', 0.28, 170)
    mess(p, R, rn, 6, 1)


def f_alojamento(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [BUNK, BUNK, BUNK, BUNK, BUNK], R.x0 + 0.6, R.x1 - 0.6, gap=0.6)
    p.south(R, [BED_THIN, BED_THIN, BED_THIN, BED_THIN], R.x0 + 1.0, R.x1 - 1.0, gap=1.2)
    p.z.put('armario-ferro', R.x1 - 1.2, R.cy + 1.0); p.z.put('mochila-chao', R.x0 + 1.6, R.cy + 2.0)
    p.z.put('tv-antiga', R.cx, R.cy + 1.2)
    lamp(p, R, '#ffe0b0', 0.3, 180)
    mess(p, R, rn, 8, 1)


def f_consultorio(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [SHELF, CABINET, 'geladeira'], R.x0 + 0.5, R.x1 - 0.5)
    p.z.put('cama-hospital', R.cx - 2.0, R.cy + 1.8); p.z.put('suporte-soro', R.cx - 0.2, R.cy + 1.4)
    p.z.put('biombo-hospital', R.cx + 3.2, R.cy + 1.9) if R.w >= 12 else None
    p.z.put('kit-medico', R.x1 - 1.2, R.y1 - 0.4); p.z.put('lixeira-nyc', R.x0 + 1.0, R.y1 - 0.3)
    p.z.put(DESK, R.x1 - 1.6, R.cy + 2.8, True)
    lamp(p, R, '#e0ffe8', 0.34, 190)
    mess(p, R, rn, 6, 1)


# ── Escola ────────────────────────────────────────────────

def f_sala_aula(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('lousa', R.cx, R.y0 + 0.2)
    p.z.put(WORKTBL, R.x0 + 4.5, R.y0 + 3.4); p.z.put(CHAIR, R.x0 + 4.5, R.y0 + 2.4)
    p.z.put(BOOKS, R.x1 - 1.4, R.y0 + 1.9); p.z.put(BOOKS, R.x1 - 2.5, R.y0 + 1.9)
    p.grid(R, 'carteira', 2.1, 2.2, ix=2.0, iy=5.8, bx=1.6, by=1.4)
    p.south(R, [LOCKER, LOCKER, 'planta-vaso'], R.x0 + 0.5, gap=0.3)
    p.z.put('bandeira-eua', R.x1 - 1.0, R.y1 - 0.4)
    lamp(p, R, '#fff0c0', 0.34, 230)
    mess(p, R, rn, 9, 2)


def f_laboratorio(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['prateleira-aco', 'pia-industrial', 'prateleira-aco', 'geladeira'], R.x0 + 0.5, R.x1 - 0.5)
    for i in range(max(1, int((R.h - 6) // 3.6))):
        for k in range(max(1, int((R.w - 5) // 4.0))):
            p.z.put('mesa-aco', R.x0 + 3.4 + k * 4.0, R.y0 + 6.6 + i * 3.6)
    p.z.put('kit-medico', R.x1 - 1.2, R.y1 - 0.4); p.z.put('lixeira-nyc', R.x0 + 1.0, R.y1 - 0.3)
    lamp(p, R, '#e0ffe8', 0.36, 220)
    mess(p, R, rn, 7, 1)


def f_biblioteca(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [SHELF] * 20, R.x0 + 0.4, R.x1 - 0.4, gap=0.05)
    for i in range(max(1, int((R.h - 7) // 3.8))):
        y = R.y0 + 6.0 + i * 3.8
        x = R.x0 + 2.5
        while x < R.x1 - 4:
            p.z.put(SHELF, x, y)
            x += 2.2 if (int(x) % 5) else 3.4
    p.z.put(TABLE_LONG, R.cx, R.y1 - 1.5)
    for dx in (-2.0, 0, 2.0):
        p.z.put(CHAIR, R.cx + dx, R.y1 - 2.4); p.z.put(CHAIR, R.cx + dx, R.y1 - 0.2, True)
    corner_plants(p, R, rn)
    lamp(p, R, '#ffe0b0', 0.34, 230)
    mess(p, R, rn, 9, 2)


def f_refeitorio(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['balcao-lanchonete', 'fogao-industrial', 'geladeira'] if R.w >= 22 else ['balcao-lanchonete'], R.x0 + 0.6, R.x1 - 0.6, gap=0.3)
    for i in range(max(1, int((R.h - 8) // 3.4))):
        for k in range(max(2, int((R.w - 4) // 5.0))):
            x, y = R.x0 + 3.4 + k * 5.0, R.y0 + 7.0 + i * 3.4
            p.z.put(TABLE_LONG, x, y); p.z.put(BENCH, x, y - 1.3); p.z.put(BENCH, x, y + 1.0)
    p.z.put('maquina-vendas', R.x1 - 1.6, R.y1 - 0.3)
    lamp(p, R, '#fff0c0', 0.36, 240)
    mess(p, R, rn, 10, 2)


def f_musica(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put(PIANO, R.cx, R.y0 + 3.0)
    p.z.put(CHAIR, R.cx, R.y0 + 4.2)
    for i in range(2):
        for k in range(max(2, int((R.w - 4) // 2.0))):
            p.z.put(CHAIR, R.x0 + 2.0 + k * 2.0, R.y0 + 7.2 + i * 1.8)
    p.south(R, [SHELF, 'armarios-escola'], R.x0 + 0.6)
    lamp(p, R, '#ffe0b0', 0.32, 200)
    mess(p, R, rn, 6, 1)


def f_diretoria(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [SHELF, 'arquivo-metal', BOOKS, 'arquivo-metal'], R.x0 + 0.5, R.x1 - 0.5)
    p.z.put(DESK2, R.cx, R.cy + 1.2); p.z.put(CHAIR, R.cx, R.cy + 2.5)
    p.z.put(SOFA2, R.x1 - 2.2, R.y1 - 0.4); p.z.put(COFFEE, R.x1 - 5.0, R.y1 - 0.5)
    p.z.put('bandeira-eua', R.x0 + 1.2, R.y0 + 2.0)
    p.wall_decor(R, PAINTINGS, 2, -0.6)
    p.rug(R, 'rug-6', 3) if R.w >= 9 else None
    lamp(p, R, '#ffe0b0', 0.38, 190)
    mess(p, R, rn, 5, 1)


def f_professores(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [SHELF, 'arquivo-metal', 'geladeira', COUNTER, SINK], R.x0 + 0.5, R.x1 - 0.5)
    p.z.put(TABLE_LONG, R.cx, R.cy + 1.4)
    for dx in (-2.4, 0, 2.4):
        p.z.put(CHAIR, R.cx + dx, R.cy + 0.1); p.z.put(CHAIR, R.cx + dx, R.cy + 3.0, True)
    p.z.put(SOFA2, R.x1 - 2.2, R.y1 - 0.4)
    lamp(p, R, '#ffe9c2', 0.34, 190)
    mess(p, R, rn, 7, 1)


# ── Oficina, galpão, motel ──────────────────────────────────

def f_oficina(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['bancada', 'caixa-ferramentas', 'rack-pneus', 'rack-pneus', 'armario-ferro'], R.x0 + 0.5, R.x1 - 0.5, gap=0.8)
    p.z.put('elevador-carro', R.cx - 2.0, R.cy + 3.0); p.z.put('carro-azul', R.cx - 2.0, R.cy + 2.0)
    p.z.put('elevador-carro', R.cx + 6.0, R.cy + 3.0) if R.w >= 22 else None
    p.z.put('gerador', R.x1 - 1.5, R.y1 - 0.4); p.z.put('barril-enferrujado', R.x0 + 1.2, R.y1 - 0.3); p.z.put('barril-enferrujado', R.x0 + 2.3, R.y1 - 0.3)
    p.z.put('pneus', R.x0 + 4.0, R.y1 - 0.3); p.z.put('caixa-ferramentas', R.x1 - 4.0, R.y1 - 0.3)
    lamp(p, R, '#ffe0b0', 0.36, 230)
    mess(p, R, rn, 10, 2)


def f_galpao(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [MSHELF] * 20, R.x0 + 0.4, R.x1 - 0.4, gap=0.05)
    for i in range(max(1, int((R.h - 6) // 3.6))):
        for k in range(max(2, int((R.w - 4) // 4.2))):
            p.z.put('caixotes-pilha' if (i + k) % 2 == 0 else 'caixote', R.x0 + 2.6 + k * 4.2, R.y0 + 6.0 + i * 3.6)
    p.z.put('gerador', R.x1 - 1.6, R.y1 - 0.4); p.z.put('bancada', R.x0 + 2.0, R.y1 - 0.4); p.z.put('van', R.cx, R.y1 - 0.5) if R.w >= 24 else None
    p.z.put('barril-agua', R.x0 + 4.5, R.y1 - 0.3)
    lamp(p, R, '#ffe0b0', 0.3, 240)
    mess(p, R, rn, 12, 3)


def f_quarto_motel(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, [CABINET, BED, CABINET, WARDROBE], R.x0 + 0.5, R.x1 - 0.5)
    p.z.put('tv-antiga', R.x1 - 1.4, R.cy + 1.2); p.z.put(DESK, R.x0 + 1.4, R.y1 - 0.4)
    p.rug(R, 'rug-6', 2) if R.w >= 8 else None
    p.wall_decor(R, PAINTINGS, 1, -0.6)
    lamp(p, R, '#ffd9a0', 0.3, 150)
    mess(p, R, rn, 4, 1)


def f_recepcao_motel(p: Plan, R: Rect, rn: random.Random) -> None:
    p.z.put('balcao-recepcao', R.cx, R.y0 + 2.6)
    p.z.put('quadro-chaves', R.cx - 5.0, R.y0 - 0.4)
    p.east(R, [SOFA2, 'planta-vaso'], R.y0 + 4.5, R.y1 - 0.5); p.z.put('maquina-vendas', R.x0 + 1.6, R.y1 - 0.3)
    p.z.put('tv-antiga', R.x0 + 2.0, R.y0 + 2.0)
    lamp(p, R, '#ff9a4a', 0.4, 210)
    mess(p, R, rn, 8, 2)


# ── Subsolo e infecção ────────────────────────────────────

def f_caldeira(p: Plan, R: Rect, rn: random.Random) -> None:
    p.north(R, ['gerador', 'gerador', 'caixa-ferramentas', 'gerador', 'bancada'], R.x0 + 0.5, R.x1 - 0.5, gap=1.0)
    for k in range(max(2, int((R.w - 4) // 3.0))):
        p.z.put('barril-enferrujado', R.x0 + 2.0 + k * 3.0, R.cy + 2.0)
    p.z.put('caixotes-pilha', R.x1 - 1.4, R.y1 - 0.4)
    lamp(p, R, '#ffb060', 0.34, 180)
    mess(p, R, rn, 8, 0)


def infect(p: Plan, R: Rect, rn: random.Random, n: int = 10) -> None:
    box = (R.x0 + 0.8, R.y0 + 1.5, R.x1 - 0.8, R.y1 - 0.4)
    p.z.scatter(SPORES, n, box)
    p.z.scatter(['nuvem-esporos', 'esporos-flutuando', 'bulbo-esporos'], max(2, n // 3), box)
    p.z.scatter(['cordyceps-parede-1', 'cordyceps-parede-2', 'cordyceps-parede-3'], max(2, n // 4), (R.x0 + 1, R.y0 - 0.5, R.x1 - 1, R.y0 - 0.2))
    p.z.light(f'esp-{R.key}', R.cx, R.cy, 140, '#8bd45a', 0.38, 0.15)


FURN = {
    'apto': f_apto, 'quarto': f_quarto, 'sala': f_sala, 'cozinha': f_cozinha, 'banheiro': f_banheiro, 'lavanderia': f_lavanderia,
    'lobby': f_lobby, 'corredor': f_corredor, 'hall': f_hall_escada,
    'loja': f_loja, 'farmacia': f_farmacia, 'estoque': f_estoque, 'camara': f_camara_fria,
    'escritorio': f_escritorio_sala, 'baias': f_baias, 'reuniao': f_reuniao, 'moda': f_moda, 'provadores': f_provadores,
    'diner': f_diner, 'salao': f_salao_rest, 'bar': f_bar, 'cozinha_ind': f_cozinha_ind, 'despensa': f_despensa,
    'recepcao_del': f_recepcao_del, 'investigacao': f_investigacao, 'interrogatorio': f_interrogatorio, 'arquivo': f_arquivo_sala,
    'armeiro': f_armeiro, 'cela': f_cela, 'vestiario': f_vestiario, 'alojamento': f_alojamento, 'consultorio': f_consultorio,
    'aula': f_sala_aula, 'laboratorio': f_laboratorio, 'biblioteca': f_biblioteca, 'refeitorio': f_refeitorio, 'musica': f_musica,
    'diretoria': f_diretoria, 'professores': f_professores,
    'oficina': f_oficina, 'galpao': f_galpao, 'quarto_motel': f_quarto_motel, 'recepcao_motel': f_recepcao_motel, 'caldeira': f_caldeira,
}

NO_WINDOWS = {'banheiro', 'camara', 'cela', 'interrogatorio', 'arquivo', 'armeiro', 'despensa', 'provadores', 'estoque', 'caldeira', 'vestiario', 'lavanderia'}


# ── Enchimento: se a sala ainda ficou vazia perto do tamanho dela, completa com móveis do tipo de sala ──

POOL: dict[str, list[str]] = {
    'investigacao': [DESK2, CHAIR, 'arquivo-metal', 'baia-escritorio', 'mesa-mapa', 'planta-vaso', 'lixeira-nyc'],
    'interrogatorio': [CHAIR, 'arquivo-metal', 'lixeira-nyc', TABLE_LONG],
    'arquivo': ['arquivo-metal', 'arquivo-metal', 'caixotes-pilha', 'caixote', 'prateleira-aco'],
    'recepcao_del': [BENCH, 'planta-vaso', 'maquina-vendas', 'lixeira-nyc', CHAIR],
    'armeiro': ['armario-ferro', 'caixa-municao', 'prateleira-aco', 'cofre'],
    'hall': [BENCH, 'planta-vaso', 'lixeira-nyc'],
    'lobby': [SOFA2, 'planta-vaso', COFFEE, 'lixeira-nyc'],
    'diretoria': [SHELF, CHAIR, 'planta-vaso', 'arquivo-metal', COFFEE, SOFA2],
    'reuniao': [CHAIR, 'planta-vaso', 'arquivo-metal', 'lixeira-nyc'],
    'baias': ['baia-escritorio', 'arquivo-metal', 'planta-vaso'],
    'escritorio': [DESK2, CHAIR, 'arquivo-metal', SHELF, 'planta-vaso'],
    'aula': ['carteira', 'carteira', 'armarios-escola', 'planta-vaso', 'lixeira-nyc'],
    'biblioteca': [SHELF, BOOKS, TABLE_LONG, CHAIR, 'planta-vaso'],
    'refeitorio': [TABLE_LONG, CHAIR, BENCH, 'lixeira-nyc'],
    'professores': [SOFA2, COFFEE, DESK2, CHAIR, SHELF, 'planta-vaso'],
    'laboratorio': ['mesa-aco', 'prateleira-aco', 'pia-industrial', CHAIR],
    'musica': [PIANO, CHAIR, BENCH, 'planta-vaso'],
    'estoque': ['caixotes-pilha', 'caixote', 'barril-agua', 'prateleira-aco'],
    'caldeira': ['barril-enferrujado', 'caixotes-pilha', 'caixa-ferramentas'],
    'loja': ['caixotes-pilha', 'carrinho', 'maquina-vendas', 'lixeira-nyc'],
    'farmacia': [SHELF_LOW, 'planta-vaso', CHAIR, 'maquina-vendas', 'kit-medico'],
    'moda': ['arara-roupas', 'manequim', 'planta-vaso', 'arara-roupas'],
    'salao': [TABLE_ROUND, CHAIR, 'planta-vaso'],
    'diner': ['planta-vaso', 'lixeira-nyc', 'banqueta'],
    'bar': ['banqueta', 'planta-vaso', TABLE_ROUND, CHAIR],
    'cozinha_ind': ['mesa-aco', 'caixotes-pilha', 'lixeira-nyc', 'barril-agua'],
    'despensa': ['caixotes-pilha', 'prateleira-aco', 'barril-agua', 'caixote'],
    'camara': ['caixotes-pilha', 'caixote', 'barril-agua'],
    'alojamento': [BUNK, WARDROBE, LOCKER, 'planta-vaso'],
    'vestiario': [LOCKER, BENCH, 'lixeira-nyc'],
    'consultorio': ['biombo-hospital', CHAIR, 'kit-medico', 'planta-vaso'],
    'oficina': ['rack-pneus', 'caixa-ferramentas', 'barril-enferrujado', 'caixotes-pilha'],
    'galpao': ['caixotes-pilha', 'barril-enferrujado', 'prateleira-aco', 'caixote'],
    'quarto_motel': ['planta-vaso', CABINET, CHAIR],
    'recepcao_motel': ['planta-vaso', SOFA2, 'lixeira-nyc', CHAIR],
    'quarto': ['planta-vaso', CABINET, CHAIR, SHELF],
    'sala': ['planta-vaso', SHELF, CHAIR, COFFEE],
    'apto': ['planta-vaso', CABINET, CHAIR, SHELF],
    'cozinha': ['caixote', 'lixeira-nyc', CHAIR, 'barril-agua'],
    'banheiro': ['lixeira-nyc', 'planta-vaso', 'maquina-lavar'],
    'lavanderia': ['maquina-lavar', 'caixotes-pilha', 'lixeira-nyc'],
}
DENS = {'hall': 0.08, 'lobby': 0.1, 'banheiro': 0.06, 'musica': 0.12, 'reuniao': 0.11, 'loja': 0.09, 'farmacia': 0.11, 'moda': 0.12, 'diner': 0.09}
LIGHT_KINDS = ('wd@', 'tlou@quadro', 'tlou@espelho', 'tlou@papeis', 'tlou@vidro', 'tlou@latas', 'tlou@entulho', 'tlou@sacos', 'tlou@mato', 'tlou@raizes',
               'tlou@rachadura', 'tlou@arbusto', 'tlou@nuvem', 'tlou@esporos', 'tlou@bulbo', 'tlou@cordyceps', 'tlou@fungo')


def fill(p: Plan, R: Rect, rn: random.Random, dens: float = 0.15) -> None:
    pool = POOL.get(R.role)
    if not pool:
        return
    z = p.z
    inside = [o for o in z.objects if R.x0 <= o['x'] / TILE <= R.x1 and R.y0 - 1 <= o['y'] / TILE <= R.y1 + 1 and not o['kind'].startswith(LIGHT_KINDS)]
    want = int(R.w * R.h * DENS.get(R.role, dens)) - len(inside)
    pts = [(o['x'] / TILE, o['y'] / TILE) for o in inside]
    for _ in range(max(0, want)):
        for _try in range(40):
            x = rn.uniform(R.x0 + 1.4, R.x1 - 1.4)
            y = rn.uniform(R.y0 + 3.2, R.y1 - 0.5)
            if all((x - a) ** 2 + (y - b) ** 2 > 2.0 ** 2 for a, b in pts):
                z.put(rn.choice(pool), x, y, rn.random() < 0.3)
                pts.append((x, y))
                break


def furnish(p: Plan, windows: bool = True, ruin: float = 1.0, infected: set[str] | None = None) -> None:
    """Mobília todas as salas da planta pelo papel de cada uma; janelas nas salas da fileira de cima."""
    for R in p.rooms.values():
        rn = rng_for(p, R)
        fn = FURN.get(R.role)
        if fn:
            fn(p, R, rn)
            fill(p, R, rn)
        if windows and R.y0 == TOP and R.role not in NO_WINDOWS and R.w >= 8:
            p.windows(R, 7.0 if R.w >= 12 else 8.0)
        if infected and (R.key in infected or R.role in infected):
            infect(p, R, rn, int(R.w * R.h / 9))
