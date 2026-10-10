"""Interiores detalhados do mundo "Nova York": cada prédio é uma planta de salas com paredes, portas e móveis do estabelecimento.

Todo construtor devolve zonas com `entry` (saída pra rua, em tiles: cx, y de cima, largura, altura) e `stair` (escadas:
'up'/'dn', no mesmo formato), que o mundo usa pra ligar tudo.
"""
from __future__ import annotations

from .nyc_buildings import APT, BASEMENT, CABIN, DINER, MOTEL, OFFICE, PHARM, POLICE, RESTA, SCHOOL, SCHOOL_HALL, SHED, SHOP, Style
from .nyc_floor import Plan
from .nyc_kit import NZ, LONG, SHIRT_DIRTY, SHORT, LEGS_DIRTY, person
from .nyc_rooms import furnish

# pisos por tipo de sala
WOOD, DARK = 'floor-2', 'floor-4'
TILE_W, TILE_K, TILE_G = 'floor-22', 'floor-20', 'floor-24'
STONE = 'floor-29'


def make(zid: str, name: str, st: Style, cols: list[int], rows: list[int], areas: list[list[str | None]], roles: dict[str, str],
         floors: dict[str, str] | None = None, doors: list[tuple] | None = None, seed: int = 1, entry: tuple[str, float] | None = None,
         stairs: dict[str, tuple[bool, bool]] | None = None, windows: bool = True, infected: set[str] | None = None,
         underground: str | None = None, ruin: float = 1.0, clear: list[tuple[float, float, float, float]] | None = None) -> NZ:
    p = Plan(zid, name, st, cols, rows, areas, seed, roles, floors)
    for d in doors or []:
        p.door(*d)
    p.paint()
    furnish(p, windows=windows, ruin=ruin, infected=infected)
    z = p.z
    keep: list[tuple[float, float, float, float]] = []                  # áreas que precisam ficar livres (porta e escadas)
    for dx0, dy0, dx1, dy1, _f in p.doors:                              # portas abertas nas paredes: nada de móvel na passagem
        if dx1 - dx0 <= 2:
            keep.append((dx0 - 1.8, dy0 - 1.0, dx1 + 1.8, dy1 + 0.8))
        else:
            keep.append((dx0 - 0.4, dy0 - 1.8, dx1 + 0.4, dy1 + 3.0))
    for cx, cy, cw, ch in clear or []:
        keep.append((cx - cw / 2 - 1.2, cy - 1.5, cx + cw / 2 + 1.2, cy + ch + 0.8))
    for key, (up, down) in (stairs or {}).items():
        R = p.rooms[key]
        sx = R.x1 - 2.6
        keep.append((sx - 2.4, R.y0 - 0.2, sx + 2.4, R.y0 + 5.0))
        if up and down:
            keep.append((sx - 4.2 - 2.4, R.y0 - 0.2, sx - 4.2 + 2.4, R.y0 + 5.0))
    if entry:
        R = p.rooms[entry[0]]
        z.entry = p.enter_rect(R, R.cx + entry[1])                       # type: ignore[attr-defined]
        z.spawn = {'x': int((R.cx + entry[1]) * TILE), 'y': int((R.y1 - 3.2) * TILE)}
        ex, ey = z.entry[0], z.entry[1]                                  # type: ignore[attr-defined]
        keep.append((ex - 3.0, ey - 2.6, ex + 3.0, R.y1 + 0.5))
    if keep:
        def inside(o: dict) -> bool:
            if o['kind'].startswith(('wd@', 'tlou@quadro', 'tlou@luz')):
                return False
            x, y = o['x'] / TILE, o['y'] / TILE
            return any(a <= x <= c and b <= y <= d for a, b, c, d in keep)
        z.objects[:] = [o for o in z.objects if not inside(o)]
    for key, (up, down) in (stairs or {}).items():
        p.stairs(p.rooms[key], up, down)
    if not hasattr(z, 'stair'):
        z.stair = {}                                                     # type: ignore[attr-defined]
    if underground:
        z.lighting = {'place': 'underground', 'tint': underground, 'particles': True}
        z.sound = {'auto': True, 'layers': {'spooky': 0.4, 'cave': 0.3}}
    return z


