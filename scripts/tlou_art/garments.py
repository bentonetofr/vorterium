"""Roupas do pós-apocalipse: padrões (xadrez, camuflagem, manchas) sobre as roupas do catálogo.

Cada peça nova pega a folha de uma roupa existente (nos três corpos e nas três animações) e troca a cor de
cada pixel por um padrão, mantendo o sombreamento original (a luminosidade do pixel diz se ele é contorno,
sombra ou luz). Saem como variantes prontas (`<pasta>/<anim>/<variante>.png`).
"""
from __future__ import annotations

import os

from PIL import Image

from .px import RGBA, fbm, rgb, _hash
from .sheet import load_json

SHEETS = 'character/sheets'
Z = {'clothes': 35, 'legs': 20, 'armour': 60}


def _lum(c: RGBA) -> float:
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255


def _tone(c: tuple[int, int, int], k: float) -> RGBA:
    return (max(0, min(255, int(c[0] * k))), max(0, min(255, int(c[1] * k))), max(0, min(255, int(c[2] * k))), 255)


def _hexrgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# ── Padrões: (x, y) no quadro de 64 → cor base ──────────

def plaid(base: str, stripe: str, line: str):
    b, s, l = _hexrgb(base), _hexrgb(stripe), _hexrgb(line)

    def fn(x: int, y: int) -> tuple[int, int, int]:
        v = x % 8 < 2
        h = y % 8 < 2
        if v and h:
            return tuple(int(l[i] * 0.8 + s[i] * 0.2) for i in range(3))   # type: ignore[return-value]
        if v or h:
            return tuple(int(s[i] * 0.75 + b[i] * 0.25) for i in range(3))  # type: ignore[return-value]
        if (x % 8 == 4) or (y % 8 == 4):
            return tuple(int(b[i] * 0.85 + l[i] * 0.15) for i in range(3))  # type: ignore[return-value]
        return b
    return fn


def camo(c1: str, c2: str, c3: str, c4: str, seed: int):
    cols = [_hexrgb(c) for c in (c1, c2, c3, c4)]

    def fn(x: int, y: int) -> tuple[int, int, int]:
        v = fbm(x / 4.5, y / 4.5, seed, 3)
        w = fbm(x / 3.0 + 40, y / 3.0 + 17, seed + 9, 2)
        if v > 0.62:
            return cols[2]
        if v < 0.36:
            return cols[1]
        if w > 0.66:
            return cols[3]
        return cols[0]
    return fn


def stained(base: str, seed: int):
    b = _hexrgb(base)
    dirt = _hexrgb('#3a2c1e')

    def fn(x: int, y: int) -> tuple[int, int, int]:
        v = fbm(x / 3.5, y / 3.5, seed, 3)
        d = max(0.0, (y % 64 - 38) / 26)                       # mais sujo perto da barra
        if v > 0.7 - d * 0.25:
            return tuple(int(b[i] * 0.45 + dirt[i] * 0.55) for i in range(3))  # type: ignore[return-value]
        if _hash(x, y, seed) > 0.985:
            return dirt
        return b
    return fn


def ripstop(base: str):
    b = _hexrgb(base)

    def fn(x: int, y: int) -> tuple[int, int, int]:
        k = 0.88 if (x % 4 == 0 or y % 4 == 0) else 1.0
        return tuple(int(c * k) for c in b)  # type: ignore[return-value]
    return fn


def reskin(img: Image.Image, pattern, lmin: float, lmax: float) -> Image.Image:
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    span = max(0.05, lmax - lmin)
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = img.getpixel((x, y))
            if a == 0:
                continue
            t = max(0.0, min(1.0, (_lum((r, g, b, a)) - lmin) / span))
            base = pattern(x % 64, y % 64)
            out.putpixel((x, y), _tone(base, 0.42 + 0.9 * t)[:3] + (a,))
    return out


# ── Peças ────────────────────────────────────────────────

