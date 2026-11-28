// Teste visual do lado do mestre do DaggerHeart (só no `npm run dev`): /testes/dh-mestre.html — adversários e ambientes num banco falso
// na memória (_ficha-viva-db.ts), sem login. `?jogador=1` mostra como o jogador vê (só o que o mestre mostrou, sem editar).
import { seedFakeDb } from './_ficha-viva-db'
import { createRoot } from 'react-dom/client'
import '../src/styles'
import { DialogHost } from '../src/shared/components/dialogs'
import { DhGmSection } from '../src/features/sheets/daggerheart/components/DhGmSection'
import { ENVIRONMENT_PRESETS, emptyAdversary } from '../src/features/sheets/daggerheart/model/gm'
import { newCounter } from '../src/features/sheets/daggerheart/model/counters'

const player = new URLSearchParams(location.search).has('jogador')
const veneno = { ...newCounter('Veneno'), value: 2 }
const carga = { ...newCounter('Cargas', 3), value: 1 }
const lobo = { ...emptyAdversary(), name: 'Lobo Sombrio', kind: 'Bruto', hp: 6, hpMarked: 3, stressMarked: 1, counters: [veneno, carga] }

seedFakeDb({
  dh_gm_sheets: [
    { id: 'g1', campaign_id: 'c1', kind: 'adversary', visible: true, data: lobo, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 'g2', campaign_id: 'c1', kind: 'adversary', visible: false, data: { ...emptyAdversary(), name: 'Goblin' }, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    { id: 'g3', campaign_id: 'c1', kind: 'environment', visible: true, data: ENVIRONMENT_PRESETS[0].build(), created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z' },
  ],
  dh_fear: [{ campaign_id: 'c1', value: 4 }],
})

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 16, maxWidth: 980, margin: '0 auto' }}>
    <DhGmSection campaignId="c1" isMaster={!player} />
    <DialogHost />
  </div>,
)
