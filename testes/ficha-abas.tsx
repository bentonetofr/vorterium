// ────────────────────────────────────────────────────────
// Prévia das abas da ficha de D&D com a ficha de exemplo (só no `npm run dev`;
// fora do build): /testes/ficha-abas.html?aba=atributos|combate|magias|personagem
// Sem banco e sem login. `?manual=1` deixa os valores calculados em modo manual.
// ────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/features/sheets/dnd/components/DndSheet.css'
import { cls, makeCtx, makeData, makeSheet, now, resource } from '../src/features/sheets/dnd/components/fixtures'
import { DndAtributosTab } from '../src/features/sheets/dnd/components/DndAtributosTab'
import { DndCombateTab } from '../src/features/sheets/dnd/components/DndCombateTab'
import { DndMagiasTab } from '../src/features/sheets/dnd/components/DndMagiasTab'
import { DndPersonagemTab } from '../src/features/sheets/dnd/components/DndPersonagemTab'
import type { DndDerivedField } from '../src/shared/types'

const params = new URLSearchParams(location.search)
const tab = params.get('aba') ?? 'atributos'
const manual = params.get('manual') === '1'
const klass = params.get('classe')

const base = makeData()
const overrides = manual
  ? (['mod_strength', 'mod_dexterity', 'save_strength', 'skill_stealth', 'armor_class', 'initiative_bonus'] as DndDerivedField[]).map((f, i) => ({ id: `o${i}`, sheet_id: 's1', field_key: f, manual_value: f === 'mod_strength' ? '-2' : '3', reason: '', updated_at: now }))
  : []
const data = makeData({
  details: { ...base.details, overrides },
  ...(klass ? { classes: [cls(klass, 5, true)] } : {}),
  ...(klass === 'warlock' ? { resources: [resource('pact_slot', 'Pacto (3º nível)', 1, 2, 'short', 'spell_slots')] } : {}),
})
const ctx = makeCtx({ sheet: makeSheet(klass ? { class_key: klass } : {}), data })

const TABS = { atributos: DndAtributosTab, combate: DndCombateTab, magias: DndMagiasTab, personagem: DndPersonagemTab } as const
const Tab = TABS[tab as keyof typeof TABS] ?? DndAtributosTab
createRoot(document.getElementById('root')!).render(
  <div className="dsh-sheet" style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}><Tab ctx={ctx} /></div>,
)
