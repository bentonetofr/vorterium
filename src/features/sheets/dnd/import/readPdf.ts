import { isJohnBard, readJohnBard } from './models/johnbard'
import type { PdfFieldsRead } from './pdfFields'
import type { SheetRead } from './readTypes'

// ────────────────────────────────────────────────────────
// Do PDF lido (campos) para a leitura da ficha: descobre o modelo e usa o
// leitor dele. Sem campos de formulário, ou com um modelo que não conhecemos,
// devolve um motivo claro para a janela explicar (nunca chuta).
// ────────────────────────────────────────────────────────

export type ReadOutcome =
  | { ok: true; sheet: SheetRead }
  | { ok: false; reason: 'no-form' | 'unknown-model'; message: string }

export function readSheetFromPdf(read: PdfFieldsRead): ReadOutcome {
  if (read.fields.length === 0) {
    return { ok: false, reason: 'no-form', message: 'Este PDF não tem campos de formulário (parece uma ficha impressa ou escaneada, só com imagem). Não há dados para ler: use o PDF preenchível da ficha, o mesmo arquivo que você preenche no computador.' }
  }
  if (isJohnBard(read.fields)) return { ok: true, sheet: readJohnBard(read.fields) }
  return { ok: false, reason: 'unknown-model', message: 'Este PDF tem formulário, mas não é de um modelo de ficha que o sistema conhece ainda. Hoje a importação lê a ficha preenchível "JohnBard.com DnD 5e CS" (a mais usada, também em português). Se a sua é outra, mande um exemplo para o sistema aprender a ler.' }
}
