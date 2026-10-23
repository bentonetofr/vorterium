// ────────────────────────────────────────────────────────
// Gera o arquivo de teste da importação de ficha por PDF a partir de um PDF
// real: lê os campos com o mesmo leitor do site e grava src/.../__fixtures__.
// Uso: npx vite-node scripts/import-ficha-fixture.ts "caminho/da ficha.pdf" nome-do-arquivo
// ────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { readPdfFields, type PdfLib } from '../src/features/sheets/dnd/import/pdfFields'

const [, , pdfPath, outName] = process.argv
if (!pdfPath || !outName) { console.error('Uso: vite-node scripts/import-ficha-fixture.ts <pdf> <nome>'); process.exit(1) }

const libUrl = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href
const lib = (await import(/* @vite-ignore */ libUrl)) as unknown as PdfLib
const read = await readPdfFields(new Uint8Array(fs.readFileSync(pdfPath)), lib)
const out = path.resolve('src/features/sheets/dnd/import/__fixtures__', `${outName}.fields.json`)
fs.mkdirSync(path.dirname(out), { recursive: true })
// uma linha por campo: [nome, tipo, valor, página, x0, y0, x1, y1] (compacto)
const rows = read.fields.map((f) => [f.name, f.kind, f.value, f.page, ...f.rect])
fs.writeFileSync(out, `{"pageCount":${read.pageCount},"fields":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`)
console.log(`${read.fields.length} campos, ${read.pageCount} páginas -> ${out}`)
