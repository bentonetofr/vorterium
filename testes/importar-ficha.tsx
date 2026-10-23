// ────────────────────────────────────────────────────────
// Teste da janela de importar ficha por PDF (só no `npm run dev`; fora do
// build): /testes/importar-ficha.html. O banco é trocado por um falso em
// memória. Para testar sem escolher arquivo, ponha uma ficha em
// testes/_ficha-exemplo.pdf (fica fora do git) e use o botão "Carregar o PDF
// de exemplo". Em `window.__saved` fica o que seria gravado na ficha.
// ────────────────────────────────────────────────────────
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/features/sheets/dnd/components/DndSheet.css'
import { Presence } from '../src/shared/components/Presence'
import { supabase } from '../src/shared/lib/supabase'
import { makeData, makeSheet } from '../src/features/sheets/dnd/components/fixtures'
import { DndImportWizard } from '../src/features/sheets/dnd/import/DndImportWizard'

/* eslint-disable @typescript-eslint/no-explicit-any */
const tables: Record<string, any[]> = {}
const log: string[] = []
;(window as any).__db = { tables, log }
;(supabase as any).from = (table: string) => {
  const rows = () => (tables[table] ??= [])
  let mode = 'select'
  let payload: any[] = []
  const q: any = {
    select: () => { mode = 'select'; return q },
    delete: () => { mode = 'delete'; return q },
    insert: (r: any) => { mode = 'insert'; payload = Array.isArray(r) ? r : [r]; return q },
    eq: () => q, neq: () => q,
    then: (resolve: (v: unknown) => void) => {
      if (mode === 'select') resolve({ data: rows().map((r) => ({ ...r })), error: null })
      else if (mode === 'delete') { tables[table] = []; log.push(`delete ${table}`); resolve({ error: null }) }
      else { log.push(`insert ${table} x${payload.length}`); rows().push(...payload); resolve({ error: null }) }
    },
  }
  return q
}

function Page() {
  const [open, setOpen] = useState(true)
  async function sample() {
    const input = document.querySelector<HTMLInputElement>('input[type=file]')
    if (!input) return
    const blob = await (await fetch('/testes/_ficha-exemplo.pdf')).blob()
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'FICHA DE EXEMPLO.pdf', { type: 'application/pdf' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return (
    <div style={{ padding: 24, color: '#eee', display: 'flex', gap: 8 }}>
      <button onClick={() => setOpen(true)}>Abrir a janela</button>
      <button onClick={() => void sample()}>Carregar o PDF de exemplo</button>
      <Presence show={open}>
        {() => <DndImportWizard sheet={makeSheet()} data={makeData()} saveSheet={async (p) => { (window as any).__saved = p }} lock={() => {}} onClose={() => setOpen(false)} />}
      </Presence>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