TILE = 32
ROLES_APT = {'apA': 'apto', 'apB': 'apto', 'apC': 'apto', 'apD': 'apto', 'apE': 'apto', 'banA': 'banheiro', 'banB': 'banheiro', 'banC': 'banheiro',
             'banD': 'banheiro', 'banE': 'banheiro', 'corr': 'corredor', 'lobby': 'lobby', 'hall': 'hall'}
FL_APT = {'banA': TILE_W, 'banB': TILE_W, 'banC': TILE_W, 'banD': TILE_W, 'banE': TILE_W, 'corr': DARK, 'lobby': 'floor-30', 'hall': 'floor-30'}


def apartment(prefix: str, name: str, seed: int, floors: int = 3) -> list[NZ]:
    """Prédio residencial: térreo com o saguão, a portaria e dois apartamentos; andares com quatro apartamentos e a escada."""
    out: list[NZ] = []
    cols, rows = [14, 7, 14, 7], [10, 5, 10]
    for f in range(floors):
        if f == 0:
            areas = [['apD', 'banD', 'apE', 'banE'], ['corr'] * 4, ['lobby'] * 4]
            doors = [('apD', 'banD'), ('apE', 'banE'), ('apD', 'corr'), ('apE', 'corr'), ('lobby', 'corr', 0.3, 6), ('lobby', 'corr', 0.8, 6)]
            z = make(f'{prefix}-1', f'{name} — térreo', APT, cols, rows, areas, ROLES_APT, FL_APT, doors, seed, entry=('lobby', -8.0),
                     stairs={'lobby': (True, False)})
        else:
            areas = [['apA', 'banA', 'apB', 'banB'], ['corr'] * 4, ['apC', 'banC', 'hall', 'hall']]
            doors = [('apA', 'banA'), ('apB', 'banB'), ('apA', 'corr'), ('apB', 'corr'), ('apC', 'corr'), ('apC', 'banC'), ('hall', 'corr', 0.5, 6)]
            z = make(f'{prefix}-{f + 1}', f'{name} — {f + 1}º andar', APT, cols, rows, areas, ROLES_APT, FL_APT, doors, seed + f * 7,
                     stairs={'hall': (f < floors - 1, True)})
        out.append(z)
    return out


# ── Comércio de esquina ─────────────────────────────────────

def corner_store(zid: str, name: str, seed: int, kind: str) -> NZ:
    cols, rows = [20, 7, 10], [10, 8]
    if kind == 'deli':
        areas = [['loja', 'banho', 'estoque'], ['loja', 'escr', 'camara']]
        roles = {'loja': 'loja', 'banho': 'banheiro', 'estoque': 'estoque', 'escr': 'escritorio', 'camara': 'camara'}
        floors = {'loja': TILE_K, 'banho': TILE_W, 'estoque': STONE, 'escr': WOOD, 'camara': TILE_W}
        doors = [('loja', 'banho'), ('loja', 'escr'), ('loja', 'estoque', 0.3), ('estoque', 'camara'), ('escr', 'camara')]
        return make(zid, name, SHOP, cols, rows, areas, roles, floors, doors, seed, entry=('loja', 0.0))
    areas = [['farm', 'banho', 'vacina'], ['farm', 'escr', 'estoque']]
    roles = {'farm': 'farmacia', 'banho': 'banheiro', 'vacina': 'consultorio', 'escr': 'escritorio', 'estoque': 'estoque'}
    floors = {'farm': TILE_W, 'banho': TILE_W, 'vacina': TILE_W, 'escr': WOOD, 'estoque': STONE}
    doors = [('farm', 'banho'), ('farm', 'escr'), ('farm', 'vacina', 0.3), ('vacina', 'estoque'), ('escr', 'estoque')]
    return make(zid, name, PHARM, cols, rows, areas, roles, floors, doors, seed, entry=('farm', 0.0))


def diner(zid: str, name: str, seed: int) -> NZ:
    cols, rows = [26, 11], [9, 5, 6]
    areas = [['diner', 'cozinha'], ['diner', 'despensa'], ['diner', 'banho']]
    roles = {'diner': 'diner', 'cozinha': 'cozinha_ind', 'despensa': 'despensa', 'banho': 'banheiro'}
    floors = {'diner': 'floor-25', 'cozinha': TILE_W, 'despensa': STONE, 'banho': TILE_W}
    doors = [('diner', 'cozinha', 0.4), ('diner', 'despensa'), ('diner', 'banho'), ('cozinha', 'despensa')]
    return make(zid, name, DINER, cols, rows, areas, roles, floors, doors, seed, entry=('diner', -6.0))


