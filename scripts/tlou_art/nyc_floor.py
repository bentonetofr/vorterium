"""Plantas de interior em grade: salas lado a lado e empilhadas, paredes entre elas e portas, sem salas "soltas".

Um andar é UM cômodo para o motor (a borda do prédio é a única parede de cômodo). As divisórias de dentro são terreno de parede
pintado (sólido), com passagens abertas. Isso evita as bordas de cômodo bloqueando as portas.

Medidas em vértices (1 tile = 1 vértice de distância). Parede vertical entre salas: 2 vértices; parede horizontal: 4 (a face).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .nyc_kit import NZ, TILE, size

H3 = 3                # altura da parede de cima (faixa de 4 linhas)
VGAP = 2              # largura da parede entre salas lado a lado
HGAP = 4              # altura da parede entre salas empilhadas
TOP = 5               # primeira linha de piso (depois da faixa da parede de cima)


@dataclass
class Rect:
    key: str
    x0: int
    y0: int
    x1: int
    y1: int
    role: str = ''
    floor: str | None = None
    cells: list[tuple[int, int]] = field(default_factory=list)

    @property
    def w(self) -> int:
        return self.x1 - self.x0

    @property
    def h(self) -> int:
        return self.y1 - self.y0

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


class Plan:
    """Um andar: grade de salas (`areas`), cada nome é uma sala (nomes repetidos viram uma sala só), None é parede maciça."""

    def __init__(self, zid: str, name: str, st, cols: list[int], rows: list[int], areas: list[list[str | None]], seed: int = 1,
                 roles: dict[str, str] | None = None, floors: dict[str, str] | None = None) -> None:
        self.st = st
        self.cols, self.rows, self.areas = cols, rows, areas
        self.rooms: dict[str, Rect] = {}
        self.doors: list[tuple[int, int, int, int, str]] = []
        xs, ys = [], []
        x = 1
        for w in cols:
            xs.append(x); x += w + VGAP
        y = TOP
        for h in rows:
            ys.append(y); y += h + HGAP
        self.xs, self.ys = xs, ys
        for r, line in enumerate(areas):
            for c, name in enumerate(line):
                if not name:
                    continue
                x0, y0 = xs[c], ys[r]
                x1, y1 = x0 + cols[c], y0 + rows[r]
                rc = self.rooms.get(name)
                if rc is None:
                    self.rooms[name] = Rect(name, x0, y0, x1, y1, (roles or {}).get(name, name), (floors or {}).get(name), [(r, c)])
                else:
                    rc.x0, rc.y0, rc.x1, rc.y1 = min(rc.x0, x0), min(rc.y0, y0), max(rc.x1, x1), max(rc.y1, y1)
                    rc.cells.append((r, c))
        self.width = xs[-1] + cols[-1] + 2
        self.height = ys[-1] + rows[-1] + 2
        self.z = NZ(zid, name, self.width, self.height, 'void', seed)
        self.z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
        self.z.sound = {'auto': True}

    # ── Portas ──
    def door(self, a: str, b: str, at: float = 0.5, span: int = 5, floor: str | None = None) -> None:
        """Abre uma passagem na parede entre as salas a e b (lado a lado ou empilhadas)."""
        A, B = self.rooms[a], self.rooms[b]
        if A.x1 < B.x0:                                   # A à esquerda de B
            lo, hi = max(A.y0, B.y0), min(A.y1, B.y1)
            y = int(round(lo + (hi - lo - span) * at)); y = max(lo, min(hi - span, y))
            self.doors.append((A.x1, y, B.x0, y + span, floor or A.floor or self.st.floor))
        elif B.x1 < A.x0:
            self.door(b, a, at, span, floor)
        elif A.y1 < B.y0:                                 # A em cima de B
            lo, hi = max(A.x0, B.x0), min(A.x1, B.x1)
            x = int(round(lo + (hi - lo - span) * at)); x = max(lo, min(hi - span, x))
            self.doors.append((x, A.y1, x + span, B.y0, floor or A.floor or self.st.floor))
        elif B.y1 < A.y0:
            self.door(b, a, at, span, floor)
        else:
            raise ValueError(f'salas {a} e {b} não se encostam')

    # ── Pintura ──
    def paint(self) -> None:
        z, st = self.z, self.st
        z.room(1, 1, self.width - 2, self.height - 2, st.floor, st.wall, st.ceil, H3)     # o prédio inteiro é um cômodo só
        # tudo que está abaixo da faixa de cima vira parede, menos as salas e as portas
        free = set()
        for rc in self.rooms.values():
            for y in range(rc.y0, rc.y1 + 1):
                for x in range(rc.x0, rc.x1 + 1):
                    free.add((x, y))
            # (células de uma sala que se estende por várias células: o miolo entre elas também é piso)
        for x0, y0, x1, y1, _f in self.doors:
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    free.add((x, y))
        floors = {}
        for rc in self.rooms.values():
            for y in range(rc.y0, rc.y1 + 1):
                for x in range(rc.x0, rc.x1 + 1):
                    floors[(x, y)] = rc.floor or st.floor
        for x0, y0, x1, y1, f in self.doors:
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    floors[(x, y)] = f
        for y in range(TOP, self.height - 1):
            for x in range(1, self.width - 1):
                z.corners[z.at(x, y)] = floors.get((x, y), st.wall) if (x, y) in free else st.wall
        # Sobra de borda: a faixa de cima continua sendo parede (já pintada por z.room)
        # Teto/moldura em tudo e o estilo do cômodo em todos os vértices do prédio (z.room já fez)

    # ── Ajudantes de móveis ──
    def _put(self, kind: str, x: float, y: float, flip: bool = False) -> None:
        self.z.put(kind, x, y, flip)

    def north(self, R: Rect, kinds: list[str], x0: float | None = None, x1: float | None = None, gap: float = 0.15, skip_edges: float = 0.2) -> int:
        """Fileira encostada na parede de cima da sala (a base do móvel fica um pouco abaixo da face da parede)."""
        x = (R.x0 if x0 is None else x0) + skip_edges
        end = (R.x1 if x1 is None else x1) - skip_edges
        n = 0
        for k in kinds:
            w, h = size(k)
            if x + w / TILE > end + 1e-6:
                break
            self._put(k, x + w / TILE / 2, R.y0 + h / TILE * 0.62 + 0.15)
            x += w / TILE + gap
            n += 1
        return n

    def south(self, R: Rect, kinds: list[str], x0: float | None = None, x1: float | None = None, gap: float = 0.15) -> int:
        x = (R.x0 if x0 is None else x0) + 0.2
        end = (R.x1 if x1 is None else x1) - 0.2
        n = 0
        for k in kinds:
            w, h = size(k)
            if x + w / TILE > end + 1e-6:
                break
            self._put(k, x + w / TILE / 2, R.y1 - 0.15)
            x += w / TILE + gap
            n += 1
        return n

    def west(self, R: Rect, kinds: list[str], y0: float | None = None, y1: float | None = None, gap: float = 0.1, flip: bool = False) -> int:
        y = (R.y0 if y0 is None else y0) + 0.3
        end = (R.y1 if y1 is None else y1) - 0.1
        n = 0
        for k in kinds:
            w, h = size(k)
            if y + h / TILE * 0.6 > end + 1e-6:
                break
            self._put(k, R.x0 + w / TILE / 2 + 0.15, y + h / TILE * 0.7, flip)
            y += h / TILE * 0.6 + gap
            n += 1
        return n

    def east(self, R: Rect, kinds: list[str], y0: float | None = None, y1: float | None = None, gap: float = 0.1) -> int:
        y = (R.y0 if y0 is None else y0) + 0.3
        end = (R.y1 if y1 is None else y1) - 0.1
        n = 0
        for k in kinds:
            w, h = size(k)
            if y + h / TILE * 0.6 > end + 1e-6:
                break
            self._put(k, R.x1 - w / TILE / 2 - 0.15, y + h / TILE * 0.7, True)
            y += h / TILE * 0.6 + gap
            n += 1
        return n

    def grid(self, R: Rect, kind: str, dx: float, dy: float, ix: float = 1.5, iy: float = 2.2, bx: float = 1.5, by: float = 1.0,
             flip_alt: bool = False) -> int:
        """Grade de móveis dentro da sala (margens ix/iy dos lados e bx/by embaixo)."""
        n = 0
        y = R.y0 + iy
        r = 0
        while y <= R.y1 - by + 1e-6:
            x = R.x0 + ix
            while x <= R.x1 - bx + 1e-6:
                self._put(kind, x, y, flip_alt and r % 2 == 1)
                n += 1
                x += dx
            y += dy
            r += 1
        return n

    def rug(self, R: Rect, rug_id: str, inset: int = 2) -> None:
        z = self.z
        for y in range(R.y0 + inset, R.y1 - inset + 1):
            for x in range(R.x0 + inset, R.x1 - inset + 1):
                z.overlay[z.at(x, y)] = rug_id

    def windows(self, R: Rect, every: float = 7.0, lit: bool = True, kinds: tuple[str, str] = ('wd@528,25', 'wd@608,25')) -> None:
        """Janelas na parede de cima da sala (só vale pras salas da fileira de cima, que dão pra rua)."""
        wy = R.y0 - 0.5
        x = R.x0 + 2.5
        i = 0
        while x <= R.x1 - 2.0:
            self.z.put(kinds[i % 2], x, wy)
            if lit:
                self.z.light(f'jan-{R.key}-{i}', x, R.y0 + 1.2, 120, '#9cc4ff', 0.28, 0.05)
            x += every
            i += 1

    def wall_decor(self, R: Rect, kinds: list[str], n: int, y_off: float = -0.7) -> None:
        """Quadros, avisos, espelhos na parede de cima."""
        if n <= 0 or R.w < 6:
            return
        step = R.w / (n + 1)
        for i in range(n):
            self.z.put(kinds[i % len(kinds)], R.x0 + step * (i + 1), R.y0 + y_off)

    def light(self, R: Rect, color: str = '#ffd9a0', intensity: float = 0.4, radius: int = 170, flicker: float = 0.1, at: tuple[float, float] | None = None) -> None:
        x, y = at or (R.cx, R.cy)
        self.z.light(f'l-{R.key}-{int(x)}-{int(y)}', x, y, radius, color, intensity, flicker)

    def stairs(self, R: Rect, up: bool = True, down: bool = False) -> None:
        """Escada(s) no canto de cima da sala: o desenho encosta na parede e a saída (portal) fica logo abaixo."""
        sx = R.x1 - 2.6
        out: dict[str, tuple[float, float, float, float]] = {}
        if up:
            self.z.put('stairs@0,0', sx, R.y0 + 2.0)
            out['up'] = (sx, R.y0 + 2.4, 3.0, 1.4)
        if down:
            sdx = sx - (4.2 if up else 0)
            self.z.put('stairs@0,64', sdx, R.y0 + 2.0)
            out['dn'] = (sdx, R.y0 + 2.4, 3.0, 1.4)
        self.z.stair = out                     # type: ignore[attr-defined]

    def enter_rect(self, R: Rect, cx: float | None = None) -> tuple[float, float, float, float]:
        """Retângulo de saída (portal) perto da borda de baixo do prédio, dentro da sala."""
        return (R.cx if cx is None else cx, R.y1 - 1.7, 4.0, 1.6)
