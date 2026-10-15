"""Moradores do Saltmore: aparências montadas com as peças do catálogo de personagem do Vortable."""
from __future__ import annotations

import json
import os

from .lib import ASSETS

_cat = json.load(open(os.path.join(ASSETS, 'character', 'catalog.json'), encoding='utf-8'))
ITEMS = {i['id']: i for i in _cat['items']}
_pal = json.load(open(os.path.join(ASSETS, 'character', 'palettes.json'), encoding='utf-8'))


def _slot(body: str, item_id: str, color: str | None = None, color2: str | None = None) -> dict:
    """Uma peça no espaço dela: `color` vale pro 1º canal de cor (ou a variante, nas peças prontas), `color2` pro 2º."""
    it = ITEMS.get(item_id)
    if it is None:
        raise KeyError(f'peça de personagem inexistente: {item_id}')
    if body not in it['bodies']:
        raise ValueError(f'{item_id} não serve no corpo {body}')
    out: dict = {'id': item_id}
    if it.get('variants'):
        if color is not None:
            if color not in it['variants']:
                raise ValueError(f'{item_id}: variante {color!r} inexistente ({it["variants"][:6]})')
            out['variant'] = color
        return out
    chans = it.get('colors') or []
    picks = [color, color2]
    colors = {}
    for ch, pick in zip(chans, picks):
        if pick is None:
            continue
        if pick not in _pal.get(ch['material'], {}):
            raise ValueError(f'{item_id}: cor {pick!r} inexistente em {ch["material"]}')
        colors[ch['key']] = pick
    if colors:
        out['colors'] = colors
    return out


def look(body: str, *, skin: str = 'light', eyes: str = 'brown', head: str | None = None, hair: tuple | None = None, beard: tuple | None = None,
         mustache: tuple | None = None, clothes: tuple | None = None, legs: tuple | None = None, shoes: tuple | None = None, hat: tuple | None = None,
         apron: tuple | None = None, jacket: tuple | None = None, vest: tuple | None = None, dress: tuple | None = None, belt: tuple | None = None,
         cape: tuple | None = None, height: float | None = None) -> dict:
    """Monta a aparência. Cada peça é (id, cor, cor2). Corpos: male, female, muscular, teen, child."""
    if head is None:
        head = {'male': 'head/heads/human/heads_human_male', 'muscular': 'head/heads/human/heads_human_male',
                'teen': 'head/heads/human/heads_human_male', 'female': 'head/heads/human/heads_human_female',
                'child': 'head/heads/human/heads_human_child'}[body]
    slots: dict = {'body': {'id': 'body/body'}}
    slots['head'] = _slot(body, head, None, None)
    slots['head']['colors'] = {'color_2': eyes}
    for name, spec in (('hair', hair), ('beard', beard), ('mustache', mustache), ('clothes', clothes), ('legs', legs), ('shoes', shoes), ('hat', hat),
                       ('apron', apron), ('jacket', jacket), ('vest', vest), ('dress', dress), ('belt', belt), ('cape', cape)):
        if spec:
            slots[name] = _slot(body, *spec)
    out = {'version': 2, 'body': body, 'skin': skin, 'slots': slots}
    if height:
        out['height'] = height
    return out


# ── peças comuns ─────────────────────────────────────────────────────────────
H_SHORT = 'hair/short/hair_messy1'
H_LONG = 'hair/long/hair_long'
H_BOB = 'hair/bob/hair_bob'
H_BRAID = 'hair/braids/hair_braid'
H_BUZZ = 'hair/bald/hair_buzzcut'
H_CURLY = 'hair/curly/hair_curly_short'
H_PONY = 'hair/braids/hair_high_ponytail'
H_LOOSE = 'hair/long/hair_loose'
H_COWLICK = 'hair/short/hair_cowlick'
H_BALDING = 'hair/bald/hair_balding'

TUNIC = 'torso/shirts/torso_clothes_tunic'
LONGSLEEVE = 'torso/shirts/longsleeve/torso_clothes_longsleeve'
BLOUSE = 'torso/shirts/torso_clothes_blouse_longsleeve'
ROBE = 'torso/shirts/torso_clothes_robe'
SLEEVELESS = 'torso/shirts/sleeveless/torso_clothes_sleeveless'
PANTS = 'legs/pants/legs_pants'
WIDE = 'legs/pants/legs_widepants'
SKIRT = 'legs/skirts/legs_skirts_plain'
BOOTS = 'feet/boots/feet_boots_basic'
SHOES = 'feet/shoes/feet_shoes_basic'
APRON = 'torso/aprons/torso_aprons_apron_full'
APRON_LEATHER = 'torso/aprons/torso_aprons_apron'
VEST = 'torso/vest/torso_clothes_vest'
TABARD = 'torso/jacket/torso_jacket_tabard'
BELT = 'torso/waist/belt_leather'


