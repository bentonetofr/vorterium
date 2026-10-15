"""Monta o mundo SALTMORE e escreve public/vortable/maps/saltmore.mundo.json."""
from __future__ import annotations

import os
import sys

from .lib import ROOT, Zone, write_world

MAP = os.path.join(ROOT, 'public', 'vortable', 'maps', 'saltmore.mundo.json')


def validate(zones: list[Zone]) -> None:
    """Toda saída leva a uma zona e a uma saída que existem; ids únicos; spawn dentro da zona."""
    by_id = {z.id: z for z in zones}
    assert len(by_id) == len(zones), 'ids de zona repetidos'
    problems: list[str] = []
    for z in zones:
        pids = [p['id'] for p in z.portals]
        if len(set(pids)) != len(pids):
            problems.append(f'{z.id}: saídas com id repetido')
        if not (0 <= z.spawn['x'] <= z.w * 32 and 0 <= z.spawn['y'] <= z.h * 32):
            problems.append(f'{z.id}: spawn fora da zona')
        for p in z.portals:
            to = p['to']
            if to is None:
                continue
            tz = by_id.get(to['zone'])
            if tz is None:
                problems.append(f'{z.id}/{p["id"]}: zona {to["zone"]} não existe')
                continue
            tp = next((q for q in tz.portals if q['id'] == to['portal']), None)
            if tp is None:
                problems.append(f'{z.id}/{p["id"]}: saída {to["portal"]} não existe em {tz.id}')
            elif not tp['to'] or tp['to']['zone'] != z.id or tp['to']['portal'] != p['id']:
                problems.append(f'{z.id}/{p["id"]}: a saída de volta não aponta pra cá')
            if not (0 <= p['x'] and p['x'] + p['w'] <= z.w * 32 and 0 <= p['y'] and p['y'] + p['h'] <= z.h * 32):
                problems.append(f'{z.id}/{p["id"]}: saída fora da zona')
        for o in z.objects:
            if not (-64 <= o['x'] <= z.w * 32 + 64 and -64 <= o['y'] <= z.h * 32 + 64):
                problems.append(f'{z.id}: objeto muito fora da zona {o}')
                break
    if problems:
        raise SystemExit('PROBLEMAS:\n  ' + '\n  '.join(problems))


def build(only: list[str] | None = None) -> list[Zone]:
    from . import z_cabana, z_clareira, z_encosta, z_estalagem, z_floresta, z_ponte, z_riacho, z_vila
    zones: list[Zone] = [z_cabana.ground(), z_cabana.loft(), z_clareira.build(), z_floresta.build(), z_riacho.build(), z_encosta.build(), z_vila.build(), z_estalagem.build(), z_ponte.build()]
    return zones


LAYOUT = {
    'saltmore-estalagem': (1, 5),
    'saltmore-ponte': (0, 6),
    'saltmore-vila': (0, 5),
    'saltmore-encosta': (0, 4),
    'saltmore-riacho': (0, 3),
    'saltmore-floresta': (0, 2),
    'saltmore-clareira': (0, 1),
    'saltmore-sotao': (0, -1),
    'saltmore-cabana': (0, 0),
}


def generate(check: bool = True) -> None:
    zones = build()
    if check:
        try:
            validate(zones)
        except SystemExit as e:
            print(e)
    layout = {z.id: LAYOUT.get(z.id, (0, 0)) for z in zones}
    write_world(MAP, 'mundo-saltmore', 'SALTMORE', zones, layout, 'saltmore-cabana', {'hour': 16.0, 'weather': 'cloudy'})


if __name__ == '__main__':
    generate()
