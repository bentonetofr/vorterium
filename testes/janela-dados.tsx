// ────────────────────────────────────────────────────────
// Teste do painel de dados do D&D (a janela do canto) (só no `npm run dev`; fora do build):
// /testes/janela-dados.html. O banco é trocado por um falso em memória, então
// não precisa de login: rola, grava no "histórico" e troca o conjunto de dados.
// ────────────────────────────────────────────────────────
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { Presence } from '../src/shared/components/Presence'
import { supabase } from '../src/shared/lib/supabase'
import { CurrentCampaignProvider } from '../src/features/campaigns/CurrentCampaignContext'
import { DndDiceCard } from '../src/features/sheets/dnd/rolls/DndDiceCard'

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any
sb.auth.getUser = async () => ({ data: { user: { id: 'u1' } } })
const rows: any[] = []
let skin = 'madeira'
sb.from = () => {
  const q: any = {
    insert: (row: any) => { q.row = { ...row, id: `r${rows.length + 1}`, created_at: new Date().toISOString() }; return q },
    select: () => q,
    single: async () => { rows.unshift(q.row); return { data: q.row, error: null } },
    eq: () => q,
    order: () => q,
    limit: async () => ({ data: rows.map((r) => ({ ...r, profiles: { id: r.user_id, display_name: 'Você' } })), error: null }),
    maybeSingle: async () => ({ data: { dice_skin: skin }, error: null }),
    update: (v: any) => ({ eq: async () => { if (v.dice_skin) skin = v.dice_skin; return { error: null } } }),
  }
  return q
}

function Page() {
  const [open, setOpen] = useState(true)
  return (
    <CurrentCampaignProvider>
      <div style={{ padding: 24, color: '#eee' }}>
        <button onClick={() => setOpen(true)} style={{ padding: '8px 16px' }}>Abrir o cartão de dados</button>
        {open && <DndDiceCard campaignId="c1" currentUserId="u1" onClose={() => setOpen(false)} />}
      </div>
    </CurrentCampaignProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
