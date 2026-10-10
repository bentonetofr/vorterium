"""Personagem: cores novas, espaços e itens do pacote Apocalipse no catálogo do criador."""
from __future__ import annotations

import os

from .sheet import load_json, save_json

ITEM_PREFIX = 'tlou/'

# Rampas (do escuro ao claro, 6 tons como as do catálogo). Entram nas cores de tecido de TODAS as roupas.
CLOTH = {
    'oliva-militar':   ['#1d2316', '#2f3a22', '#46552f', '#5f7240', '#7b9055', '#98ab72'],
    'caqui-sujo':      ['#2e281a', '#473f28', '#625738', '#80724a', '#9d8d60', '#b9a97c'],
    'ferrugem':        ['#2a1710', '#47271a', '#693b23', '#8b5230', '#af6e3c', '#c98a56'],
    'jeans-desbotado': ['#1c2a3a', '#2c4258', '#40607f', '#5a7ea0', '#7a9ebd', '#9fbdd4'],
    'jeans-escuro':    ['#10161f', '#1b2735', '#283a4f', '#384f6b', '#4c6887', '#6482a3'],
    'cinza-fuligem':   ['#161616', '#262626', '#3a3a38', '#52524e', '#6c6c66', '#8a8a82'],
    'vinho-gasto':     ['#2a0f12', '#451a1f', '#62262d', '#83363e', '#a04a52', '#bb6870'],
    'azul-petroleo':   ['#0f2024', '#18363d', '#245259', '#336e75', '#468c92', '#62a8ab'],
    'bege-poeira':     ['#3b3226', '#574b3a', '#76674f', '#968565', '#b5a380', '#d1c29f'],
    'verde-musgo':     ['#1b2410', '#2d3a19', '#44562a', '#5f7a3c', '#7f9c55', '#a0bb76'],
    'lama':            ['#1d160e', '#2e2316', '#43331f', '#5b452b', '#765b38', '#917548'],
}
HAIR = {
    'castanho-cinza':  ['#1b1411', '#2c211b', '#413228', '#5a463a', '#77604f', '#957b66'],
    'ruivo-queimado':  ['#2b0f08', '#4a1a0d', '#6e2a14', '#923c1c', '#b5522a', '#d06e3f'],
    'grisalho-sujo':   ['#2a2927', '#403f3b', '#5a5853', '#77746d', '#98948b', '#b9b5aa'],
}


def merge_character(assets: str, slots: list[dict], items: list[dict]) -> None:
    """Tira do catálogo do personagem o que é do pacote `tlou` e põe de volta o gerado agora."""
    path = os.path.join(assets, 'character', 'catalog.json')
    cat = load_json(path)
    ids = {s['id'] for s in slots}
    cat['slots'] = [s for s in cat['slots'] if s['id'] not in ids] + slots
    cat['items'] = [i for i in cat['items'] if not i['id'].startswith(ITEM_PREFIX)] + items
    save_json(path, cat)

    ppath = os.path.join(assets, 'character', 'palettes.json')
    pal = load_json(ppath)
    for material, extra in (('cloth', CLOTH), ('hair', HAIR)):
        for name, ramp in extra.items():
            pal[material][name] = ramp
    save_json(ppath, pal)