def fashion_store() -> NZ:
    cols, rows = [22, 8, 10], [10, 8]
    areas = [['moda', 'prov', 'estoque'], ['moda', 'escr', 'banho']]
    roles = {'moda': 'moda', 'prov': 'provadores', 'estoque': 'estoque', 'escr': 'escritorio', 'banho': 'banheiro'}
    floors = {'moda': 'floor-26', 'prov': DARK, 'estoque': STONE, 'escr': WOOD, 'banho': TILE_W}
    doors = [('moda', 'prov', 0.4), ('moda', 'escr'), ('moda', 'estoque', 0.3), ('estoque', 'banho'), ('escr', 'banho')]
    return make('nyc-moda', 'Loja de roupas Fashion Ave', SHOP, cols, rows, areas, roles, floors, doors, 4201, entry=('moda', 0.0))


def gas_station() -> NZ:
    cols, rows = [22, 10, 14], [10, 8]
    areas = [['loja', 'escr', 'oficina'], ['loja', 'banho', 'oficina']]
    roles = {'loja': 'loja', 'escr': 'escritorio', 'banho': 'banheiro', 'oficina': 'oficina'}
    floors = {'loja': TILE_K, 'escr': WOOD, 'banho': TILE_W, 'oficina': STONE}
    doors = [('loja', 'escr'), ('loja', 'banho'), ('loja', 'oficina', 0.5), ('escr', 'oficina')]
    return make('nyc-posto', 'Posto de gasolina e oficina', SHED, cols, rows, areas, roles, floors, doors, 4401, entry=('loja', 0.0))


def motel() -> NZ:
    cols, rows = [11, 11, 11, 11, 11], [9, 5, 9]
    areas = [['q1', 'q2', 'q3', 'q4', 'q5'], ['corr'] * 5, ['rec', 'rec', 'banho', 'lav', 'escr']]
    roles = {'q1': 'quarto_motel', 'q2': 'quarto_motel', 'q3': 'quarto_motel', 'q4': 'quarto_motel', 'q5': 'quarto_motel', 'corr': 'corredor',
             'rec': 'recepcao_motel', 'banho': 'banheiro', 'lav': 'lavanderia', 'escr': 'escritorio'}
    floors = {'q1': DARK, 'q2': DARK, 'q3': DARK, 'q4': DARK, 'q5': DARK, 'corr': STONE, 'rec': WOOD, 'banho': TILE_W, 'lav': TILE_W, 'escr': WOOD}
    doors = [(f'q{i}', 'corr') for i in range(1, 6)] + [('rec', 'corr', 0.3, 6), ('banho', 'corr'), ('lav', 'corr'), ('escr', 'corr')]
    return make('nyc-motel', 'Motel Roadside', MOTEL, cols, rows, areas, roles, floors, doors, 4301, entry=('rec', 0.0))


def cabin_home() -> NZ:
    cols, rows = [15, 11], [9, 7]
    areas = [['sala', 'quarto'], ['cozinha', 'banho']]
    roles = {'sala': 'sala', 'quarto': 'quarto', 'cozinha': 'cozinha', 'banho': 'banheiro'}
    floors = {'sala': 'floor-7', 'quarto': 'floor-7', 'cozinha': 'floor-9', 'banho': TILE_W}
    doors = [('sala', 'quarto'), ('sala', 'cozinha', 0.4), ('quarto', 'banho'), ('cozinha', 'banho')]
    return make('nyc-cabana', 'Cabana abandonada', CABIN, cols, rows, areas, roles, floors, doors, 4501, entry=('cozinha', 0.0))


def warehouse() -> NZ:
    cols, rows = [28, 12], [12, 8]
    areas = [['galpao', 'escr'], ['galpao', 'docas']]
    roles = {'galpao': 'galpao', 'escr': 'escritorio', 'docas': 'estoque'}
    floors = {'galpao': STONE, 'escr': WOOD, 'docas': STONE}
    doors = [('galpao', 'escr'), ('galpao', 'docas'), ('escr', 'docas')]
    return make('nyc-galpao', 'Galpão', SHED, cols, rows, areas, roles, floors, doors, 4601, entry=('galpao', 0.0))


