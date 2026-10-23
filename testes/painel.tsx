// ────────────────────────────────────────────────────────
// Teste do painel de rolagem do D&D e da bandeja (só no `npm run dev`; fora do
// build): /testes/painel.html. Usa um sorteio falso no lugar do banco, então
// não precisa de login. Botões abrem o painel com cada tipo de teste.
// ────────────────────────────────────────────────────────
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/components/ModalOverlay.css'
import '../src/features/sheets/dnd/components/DndSheet.css'
import type { DiceRoll } from '../src/shared/types'
import { parseDiceFormula, rollParsedFormula, type RollExtras, type RollResult } from '../src/features/dice/services/diceService'
import { DICE_SKINS } from '../src/features/dice3d/skins'
import { computeDerived } from '../src/features/sheets/dnd/rules/derive'
import { attackCheck, deathCheck, initiativeCheck, saveCheck, skillCheck, type CheckSpec } from '../src/features/sheets/dnd/rolls/checkModel'
import { DndCheckPanel } from '../src/features/sheets/dnd/rolls/DndCheckPanel'
import { DndDiceTray, type TrayJob } from '../src/features/sheets/dnd/rolls/DndDiceTray'

const derived = computeDerived({
  abilities: { strength: 16, dexterity: 17, constitution: 12, intelligence: 10, wisdom: 13, charisma: 8 },
  classes: [{ classKey: 'rogue', level: 5 }],
  skillProficiency: { stealth: 'expertise', perception: 'proficient', sleight_of_hand: 'expertise' },
  saveProficiency: { dexterity: true, intelligence: true },
})

let n = 0
function fakeRoll(rolled: RollResult, extras: RollExtras): DiceRoll {
  return {
    id: `fake-${++n}`, campaign_id: 'c', user_id: 'u', die_type: 'd20', result: rolled.total, quantity: rolled.legacyQty, modifier: rolled.legacyModifier,
    individual_results: null, total_result: rolled.total, roll_mode: rolled.legacyRollMode, kept_result: rolled.legacyKeptResult,
    formula: rolled.formula, roll_breakdown: rolled.breakdown, is_private: false, created_at: new Date().toISOString(),
    roll_label: extras.label ?? null, roll_context: extras.context ?? null, dice_skin: extras.skin ?? null, no_floor: !!extras.noFloor,
  }
}

const SPECS: [string, () => CheckSpec][] = [
  ['Prestidigitação CD 10', () => ({ ...skillCheck(derived, 'sleight_of_hand'), dc: 10 })],
  ['Furtividade (sem CD)', () => skillCheck(derived, 'stealth')],
  ['Salvaguarda de Destreza CD 15', () => ({ ...saveCheck(derived, 'dexterity'), dc: 15 })],
  ['Pedido do mestre, CD oculta', () => ({ ...saveCheck(derived, 'wisdom'), dcHidden: true, requestId: 'req' })],
  ['Iniciativa', () => initiativeCheck(derived)],
  ['Ataque: Espada curta', () => attackCheck('Espada curta', 'shortsword', 'dexterity', 3, 3, 6)],
  ['Morte', () => deathCheck()],
]

function App() {
  const [spec, setSpec] = useState<CheckSpec | null>(null)
  const [skin, setSkin] = useState('madeira')
  const [inspired, setInspired] = useState(true)
  const [tray, setTray] = useState<TrayJob | null>(null)
  const [log, setLog] = useState('')
  const damage = (formula: string, label: string) => {
    const rolled = rollParsedFormula(parseDiceFormula(formula))
    setTray({ id: ++n, label, roll: fakeRoll(rolled, { label }), skin })
  }
  return (
    <div className="dsh-sheet" style={{ minHeight: '100vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--dsh-bone)' }}>Painel de rolagem (teste)</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={skin} onChange={(e) => setSkin(e.target.value)}>{DICE_SKINS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label style={{ color: 'var(--text-secondary)' }}><input type="checkbox" checked={inspired} onChange={(e) => setInspired(e.target.checked)} /> tem Inspiração</label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SPECS.map(([name, make]) => <button key={name} type="button" className="dsh-chip" onClick={() => setSpec(make())}>{name}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => damage('1d6+3', 'Dano: Espada curta')}>Dano 1d6+3</button>
        <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => damage('8d6', 'Bola de Fogo')}>Bola de Fogo 8d6</button>
        <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => damage('3d6+1d8+2', 'Ataque Furtivo')}>3d6+1d8+2</button>
        <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => damage('1d100', 'Tabela de loot')}>d100</button>
      </div>
      <pre id="log" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{log}</pre>
      {spec && (
        <DndCheckPanel
          spec={spec} character="Lia Sombra" sheetId="s1" skin={skin}
          perform={async (formula, build) => { const r = rollParsedFormula(parseDiceFormula(formula), { floor: false }); return fakeRoll(r, build(r)) }}
          revealDc={async () => 14}
          inspiration={{ has: inspired, spend: () => setInspired(false) }}
          onResult={(d) => setLog(`${spec.label}: d20 ${d.reading.d20s.join('/')} → total ${d.reading.total}, CD ${d.dc ?? '-'}, ${d.outcome ?? 'sem CD'}${d.crit ? `, ${d.crit}` : ''}\ncontexto: ${JSON.stringify(d.roll.roll_context)}`)}
          onClose={() => setSpec(null)}
        />
      )}
      <DndDiceTray job={tray} onDone={() => setTray(null)} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
