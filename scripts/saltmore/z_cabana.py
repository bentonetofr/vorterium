"""A cabana abandonada por dentro: o térreo (lareira apagada, mobília quebrada) e o sótão pequeno (uma cama e tralhas)."""
from __future__ import annotations

from .kit import find, one
from .lib import TILE, Zone

FLOOR = 'floor-14'          # madeira escura e gasta
WALL = 'wall-209'           # madeira escura
CEIL = 'ceil-2'             # viga de carvalho


def _p(pattern: str, **kw) -> str:
    try:
        return one(pattern, **kw)
    except KeyError:
        return one(pattern)


def ground() -> Zone:
    z = Zone('saltmore-cabana', 'Cabana abandonada (térreo)', 24, 19, 'void', 301)
    z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
    z.sound = {'auto': True, 'layers': {'wind': 0.18}}
    # sala: parede de 3 tiles em cima, piso embaixo (borda do cômodo é sólida pro motor)
    X0, X1, Y0, Y1, H = 3, 20, 3, 14, 3
    z.room(X0, Y0, X1, Y1, FLOOR, WALL, CEIL, H)
    wall_y = Y0 + H + 0.3            # pé dos móveis encostados na parede de cima (tiles)

    # ── parede de cima ──
    shelf = _p(r'^prateleira com teias$', pack='interior')
    hearth = 'furn-dark-wood@385,752'        # lareira de madeira, apagada
    books = _p(r'^estante de livros$', pack='interior')
    spears = _p(r'^suporte de lancas$', pack='interior')
    web = _p(r'^teia de aranha$', pack='dungeon')
    web2 = _p(r'^teia de aranha 2$', pack='dungeon')
    win = 'wd@611,162'
    win2 = 'wd@130,64'
    z.put(shelf, 5.0, wall_y)
    z.put(win, 7.9, wall_y - 1.05)
    z.put(hearth, 11.5, wall_y + 0.2)
    z.put(win2, 15.1, wall_y - 1.05)
    z.put(books, 17.6, wall_y)
    z.put(web, 3.9, Y0 + 1.6)
    z.put(web2, 13.7, Y0 + 1.1)
    z.put(_p(r'^cordas na parede$', pack='interior'), 9.2, Y0 + 2.1)
    z.put(_p(r'^escudo na parede$', pack='interior'), 13.9, Y0 + 2.2)
    z.put(_p(r'^espadas na parede$', pack='interior'), 19.5, Y0 + 2.1)
    # lareira apagada: cinzas e lenha queimada na frente
    z.put(_p(r'^lenha queimada$', pack='dungeon'), 11.4, wall_y + 0.95)
    z.put(_p(r'^mancha no chao$', pack='dungeon'), 12.4, wall_y + 1.5)
    # tábuas soltas e frascos quebrados pelo chão
    z.put(_p(r'^tabuas soltas$'), 8.1, 9.2)
    z.put(_p(r'^tabuas cruzadas$'), 14.9, 12.6)
    z.put(_p(r'^tabua caida$'), 5.9, 10.9)
    z.put(_p(r'^frascos no chao$'), 10.8, 13.3)

    # a escada de mão pro sótão, no canto direito: 3 lances empilhados na parede
    ladder = _p(r'^escada de madeira$', pack='plants')
    lx = 19.1
    for i in range(3):
        z.put(ladder, lx, wall_y - 0.0 - i * 0.95)
    z.portal('escada-sotao', 'Subir a escada pro sótão', lx - 1.3, wall_y + 0.15, 2.6, 1.5, ('saltmore-sotao', 'escada-baixo'))

    # ── centro: a mesa virada, cadeiras caídas ──
    z.put(_p(r'^mesa redonda com teias$', pack='interior'), 9.6, 10.6)
    z.put(_p(r'^cadeira de lado$', pack='dungeon'), 7.4, 11.0)
    z.put(_p(r'^cadeira de lado 2$', pack='dungeon'), 11.9, 12.1, True)
    z.put(_p(r'^pilha de pratos$', pack='interior'), 9.6, 10.6, z=14)
    z.put(_p(r'^pratinhos$', pack='interior'), 5.6, 12.6)
    z.put(_p(r'^banco comprido$', pack='dungeon'), 14.3, 9.9)
    z.put(_p(r'^papeis$', pack='interior'), 13.0, 11.7)
    z.put(_p(r'^garrafa verde$', pack='interior'), 15.9, 10.0)

    # ── canto de baixo/esquerda: tralhas ──
    z.put(_p(r'^pilha de barris$', pack='interior'), 4.6, 12.9)
    z.put(_p(r'^caixote$', pack='farm'), 6.6, 13.0)
    z.put(_p(r'^bau$', pack='lpc-base'), 3.9, 9.8)
    # ── canto de baixo/direita: cozinha velha ──
    z.put(_p(r'^fogao de ferro com cano$', pack='interior'), 18.6, 13.1)
    z.put(_p(r'^balcao de cozinha$', pack='interior'), 16.5, 13.2)
    z.put(_p(r'^balcao com pia$', pack='interior'), 15.4, 13.3)
    z.put(_p(r'^caldeirao$', pack='dungeon'), 17.2, 10.9)
    z.put(_p(r'^sacos e frascos$', pack='interior'), 16.3, 12.2)

    # ── no chão: musgo, rachaduras, poeira, mato entrando ──
    musgo = _p(r'^musgo$', pack='dungeon')
    crack = _p(r'^rachadura no chao$', pack='dungeon')
    weeds = _p(r'^erva de masmorra$', pack='dungeon')
    for tx, ty in ((4.6, 10.6), (12.8, 13.1), (8.6, 8.4), (18.1, 9.2)):
        z.put(musgo, tx, ty)
    for tx, ty in ((9.1, 12.7), (14.9, 11.3), (6.4, 9.3)):
        z.put(crack, tx, ty)
    for tx, ty in ((7.1, 13.3), (10.3, 13.5), (17.3, 8.6)):
        z.put(weeds, tx, ty)

    # porta da frente: tapete e luz fria vinda de fora; a saída fica na borda de baixo
    z.put(_p(r'^tapete de porta$', pack='lpc-base'), 11.5, Y1 - 0.55)
    z.portal('porta-frente', 'Sair da cabana', 9.5, Y1 - 1.6, 4.0, 1.6, ('saltmore-clareira', 'porta-cabana'))
    z.spawn = {'x': int(12.6 * TILE), 'y': int(9.0 * TILE)}

    # luz: fresta fria das janelas, brilho quase nenhum
    z.light('janela-1', 7.9, wall_y + 1.5, 150, '#9fc7ff', 0.32, 0.0)
    z.light('janela-2', 15.1, wall_y + 1.5, 150, '#9fc7ff', 0.32, 0.0)
    z.light('porta', 11.5, Y1 - 1.2, 110, '#b9d6ff', 0.22, 0.0)
    return z


