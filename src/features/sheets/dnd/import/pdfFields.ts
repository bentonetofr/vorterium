// ────────────────────────────────────────────────────────
// Leitura dos campos de formulário de um PDF (AcroForm): nome, valor, tipo,
// página e posição de cada campo. É só a leitura crua; quem entende o que
// cada campo significa é o modelo da ficha (models/). O leitor do PDF
// (pdf.js) vem de fora (`PdfLib`) para este arquivo funcionar no navegador e
// nos testes.
// ────────────────────────────────────────────────────────

export type PdfFieldKind = 'text' | 'check' | 'choice'

export interface PdfField {
  /** Nome completo do campo no formulário (ex.: "Character Name", "Spells 1014"). */
  name:  string
  kind:  PdfFieldKind
  /** Texto, ou marcado/desmarcado (check). */
  value: string | boolean
  /** Página, de 1 em diante. */
  page:  number
  /** Posição na página em pontos, com a origem no canto de cima à esquerda: [x0, y0, x1, y1]. */
  rect:  [number, number, number, number]
  /** Opções de uma lista (choice). */
  options?: string[]
}

export interface PdfFieldsRead {
  pageCount: number
  fields:    PdfField[]
}

// A parte do pdf.js que usamos (tipada solta para não depender das versões dele).
interface PdfAnnotation {
  subtype?: string
  fieldName?: string
  fieldType?: string
  fieldValue?: unknown
  checkBox?: boolean
  radioButton?: boolean
  pushButton?: boolean
  rect?: number[]
  options?: { exportValue: string; displayValue: string }[]
}
interface PdfPage { getViewport(o: { scale: number }): { height: number }; getAnnotations(): Promise<PdfAnnotation[]> }
interface PdfDocument { numPages: number; getPage(n: number): Promise<PdfPage>; destroy?(): Promise<void> }
export interface PdfLib { getDocument(src: { data: Uint8Array; verbosity?: number }): { promise: Promise<PdfDocument> } }

const round1 = (n: number) => Math.round(n * 10) / 10

function textOf(v: unknown): string {
  const s = Array.isArray(v) ? (v.length ? String(v[0]) : '') : v == null ? '' : String(v)
  return s.replace(/\r\n?/g, '\n')
}

/** Lê todos os campos de formulário do PDF. Lança erro se o arquivo não for um PDF legível. */
export async function readPdfFields(data: ArrayBuffer | Uint8Array, lib: PdfLib): Promise<PdfFieldsRead> {
  // o pdf.js passa a ser dono do buffer, então ele recebe uma cópia
  const bytes = new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data)).slice()
  const doc = await lib.getDocument({ data: bytes, verbosity: 0 }).promise
  const fields: PdfField[] = []
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const height = page.getViewport({ scale: 1 }).height
      for (const a of await page.getAnnotations()) {
        if (a.subtype !== 'Widget' || !a.fieldName || a.pushButton) continue
        const r = a.rect ?? [0, 0, 0, 0]
        const rect: PdfField['rect'] = [round1(r[0]), round1(height - r[3]), round1(r[2]), round1(height - r[1])]
        if (a.fieldType === 'Btn') {
          const raw = textOf(a.fieldValue)
          if (a.radioButton) fields.push({ name: a.fieldName, kind: 'choice', value: raw === 'Off' ? '' : raw, page: p, rect })
          else fields.push({ name: a.fieldName, kind: 'check', value: raw !== '' && raw !== 'Off', page: p, rect })
        } else if (a.fieldType === 'Ch') {
          fields.push({ name: a.fieldName, kind: 'choice', value: textOf(a.fieldValue), page: p, rect, options: (a.options ?? []).map((o) => o.displayValue) })
        } else if (a.fieldType === 'Tx') {
          fields.push({ name: a.fieldName, kind: 'text', value: textOf(a.fieldValue), page: p, rect })
        }
      }
    }
    return { pageCount: doc.numPages, fields }
  } finally {
    void doc.destroy?.()
  }
}
