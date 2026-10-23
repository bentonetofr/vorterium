// ────────────────────────────────────────────────────────
// Prévia viva da ficha de D&D inteira (só no `npm run dev`; fora do build):
// /testes/ficha-viva.html. Cabeçalho, as sete abas, salvar, adicionar e remover
// de verdade, num banco falso na memória (_ficha-viva-db.ts), sem login.
// `?largura=820` põe a ficha numa caixa dessa largura (o painel do Vortable);
// `?atraso=800` deixa a "rede" mais lenta.
// ────────────────────────────────────────────────────────
import { seedFakeDb } from './_ficha-viva-db'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/theme/motion.css'
import '../src/features/sheets/components/SheetPanel.css'
import '../src/features/campaigns/pages/CampaignPages.css'
import '../src/shared/theme/touch.css'
import { cls, details, feature, makeData, makeSheet, resource } from '../src/features/sheets/dnd/components/fixtures'
import { DndSheetForm } from '../src/features/sheets/dnd/components/DndSheetForm'
import type { DndCharacterSheet, DndCharacterSheetUpdateInput } from '../src/shared/types'

const params = new URLSearchParams(location.search)
const width = Number(params.get('largura')) || undefined

const example = details()
seedFakeDb({
  dnd_character_skills: example.skills,
  dnd_character_attacks: example.attacks,
  dnd_character_inventory: example.inventory,
  dnd_character_spells: example.spells,
  dnd_character_proficiencies: makeData().proficiencies,
  dnd_character_classes: [cls('fighter', 3, true, 'champion'), cls('wizard', 2, false)],
  dnd_character_resources: [resource('rage', 'Fúria', 1, 2, 'long', 'manual'), resource('superiority', 'Dados de Superioridade', 3, 4, 'short', 'manual')],
  dnd_character_features: [feature('fighter__second_wind', 'class', 'Retomar o Fôlego', 1), feature(null, 'manual', 'Cicatriz de guerra', null)],
})

function Preview() {
  const [sheet, setSheet] = useState<DndCharacterSheet>(() => makeSheet())
  async function save(data: DndCharacterSheetUpdateInput) {
    await new Promise((r) => setTimeout(r, 300))
    setSheet((s) => ({ ...s, ...data, updated_at: new Date().toISOString() }) as DndCharacterSheet)
  }
  return (
    <DndSheetForm
      sheet={sheet} onSave={save} saveError={null} portraitBusy={false} isNpc /* sem login: esconde o botão do boneco do Vortable */
      onPortraitChange={async () => {}} onPortraitRemove={() => {}}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 16, width: '100%', maxWidth: width ?? 1100, margin: '0 auto' }}><Preview /></div>,
)
