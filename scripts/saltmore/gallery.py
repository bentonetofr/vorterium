"""Folha de contato pra escolher objetos: python gallery.py saida.png filtro [filtro...]
filtro = 'pack:categoria' (ex.: medieval:Vila) ou 'id:parte-do-id'."""
import json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vortable', 'assets'))
cat = json.load(open(os.path.join(ROOT, 'catalog', 'objects.json'), encoding='utf-8'))
sheets = {s['id']: Image.open(os.path.join(ROOT, s['url'])).convert('RGBA') for s in cat['sheets']}

def pick(filters):
    out = []
    for o in cat['objects']:
        for f in filters:
            k, v = f.split(':', 1)
            if (k == 'id' and v in o['id']) or (k != 'id' and o['pack'] == k and (v == '*' or o['category'] == v)):
                out.append(o); break
    return out

def render(objs, path, cols=8, cell=(150, 150), bg=(70, 110, 60, 255)):
    rows = (len(objs) + cols - 1) // cols
    img = Image.new('RGBA', (cols * cell[0], rows * cell[1]), bg)
    d = ImageDraw.Draw(img)
    for i, o in enumerate(objs):
        cx, cy = (i % cols) * cell[0], (i // cols) * cell[1]
        spr = sheets[o['sheet']].crop((o['x'], o['y'], o['x'] + o['w'], o['y'] + o['h']))
        s = min(1.0, (cell[0] - 8) / max(1, spr.width), (cell[1] - 30) / max(1, spr.height))
        if s < 1: spr = spr.resize((max(1, int(spr.width * s)), max(1, int(spr.height * s))), Image.NEAREST)
        img.alpha_composite(spr, (cx + (cell[0] - spr.width) // 2, cy + 4))
        d.text((cx + 3, cy + cell[1] - 24), o['id'].split('@')[-1] + ' ' + o['sheet'][:10], fill=(255, 255, 255, 255))
        d.text((cx + 3, cy + cell[1] - 12), o['label'][:22].encode('ascii', 'replace').decode(), fill=(255, 255, 160, 255))
    img.convert('RGB').save(path)

if __name__ == '__main__':
    objs = pick(sys.argv[2:])
    render(objs, sys.argv[1]); print(len(objs), 'objetos')