PIECES = [
    {
        'id': 'tlou/clothes/xadrez', 'slot': 'clothes', 'name': 'Camisa xadrez de manga comprida',
        'base': 'torso/shirts/longsleeve/torso_clothes_longsleeve',
        'variants': {
            'vermelha': plaid('#8a2c26', '#1d1d1d', '#101010'),
            'verde': plaid('#3c5a2e', '#1c2418', '#0e140c'),
            'azul': plaid('#34506e', '#1a2430', '#0e141c'),
            'marrom': plaid('#6e4a2c', '#2a1c10', '#160e08'),
        },
    },
    {
        'id': 'tlou/clothes/camuflada', 'slot': 'clothes', 'name': 'Camiseta camuflada',
        'base': 'torso/shirts/shortsleeve/torso_clothes_tshirt',
        'variants': {
            'floresta': camo('#5b6b3a', '#2f3a22', '#46552f', '#7b8a58', 11),
            'deserto': camo('#a89466', '#7a6a44', '#8c7b52', '#c4b184', 13),
            'urbana': camo('#6a6e6c', '#3a3d3c', '#52565a', '#8a8f8c', 15),
        },
    },
    {
        'id': 'tlou/clothes/surrada', 'slot': 'clothes', 'name': 'Camiseta surrada e suja',
        'base': 'torso/shirts/shortsleeve/torso_clothes_tshirt',
        'variants': {
            'cinza': stained('#7a7c78', 21),
            'bege': stained('#a99a78', 23),
            'branca': stained('#cfcbbd', 25),
        },
    },
    {
        'id': 'tlou/legs/camuflada', 'slot': 'legs', 'name': 'Calça camuflada',
        'base': 'legs/pants/legs_pants',
        'variants': {
            'floresta': camo('#5b6b3a', '#2f3a22', '#46552f', '#7b8a58', 31),
            'deserto': camo('#a89466', '#7a6a44', '#8c7b52', '#c4b184', 33),
            'urbana': camo('#6a6e6c', '#3a3d3c', '#52565a', '#8a8f8c', 35),
        },
    },
    {
        'id': 'tlou/legs/surrada', 'slot': 'legs', 'name': 'Calça surrada e suja',
        'base': 'legs/pants/legs_pants',
        'variants': {
            'jeans': stained('#3f5a7a', 41),
            'cargo': stained('#6d6446', 43),
            'preta': stained('#34343a', 45),
        },
    },
    {
        'id': 'tlou/armour/colete-tatico', 'slot': 'armour', 'name': 'Colete tático',
        'base': 'torso/armour/torso_armour_leather',
        'variants': {
            'oliva': ripstop('#566a3a'),
            'preto': ripstop('#2a2c2e'),
            'caqui': ripstop('#8b7d58'),
        },
    },
]


def generate(assets: str) -> tuple[list[dict], list[dict]]:
    cat = load_json(os.path.join(assets, 'character', 'catalog.json'))
    by_id = {i['id']: i for i in cat['items']}
    items = []
    for piece in PIECES:
        base_item = by_id.get(piece['base'])
        if not base_item:
            raise SystemExit(f'peça-base não achada: {piece["base"]}')
        src_ramp = base_item['colors'][0]['source']
        lmin, lmax = _lum(rgb(src_ramp[0])), _lum(rgb(src_ramp[-1]))
        z = base_item['layers'][0]['z']
        paths: dict[str, str] = {}
        for body in base_item['bodies']:
            base_dir = base_item['layers'][0]['paths'].get(body) or base_item['layers'][0]['paths'].get('male')
            rel = f'tlou/{piece["id"].split("/", 1)[1]}/{body}/'
            for anim in base_item['anims']:
                src = os.path.join(assets, SHEETS, base_dir, f'{anim}.png')
                if not os.path.exists(src):
                    continue
                im = Image.open(src).convert('RGBA')
                d = os.path.join(assets, SHEETS, rel, anim)
                os.makedirs(d, exist_ok=True)
                for name, pattern in piece['variants'].items():
                    reskin(im, pattern, lmin, lmax).save(os.path.join(d, f'{name}.png'), optimize=True)
            paths[body] = rel
        items.append({
            'id': piece['id'], 'slot': piece['slot'], 'name': piece['name'],
            'layers': [{'z': z, 'paths': paths}],
            'bodies': list(paths), 'anims': list(base_item['anims']),
            'variants': list(piece['variants']),
        })
    return [], items


def preview(assets: str, out: str, scale: int = 5) -> None:
    """Cada peça nova vestida no corpo (de frente e de costas, quadro 2)."""
    from PIL import ImageDraw
    slots, items = generate(assets)
    body_img = Image.open(os.path.join(assets, SHEETS, 'body', 'bodies', 'male', 'walk.png')).convert('RGBA')
    head_img = Image.open(os.path.join(assets, SHEETS, 'head', 'heads', 'human', 'male', 'walk.png')).convert('RGBA')
    tiles = []
    for it in items:
        if 'male' not in it['bodies']:
            continue
        for v in it['variants']:
            sheet = Image.open(os.path.join(assets, SHEETS, it['layers'][0]['paths']['male'], 'walk', f'{v}.png')).convert('RGBA')
            row = []
            for r in (2, 0):
                box = (2 * 64, r * 64, 3 * 64, r * 64 + 64)
                tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
                if it['slot'] == 'legs':
                    tile.alpha_composite(body_img.crop(box)); tile.alpha_composite(sheet.crop(box)); tile.alpha_composite(head_img.crop(box))
                else:
                    tile.alpha_composite(body_img.crop(box)); tile.alpha_composite(sheet.crop(box)); tile.alpha_composite(head_img.crop(box))
                row.append(tile)
            tiles.append((f'{it["name"]} ({v})', row))
    cols = 5
    cw = 64 * scale * 2 + 14
    rows = (len(tiles) + cols - 1) // cols
    canvas = Image.new('RGBA', (cols * cw, rows * (64 * scale + 16)), (74, 82, 66, 255))
    d = ImageDraw.Draw(canvas)
    for i, (label, row) in enumerate(tiles):
        x, y = (i % cols) * cw, (i // cols) * (64 * scale + 16)
        d.text((x + 2, y), label[:30], fill=(255, 255, 255, 255))
        for k, t in enumerate(row):
            canvas.alpha_composite(t.resize((64 * scale, 64 * scale), Image.NEAREST), (x + k * 64 * scale, y + 14))
    canvas.save(out)
