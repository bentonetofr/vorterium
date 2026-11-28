// Teste visual da aba Ficha de DaggerHeart como MESTRE (só no `npm run dev`): /testes/dh-mestre.html — jogadores, adversários, ambientes
// e NPCs num banco falso na memória (_ficha-viva-db.ts), sem login. As fichas abrem em janelas flutuantes.
// `?jogador=1` mostra a visão do jogador (sem a ficha própria, que precisa de login): só o que o mestre mostrou, para ler.
// Limpe as janelas lembradas com: localStorage.removeItem('vorterium:janelas:c1')
import { seedFakeDb } from './_ficha-viva-db'
import { createRoot } from 'react-dom/client'
import '../src/styles'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { DialogHost } from '../src/shared/components/dialogs'
import { DhSheetPanel } from '../src/features/sheets/daggerheart/components/DhSheetPanel'
import { ENVIRONMENT_PRESETS, emptyAdversary } from '../src/features/sheets/daggerheart/model/gm'
import { emptySheet } from '../src/features/sheets/daggerheart/model/defaults'
import { newCounter } from '../src/features/sheets/daggerheart/model/counters'

const player = new URLSearchParams(location.search).has('jogador')
const veneno = { ...newCounter('Veneno'), value: 2 }
const carga = { ...newCounter('Cargas', 3), value: 1 }
const lobo = { ...emptyAdversary(), name: 'Lobo Sombrio', kind: 'Bruto', hp: 6, hpMarked: 3, stressMarked: 1, counters: [veneno, carga] }
const t = (n: number) => `2026-01-0${n}T00:00:00Z`

const sheet = (id: string, name: string, extra: Record<string, unknown>, npc = false) => ({
  id, campaign_id: 'c1', user_id: npc ? 'm1' : `u-${id}`, character_name: name, is_npc: npc, npc_visible: npc, created_at: t(Number(id.slice(-1)) || 1), updated_at: t(1),
  data: { ...emptySheet('feiticeiro'), started: true, name, subclassKey: 'primordialista', ancestryKey: 'elfo', communityKey: 'erudita', ...extra },
})

seedFakeDb({
  site_features: [{ key: 'daggerheart', enabled: true, updated_at: t(1) }],
  dh_sheets: [
    sheet('p1', 'tESTE FADINHA', { hpMarked: 2, stressMarked: 1, hope: 4 }),
    sheet('p2', 'Marlowe Fairwind', { hpMarked: 4, stressMarked: 3, hope: 2, level: 3 }),
    sheet('n1', 'vlevors', { hpMarked: 1 }, true),
    { ...sheet('n2', 'zdfvgbfd', { classKey: 'guardiao', subclassKey: null, level: 2 }, true) },
    sheet('n3', 'Novo NPC', { classKey: null, started: false }, true),
  ],
  dh_gm_sheets: [
    { id: 'g1', campaign_id: 'c1', kind: 'adversary', visible: true, data: lobo, created_at: t(1), updated_at: t(1) },
    { id: 'g2', campaign_id: 'c1', kind: 'adversary', visible: false, data: { ...emptyAdversary(), name: 'Goblin' }, created_at: t(2), updated_at: t(2) },
    { id: 'g3', campaign_id: 'c1', kind: 'environment', visible: true, data: ENVIRONMENT_PRESETS[0].build(), created_at: t(3), updated_at: t(3) },
  ],
  dh_fear: [{ campaign_id: 'c1', value: 4 }],
})

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <DhSheetPanel campaignId="c1" userRole={player ? 'player' : 'master'} />
      <DialogHost />
    </div>
  </AuthProvider>,
)
