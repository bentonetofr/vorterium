"""A estalagem do Corvo por dentro: salão com lareira acesa, balcão, mesas, cantinho do bardo e um forasteiro encapuzado."""
from __future__ import annotations

from . import npcs
from .kit import find, one
from .lib import TILE, Zone

FLOOR = 'floor-7'
WALL = 'wall-209'
CEIL = 'ceil-3'
FW = 'furn-dark-wood'


def _f(pattern: str, nth: int = 0) -> str:
    r = find(pattern, sheet=FW)
    if not r:
        raise KeyError(pattern)
    return r[nth]


def build() -> Zone:
    z = Zone('saltmore-estalagem', 'Estalagem do Corvo', 32, 24, 'void', 811)
    z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
    z.sound = {'auto': True, 'layers': {'fire': 0.45, 'wind': 0.1}}
    X0, X1, Y0, Y1, H = 2, 29, 3, 21, 4
    z.room(X0, Y0, X1, Y1, FLOOR, WALL, CEIL, H)
    wy = Y0 + H + 0.3                          # pé do que encosta na parede de cima

    # ── a parede de cima: lareira acesa no meio, estante, relógio, janelas e troféus ──
    z.put(one(r'^lareira de tijolos$', pack='interior'), 15.5, wy + 0.1)
    z.put(_f(r'^estante grande$'), 9.0, wy + 0.2)
    z.put(_f(r'^relogio de pendulo$'), 4.6, wy + 0.2)
    z.put(_f(r'^aparador$'), 22.0, wy + 0.2)
    z.put('wd@611,162', 6.8, wy - 1.0)
    z.put('wd@130,64', 12.0, wy - 1.0)
    z.put('wd@611,162', 19.0, wy - 1.0)
    z.put('wd@130,64', 25.4, wy - 1.0)
    z.put(one(r'^escudo na parede$', pack='interior'), 8.0, Y0 + 2.2)
    z.put(one(r'^espadas na parede$', pack='interior'), 23.6, Y0 + 2.2)
    z.put(one(r'^cordas na parede$', pack='interior'), 27.0, Y0 + 2.4)
    z.put(one(r'^placa pendurada 4$', pack='medieval'), 15.5, Y0 + 0.9)
    z.put(one(r'^estandarte (vermelho)$', pack='medieval'), 11.4, Y0 + 2.6)
    z.put(one(r'^estandarte (dourado)$', pack='medieval'), 19.6, Y0 + 2.6)
    # o fogo faz a luz do salão
    z.light('lareira', 15.5, wy + 0.8, 300, '#ff9a4a', 0.65, 0.4)
    for lid, lx in (('jan-1', 6.8), ('jan-2', 12.0), ('jan-3', 19.0), ('jan-4', 25.4)):
        z.light(lid, lx, wy + 1.4, 130, '#9fc7ff', 0.18, 0.0)

    # ── o balcão (lado leste): tampo, barris e prateleiras atrás, canecas em cima ──
    counter = _f(r'^mesa comprida$')
    z.put(counter, 25.2, 12.6)
    z.put(counter, 25.2, 15.6)
    z.put(counter, 25.2, 18.6)
    for ty in (12.0, 15.0, 18.0):
        for dx in (-1.1, 0.4, 1.4):
            z.put(one(r'^(taca e garrafa|garrafa verde|bandeja de prata|pratos de prata)$', pack='interior'), 25.2 + dx, ty + 0.2, False, 20)
    z.put(one(r'^pilha de barris$', pack='interior'), 28.3, 11.6)
    z.put(one(r'^pilha de barris$', pack='interior'), 28.3, 20.2)
    z.put(_f(r'^estante baixa$'), 28.4, 16.0)
    z.put(one(r'^barril em pe$', pack='lpc-base'), 28.2, 14.0)
    z.put(one(r'^barril em pe \(escuro\)$', pack='lpc-base'), 28.2, 17.8)

    # ── mesas redondas e uma comprida, com cadeiras e bancos; velas em cima ──
    def round_table(tx: float, ty: float) -> None:
        z.put(_f(r'^mesa redonda grande$'), tx, ty)
        z.put(one(r'^mesinha com vela$', pack='interior'), tx, ty - 0.2, False, 14)
        z.put(_f(r'^cadeira$'), tx - 2.0, ty + 0.1)
        z.put(_f(r'^cadeira lateral 3$'), tx + 2.0, ty + 0.1, True)
        z.put(_f(r'^cadeira$'), tx, ty - 1.7)
        z.put(_f(r'^banquinho$'), tx, ty + 1.7)
    round_table(6.0, 11.4)
    round_table(11.0, 16.4)
    round_table(20.0, 16.6)
    z.put(_f(r'^mesa de jantar$'), 15.5, 11.6)
    z.put(_f(r'^banco longo$'), 15.5, 10.0)
    z.put(_f(r'^banco longo$'), 15.5, 13.2)
    z.put(one(r'^mesinha com vela 2$', pack='interior'), 14.6, 11.4, False, 18)
    z.put(one(r'^pratinhos$', pack='interior'), 16.5, 11.5, False, 18)
    z.put(one(r'^taca e garrafa$', pack='interior'), 15.4, 11.6, False, 18)

    # ── o cantinho do bardo (sudeste do salão): palco, piano e um banquinho ──
    z.put(one(r'^palco de madeira$', pack='medieval'), 6.4, 19.8)
    z.put(_f(r'^piano$'), 5.0, 19.0)
    z.put(_f(r'^banquinho$'), 5.2, 20.0)
    z.put(one(r'^lamparina 2$', pack='medieval'), 9.0, 19.8)

    # ── o chão: tapete grande no meio, palha, um chope derramado ──
    z.put(one(r'^papeis$', pack='interior'), 10.6, 13.6)
    z.put(one(r'^caixote$', pack='medieval'), 3.8, 8.6)
    
    # a porta da frente: tapete e a saída na borda de baixo
    z.put(one(r'^tapete de porta$', pack='lpc-base'), 15.5, Y1 - 0.55)
    z.portal('porta-frente', 'Sair da estalagem', 13.5, Y1 - 1.6, 4.0, 1.6, ('saltmore-vila', 'estalagem'))
    z.spawn = {'x': int(15.5 * TILE), 'y': int((Y1 - 2.4) * TILE)}
    z.light('porta', 15.5, Y1 - 1.2, 120, '#b9d6ff', 0.2, 0.0)

    # ── gente ──
    z.npc('estalagem-taverneiro', 'Ulf', 'Taverneiro', npcs.look('male', skin='light', eyes='blue', hair=(npcs.H_BALDING, 'ginger'),
          beard=('hair/beards/beards_medium', 'ginger'), clothes=(npcs.LONGSLEEVE, 'white'), apron=(npcs.APRON_LEATHER, 'brown'),
          legs=(npcs.PANTS, 'brown'), shoes=(npcs.BOOTS, 'espresso')), 26.8, 14.0, 'left')
    z.npc('estalagem-bardo', 'Lirael', 'Bardo', npcs.look('female', skin='fair', eyes='green', hair=(npcs.H_LONG, 'auburn'),
          clothes=(npcs.LONGSLEEVE, 'teal'), legs=(npcs.PANTS, 'charcoal'), shoes=(npcs.BOOTS, 'brown'),
          hat=('headwear/hats/caps/hat_cap_cavalier', 'blue')), 5.2, 20.9, 'up')
    z.npc('estalagem-cliente-1', 'Vigo', 'Cliente', npcs.farmer_m(), 8.1, 11.9, 'left')
    z.npc('estalagem-cliente-2', 'Moll', 'Cliente', npcs.farmer_f(), 8.7, 16.6, 'left')
    z.npc('estalagem-forasteiro', 'Forasteiro encapuzado', 'Hóspede misterioso',
          npcs.look('male', skin='light', eyes='gray', hair=(npcs.H_SHORT, 'black'), clothes=(npcs.LONGSLEEVE, 'charcoal'), legs=(npcs.PANTS, 'black'),
                    shoes=(npcs.BOOTS, 'espresso'), hat=('headwear/coverings/hoods/hat_hood_cloth', 'charcoal'), cape=('torso/cape/cape_tattered', 'black')),
          3.6, 14.4, 'right')
    return z
