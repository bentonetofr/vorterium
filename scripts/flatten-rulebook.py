"""Versão leve do livro pro leitor: cada página vira UM fundo JPEG opaco
(todas as imagens transparentes e desenhos já misturados) + o texto
original por cima, em vetor (nítido, pesquisável e selecionável).

uso: python scripts/flatten-rulebook.py origem.pdf destino.pdf [dpi=150] [qualidade=80] [primeira] [última]
(precisa do PyMuPDF: python -m pip install pymupdf)
O Altherium foi gerado com dpi 150 e qualidade 78.
"""
import sys
import time
import pymupdf as fitz

src, dst = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150
quality = int(sys.argv[4]) if len(sys.argv) > 4 else 80
first = int(sys.argv[5]) - 1 if len(sys.argv) > 5 else 0
last = int(sys.argv[6]) if len(sys.argv) > 6 else None

original = fitz.open(src)
last = last or original.page_count

# 1) Fundos: o livro sem o texto (redação só de texto), renderizado opaco.
backgrounds = fitz.open(src)
jpegs = []
for n in range(first, last):
    page = backgrounds[n]
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['text'].strip():
                    page.add_redact_annot(span['bbox'])
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    jpegs.append(pix.tobytes('jpeg', jpg_quality=quality))

# 2) Texto: o livro sem imagens nem desenhos (só o texto fica), com o fundo por baixo.
out = fitz.open(src)
for i, n in enumerate(range(first, last)):
    page = out[n]
    page.add_redact_annot(page.rect)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_REMOVE,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_NONE,
    )
    page.insert_image(page.rect, stream=jpegs[i], overlay=False)

if first > 0 or last < out.page_count:
    out.select(list(range(first, last)))
out.save(dst, garbage=4, deflate=True, clean=True)

# Relatório: tamanho e tempo de desenho por página (antes x depois).
res = fitz.open(dst)
def render_ms(doc, idx):
    t = time.perf_counter(); doc[idx].get_pixmap(dpi=110); return (time.perf_counter() - t) * 1000
before = [render_ms(original, n) for n in range(first, last)]
after = [render_ms(res, i) for i in range(res.page_count)]
import os
print(f'páginas {res.page_count} | arquivo {os.path.getsize(dst) / 1e6:.1f} MB')
print(f'desenho por página: antes média {sum(before)/len(before):.0f} ms (máx {max(before):.0f}) | depois média {sum(after)/len(after):.0f} ms (máx {max(after):.0f})')
print('texto preservado (pág 1):', repr(res[0].get_text()[:120]))