# ── os moradores ─────────────────────────────────────────────────────────────

def guard(skin: str = 'tan', hair: str = 'dark_brown', tabard: str = 'green') -> dict:
    return look('male', skin=skin, eyes='brown', hair=(H_BUZZ, hair), clothes=(LONGSLEEVE, 'gray'), legs=(PANTS, 'charcoal'),
                shoes=(BOOTS, 'espresso'), hat=('headwear/helmets/helmets/hat_helmet_kettle',), jacket=(TABARD, tabard), belt=(BELT, 'brown'))


def innkeeper() -> dict:
    return look('female', skin='peach', eyes='green', hair=(H_BRAID, 'auburn'), dress=('torso/dresses/dress_sash', 'maroon'), apron=(APRON, 'white'),
                shoes=(SHOES, 'espresso'))


def blacksmith() -> dict:
    return look('male', skin='bronze', eyes='brown', hair=(H_BUZZ, 'black'), beard=('hair/beards/beards_medium', 'black'), clothes=(SLEEVELESS, 'charcoal'),
                apron=(APRON_LEATHER, 'leather'), legs=(PANTS, 'brown'), shoes=(BOOTS, 'espresso'))


def merchant_f() -> dict:
    return look('female', skin='fair', eyes='hazel', hair=(H_LOOSE, 'chestnut'), clothes=(LONGSLEEVE, 'white'),
                vest=('torso/dresses/dress_bodice', 'forest'), legs=(SKIRT, 'navy'), shoes=(SHOES, 'brown'), hat=('headwear/hats/caps/hat_cap_bonnie', 'tan'))


def merchant_m() -> dict:
    return look('male', skin='olive', eyes='brown', hair=(H_COWLICK, 'dark_brown'), mustache=('hair/mustaches/beards_handlebar', 'dark_brown'),
                clothes=(LONGSLEEVE, 'tan'), vest=(VEST, 'brown'), legs=(PANTS, 'brown'), shoes=(BOOTS, 'espresso'),
                hat=('headwear/hats/caps/hat_cap_leather', 'brown'))


def farmer_f() -> dict:
    return look('female', skin='tan', eyes='brown', hair=(H_PONY, 'dark_brown'), clothes=(BLOUSE, 'green'), apron=(APRON, 'brown'), legs=(SKIRT, 'forest'),
                shoes=(SHOES, 'espresso'), hat=('headwear/hats/caps/hat_cap_bonnie_tilt', 'tan'))


def farmer_m() -> dict:
    return look('male', skin='tan', eyes='brown', hair=(H_SHORT, 'light_brown'), clothes=(LONGSLEEVE, 'forest'), legs=(PANTS, 'brown'), shoes=(BOOTS, 'brown'),
                hat=('headwear/hats/caps/hat_cap_leather', 'tan'))


def old_man() -> dict:
    return look('male', skin='light', eyes='gray', head='head/heads/human/heads_human_male_elderly', hair=(H_BALDING, 'white'),
                beard=('hair/beards/beards_winter', 'white'), clothes=(LONGSLEEVE, 'brown'), legs=(PANTS, 'charcoal'), shoes=(SHOES, 'brown'), height=0.92)


def priest() -> dict:
    return look('male', skin='fair', eyes='blue', hair=(H_BALDING, 'gray'), clothes=(LONGSLEEVE, 'black'), jacket=('torso/jacket/torso_jacket_frock', 'black'),
                legs=(PANTS, 'black'), shoes=(SHOES, 'espresso'), belt=('torso/waist/belt_robe', 'white'))


def child(boy: bool = True) -> dict:
    return look('child', skin='peach', eyes='brown', hair=('hair/long/hair_wavy_child', 'ginger'), clothes=('torso/shirts/torso_clothes_child_shirt', 'green'),
                legs=('legs/pants/legs_childpants', 'brown'))


def fisherman() -> dict:
    return look('male', skin='tan', eyes='blue', hair=(H_CURLY, 'gray'), beard=('hair/beards/beards_trimmed', 'gray'), clothes=(LONGSLEEVE, 'bluegray'),
                legs=(PANTS, 'slate'), shoes=(BOOTS, 'brown'), hat=('headwear/hats/caps/hat_cap_leather', 'slate'))


def old_woman() -> dict:
    return look('female', skin='light', eyes='gray', head='head/heads/human/heads_human_female_elderly', hair=(H_BOB, 'silver'), clothes=(BLOUSE, 'gray'),
                legs=(SKIRT, 'charcoal'), shoes=(SHOES, 'espresso'), apron=(APRON, 'charcoal'), height=0.92)
