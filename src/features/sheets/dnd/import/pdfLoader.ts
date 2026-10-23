import type { PdfLib } from './pdfFields'

// ────────────────────────────────────────────────────────
// Carrega o pdf.js (e o worker dele) só na hora de importar: é um pedaço
// grande e separado do site. A versão "legacy" roda em navegadores mais velhos.
// ────────────────────────────────────────────────────────

export async function loadPdfLib(): Promise<PdfLib> {
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  lib.GlobalWorkerOptions.workerSrc = worker.default
  return lib as unknown as PdfLib
}
