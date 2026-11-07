"""O acampamento do fim da estrada: tendas, a fogueira e onde sentar. Só o que um acampamento tem."""
from __future__ import annotations

from saltmore.kit import one
from saltmore.lib import Path, Zone

TENT_BIG = 'med-deco@9,1604'
TENT_SMALL = 'med-deco@245,1604'
TENT_POINTED = 'med-deco@386,1733'
FIRE = 'med-deco@256,1536'
TRIPOD = 'med-deco@448,1510'
FIREWOOD = 'med-deco@322,1576'
LOG = 'med-deco@421,680'
BENCH = 'med-deco@193,1091'
WOODPILE = 'med-deco@455,646'


def build(z: Zone, road: Path) -> None:
    # o ponto do fogo: à direita da estrada, mais ou menos na altura 56
    fx, fy = 78.0, 56.0
    # um ramal de terra batida liga a estrada ao acampamento
    rx, ry = min(road.pts, key=lambda p: (p[0] - (fx - 9)) ** 2 + (p[1] - fy) ** 2)
    spur = Path([(rx + 3.4, ry + 0.3), ((rx + fx) / 2 - 2, (ry + fy) / 2 + 0.8), (fx - 7.5, fy + 0.5)])
    z.brush('dirt', spur.pts, 1.5, 0.3, 203, only={'grass-light', 'grass', 'dirt'})
    z.reserve_path(spur, 3.5)
    z.brush('dirt-light', spur.pts[::2], 1.0, 0.4, 205, only={'dirt'})
    # clareira de terra batida em volta do fogo
    z.disc('dirt', fx, fy - 2, 11.0, 0.25, 201, only={'grass-light', 'grass'})
    z.disc('dirt-light', fx, fy - 1, 5.2, 0.3, 202, only={'dirt'})
    z.reserve_disc(fx, fy, 13.0)
    z.reserve_rect(fx - 18, fy - 14, fx + 17, fy + 8)
    z.put(FIRE, fx, fy, radius=1.0)
    z.put(FIREWOOD, fx - 1.6, fy + 0.9)
    z.put(TRIPOD, fx + 2.8, fy - 0.2, radius=1.2)
    z.put(BENCH, fx - 0.2, fy + 4.2)
    z.put(LOG, fx - 4.8, fy + 0.8)
    z.put(LOG, fx + 4.9, fy + 2.6, True)
    # tendas em arco atrás do fogo, de frente pra ele
    z.put(TENT_BIG, fx - 7.0, fy - 5.0, radius=3.2)
    z.put(TENT_POINTED, fx + 1.0, fy - 7.0, radius=2.4)
    z.put(TENT_SMALL, fx + 9.0, fy - 4.0, radius=2.4)
    z.put(WOODPILE, fx + 7.0, fy + 3.6)
    z.light('fogueira', fx, fy - 0.4, 260, '#ffb066', 0.9, 0.25)
