import type { PdfField, PdfFieldsRead } from './pdfFields'
import dandrelis from './__fixtures__/dandrelis.fields.json'

// Campos de PDFs reais (gerados por scripts/import-ficha-fixture.ts) para os testes da importação.

type Row = [string, PdfField['kind'], string | boolean, number, number, number, number, number]

/** A ficha do Dandrelis Eldricon (Bardo 5, Meio-Elfo), no modelo JohnBard 1.4. */
export function dandrelisFields(): PdfFieldsRead {
  const raw = dandrelis as unknown as { pageCount: number; fields: Row[] }
  return {
    pageCount: raw.pageCount,
    fields: raw.fields.map(([name, kind, value, page, x0, y0, x1, y1]) => ({ name, kind, value, page, rect: [x0, y0, x1, y1] })),
  }
}