# ── Delegacia (2 andares) ─────────────────────────────────────

def police() -> list[NZ]:
    cols, rows = [14, 12, 12, 12], [10, 5, 10]
    roles = {'inv': 'investigacao', 'int1': 'interrogatorio', 'arq': 'arquivo', 'corr': 'corredor', 'rec': 'recepcao_del', 'arm': 'armeiro', 'hall': 'hall',
             'cela1': 'cela', 'cela2': 'cela', 'cela3': 'cela', 'cela4': 'cela', 'cmd': 'diretoria', 'alo': 'alojamento', 'ban': 'banheiro', 'vest': 'vestiario'}
    floors = {'int1': STONE, 'arq': STONE, 'corr': STONE, 'rec': 'floor-30', 'arm': STONE, 'hall': 'floor-30', 'cela1': STONE, 'cela2': STONE, 'cela3': STONE,
              'cela4': STONE, 'cmd': WOOD, 'alo': DARK, 'ban': TILE_W, 'vest': TILE_W}
    f1 = make('nyc-delegacia-1', 'Delegacia — térreo', POLICE, cols, rows,
              [['inv', 'inv', 'int1', 'arq'], ['corr'] * 4, ['rec', 'rec', 'arm', 'hall']], roles, floors,
              [('inv', 'int1'), ('int1', 'arq'), ('inv', 'corr', 0.3), ('int1', 'corr'), ('arq', 'corr'), ('rec', 'corr', 0.3, 6), ('arm', 'corr'), ('hall', 'corr', 0.5, 6)],
              4001, entry=('rec', -2.0), stairs={'hall': (True, False)})
    f2 = make('nyc-delegacia-2', 'Delegacia — celas e comando', POLICE, cols, rows,
              [['cela1', 'cela2', 'cela3', 'cela4'], ['corr'] * 4, ['cmd', 'cmd', 'alo', 'hall']], roles, floors,
              [('cela1', 'corr'), ('cela2', 'corr'), ('cela3', 'corr'), ('cela4', 'corr'), ('cmd', 'corr', 0.3, 6), ('alo', 'corr'), ('hall', 'corr', 0.5, 6)],
              4002, stairs={'hall': (False, True)})
    return [f1, f2]


# ── Edifício de escritórios (2 andares) ────────────────────────────

def offices() -> list[NZ]:
    cols, rows = [14, 12, 12, 12], [10, 5, 10]
    roles = {'reu': 'reuniao', 'e1': 'escritorio', 'e2': 'escritorio', 'e3': 'escritorio', 'corr': 'corredor', 'lobby': 'lobby', 'copa': 'cozinha', 'hall': 'hall',
             'baias': 'baias', 'reu2': 'reuniao', 'dir': 'diretoria', 'e4': 'escritorio', 'ban': 'banheiro'}
    floors = {'reu': WOOD, 'e1': WOOD, 'e2': WOOD, 'e3': WOOD, 'corr': 'floor-30', 'lobby': 'floor-30', 'copa': TILE_W, 'hall': 'floor-30',
              'baias': 'floor-24', 'reu2': WOOD, 'dir': DARK, 'e4': WOOD, 'ban': TILE_W}
    f1 = make('nyc-escritorio-1', 'Edifício Hudson — térreo', OFFICE, cols, rows,
              [['reu', 'e1', 'e2', 'e3'], ['corr'] * 4, ['lobby', 'lobby', 'copa', 'hall']], roles, floors,
              [('reu', 'corr'), ('e1', 'corr'), ('e2', 'corr'), ('e3', 'corr'), ('lobby', 'corr', 0.3, 6), ('copa', 'corr'), ('hall', 'corr', 0.5, 6)],
              4101, entry=('lobby', -2.0), stairs={'hall': (True, False)})
    f2 = make('nyc-escritorio-2', 'Edifício Hudson — 2º andar', OFFICE, cols, rows,
              [['baias', 'baias', 'baias', 'reu2'], ['corr'] * 4, ['dir', 'e4', 'ban', 'hall']], roles, floors,
              [('baias', 'corr', 0.2, 6), ('baias', 'corr', 0.7, 6), ('reu2', 'corr'), ('dir', 'corr'), ('e4', 'corr'), ('ban', 'corr'), ('hall', 'corr', 0.5, 6)],
              4102, stairs={'hall': (False, True)})
    return [f1, f2]


