"""Folha de contato pra olhar a arte gerada antes de ligar no Vortable."""
from __future__ import annotations

from PIL import Image, ImageDraw

from .sheet import Sheet


def contact(sheets: dict[str, Sheet], out: str, scale: int = 3, cols_px: int = 1500, bg=(86, 92, 74)) -> None:
    """Desenha todos os objetos (1º quadro) lado a lado, ampliados, com o nome embaixo."""
    cells = []
    for sid, sh in sheets.items():
        for frames, entry in sh.items:
            strip = Image.new('RGBA', (sum(f.w + 2 for f in frames), frames[0].h), (0, 0, 0, 0))
            cx = 0
            for f in frames:
                strip.alpha_composite(f.im, (cx, 0))
                cx += f.w + 2
            cells.append((strip, entry['label'], len(frames)))
    x = y = row_h = 0
    pad = 10
    layout = []
    for im, label, n in cells:
        w, h = im.width * scale, im.height * scale
        cw = max(w, 90)
        if x + cw + pad > cols_px:
            x, y, row_h = 0, y + row_h + pad, 0
        layout.append((im, label, n, x, y, w, h, cw))
        x += cw + pad
        row_h = max(row_h, h + 14)
    total_h = y + row_h + pad
    canvas = Image.new('RGBA', (cols_px, total_h), bg + (255,))
    d = ImageDraw.Draw(canvas)
    for im, label, n, x, y, w, h, cw in layout:
        big = im.resize((w, h), Image.NEAREST)
        canvas.alpha_composite(big, (x + (cw - w) // 2, y))
        d.text((x, y + h + 1), f'{label[:22]}{" x" + str(n) if n > 1 else ""}', fill=(255, 255, 255, 255))
    canvas.save(out)
