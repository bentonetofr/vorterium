"""Confere o mundo gerado: dá pra ir de uma saída a outra andando? Os NPCs e o início não estão presos?

Refaz, em miniatura, as regras de colisão do motor (terrenos sólidos como água e parede, borda de cômodo, cercas, retângulos
sólidos dos objetos, o pé do boneco 18×10) numa grade de 8 px e roda uma busca em largura.

    python -m saltmore.verify            (de dentro de scripts/)
"""
from __future__ import annotations

import json
import os
import sys
from collections import deque

from .lib import OBJ, ROOT, TILE, _terrains  # noqa: PLC2701

CELL = 8
FEET = (9, 5)                       # metade da caixa dos pés (18×10)
SOLID = {'water-light', 'water', 'water-deep', 'water-poison', 'lava', 'hole', 'pit', 'void'} | {t['id'] for t in _terrains if t.get('solid')}


class Grid:
    def __init__(self, zone: dict):
        self.z = zone
        self.w, self.h = zone['width'], zone['height']
        self.cw, self.ch = self.w * TILE // CELL, self.h * TILE // CELL
        self.blocked = bytearray(self.cw * self.ch)
        self.vw = self.w + 1
        self.build()

    def rect(self, x0: float, y0: float, x1: float, y1: float) -> None:
        """Bloqueia o retângulo (px do mundo), já engordado pela metade da caixa dos pés."""
        x0, x1 = x0 - FEET[0], x1 + FEET[0]
        y0, y1 = y0 - FEET[1], y1 + FEET[1]
        cx0, cx1 = max(0, int((x0 - CELL / 2) // CELL) + 1), min(self.cw - 1, int((x1 - CELL / 2) // CELL))
        cy0, cy1 = max(0, int((y0 - CELL / 2) // CELL) + 1), min(self.ch - 1, int((y1 - CELL / 2) // CELL))
        for cy in range(cy0, cy1 + 1):
            row = cy * self.cw
            for cx in range(cx0, cx1 + 1):
                self.blocked[row + cx] = 1

    def corner(self, vx: int, vy: int) -> str:
        return self.z['corners'][vy * self.vw + vx] or self.z['base']

    def build(self) -> None:
        z = self.z
        rooms = z.get('rooms') or []
        for ty in range(self.h):
            for tx in range(self.w):
                vs = [(tx, ty), (tx + 1, ty), (tx, ty + 1), (tx + 1, ty + 1)]
                solid = any(self.corner(vx, vy) in SOLID for vx, vy in vs)
                if not solid and rooms:
                    n = sum(1 for vx, vy in vs if rooms[vy * self.vw + vx])
                    solid = 0 < n < 4
                if solid:
                    self.rect(tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE)
        fences = z.get('fences') or []
        for ty in range(self.h):
            for tx in range(self.w):
                f = fences[ty * self.w + tx] if fences else ''
                if not f:
                    continue
                cx, cy = tx * TILE + TILE / 2, ty * TILE + TILE / 2
                self.rect(cx - 5, cy - 5, cx + 5, cy + 5)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = tx + dx, ty + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and fences[ny * self.w + nx] == f:
                        self.rect(min(cx, cx + dx * TILE / 2) - (4 if dy else 0), min(cy, cy + dy * TILE / 2) - (4 if dx else 0),
                                  max(cx, cx + dx * TILE / 2) + (4 if dy else 0), max(cy, cy + dy * TILE / 2) + (4 if dx else 0))
        for o in z['objects']:
            if o.get('z'):
                continue
            d = OBJ.get(o['kind'])
            if not d:
                continue
            for r in d['solids']:
                rx = -(r['x'] + r['w']) if o.get('flip') else r['x']
                self.rect(o['x'] + rx, o['y'] + r['y'], o['x'] + rx + r['w'], o['y'] + r['y'] + r['h'])

    def free(self, px: float, py: float) -> bool:
        cx, cy = int(px // CELL), int(py // CELL)
        return 0 <= cx < self.cw and 0 <= cy < self.ch and not self.blocked[cy * self.cw + cx]

    def flood(self, px: float, py: float) -> bytearray | None:
        """Células alcançáveis a partir de um ponto (ou do livre mais perto dele, num raio de 2 tiles)."""
        sx, sy = int(px // CELL), int(py // CELL)
        start = None
        for r in range(0, 9):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    cx, cy = sx + dx, sy + dy
                    if 0 <= cx < self.cw and 0 <= cy < self.ch and not self.blocked[cy * self.cw + cx]:
                        start = (cx, cy)
                        break
                if start:
                    break
            if start:
                break
        if not start:
            return None
        seen = bytearray(self.cw * self.ch)
        seen[start[1] * self.cw + start[0]] = 1
        q = deque([start])
        cw, ch, bl = self.cw, self.ch, self.blocked
        while q:
            cx, cy = q.popleft()
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < cw and 0 <= ny < ch:
                    i = ny * cw + nx
                    if not seen[i] and not bl[i]:
                        seen[i] = 1
                        q.append((nx, ny))
        return seen

    def reach(self, seen: bytearray, px: float, py: float, radius: float = 40) -> bool:
        """Algum ponto livre alcançável a até `radius` px do ponto?"""
        cx0, cy0 = int(px // CELL), int(py // CELL)
        r = int(radius // CELL)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                cx, cy = cx0 + dx, cy0 + dy
                if 0 <= cx < self.cw and 0 <= cy < self.ch and seen[cy * self.cw + cx]:
                    return True
        return False


def portal_center(p: dict) -> tuple[float, float]:
    return p['x'] + p['w'] / 2, p['y'] + p['h'] / 2


def verify(path: str) -> int:
    d = json.load(open(path, encoding='utf-8'))
    zones = {z['id']: z for z in d['zones']}
    grids = {zid: Grid(z) for zid, z in zones.items()}
    problems = 0
    for zid, z in zones.items():
        g = grids[zid]
        pts = [(p['id'], *portal_center(p)) for p in z['portals']]
        spawn = (z['spawn']['x'], z['spawn']['y'])
        origin = pts[0] if pts else ('spawn', *spawn)
        seen = g.flood(origin[1], origin[2])
        if seen is None:
            print(f'  XX {zid}: nada livre perto de {origin[0]}')
            problems += 1
            continue
        ok = []
        for name, x, y in pts + [('spawn', *spawn)]:
            if g.reach(seen, x, y, 28):
                ok.append(name)
            else:
                print(f'  XX {zid}: "{name}" ({x / TILE:.1f}, {y / TILE:.1f}) não é alcançável a pé a partir de "{origin[0]}"')
                problems += 1
        for n in z.get('npcs', []):
            if not g.reach(seen, n['x'], n['y'], 24):
                print(f'  ! {zid}: NPC "{n["name"]}" ({n["x"] / TILE:.1f}, {n["y"] / TILE:.1f}) fica fora da área andável')
                problems += 1
        for o in z['objects']:
            d = OBJ.get(o['kind'])
            if d and d['pack'] == 'doors' and (d['label'].startswith('Porta') or d['label'].startswith('Arco e batente')) and not o.get('z'):
                if not g.reach(seen, o['x'], o['y'] + 18, 22):
                    print(f'  ! {zid}: a porta em ({o["x"] / TILE:.1f}, {o["y"] / TILE:.1f}) não tem chão andável na frente')
                    problems += 1
        print(f'  {"OK" if len(ok) == len(pts) + 1 else "XX"} {zid}: {len(ok)}/{len(pts) + 1} pontos ligados; livre {100 * sum(seen) / len(seen):.0f}% da área')
    return problems


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'public', 'vortable', 'maps', 'saltmore.mundo.json')
    n = verify(target)
    print('SEM PROBLEMAS' if n == 0 else f'{n} problema(s)')
    sys.exit(1 if n else 0)