def loft() -> Zone:
    z = Zone('saltmore-sotao', 'Cabana abandonada (sótão)', 18, 14, 'void', 302)
    z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
    z.sound = {'auto': True, 'layers': {'wind': 0.22}}
    X0, X1, Y0, Y1, H = 3, 14, 2, 10, 3
    z.room(X0, Y0, X1, Y1, FLOOR, 'wall-225', 'ceil-3', H)
    wall_y = Y0 + H + 0.3

    z.put(_p(r'^catre bagunçado$|^catre bagun.ado$', pack='dungeon'), 6.2, wall_y + 1.9)
    z.put('wd@611,162', 10.4, wall_y - 1.0)
    z.put(_p(r'^teia de aranha$', pack='dungeon'), 3.8, Y0 + 1.5)
    z.put(_p(r'^teia de aranha 2$', pack='dungeon'), 12.6, Y0 + 1.5)
    z.put(_p(r'^bau$', pack='lpc-base'), 11.2, wall_y + 0.9)
    z.put(_p(r'^cadeira de lado$', pack='dungeon'), 9.4, wall_y + 2.2)
    z.put(_p(r'^papeis$', pack='interior'), 8.2, wall_y + 2.0)
    z.put(_p(r'^caveira$', pack='dungeon'), 11.2, wall_y + 2.5)
    z.put(_p(r'^musgo$', pack='dungeon'), 5.0, wall_y + 3.0)
    z.put(_p(r'^rachadura no chao$', pack='dungeon'), 7.9, wall_y + 3.1)
    z.put(_p(r'^anforas$', pack='interior'), 4.2, wall_y + 0.9)
    z.put(_p(r'^caixote$', pack='farm'), 10.9, wall_y + 3.2)

    # a escada que desce, no canto direito
    ladder = _p(r'^escada de madeira$', pack='plants')
    lx = 13.0
    z.put(ladder, lx, wall_y + 0.2)
    z.put(ladder, lx, wall_y - 0.75)
    z.portal('escada-baixo', 'Descer a escada', lx - 1.3, wall_y + 0.65, 2.6, 1.5, ('saltmore-cabana', 'escada-sotao'))
    z.spawn = {'x': int((lx - 0.4) * TILE), 'y': int((wall_y + 1.5) * TILE)}
    z.light('janela', 10.4, wall_y + 1.2, 130, '#9fc7ff', 0.28, 0.0)
    return z
