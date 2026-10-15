"""Ferramentas pra montar o mundo "Saltmore" (zonas do Vortable geradas por código).

Mesmo formato do TORVALLEN e dos mundos do pacote Apocalipse (`vortable-world`), só que pensado pra ar livre:
trilhas que serpenteiam, florestas por ruído, casas de pedra com telhado, cercas, pontes e águas.
Tudo usa o que já existe nos catálogos (public/vortable/assets/catalog): nenhuma arte nova.
"""
from __future__ import annotations

import json
import math
import os
import random

TILE = 32
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ASSETS = os.path.join(ROOT, 'public', 'vortable', 'assets')

# ── Catálogos (pra conferir ids e saber o tamanho de cada peça) ────────────────

_objs = json.load(open(os.path.join(ASSETS, 'catalog', 'objects.json'), encoding='utf-8'))['objects']
OBJ: dict[str, dict] = {o['id']: o for o in _objs}
_terrains = json.load(open(os.path.join(ASSETS, 'catalog', 'terrains.json'), encoding='utf-8'))['terrains']

# terrenos que vêm de dentro do motor (não estão no terrains.json)
BUILTIN_TERRAINS = {
    'grass', 'grass-light', 'grass-dark', 'grass-dry', 'dirt-weeds', 'dirt-soft', 'dirt', 'dirt-light', 'dirt-red',
    'sand', 'sand-rocky', 'snow', 'snow-gray', 'gravel-light', 'gravel', 'gravel-dark', 'gravel-black', 'pebbles',
    'cobble-light', 'cobble-sand', 'stone-moss', 'stone-brown', 'swamp', 'water-light', 'water', 'water-deep',
    'water-poison', 'lava', 'hole', 'pit', 'void', 'floor-wood', 'floor-stone', 'rug-purple', 'rug-blue', 'rug-red',
    'wall-brick', 'wall-stone',
}
TERRAIN_IDS = BUILTIN_TERRAINS | {t['id'] for t in _terrains}
FENCE_IDS = {t['id'] for t in _terrains if t.get('layer') == 'fence' or t['id'].startswith('fence-')}


def obj_size(kind: str) -> tuple[int, int]:
    o = OBJ[kind]
    return o['w'], o['h']


def check_obj(kind: str) -> str:
    if kind not in OBJ:
        raise KeyError(f'objeto inexistente no catálogo: {kind}')
    return kind


def check_terrain(t: str) -> str:
    if t and t not in TERRAIN_IDS:
        raise KeyError(f'terreno inexistente no catálogo: {t}')
    return t


# ── Ruído ─────────────────────────────────────────────────────────────────────

def _hash(ix: int, iy: int, seed: int) -> float:
    n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF


def vnoise(x: float, y: float, seed: int) -> float:
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy


def fbm(x: float, y: float, seed: int, octaves: int = 3) -> float:
    total, amp, norm, f = 0.0, 1.0, 0.0, 1.0
    for i in range(octaves):
        total += vnoise(x * f, y * f, seed + i * 101) * amp
        norm += amp
        amp *= 0.5
        f *= 2.0
    return total / norm


# ── Trilhas ──────────────────────────────────────────────────────────────────

class Path:
    """Linha suave (Catmull-Rom) por pontos de controle, em tiles."""

    def __init__(self, pts: list[tuple[float, float]], step: float = 0.4):
        self.ctrl = pts
        p = [pts[0]] + pts + [pts[-1]]
        out: list[tuple[float, float]] = []
        for i in range(1, len(p) - 2):
            p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
            seg = math.dist(p1, p2)
            n = max(2, int(seg / step))
            for k in range(n):
                t = k / n
                t2, t3 = t * t, t * t * t
                out.append((
                    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
                ))
        out.append(pts[-1])
        self.pts = out

    def dist(self, x: float, y: float) -> float:
        best = 1e9
        for px, py in self.pts:
            d = (px - x) ** 2 + (py - y) ** 2
            if d < best:
                best = d
        return math.sqrt(best)

    def near(self, x: float, y: float, r: float) -> bool:
        r2 = r * r
        return any((px - x) ** 2 + (py - y) ** 2 <= r2 for px, py in self.pts)

    def at(self, f: float) -> tuple[float, float]:
        """Ponto a uma fração f (0..1) do comprimento (por amostra)."""
        i = max(0, min(len(self.pts) - 1, int(round(f * (len(self.pts) - 1)))))
        return self.pts[i]


# ── Zona ─────────────────────────────────────────────────────────────────────

