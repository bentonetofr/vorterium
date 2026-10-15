"""Peças do Saltmore: árvores, pedras, moitas, casas, cercas e adereços, escolhidos pelo nome no catálogo."""
from __future__ import annotations

import math
import re
import unicodedata

from .lib import OBJ, TILE, Path, Zone, fbm, obj_size


def _norm(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


_INDEX = [(o['id'], _norm(o['label']), o['sheet'], o['pack'], o['category']) for o in OBJ.values()]


def find(pattern: str, sheet: str | None = None, pack: str | None = None, category: str | None = None) -> list[str]:
    """Ids cujo rótulo (sem acento, minúsculo) casa com `pattern`."""
    rx = re.compile(pattern)
    out = []
    for oid, label, sh, pk, cat in _INDEX:
        if sheet and sh != sheet:
            continue
        if pack and pk != pack:
            continue
        if category and _norm(cat) != _norm(category):
            continue
        if rx.search(label):
            out.append(oid)
    return out


def one(pattern: str, sheet: str | None = None, pack: str | None = None, nth: int = 0) -> str:
    r = find(pattern, sheet, pack)
    if not r:
        raise KeyError(f'nada no catálogo para {pattern!r} ({sheet}/{pack})')
    return r[nth]


def need(ids: list[str], what: str) -> list[str]:
    if not ids:
        raise KeyError(f'nenhuma peça para {what}')
    return ids


# ── Árvores ─────────────────────────────────────────────────────────────────

G = 'trees-green'
P = 'trees-pale'          # a versão azul-esverdeada, mais fria e escura: o tom do Saltmore


def _both(pattern: str, green_share: int = 1, pale_share: int = 4) -> list[str]:
    """Peças pálidas (frias) em maior número e algumas verdes, pra variar o tom."""
    pale = find(pattern, sheet=P)
    green = find(pattern, sheet=G)
    return need(pale * pale_share + green * green_share, pattern)


PINES = _both(r'^(pinheiro|cipreste)$')
PINES_YOUNG = _both(r'^pinheiro jovem$')
OAKS_BIG = _both(r'^carvalho (frondoso|gigante)')
OAKS_MID = _both(r'^(carvalho velho|arvore sombria|arvore densa|arvore de tronco grosso|arvore antiga|carvalho largo|arvore copada|arvore redonda)$')
OAKS_SMALL = _both(r'^(carvalho|arvore jovem|arvore de folhas miudas|arvore inclinada|arvore retorcida|arvore galhuda)$')
COLOSSAL = _both(r'^arvore colossal')
TREELETS = _both(r'^(arvoreta|arvoreta com arbusto|arvore baixa de raizes|choupo)$')
DEAD_TREES = need(find(r'^(arvore morta|arvore morta grossa|tronco morto retorcido|arvore morta larga|arvore morta alta|arvore seca alta|arvore seca espalhada|arvore morta torta|arvore morta assombrada|arvore seca curvada)', sheet='trees-dead'), 'árvores mortas')
BARE_SMALL = need(find(r'^(arvoreta seca|arvore morta)$', sheet='trees-dead'), 'árvores secas pequenas')

# raio de espaçamento (tiles) por tipo: o tronco + um pouco da copa
def _tree_r(oid: str) -> float:
    w, _ = obj_size(oid)
    return max(0.55, min(w, 200) / TILE * 0.32)


# ── Moitas, plantas e troncos ────────────────────────────────────────────────

BUSHES_DARK = need(find(r'^(moita escura \d|moita baixa \d|arbusto \d|arbusto escuro|moita clara)$', pack='plants'), 'moitas escuras')
BUSHES_LOW = need(find(r'^(moita baixa \d|arbusto alto \d|moitinha \d)$', pack='plants'), 'moitas baixas')
FERNS = find(r'^(planta|samambaia|folhagem)', pack='plants', category='Plantas')
MUSHROOMS = need(find(r'cogumelo', pack='plants'), 'cogumelos')
LOGS = need(find(r'^(tronco caido|tronco oco caido|tronco com musgo|toras?|toco com musgo|galho caido \d|tronco cortado)', pack='plants'), 'troncos')
STUMPS = need(find(r'^(toco|toco \d|toco pequeno \d|toco cortado|toco com musgo)$', pack='plants'), 'tocos')
FLOWERS = find(r'flor|margarida|lirio|violeta|campanula', pack='plants', category='Flores')


def tree_pick(rng, kinds: list[str]) -> str:
    return rng.choice(kinds)


# ── Pedras ──────────────────────────────────────────────────────────────────

def rocks(sheet: str) -> dict[str, list[str]]:
    """Pedras de uma folha (rock-cinza, rock-escura, rock-carvao, rock-arenito e as -neve) por tamanho."""
    big = find(r'^(rochedo aspero( \d)?|dolmen|pedras em pe|rochedo de colunas)$', sheet=sheet)
    mid = find(r'^(rochedo( \d)?|rochedo com musgo|rochedo grande|rocha grande( \d)?|rocha com musgo|rocha chata|coluna de rocha( \d)?|coluna aspera( \d)?|menires?|menires duplos)$', sheet=sheet)
    small = find(r'^(pedra (redonda|lisa|lisa 2|media|aspera|aspera \d|aspera pequena|cortada|torta)|pilha de pedras( \d)?|pedras empilhadas|bloco de pedra|laje de pedra|pedregulhos \d|pedras com grama)$', sheet=sheet)
    flat = find(r'^(pedrinhas?( \d)?|seixos( \d| com grama)?|pedregulhos?|lascas de pedra( \d)?|pedra pequena( \d)?)$', sheet=sheet)
    return {'big': big, 'mid': mid, 'small': small, 'flat': flat}


R_GRAY = rocks('rock-cinza')
R_DARK = rocks('rock-escura')
R_COAL = rocks('rock-carvao')
R_GRAY_SNOW = rocks('rock-cinza-neve')
R_DARK_SNOW = rocks('rock-escura-neve')
R_SAND = rocks('rock-arenito')


# ── Mata por ruído ───────────────────────────────────────────────────────────

def forest(z: Zone, density, *, pines: float = 0.55, oaks: float = 0.3, small: float = 0.1, dead: float = 0.0,
           big_chance: float = 0.0, cell: float = 2.1, box: tuple[float, float, float, float] | None = None,
           seed: int = 0, pine_set: list[str] | None = None, oak_set: list[str] | None = None,
           colossal_chance: float = 0.0) -> int:
    """Espalha árvores numa grade com tremida. `density(tx, ty)` dá 0..1 (0 = nada, 1 = cheio); reservas e coisas já
    colocadas são respeitadas. `pines/oaks/small/dead` são os pesos de cada tipo; `big_chance` é a chance de um carvalho gigante."""
    rng = z.rng
    x0, y0, x1, y1 = box or (0, 0, z.w, z.h)
    pine_set = pine_set or PINES
    oak_set = oak_set or OAKS_MID
    placed = 0
    ty = y0 + cell / 2
    row = 0
    while ty < y1:
        tx = x0 + cell / 2 + (cell / 2 if row % 2 else 0)
        while tx < x1:
            jx, jy = tx + rng.uniform(-cell * 0.45, cell * 0.45), ty + rng.uniform(-cell * 0.45, cell * 0.45)
            d = density(jx, jy)
            if d > 0 and rng.random() < d:
                # os tipos vêm em manchas: o ruído inclina a escolha (pinheiral / carvalhal)
                bias = fbm(jx / 9.0, jy / 9.0, seed + z.seed + 17, 2)
                wp, wo = pines * (0.4 + bias * 1.2), oaks * (1.6 - bias * 1.2)
                kind_roll = rng.random() * (wp + wo + small + dead)
                if colossal_chance and rng.random() < colossal_chance:
                    kind = rng.choice(COLOSSAL)
                elif big_chance and rng.random() < big_chance:
                    kind = rng.choice(OAKS_BIG)
                elif kind_roll < wp:
                    kind = rng.choice(pine_set)
                elif kind_roll < wp + wo:
                    kind = rng.choice(oak_set)
                elif kind_roll < wp + wo + small:
                    kind = rng.choice(PINES_YOUNG + TREELETS)
                else:
                    kind = rng.choice(DEAD_TREES)
                r = _tree_r(kind)
                if z.free_disc(jx, jy, r):
                    z.put(kind, jx, jy, rng.random() < 0.5, radius=r * 0.9)
                    placed += 1
        # fim da linha
            tx += cell
        ty += cell * 0.82
        row += 1
    return placed


def undergrowth(z: Zone, density, *, n_per_100: float = 6.0, box: tuple[float, float, float, float] | None = None,
                kinds: list[str] | None = None, seed: int = 0, radius: float = 0.35) -> int:
    """Moitas, samambaias, cogumelos e troncos pelo chão, em manchas."""
    rng = z.rng
    x0, y0, x1, y1 = box or (0, 0, z.w, z.h)
    n = int((x1 - x0) * (y1 - y0) / 100 * n_per_100)
    kinds = kinds or (BUSHES_DARK * 3 + BUSHES_LOW * 2 + FERNS * 2 + MUSHROOMS)
    placed, tries = 0, 0
    while placed < n and tries < n * 20:
        tries += 1
        tx, ty = rng.uniform(x0, x1), rng.uniform(y0, y1)
        d = density(tx, ty)
        if d <= 0 or rng.random() > d:
            continue
        if z.reserved(tx, ty):
            continue
        if any((tx - sx) ** 2 + (ty - sy) ** 2 < (radius + sr) ** 2 for sx, sy, sr in z.spots[-400:]):
            continue
        z.put(rng.choice(kinds), tx, ty, rng.random() < 0.5, radius=radius)
        placed += 1
    return placed


def rock_cluster(z: Zone, cx: float, cy: float, r: float, n: int, sets: list[dict[str, list[str]]] | None = None,
                 weights: tuple[float, float, float, float] = (0.15, 0.3, 0.35, 0.2), reserve: bool = True) -> None:
    """Grupo de pedras (grandes no meio, miúdas nas bordas)."""
    rng = z.rng
    sets = sets or [R_GRAY]
    for i in range(n):
        ang = rng.uniform(0, math.tau)
        dist = r * math.sqrt(rng.random())
        tx, ty = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist * 0.8
        rs = rng.choice(sets)
        # perto do centro: pedras maiores
        t = dist / max(r, 0.01)
        w = [weights[0] * (1.4 - t), weights[1], weights[2] * (0.6 + t), weights[3] * (0.5 + t)]
        grp = rng.choices(['big', 'mid', 'small', 'flat'], weights=w)[0]
        pool = rs[grp]
        if not pool:
            continue
        kind = rng.choice(pool)
        solid = OBJ[kind]['kind'] == 'stand'
        rr = max(0.3, obj_size(kind)[0] / TILE * 0.4) if solid else 0.1
        if z.reserved(tx, ty) and reserve:
            continue
        z.put(kind, tx, ty, rng.random() < 0.5, radius=rr if solid else None)


# ── Casas ────────────────────────────────────────────────────────────────────

class Building:
    """Uma construção vista de frente: telhado (sala de altura 0 com piso de telha) + fachada (faixa de parede)."""

    def __init__(self, z: Zone, x0: int, y0: int, w: int, roof_d: int = 4, wall_h: int = 3, *, wall: str, wall_trim: str,
                 roof: str, roof_trim: str, overhang: int = 1, floor: str = 'dirt'):
        self.z, self.x0, self.y0, self.w = z, x0, y0, w
        self.x1 = x0 + w
        self.roof_d, self.wall_h = roof_d, wall_h
        z.room(x0 - overhang, y0, self.x1 + overhang, y0 + roof_d, roof, roof, roof_trim, 0)
        self.fy = y0 + roof_d + 1
        z.room(x0, self.fy, self.x1, self.fy + wall_h, floor, wall, wall_trim, wall_h)
        self.base = self.fy + wall_h + 0.65               # onde pisa a porta (y em tiles)
        self.top = y0
        self.bottom = self.fy + wall_h
        z.reserve_rect(x0 - overhang - 0.5, y0 - 0.5, self.x1 + overhang + 1.5, self.fy + wall_h + 1.2)
        z.spots.append(((x0 + self.x1) / 2, (y0 + self.bottom) / 2, max(w, roof_d + wall_h) / 2 + 0.5))

    def door(self, dx: float, kind: str) -> float:
        self.z.put(kind, self.x0 + dx, self.base)
        return self.x0 + dx

    def window(self, dx: float, kind: str, dy: float = -1.25) -> None:
        self.z.put(kind, self.x0 + dx, self.base + dy)

    def front_center(self) -> tuple[float, float]:
        return (self.x0 + self.x1) / 2, self.bottom + 1.0


def tile_fill(z: Zone, tx0: int, ty0: int, tx1: int, ty1: int, terrain: str) -> None:
    z.paint_tiles(terrain, tx0, ty0, tx1, ty1)


# ── Ajudantes de composição ─────────────────────────────────────────────────

def carve(x: float, y: float, holes: list[tuple[float, float, float, float]], soft: float = 0.35) -> float:
    """Fator 0..1 pra abrir clareiras na mata: cada buraco é (cx, cy, rx, ry); dentro = 0, na borda sobe até 1."""
    f = 1.0
    for cx, cy, rx, ry in holes:
        d = math.hypot((x - cx) / rx, (y - cy) / ry)
        if d < 1.0:
            return 0.0
        if d < 1.0 + soft:
            f = min(f, (d - 1.0) / soft)
    return f


def ring(z: Zone, kinds: list[str], cx: float, cy: float, r: float, n: int, jitter: float = 0.15, ry: float | None = None,
         start: float = 0.0, radius: float | None = None) -> None:
    """Põe n peças num círculo (ex.: anel de cogumelos, menires)."""
    ry = ry or r
    for i in range(n):
        a = start + math.tau * i / n
        z.put(z.rng.choice(kinds), cx + math.cos(a) * r + z.rng.uniform(-jitter, jitter), cy + math.sin(a) * ry + z.rng.uniform(-jitter, jitter),
              z.rng.random() < 0.5, radius=radius)


def scatter(z: Zone, kinds: list[str], n: int, box: tuple[float, float, float, float], radius: float = 0.4,
            avoid_reserved: bool = True, near: Path | None = None, near_max: float = 99.0, near_min: float = 0.0) -> int:
    """Espalha `n` peças numa caixa, sem pisar em reservas nem em coisas já postas (e opcionalmente perto de uma trilha)."""
    rng = z.rng
    x0, y0, x1, y1 = box
    placed, tries = 0, 0
    while placed < n and tries < n * 40:
        tries += 1
        tx, ty = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if near is not None:
            d = near.dist(tx, ty)
            if d < near_min or d > near_max:
                continue
        if avoid_reserved and not z.free_disc(tx, ty, radius):
            continue
        z.put(rng.choice(kinds), tx, ty, rng.random() < 0.5, radius=radius)
        placed += 1
    return placed


def cliff_line(z: Zone, pts: list[tuple[float, float]], thick: float = 1.6, sets: list[dict[str, list[str]]] | None = None,
               step: float = 1.5, weights: tuple[float, float, float, float] = (0.45, 0.35, 0.15, 0.05), reserve: float = 0.0) -> None:
    """Parede de rocha: pedras grandes e médias ao longo de uma linha, ombro a ombro (um penhasco visto de cima)."""
    rng = z.rng
    sets = sets or [R_DARK if 'R_DARK' in globals() else R_GRAY]
    path = Path(pts, step=0.3)
    last = None
    acc = 0.0
    for px, py in path.pts:
        if last is not None:
            acc += math.hypot(px - last[0], py - last[1])
        last = (px, py)
        if acc < step and acc != 0.0:
            continue
        acc = 0.0
        for _ in range(3):
            tx, ty = px + rng.uniform(-thick, thick), py + rng.uniform(-thick, thick) * 0.7
            if z.reserved(tx, ty):
                continue
            rs = rng.choice(sets)
            grp = rng.choices(['big', 'mid', 'small', 'flat'], weights=weights)[0]
            pool = rs[grp]
            if not pool:
                continue
            kind = rng.choice(pool)
            solid = OBJ[kind]['kind'] == 'stand'
            z.put(kind, tx, ty, rng.random() < 0.5, radius=(max(0.3, obj_size(kind)[0] / TILE * 0.35) if solid else None))
    if reserve:
        z.reserve_path(path, reserve)


def crop_field(z: Zone, x0: int, y0: int, x1: int, y1: int, crop: str = 'milho', *, fence: str | None = 'fence-4', gap: tuple[int, int, int, int] | None = None,
               row_gap: float = 1.7, step: float = 1.1, density: float = 0.92) -> None:
    """Campo de cultivo: terra arada nos tiles x0..x1 × y0..y1, cerca em volta (com um vão) e fileiras de plantas maduras."""
    z.paint_tiles('farm-plowed', x0, y0, x1, y1)
    if fence:
        z.fence_box(fence, x0 - 1, y0 - 1, x1 + 1, y1 + 1, gaps=[gap] if gap else None)
    z.reserve_rect(x0 - 2, y0 - 2, x1 + 3, y1 + 3)
    ids = find(rf'^plantacao de {crop} [45]$', pack='farm') or find(rf'^plantacao de {crop}', pack='farm')
    if not ids:
        raise KeyError(f'cultivo {crop}')
    ty = y0 + 1.2
    while ty < y1 + 0.6:
        tx = x0 + 0.8
        while tx < x1 + 0.6:
            if z.rng.random() < density:
                z.put(z.rng.choice(ids), tx + z.rng.uniform(-0.1, 0.1), ty + 0.5)
            tx += step
        ty += row_gap
