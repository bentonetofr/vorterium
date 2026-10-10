"""Empacotador de folhas de objetos e fusão idempotente nos catálogos do Vortable.

Cada objeto tem um id ESTÁVEL (`tlou@<apelido>`), que não depende de onde ele cai na folha:
os mundos salvos guardam esse id, então regerar a arte nunca pode mudar os ids.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from PIL import Image

from .px import Cv

PACK_ID = 'tlou'
PACK_INFO = {
    'id': PACK_ID,
    'name': 'Apocalipse (arte original do Vortable)',
    'license': 'CC0 1.0 (arte própria, gerada por scripts/make-tlou-art.py)',
    'credits': 'credits/packs/tlou.txt',
}
CREDITS_TEXT = (
    'Apocalipse: arte original gerada por scripts/make-tlou-art.py do Vorterium.\n'
    'Objetos, terrenos, esporos, roupas e armas desenhados por código, sem imagens de terceiros.\n'
    'Inspirada na estética de pós-apocalipse com natureza retomando as cidades.\n'
    'Licença: CC0 1.0 (domínio público).\n'
)


@dataclass
class Placed:
    entry: dict
    sort_key: int = 0


@dataclass
class Sheet:
    """Uma folha de objetos: cada `add` encaixa um sprite (ou os quadros de uma animação)."""
    sid: str
    category_default: str = ''
    width: int = 512
    items: list[tuple[list[Cv], dict]] = field(default_factory=list)

    def add(self, frames: Cv | list[Cv], slug: str, label: str, category: str, tags: list[str], *,
            kind: str = 'stand', solids: list[dict] | None = None, sort: int = 3,
            light: dict | None = None, fps: int | None = None,
            group: str | None = None, variant: str | None = None) -> str:
        fl = frames if isinstance(frames, list) else [frames]
        oid = f'{PACK_ID}@{slug}'
        entry: dict = {
            'id': oid, 'pack': PACK_ID, 'sheet': self.sid, 'category': category, 'label': label,
            'tags': tags, 'kind': kind, 'x': 0, 'y': 0, 'w': fl[0].w, 'h': fl[0].h,
            'solids': solids or [], 'sort': sort,
        }
        if fps:
            entry['anim'] = {'fps': fps, 'frames': []}
        if light:
            entry['light'] = light
        if group:
            entry['group'] = f'{PACK_ID}@{group}'
        if variant:
            entry['variant'] = variant
        self.items.append((fl, entry))
        return oid

    def build(self) -> tuple[Image.Image, list[dict]]:
        """Encaixa tudo em prateleiras (1 px entre os quadros) e devolve a imagem e as entradas."""
        x = y = shelf = 0
        placed: list[tuple[list[Cv], dict, list[tuple[int, int]]]] = []
        for frames, entry in self.items:
            need_w = sum(f.w + 1 for f in frames)
            h = frames[0].h
            if x + need_w > self.width:
                x, y, shelf = 0, y + shelf + 1, 0
            pos = []
            cx = x
            for f in frames:
                pos.append((cx, y))
                cx += f.w + 1
            placed.append((frames, entry, pos))
            x += need_w
            shelf = max(shelf, h)
        total_h = y + shelf
        sheet = Image.new('RGBA', (self.width, max(1, total_h)), (0, 0, 0, 0))
        entries = []
        for frames, entry, pos in placed:
            for f, (px_, py_) in zip(frames, pos):
                sheet.alpha_composite(f.im, (px_, py_))
            entry = dict(entry)
            entry['x'], entry['y'] = pos[0]
            if 'anim' in entry:
                entry['anim'] = {'fps': entry['anim']['fps'], 'frames': [[a, b] for a, b in pos]}
            entries.append(entry)
        # corta o excesso de largura
        used = max((p[0] + f.w for frames, _, pos in placed for f, p in zip(frames, pos)), default=1)
        sheet = sheet.crop((0, 0, used, sheet.height))
        return sheet, entries


def solid(cx_half: int, depth: int, offset_y: int = 0) -> dict:
    """Retângulo de colisão: largura 2*cx_half centrado na base, `depth` px pra cima."""
    return {'x': -cx_half, 'y': -depth - offset_y, 'w': cx_half * 2, 'h': depth}


# ── Catálogos ────────────────────────────────────────────

def load_json(path: str) -> dict:
    with open(path, encoding='utf-8', newline='') as f:
        return json.load(f)


def save_json(path: str, data: dict) -> None:
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))


def merge_objects(assets: str, sheets: dict[str, tuple[Image.Image, list[dict]]]) -> None:
    """Tira tudo do pacote `tlou` do objects.json e põe de volta o que foi gerado agora."""
    path = os.path.join(assets, 'catalog', 'objects.json')
    cat = load_json(path)
    cat['packs'] = [p for p in cat['packs'] if p['id'] != PACK_ID] + [PACK_INFO]
    cat['sheets'] = [s for s in cat['sheets'] if s['pack'] != PACK_ID]
    cat['objects'] = [o for o in cat['objects'] if o['pack'] != PACK_ID]
    for sid, (img, entries) in sheets.items():
        url = f'catalog/{sid}.png'
        img.save(os.path.join(assets, url), optimize=True)
        cat['sheets'].append({'id': sid, 'pack': PACK_ID, 'url': url})
        cat['objects'].extend(entries)
    save_json(path, cat)


def write_credits(assets: str) -> None:
    d = os.path.join(assets, 'credits', 'packs')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'tlou.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(CREDITS_TEXT)
