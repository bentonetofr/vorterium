"""Gera a arte do CAMPO DE BATALHA do Vortable (pacote 'batalha') e a encaixa nos catálogos de public/vortable/assets.

uso:
    python scripts/make-battle-art.py                  gera e atualiza o catálogo (objects.json + folha batalha.png)
    python scripts/make-battle-art.py --preview a.png  só desenha uma folha de contato (não mexe nos catálogos)

IDEMPOTENTE, como o do Apocalipse: rode de novo se o `npm run vorterium` do motor sobrescrever os catálogos.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.stdout.reconfigure(encoding='utf-8')

from battle_art import art  # noqa: E402
from tlou_art.preview import contact  # noqa: E402
from tlou_art.sheet import Sheet, load_json, save_json  # noqa: E402

ASSETS = os.path.normpath(os.path.join(HERE, '..', 'public', 'vortable', 'assets'))
PACK_INFO = {
    'id': art.PACK_ID,
    'name': 'Campo de batalha (arte original do Vortable)',
    'license': 'CC0 1.0 (arte própria, gerada por scripts/make-battle-art.py)',
    'credits': 'credits/packs/batalha.txt',
}


class BSheet(Sheet):
    """Folha com ids `batalha@...` (o Sheet do Apocalipse usa o prefixo `tlou@`)."""

    def add(self, frames, slug, label, category, tags, **kw):  # type: ignore[override]
        super().add(frames, slug, label, category, tags, **kw)
        entry = self.items[-1][1]
        entry['id'] = f'{art.PACK_ID}@{slug}'
        entry['pack'] = art.PACK_ID
        return entry['id']


def main() -> None:
    sheet = BSheet('batalha')
    art.build(sheet)
    if '--preview' in sys.argv:
        contact({'batalha': sheet}, sys.argv[sys.argv.index('--preview') + 1])
        print(len(sheet.items), 'objetos')
        return
    img, entries = sheet.build()
    path = os.path.join(ASSETS, 'catalog', 'objects.json')
    cat = load_json(path)
    cat['packs'] = [p for p in cat['packs'] if p['id'] != art.PACK_ID] + [PACK_INFO]
    cat['sheets'] = [s for s in cat['sheets'] if s['pack'] != art.PACK_ID]
    cat['objects'] = [o for o in cat['objects'] if o['pack'] != art.PACK_ID]
    url = 'catalog/batalha.png'
    img.save(os.path.join(ASSETS, url), optimize=True)
    cat['sheets'].append({'id': 'batalha', 'pack': art.PACK_ID, 'url': url})
    cat['objects'].extend(entries)
    save_json(path, cat)
    d = os.path.join(ASSETS, 'credits', 'packs')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'batalha.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('Campo de batalha: arte original gerada por scripts/make-battle-art.py do Vorterium.\n'
                'Espadas, escudos, elmos, soldados tombados, manchas de sangue e estandartes desenhados por código.\n'
                'Licença: CC0 1.0 (domínio público).\n')
    print(f'{len(entries)} objetos -> {os.path.relpath(path)}')


if __name__ == '__main__':
    main()