class Zone:
    def __init__(self, zid: str, name: str, w: int, h: int, base: str, seed: int):
        self.id, self.name, self.w, self.h, self.base, self.seed = zid, name, w, h, check_terrain(base), seed
        self.vw, self.vh = w + 1, h + 1
        self.corners = [''] * (self.vw * self.vh)
        self.overlay = [''] * (self.vw * self.vh)
        self.rooms = [''] * (self.vw * self.vh)
        self.fences = [''] * (w * h)
        self.objects: list[dict] = []
        self.lights: list[dict] = []
        self.portals: list[dict] = []
        self.npcs: list[dict] = []
        self.spawn = {'x': w * TILE // 2, 'y': h * TILE // 2}
        self.lighting: dict = {'place': 'outdoor', 'particles': True, 'clouds': True, 'wind': 0.3}
        self.sound: dict = {'auto': True}
        self.rng = random.Random(seed)
        # tiles onde não se espalha mato/árvore (trilha, casas, água): 1 = ocupado
        self.keep = bytearray(w * h)
        self.spots: list[tuple[float, float, float]] = []   # círculos (x, y, raio) de coisas colocadas, em tiles

    # ── vértices ──
    def at(self, x: int, y: int) -> int:
        return y * self.vw + x

    def terrain_at(self, vx: int, vy: int) -> str:
        return self.corners[self.at(vx, vy)] or self.base

    def paint(self, terrain: str, x0: int, y0: int, x1: int, y1: int) -> None:
        check_terrain(terrain)
        for y in range(max(0, y0), min(self.vh - 1, y1) + 1):
            for x in range(max(0, x0), min(self.vw - 1, x1) + 1):
                self.corners[self.at(x, y)] = terrain

    def paint_tiles(self, terrain: str, tx0: int, ty0: int, tx1: int, ty1: int) -> None:
        """Pinta os tiles tx0..tx1 × ty0..ty1 (inclusive) inteiros (os cantos de todos eles)."""
        self.paint(terrain, tx0, ty0, tx1 + 1, ty1 + 1)

    def brush(self, terrain: str, pts: list[tuple[float, float]], r: float, wobble: float = 0.0, seed: int = 0,
              only: set[str] | None = None) -> None:
        """Pincel redondo de raio `r` (em tiles) em cada ponto; `wobble` deixa a borda irregular (0..1)."""
        check_terrain(terrain)
        reach = int(r + 3)
        done: set[tuple[int, int]] = set()
        for px, py in pts:
            for vy in range(int(py) - reach, int(py) + reach + 1):
                for vx in range(int(px) - reach, int(px) + reach + 1):
                    if not (0 <= vx < self.vw and 0 <= vy < self.vh) or (vx, vy) in done:
                        continue
                    rr = r * (1 + (fbm(vx / 3.0, vy / 3.0, seed + self.seed, 2) - 0.5) * wobble)
                    if math.hypot(vx - px, vy - py) <= rr:
                        if only is not None and self.terrain_at(vx, vy) not in only:
                            continue
                        self.corners[self.at(vx, vy)] = terrain
                        done.add((vx, vy))

    def trail(self, path: Path, width: float, terrain: str = 'dirt', wobble: float = 0.35, seed: int = 5,
              keep_extra: float = 1.2) -> None:
        """Trilha de terra: pinta o caminho e reserva a faixa (sem árvores em cima)."""
        self.brush(terrain, path.pts, width / 2, wobble, seed)
        self.reserve_path(path, width / 2 + keep_extra)

    def noise(self, terrain: str, scale: float, thr: float, seed: int, box: tuple[int, int, int, int] | None = None,
              only: set[str] | str | None = None) -> None:
        check_terrain(terrain)
        if isinstance(only, str):
            only = {only}
        x0, y0, x1, y1 = box or (0, 0, self.vw - 1, self.vh - 1)
        for y in range(max(0, y0), min(self.vh - 1, y1) + 1):
            for x in range(max(0, x0), min(self.vw - 1, x1) + 1):
                if only is not None and self.terrain_at(x, y) not in only:
                    continue
                if fbm(x / scale, y / scale, seed, 3) > thr:
                    self.corners[self.at(x, y)] = terrain

    def disc(self, terrain: str, cx: float, cy: float, r: float, wobble: float = 0.5, seed: int = 0,
             only: set[str] | None = None) -> None:
        self.brush(terrain, [(cx, cy)], r, wobble, seed, only)

    def room(self, x0: int, y0: int, x1: int, y1: int, floor: str, wall: str, ceil: str, height: int = 4) -> None:
        """Cômodo como o editor grava: parede nas primeiras `height + 1` linhas, piso no resto, moldura por cima."""
        check_terrain(floor); check_terrain(wall); check_terrain(ceil)
        style = f'{floor}|{wall}|{ceil}|{height}'
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                i = self.at(x, y)
                self.corners[i] = wall if y <= y0 + height else floor
                self.overlay[i] = ceil
                self.rooms[i] = style

    def door(self, x0: int, x1: int, y0: int, y1: int, floor: str) -> None:
        """Vão numa parede: piso nos vértices (a moldura e o cômodo continuam)."""
        check_terrain(floor)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.corners[self.at(x, y)] = floor

    def side_door(self, gx0: int, gx1: int, ytop: int, ybot: int, floor: str) -> None:
        """Passagem lateral entre duas salas (ver nyc_buildings.side_door do pacote Apocalipse)."""
        self.door(gx0, gx1, ytop, ybot, floor)
        style = self.rooms[self.at(gx0 - 1, ytop)]
        for y in range(ytop, ybot + 1):
            self.rooms[self.at(gx0, y)] = style
            if y > ytop:
                self.rooms[self.at(gx1, y)] = style

    # ── cercas (uma por TILE) ──
    def fence(self, fid: str, tx0: int, ty0: int, tx1: int, ty1: int) -> None:
        """Cerca em linha reta (horizontal ou vertical) ou retângulo se for 2D: aqui só as bordas de cada eixo."""
        if fid not in FENCE_IDS:
            raise KeyError(f'cerca inexistente: {fid}')
        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                if 0 <= tx < self.w and 0 <= ty < self.h:
                    self.fences[ty * self.w + tx] = fid

    def fence_box(self, fid: str, tx0: int, ty0: int, tx1: int, ty1: int, gaps: list[tuple[int, int, int, int]] | None = None) -> None:
        """Contorno retangular de cerca (tiles inclusivos), com vãos opcionais (retângulos de tiles apagados)."""
        self.fence(fid, tx0, ty0, tx1, ty0)
        self.fence(fid, tx0, ty1, tx1, ty1)
        self.fence(fid, tx0, ty0, tx0, ty1)
        self.fence(fid, tx1, ty0, tx1, ty1)
        for gx0, gy0, gx1, gy1 in gaps or []:
            self.clear_fence(gx0, gy0, gx1, gy1)

    def clear_fence(self, tx0: int, ty0: int, tx1: int, ty1: int) -> None:
        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                if 0 <= tx < self.w and 0 <= ty < self.h:
                    self.fences[ty * self.w + tx] = ''

    def fence_path(self, fid: str, pts: list[tuple[float, float]]) -> None:
        """Cerca seguindo uma linha poligonal (liga tile a tile)."""
        if fid not in FENCE_IDS:
            raise KeyError(f'cerca inexistente: {fid}')
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            n = max(1, int(max(abs(bx - ax), abs(by - ay)) * 2))
            for i in range(n + 1):
                tx, ty = int(ax + (bx - ax) * i / n), int(ay + (by - ay) * i / n)
                if 0 <= tx < self.w and 0 <= ty < self.h:
                    self.fences[ty * self.w + tx] = fid

    # ── reservas (onde não nasce mato) ──
    def reserve_rect(self, tx0: float, ty0: float, tx1: float, ty1: float) -> None:
        for ty in range(max(0, int(ty0)), min(self.h, int(math.ceil(ty1)))):
            for tx in range(max(0, int(tx0)), min(self.w, int(math.ceil(tx1)))):
                self.keep[ty * self.w + tx] = 1

    def reserve_disc(self, cx: float, cy: float, r: float) -> None:
        for ty in range(max(0, int(cy - r)), min(self.h, int(cy + r) + 1)):
            for tx in range(max(0, int(cx - r)), min(self.w, int(cx + r) + 1)):
                if math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) <= r:
                    self.keep[ty * self.w + tx] = 1

    def reserve_path(self, path: Path, r: float) -> None:
        for px, py in path.pts:
            self.reserve_disc(px, py, r)

    def reserved(self, tx: float, ty: float) -> bool:
        ix, iy = int(tx), int(ty)
        if not (0 <= ix < self.w and 0 <= iy < self.h):
            return True
        return bool(self.keep[iy * self.w + ix])

    def free_disc(self, tx: float, ty: float, r: float) -> bool:
        """Dá pra pôr algo de raio r aqui? (sem reserva e sem bater em coisa já colocada)"""
        if self.reserved(tx, ty):
            return False
        for sx, sy, sr in self.spots:
            if (tx - sx) ** 2 + (ty - sy) ** 2 < (r + sr) ** 2:
                return False
        return True

    # ── objetos e luzes (em tiles) ──
    def put(self, kind: str, tx: float, ty: float, flip: bool = False, z: int | None = None, radius: float | None = None) -> dict:
        check_obj(kind)
        if not (-1.5 <= tx <= self.w + 1.5 and -1.0 <= ty <= self.h + 1.5):
            return {}                                   # fora da zona: nem entra
        o: dict = {'kind': kind, 'x': round(tx * TILE), 'y': round(ty * TILE)}
        if flip:
            o['flip'] = True
        if z:
            o['z'] = z
        self.objects.append(o)
        if radius is not None:
            self.spots.append((tx, ty, radius))
        return o

    def put_reserve(self, kind: str, tx: float, ty: float, flip: bool = False, z: int | None = None, r: float | None = None) -> dict:
        """Põe o objeto e reserva o chão que ele ocupa (raio padrão = metade da largura)."""
        w, h = obj_size(kind)
        rr = r if r is not None else max(0.4, min(w, 160) / TILE / 2 * 0.8)
        o = self.put(kind, tx, ty, flip, z, radius=rr)
        return o

    def row(self, kind: str, x0: float, x1: float, ty: float, gap: float = 0.0, flip_alt: bool = False) -> int:
        w = obj_size(kind)[0] / TILE
        x, n = x0 + w / 2, 0
        while x + w / 2 <= x1 + 1e-6:
            self.put(kind, x, ty, flip_alt and n % 2 == 1)
            x += w + gap
            n += 1
        return n

    def light(self, lid: str, tx: float, ty: float, radius: int, color: str, intensity: float, flicker: float = 0) -> None:
        self.lights.append({'id': lid, 'x': round(tx * TILE), 'y': round(ty * TILE), 'radius': radius,
                            'color': color, 'intensity': intensity, 'flicker': flicker})

    def portal(self, pid: str, name: str, tx: float, ty: float, tw: float, th: float, to: tuple[str, str] | None) -> None:
        self.portals.append({'id': pid, 'name': name, 'x': round(tx * TILE), 'y': round(ty * TILE),
                             'w': round(tw * TILE), 'h': round(th * TILE),
                             'to': {'zone': to[0], 'portal': to[1]} if to else None})

    def npc(self, nid: str, name: str, role: str, appearance: dict, tx: float, ty: float, d: str = 'down') -> None:
        self.npcs.append({'id': nid, 'name': name, 'role': role, 'appearance': appearance,
                          'x': round(tx * TILE), 'y': round(ty * TILE), 'dir': d})

    def data(self) -> dict:
        z = {
            'version': 1, 'id': self.id, 'name': self.name, 'width': self.w, 'height': self.h, 'base': self.base,
            'corners': self.corners, 'overlay': self.overlay, 'rooms': self.rooms, 'objects': self.objects,
            'lighting': self.lighting, 'sound': self.sound, 'lights': self.lights, 'portals': self.portals,
            'spawn': self.spawn,
        }
        if any(self.fences):
            z['fences'] = self.fences
        if self.npcs:
            z['npcs'] = self.npcs
        return z


def link(a: Zone, ida: str, ra: tuple, na: str, b: Zone, idb: str, rb: tuple, nb: str) -> None:
    """Liga duas zonas por saídas que se apontam. r = (cx, y de cima, largura, altura) em tiles."""
    a.portal(ida, na, ra[0] - ra[2] / 2, ra[1], ra[2], ra[3], (b.id, idb))
    b.portal(idb, nb, rb[0] - rb[2] / 2, rb[1], rb[2], rb[3], (a.id, ida))


def write_world(path: str, wid: str, name: str, zones: list[Zone], layout: dict[str, tuple[int, int]], start: str,
                sky: dict | None = None) -> None:
    world: dict = {'version': 1, 'id': wid, 'name': name, 'start': start,
                   'layout': {zid: {'x': x, 'y': y} for zid, (x, y) in layout.items()}}
    if sky:
        world['sky'] = sky
    bundle = {'format': 'vortable-world', 'version': 1, 'world': world, 'zones': [z.data() for z in zones]}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')))
    n_obj = sum(len(z.objects) for z in zones)
    print(f'mundo: {len(zones)} zonas, {n_obj} objetos, {sum(len(z.npcs) for z in zones)} NPCs -> {os.path.relpath(path, ROOT)}')