# ── Escola (3 andares + 2 subsolos) ───────────────────────────────

def school() -> dict[str, NZ]:
    cols, rows = [12, 12, 12, 12, 12], [10, 5, 10]
    R = {'a1': 'aula', 'a2': 'aula', 'a3': 'aula', 'a4': 'aula', 'a5': 'aula', 'a6': 'aula', 'a7': 'aula', 'a8': 'aula', 'a9': 'aula', 'a10': 'aula',
         'banhos': 'banheiro', 'bib': 'biblioteca', 'corr': 'corredor', 'ref': 'refeitorio', 'prof': 'professores', 'dir': 'diretoria', 'hall': 'hall',
         'lab1': 'laboratorio', 'lab2': 'laboratorio', 'mus': 'musica', 'vest': 'vestiario', 'sec': 'escritorio', 'arte': 'aula', 'bib2': 'biblioteca'}
    F = {'banhos': TILE_W, 'vest': TILE_W, 'corr': STONE, 'hall': 'floor-30', 'ref': TILE_K, 'dir': WOOD, 'prof': WOOD, 'bib': WOOD, 'bib2': WOOD, 'sec': WOOD,
         'a1': 'floor-22', 'a2': 'floor-22', 'a3': 'floor-22', 'a4': 'floor-22', 'a5': 'floor-22', 'a6': 'floor-22', 'a7': 'floor-22', 'a8': 'floor-22', 'a9': 'floor-22',
         'a10': 'floor-22', 'lab1': TILE_W, 'lab2': TILE_W, 'mus': WOOD, 'arte': WOOD}
    t = make('nyc-escola-1', 'Escola P.S. 114 — térreo', SCHOOL, cols, rows,
             [['a1', 'a2', 'a3', 'banhos', 'bib'], ['corr'] * 5, ['ref', 'ref', 'prof', 'dir', 'hall']], R, F,
             [('a1', 'corr'), ('a2', 'corr'), ('a3', 'corr'), ('banhos', 'corr'), ('bib', 'corr'), ('ref', 'corr', 0.3, 6), ('ref', 'corr', 0.8, 6),
              ('prof', 'corr'), ('dir', 'corr'), ('hall', 'corr', 0.5, 6), ('prof', 'dir')],
             5001, entry=('hall', 0.0), stairs={'hall': (True, True)})
    f2 = make('nyc-escola-2', 'Escola P.S. 114 — 2º andar', SCHOOL, cols, rows,
              [['a4', 'a5', 'lab1', 'lab2', 'mus'], ['corr'] * 5, ['a6', 'a7', 'banhos', 'vest', 'hall']], R, F,
              [('a4', 'corr'), ('a5', 'corr'), ('lab1', 'corr'), ('lab2', 'corr'), ('mus', 'corr'), ('a6', 'corr'), ('a7', 'corr'), ('banhos', 'corr'),
               ('vest', 'corr'), ('hall', 'corr', 0.5, 6), ('lab1', 'lab2')],
              5200, stairs={'hall': (True, True)})
    f3 = make('nyc-escola-3', 'Escola P.S. 114 — 3º andar', SCHOOL, cols, rows,
              [['a8', 'a9', 'a10', 'bib2', 'arte'], ['corr'] * 5, ['ref', 'ref', 'prof', 'banhos', 'hall']], R, F,
              [('a8', 'corr'), ('a9', 'corr'), ('a10', 'corr'), ('bib2', 'corr'), ('arte', 'corr'), ('ref', 'corr', 0.3, 6), ('ref', 'corr', 0.8, 6),
               ('prof', 'corr'), ('banhos', 'corr'), ('hall', 'corr', 0.5, 6)],
              5300, stairs={'hall': (False, True)})
    # subsolo 1: caldeira, depósitos e o começo dos esporos
    rb = {'cal': 'caldeira', 'd1': 'estoque', 'd2': 'estoque', 'd3': 'estoque', 'd4': 'estoque', 'd5': 'estoque', 'corr': 'corredor', 'hall': 'hall', 'vest': 'vestiario'}
    fb = {k: STONE for k in rb}
    b1 = make('nyc-escola-sub-1', 'Escola — porão e caldeira', BASEMENT, [14, 10, 14, 10], [9, 5, 9],
              [['cal', 'd1', 'd2', 'vest'], ['corr'] * 4, ['d3', 'd4', 'hall', 'd5']], rb, fb,
              [('cal', 'corr'), ('d1', 'corr'), ('d2', 'corr'), ('vest', 'corr'), ('d3', 'corr'), ('d4', 'corr'), ('hall', 'corr', 0.5, 6), ('d5', 'corr'),
               ('cal', 'd1'), ('d1', 'd2'), ('d3', 'd4')],
              5400, stairs={'hall': (True, True)}, windows=False, infected={'d2', 'd5', 'vest', 'corr'}, underground='#33503b')
    return {'t': t, 'f2': f2, 'f3': f3, 'b1': b1}


