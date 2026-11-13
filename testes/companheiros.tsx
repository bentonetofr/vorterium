// Teste da aba Companheiros da ficha de D&D (só no `npm run dev`): /testes/companheiros.html?classe=artificer|ranger|druid
// Sem banco e sem login; as mudanças ficam só na tela. `?vazio=1` começa sem companheiros.
import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/features/sheets/dnd/components/DndSheet.css'
import '../src/features/sheets/dnd/components/DndCompanheiros.css'
import { cls, makeCtx, makeData } from '../src/features/sheets/dnd/components/fixtures'
import { DndCompanheirosTab } from '../src/features/sheets/dnd/components/DndCompanheirosTab'
import { companionFromPreset } from '../src/features/sheets/dnd/model/companionCatalog'
import type { DndForm } from '../src/features/sheets/dnd/model/sheetForm'
import type { SheetCtx } from '../src/features/sheets/dnd/components/sheetContext'

const params = new URLSearchParams(location.search)
const klass = params.get('classe') ?? 'artificer'
const data = makeData({ classes: [cls(klass === 'artificer' ? 'hb_artificeiro' : klass, 5, true)] })
const base = makeCtx({ data })
const first = klass === 'ranger' ? ['primal:land', 'ranger:wolf'] : klass === 'druid' ? ['wildfire'] : ['steel', 'cannon:flamethrower', 'familiar:owl', 'steed:warhorse']

function App() {
  const [form, setForm] = useState<DndForm>(() => ({
    ...base.form, class_names: klass === 'artificer' ? { hb_artificeiro: 'Artificeiro' } : {},
    companions: params.get('vazio') ? [] : first.map((k) => companionFromPreset(k)!).map((c) => ({ ...c, hp: c.hp_max })),
  }))
  const ctx: SheetCtx = useMemo(() => ({
    ...base, form,
    set: (k, v) => setForm((f) => ({ ...f, [k]: v })),
    update: (fn) => setForm(fn),
  }), [form])
  return <div className="dsh-sheet" style={{ padding: 16, maxWidth: 1000, margin: '0 auto' }}><DndCompanheirosTab ctx={ctx} /></div>
}
createRoot(document.getElementById('root')!).render(<App />)
