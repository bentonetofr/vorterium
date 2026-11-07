"""As árvores imensas de Midfold, os pinheirinhos lá longe e nada mais."""
from __future__ import annotations

import math

from saltmore.kit import find, need
from saltmore.lib import Zone, fbm

COLOSSAL = need(find(r'^arvore colossal', sheet='trees-green'), 'árvores colossais')
GIANT_OAKS = need(find(r'^carvalho (frondoso|gigante)', sheet='trees-green'), 'carvalhos gigantes')
LITTLE_PINES = need(find(r'^pinheiro jovem$', sheet='trees-green'), 'pinheiros jovens')

GIANT_REACH = (9.0, 15.5, 1.5)           # a copa de um gigante cobre x ± 9 e vai 15.5 tiles pra cima, 1.5 pra baixo
OAK_REACH = (4.8, 7.0, 1.2)


def _clear(z: Zone, x: float, y: float, reach: tuple[float, float, float], margin: float = 1.0) -> bool:
    """A copa não pode cobrir trilha, estrada, acampamento nem passar pro vizinho (retângulo amostrado de 1 em 1 tile)."""
    rx, up, down = reach
    sx = int(x - rx - margin)
    while sx <= x + rx + margin:
        sy = int(y - up - margin)
        while sy <= y + down + margin:
            if 0 <= sx < z.w and 0 <= sy < z.h and z.reserved(sx, sy):
                return False
            sy += 1
        sx += 1
    return True


def _giant(z: Zone, x: float, y: float) -> None:
    """Uma árvore imensa: cinco colossais com os troncos colados e as copas fundidas numa massa só (atrás primeiro)."""
    rng = z.rng
    spots = [(-2.7, -2.0), (2.7, -1.8), (0.0, -2.8), (-1.2, 0.4), (1.3, 0.6)]
    for dx, dy in spots:
        z.put(rng.choice(COLOSSAL), x + dx, y + dy, rng.random() < 0.5, radius=2.2)


def populate(z: Zone) -> None:
    rng = z.rng
    placed: list[tuple[float, float, float]] = []                         # (x, y, raio de respeito) das árvores grandes

    def spaced(x: float, y: float, r: float) -> bool:
        return all((x - px) ** 2 + (y - py) ** 2 > (r + pr) ** 2 for px, py, pr in placed)

    # as imensas: muito espaçadas, em pontos que pedem a vista aberta
    want, tries = 5, 0
    while sum(1 for p in placed if p[2] >= 10) < want and tries < 600:
        tries += 1
        x, y = rng.uniform(9, z.w - 9), rng.uniform(15, z.h - 3)
        if _clear(z, x, y, GIANT_REACH) and spaced(x, y, 11):
            _giant(z, x, y)
            placed.append((x, y, 11))
            z.reserve_disc(x, y, 3.2)

    # carvalhos gigantes soltos (menores), pra quebrar a repetição
    want, tries, n = 4, 0, 0
    while n < want and tries < 600:
        tries += 1
        x, y = rng.uniform(6, z.w - 6), rng.uniform(9, z.h - 2)
        if _clear(z, x, y, OAK_REACH) and spaced(x, y, 6):
            z.put(rng.choice(GIANT_OAKS), x, y, rng.random() < 0.5, radius=1.6)
            placed.append((x, y, 6))
            z.reserve_disc(x, y, 1.8)
            n += 1

    # pinheirinhos lá longe, em grupos pequenos, longe da trilha
    groups, tries = 0, 0
    while groups < 4 and tries < 400:
        tries += 1
        cx, cy = rng.uniform(6, z.w - 6), rng.uniform(8, z.h - 3)
        if not _clear(z, cx, cy, (3.5, 4.5, 1.0), margin=2.0) or not spaced(cx, cy, 4.5):
            continue
        for _ in range(rng.randint(3, 6)):
            x, y = cx + rng.uniform(-3, 3), cy + rng.uniform(-2, 2)
            if all((x - px) ** 2 + (y - py) ** 2 > 1.4 ** 2 for px, py, pr in placed if pr < 3):
                z.put(rng.choice(LITTLE_PINES), x, y, rng.random() < 0.5, radius=0.7)
                placed.append((x, y, 1.2))
        placed.append((cx, cy, 3.5))
        groups += 1