# ── Restaurante (salão, cozinha, 2 andares) ──────────────────────

def t_plan_despensa(z: NZ) -> tuple[float, float, float, float]:
    """Porta da despensa (coluna da direita, linha de baixo do salão) pra cozinha: perto da parede de baixo."""
    cols, rows = [30, 11, 13], [12, 8]
    x0 = 1 + 30 + 2 + 11 + 2
    y1 = 5 + 12 + 4 + 8
    return (x0 + 6.5, y1 - 1.7, 4.0, 1.6)


def restaurant() -> dict[str, NZ]:
    cols, rows = [30, 11, 13], [12, 8]
    R = {'salao': 'salao', 'banho': 'banheiro', 'bar': 'bar', 'hall': 'hall', 'despensa': 'despensa', 'vip1': 'bar', 'vip2': 'reuniao', 'escr': 'escritorio',
         'reu': 'reuniao', 'sala': 'salao', 'cozinha': 'cozinha_ind'}
    F = {'salao': 'floor-23', 'banho': TILE_W, 'bar': DARK, 'hall': 'floor-30', 'despensa': STONE, 'vip1': DARK, 'vip2': WOOD, 'escr': WOOD, 'reu': WOOD, 'sala': 'floor-23'}
    t = make('nyc-rest-1', 'Restaurante The Arbor — salão', RESTA, cols, rows,
             [['salao', 'banho', 'bar'], ['salao', 'hall', 'despensa']], R, F,
             [('salao', 'banho', 0.3), ('salao', 'hall', 0.5), ('bar', 'despensa'), ('hall', 'despensa'), ('salao', 'bar', 0.4)],
             6001, entry=('salao', -5.0), stairs={'hall': (True, False)}, clear=[t_plan_despensa(None)])
    f2 = make('nyc-rest-2', 'Restaurante The Arbor — 2º andar', RESTA, cols, rows,
              [['salao', 'vip1', 'vip2'], ['salao', 'hall', 'banho']], R, F,
              [('salao', 'vip1', 0.4), ('vip1', 'vip2'), ('salao', 'hall', 0.5), ('hall', 'banho')],
              6200, stairs={'hall': (True, True)})
    f3 = make('nyc-rest-3', 'Restaurante The Arbor — salão de eventos', RESTA, cols, rows,
              [['salao', 'escr', 'reu'], ['salao', 'hall', 'banho']], R, F,
              [('salao', 'escr', 0.4), ('escr', 'reu'), ('salao', 'hall', 0.5), ('hall', 'banho')],
              6300, stairs={'hall': (True, True)})
    D = t_plan_despensa(t)
    t.kitchen = D                                                      # type: ignore[attr-defined]
    # cozinha e câmaras (zona própria, ligada pela despensa)
    rk = {'coz': 'cozinha_ind', 'cam': 'camara', 'des': 'despensa', 'lav': 'lavanderia', 'esc': 'escritorio', 'ves': 'vestiario', 'ban': 'banheiro'}
    fk = {'coz': TILE_W, 'cam': TILE_W, 'des': STONE, 'lav': TILE_W, 'esc': WOOD, 'ves': TILE_W, 'ban': TILE_W}
    k = make('nyc-rest-cozinha', 'Restaurante The Arbor — cozinha', RESTA, [26, 11, 11], [12, 7],
             [['coz', 'cam', 'des'], ['coz', 'lav', 'esc']], rk, fk,
             [('coz', 'cam'), ('coz', 'lav'), ('cam', 'des'), ('lav', 'esc'), ('des', 'esc'), ('coz', 'des', 0.6)],
             6100, entry=('coz', -4.0))
    return {'t': t, 'k': k, 'f2': f2, 'f3': f3}
