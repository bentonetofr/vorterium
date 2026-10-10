"""Gera a arte de pós-apocalipse do Vortable (objetos, terrenos, esporos, roupas, armas)
e a encaixa nos catálogos de public/vortable/assets.

uso:
    python scripts/make-tlou-art.py                 gera tudo e atualiza os catálogos
    python scripts/make-tlou-art.py --world         só regera o mundo pronto (public/vortable/maps/ruinas.mundo.json)
    python scripts/make-tlou-art.py --preview a.png [--only folha1,folha2]
                                                     só desenha uma folha de contato dos objetos (não mexe nos catálogos)
(precisa do Pillow: python -m pip install pillow)

É IDEMPOTENTE: tira do catálogo tudo o que é do pacote "tlou" e põe de volta o que gerou agora.
Rode de novo sempre que o motor do Vortable for sincronizado de novo (o `npm run vorterium` do
Vortable copia os catálogos por cima e apaga as entradas daqui).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from tlou_art import objects_city, objects_infection, objects_nature, objects_quarantine, objects_roads, objects_ruins, objects_survival  # noqa: E402
from tlou_art import chars, faces, garments, terrains, weapons, worlds, world_nyc  # noqa: E402
from tlou_art.preview import contact  # noqa: E402
from tlou_art.sheet import Sheet, merge_objects, write_credits  # noqa: E402

ASSETS = os.path.normpath(os.path.join(HERE, '..', 'public', 'vortable', 'assets'))
VORTABLE = os.path.dirname(ASSETS)


def object_sheets() -> dict[str, Sheet]:
    sheets: dict[str, Sheet] = {}
    ruins = Sheet('tlou-ruinas')
    objects_ruins.build(ruins)
    sheets['tlou-ruinas'] = ruins
    quarantine = Sheet('tlou-quarentena')
    objects_quarantine.build(quarantine)
    sheets['tlou-quarentena'] = quarantine
    infection = Sheet('tlou-infeccao')
    objects_infection.build(infection)
    sheets['tlou-infeccao'] = infection
    nature = Sheet('tlou-natureza')
    objects_nature.build(nature)
    sheets['tlou-natureza'] = nature
    survival = Sheet('tlou-sobrevivencia')
    objects_survival.build(survival)
    sheets['tlou-sobrevivencia'] = survival
    roads = Sheet('tlou-estrada')
    objects_roads.build(roads)
    sheets['tlou-estrada'] = roads
    city = Sheet('tlou-cidade')
    objects_city.build(city)
    sheets['tlou-cidade'] = city
    return sheets


def main() -> None:
    args = sys.argv[1:]
    if '--world' in args:                      # só o mundo pronto (usa os catálogos que já estão no disco)
        worlds.generate(VORTABLE)
        world_nyc.generate(VORTABLE)
        return
    sheets = object_sheets()
    if '--preview' in args:
        if '--only' in args:
            keep = args[args.index('--only') + 1].split(',')
            sheets = {k: v for k, v in sheets.items() if k in keep}
        contact(sheets, args[args.index('--preview') + 1])
        print('folha de contato pronta')
        return
    if '--garments-preview' in args:
        garments.preview(ASSETS, args[args.index('--garments-preview') + 1])
        print('roupas: folha de contato pronta')
        return
    if '--faces-preview' in args:
        faces.preview(ASSETS, args[args.index('--faces-preview') + 1])
        print('rostos: folha de contato pronta')
        return
    if '--weapons-preview' in args:
        weapons.preview(ASSETS, args[args.index('--weapons-preview') + 1])
        print('armas: folha de contato pronta')
        return
    if '--terrain-preview' in args:
        terrains.preview(args[args.index('--terrain-preview') + 1])
        print('terrenos: folha de contato pronta')
        return
    built = {sid: sh.build() for sid, sh in sheets.items()}
    ground, ground_entries = terrains.build()
    terrains.merge_terrains(ASSETS, ground, ground_entries)
    merge_objects(ASSETS, built)
    write_credits(ASSETS)
    char_slots, char_items = [], []
    for module in (weapons, faces, garments):
        slots, items = module.generate(ASSETS)
        char_slots += slots
        char_items += items
    chars.merge_character(ASSETS, char_slots, char_items)
    worlds.generate(VORTABLE)
    world_nyc.generate(VORTABLE)
    total = sum(len(e) for _, e in built.values())
    print(f'{total} objetos em {len(built)} folha(s), {len(ground_entries)} terrenos, {len(char_items)} pecas de personagem')


if __name__ == '__main__':
    main()
