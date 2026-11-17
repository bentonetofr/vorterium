// Teste visual da ficha de DaggerHeart (só no `npm run dev`): /testes/daggerheart.html — sem banco, tudo em memória.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles'
import { DialogHost } from '../src/shared/components/dialogs'
import { armorEntry } from '../src/features/sheets/daggerheart/catalog/armor'
import { weaponEntry } from '../src/features/sheets/daggerheart/catalog/weapons'
import { emptySheet } from '../src/features/sheets/daggerheart/model/defaults'
import { armorToSlot, weaponToSlot } from '../src/features/sheets/daggerheart/model/gear'
import type { DhSheetData } from '../src/features/sheets/daggerheart/model/types'
import { DhCardsTab } from '../src/features/sheets/daggerheart/components/DhCardsTab'
import { DhCreator } from '../src/features/sheets/daggerheart/components/DhCreator'
import { DhExtraTab } from '../src/features/sheets/daggerheart/components/DhExtraTab'
import { DhLevelTab } from '../src/features/sheets/daggerheart/components/DhLevelTab'
import { DhPersonTab } from '../src/features/sheets/daggerheart/components/DhPersonTab'
import { DhRestTab } from '../src/features/sheets/daggerheart/components/DhRestTab'
import { DhSheetMain } from '../src/features/sheets/daggerheart/components/DhSheetMain'

function exemplo(): DhSheetData {
  return {
    ...emptySheet('feiticeiro'),
    name: 'Marlowe Fairwind', pronouns: 'Ela/Dela', subclassKey: 'primordialista', ancestryKey: 'elfo', communityKey: 'erudita',
    traits: { agility: 0, strength: -1, finesse: 1, instinct: 2, presence: 1, knowledge: 0 },
    armor: armorToSlot(armorEntry('gambeson-armor')!), primary: weaponToSlot(weaponEntry('dualstaff')!),
    experiences: [{ id: 'a', name: 'Mago Real', mod: 2 }, { id: 'b', name: 'Não Na Minha Guarda', mod: 2 }],
    inventory: ['Poção Menor de Fadiga (recupera 1d4 Pontos de Fadiga)', 'Um orbe sussurrante'],
    loadout: ['rune-ward', 'unleash-chaos'], hpMarked: 2, stressMarked: 1, hope: 3, armorMarked: 1, gold: { handfuls: 3, bags: 1, chests: 0 },
    description: { clothes: 'em camadas', eyes: 'oceano sem fim', body: 'alto', skin: 'rosa', attitude: 'de comandante' },
  }
}

function Demo() {
  const [d, setD] = useState<DhSheetData>(exemplo())
  const [tab, setTab] = useState('ficha')
  const [criar, setCriar] = useState(false)
  const update = (fn: (x: DhSheetData) => DhSheetData) => setD(fn)
  const target = { campaignId: 'x', sheetId: 'y', character: d.name }
  if (criar) return <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}><DhCreator initial={emptySheet()} onDone={(x) => { setD(x); setCriar(false) }} /></div>
  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {['ficha', 'cartas', 'nivel', 'personagem', 'descanso', 'extras'].map((t) => <button key={t} className={`btn${tab === t ? ' btn-primary' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        <button className="btn" onClick={() => setCriar(true)}>assistente</button>
        <button className="btn" onClick={() => setD({ ...exemplo(), classKey: 'patrulheiro', subclassKey: 'treinador', level: 1 })}>patrulheiro</button>
        <button className="btn" onClick={() => setD({ ...exemplo(), classKey: 'druida', subclassKey: 'protetor_elementos' })}>druida</button>
      </div>
      <div className="dh-sheet">
        {tab === 'ficha' && <DhSheetMain data={d} update={update} target={target} canEdit />}
        {tab === 'cartas' && <DhCardsTab data={d} update={update} canEdit />}
        {tab === 'nivel' && <DhLevelTab data={d} update={update} canEdit />}
        {tab === 'personagem' && <DhPersonTab data={d} update={update} canEdit />}
        {tab === 'descanso' && <DhRestTab data={d} update={update} canEdit />}
        {tab === 'extras' && <DhExtraTab data={d} update={update} canEdit />}
      </div>
      <DialogHost />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Demo />)
