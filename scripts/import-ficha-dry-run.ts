// ────────────────────────────────────────────────────────
// Ensaio da importação de ficha por PDF no terminal: lê um PDF, roda o
// planejador respondendo cada pergunta com a opção recomendada (ou a primeira)
// e mostra as perguntas e o resumo. Não grava nada.
// Uso: npx vite-node scripts/import-ficha-dry-run.ts "caminho/da ficha.pdf"
// ────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { SPELLS } from '../src/features/sheets/dnd/catalog/spells'
import { makeSheet } from '../src/features/sheets/dnd/components/fixtures'
import { runImport } from '../src/features/sheets/dnd/import/plan'
import { readPdfFields, type PdfLib } from '../src/features/sheets/dnd/import/pdfFields'
import { readSheetFromPdf } from '../src/features/sheets/dnd/import/readPdf'
import type { Answers, Question } from '../src/features/sheets/dnd/import/types'

const pdf = process.argv[2]
if (!pdf) { console.error('Uso: vite-node scripts/import-ficha-dry-run.ts <pdf>'); process.exit(1) }
const lib = (await import(/* @vite-ignore */ pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href)) as unknown as PdfLib
const fields = await readPdfFields(new Uint8Array(fs.readFileSync(pdf)), lib)
const out = readSheetFromPdf(fields)
if (!out.ok) { console.log('RECUSADO:', out.message); process.exit(0) }

const answers: Answers = {}
const log: string[] = []
function pick(q: Question): string | number | string[] {
  if (q.kind === 'choice') return q.recommended ?? q.options[0].value
  if (q.kind === 'multi') return q.options.filter((o) => o.checked).map((o) => o.value)
  if (q.kind === 'number') return q.defaultValue ?? q.min
  return q.defaultValue ?? ''
}
for (let i = 0; i < 100; i++) {
  const r = runImport({ read: out.sheet, existing: makeSheet(), spells: SPELLS }, answers)
  if (r.done) {
    console.log(log.join('\n'))
    console.log('\n=== RESUMO ===')
    console.log(r.draft.report.join('\n'))
    const d = r.draft
    console.log('\nclasses', JSON.stringify(d.classes))
    console.log('form', JSON.stringify({ ...d.form, backstory: d.form.backstory.slice(0, 60), notes: d.form.notes.slice(0, 60) }))
    console.log('skills', d.skills.map((s) => s.skill_key + (s.expertise ? '*' : '')).join(','))
    console.log('attacks', JSON.stringify(d.attacks))
    console.log('inventory', JSON.stringify(d.inventory.map((i) => [i.name, i.quantity, i.equipped, i.catalog_entry_key])))
    console.log('spells', JSON.stringify(d.spells.map((s) => [s.name, s.spell_level, s.catalog_key, s.prepared])))
    console.log('profs', JSON.stringify(d.proficiencies))
    console.log('features', JSON.stringify(d.features.map((f) => [f.source, f.feature_key, f.name])))
    console.log('overrides', JSON.stringify(d.overrides))
    console.log('slotsUsed', JSON.stringify(d.slotsUsed))
    break
  }
  const q = r.question
  const a = pick(q)
  log.push(`[${q.section}] ${q.id} (${q.kind}) → ${JSON.stringify(a)}${q.kind === 'choice' ? ` | ${q.title}` : ` | ${q.title}`}`)
  answers[q.id] = a
}
