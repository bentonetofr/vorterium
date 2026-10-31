// ────────────────────────────────────────────────────────
// Prévia viva da ficha de Altherium (só no `npm run dev`; fora do build):
// /testes/altherium-viva.html. Ficha, abas, janelas e salvar de verdade, num
// banco falso na memória (_ficha-viva-db.ts), sem login.
// `?raiz=runaskin|pilar` troca a raiz; `?largura=820` põe numa caixa dessa largura;
// `?mestre=1` mostra a ficha com a barra da cena do mestre.
// ────────────────────────────────────────────────────────
import { seedFakeDb } from './_ficha-viva-db'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/theme/motion.css'
import '../src/features/sheets/components/SheetPanel.css'
import '../src/features/campaigns/pages/CampaignPages.css'
import '../src/shared/theme/touch.css'
import '../src/features/sheets/altherium/components/AltheriumSheet.css'
import { AltheriumSceneBar } from '../src/features/sheets/altherium/components/AltheriumSceneBar'
import { AltheriumMasterPanel } from '../src/features/sheets/altherium/components/AltheriumMasterPanel'
import { SheetEditor } from '../src/features/sheets/altherium/components/AltheriumSheetPanel'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { supabase } from '../src/shared/lib/supabase'
import type { AltheriumSheet } from '../src/shared/types'

const params = new URLSearchParams(location.search)
const width = Number(params.get('largura')) || undefined
const raiz = (params.get('raiz') ?? 'berserker') as AltheriumSheet['raiz']
const now = new Date().toISOString()

const sheet: AltheriumSheet = {
  id: 'sheet-1', campaign_id: 'camp-1', user_id: 'user-1', character_name: 'Gutris, O Nascido da Morte', portrait_url: null,
  level: 2, raiz, genesis: 'guerreiro',
  attr_furia: 6, attr_destino: 2, attr_espirito: 4, attr_impulso: 4, attr_estrategia: 2, attr_runico: raiz === 'runaskin' ? 2 : 0,
  vitality_roll: 6, vitality_current: 32, vitality_max: 45, equilibrio_roll: 5, equilibrio_current: 12, equilibrio_max: 15,
  fv_roll: null, fv_current: 14, fv_max: 24, pr_roll: null, pr_current: 8, pr_max: 24, cards_current: 20, hacksilvers: 1500,
  movement_override: null,
  db_pernas: 0, db_bracos: 0, db_tronco: 8, db_cabeca: 0, dano_pernas: 0, dano_bracos: 0, dano_tronco: 0, dano_cabeca: 0,
  berserker_triumphs: [], runaskin_trail: raiz === 'runaskin' ? 'regente' : null, runaskin_scene_uses: 0, runaskin_trail_overrides: {},
  pilar_card_mode: 'virtual', pilar_deck: null, recent_triumphs: [], genesis_abilities: [], skald_inspirations: [], notes: null,
  combat_state: {}, resources: {}, survival: {}, created_at: now, updated_at: now,
} as AltheriumSheet

seedFakeDb({
  altherium_character_sheets: [
    { ...sheet, is_npc: false },
    { ...sheet, id: 'sheet-2', user_id: 'user-2', character_name: 'Lyra, a Pilar', raiz: 'pilar', vitality_current: 18, vitality_max: 30, equilibrio_current: 8, cards_current: 13, is_npc: false, survival: { tokens: 3, hunger: 1 }, resources: { racao: { comum: 50 } } },
  ],
  altherium_character_domains: [
    { id: 'd1', sheet_id: 'sheet-1', domain: 'luta', points: 2, bonus_die: false, no_auto_disadvantage: false },
    { id: 'd2', sheet_id: 'sheet-1', domain: 'intimidacao', points: 1, bonus_die: false, no_auto_disadvantage: false },
    { id: 'd3', sheet_id: 'sheet-1', domain: 'sobrevivencia', points: 1, bonus_die: false, no_auto_disadvantage: false },
    { id: 'd4', sheet_id: 'sheet-1', domain: 'furtividade', points: 1, bonus_die: false, no_auto_disadvantage: false },
    { id: 'd5', sheet_id: 'sheet-1', domain: 'investigacao', points: 1, bonus_die: false, no_auto_disadvantage: false },
    { id: 'd6', sheet_id: 'sheet-1', domain: 'percepcao', points: 1, bonus_die: false, no_auto_disadvantage: false },
  ],
  altherium_character_inventory: [
    { id: 'i1', sheet_id: 'sheet-1', item_type: 'arma', item_id: 'machado_duas_laminas', quantity: 1, equipped: true, equipped_zone: null, custom_name: null, custom_detail: null, custom_db: null, custom_damage_dice: null, custom_damage_type: null, custom_attribute: null, custom_range: null, integrity: 100, reinforcements: [], crafted: null, created_at: now },
    { id: 'i2', sheet_id: 'sheet-1', item_type: 'arma', item_id: 'adaga_serrilhada', quantity: 1, equipped: false, equipped_zone: null, custom_name: null, custom_detail: null, custom_db: null, custom_damage_dice: null, custom_damage_type: null, custom_attribute: null, custom_range: null, integrity: 45, reinforcements: [], crafted: null, created_at: now },
    { id: 'i3', sheet_id: 'sheet-1', item_type: 'armadura', item_id: 'cota_malha_norte', quantity: 1, equipped: true, equipped_zone: 'db_tronco', custom_name: null, custom_detail: null, custom_db: null, custom_damage_dice: null, custom_damage_type: null, custom_attribute: null, custom_range: null, integrity: 70, reinforcements: [], crafted: null, created_at: now },
  ],
  altherium_runes: [],
  altherium_check_requests: [
    { id: 'r1', campaign_id: 'camp-1', master_id: 'm', targets: ['user-1'], kind: 'stealth', domain: null, label: 'Furtividade', dt: 8, amount: null, status: 'open', created_at: now, closed_at: null },
    { id: 'r2', campaign_id: 'camp-1', master_id: 'm', targets: ['user-1'], kind: 'equilibrium', domain: null, label: 'Corpos no salão', dt: 9, amount: 6, status: 'open', created_at: now, closed_at: null },
  ],
})

// Sem login: a prévia finge um usuário pra as rolagens gravarem no banco falso.
const fakeUser = { id: 'user-1', email: 'previa@vorterium.test' }
supabase.auth.getUser = (async () => ({ data: { user: fakeUser }, error: null })) as unknown as typeof supabase.auth.getUser

supabase.auth.getSession = (async () => ({ data: { session: { user: fakeUser, access_token: 'x', refresh_token: 'x', expires_in: 3600, token_type: 'bearer' } }, error: null })) as unknown as typeof supabase.auth.getSession
supabase.auth.onAuthStateChange = (() => ({ data: { subscription: { unsubscribe() {} } } })) as unknown as typeof supabase.auth.onAuthStateChange

function Preview() {
  if (params.get('painel') === '1') return <div style={{ maxWidth: 900, border: '1px solid #534434', padding: 16, borderRadius: 10, background: '#131b2e' }}><AltheriumMasterPanel campaignId="camp-1" /></div>
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [s, setS] = useState<AltheriumSheet>(sheet)
  return (
    <>
      {params.get('mestre') === '1' && <AltheriumSceneBar campaignId="camp-1" />}
      <SheetEditor sheet={s} ownerName="Prévia" onSheetUpdated={setS} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider><div style={{ padding: 16, width: '100%', maxWidth: width ?? 1100, margin: '0 auto' }}><Preview /></div></AuthProvider>,
)
