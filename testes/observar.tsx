// ────────────────────────────────────────────────────────
// Teste das rolagens dos outros jogadores (só no `npm run dev`; fora do
// build): /testes/observar.html. Sorteios falsos, sem banco nem login: abre o
// painel de teste de "outro jogador" e a bandeja com vários jogadores juntos.
// ────────────────────────────────────────────────────────
import { useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/features/sheets/dnd/components/DndSheet.css'
import type { DiceRoll, DiceRollContext } from '../src/shared/types'
import { parseDiceFormula, rollParsedFormula } from '../src/features/dice/services/diceService'
import { DICE_SKINS } from '../src/features/dice3d/skins'
import { DndWatchPanel } from '../src/features/sheets/dnd/rolls/DndWatchPanel'
import { DndWatchTray } from '../src/features/sheets/dnd/rolls/DndWatchTray'

let n = 0
function fake(formula: string, label: string, context: DiceRollContext, skin: string, user: string): DiceRoll {
  const r = rollParsedFormula(parseDiceFormula(formula), { floor: false })
  return {
    id: `fake-${++n}`, campaign_id: 'c', user_id: user, die_type: 'd20', result: r.total, quantity: r.legacyQty, modifier: r.legacyModifier,
    individual_results: null, total_result: r.total, roll_mode: r.legacyRollMode, kept_result: r.legacyKeptResult,
    formula: r.formula, roll_breakdown: r.breakdown, is_private: false, created_at: new Date().toISOString(),
    roll_label: label, roll_context: context, dice_skin: skin, no_floor: true,
  }
}

const PEOPLE = [
  { id: 'a', player: 'Bruna', character: 'Zé Capivara', skin: DICE_SKINS[0].id },
  { id: 'b', player: 'Maria', character: 'Lyra', skin: DICE_SKINS[4].id },
  { id: 'c', player: 'Nicolas', character: 'Grum', skin: DICE_SKINS[5].id },
]

function Page() {
  const [panel, setPanel] = useState<DiceRoll | null>(null)
  const [pending, setPending] = useState<DiceRoll[]>([])
  const take = useCallback((id: string) => setPending((l) => l.filter((r) => r.id !== id)), [])
  const who = new Map(PEOPLE.map((p) => [p.id, p]))

  const check = (hidden = false) => {
    const p = PEOPLE[n % 3]
    const roll = fake('1d20+7', 'Furtividade', { system: 'dnd5e', kind: 'skill', key: 'stealth', character: p.character, advantage: 'normal', natural: 0, dc: hidden ? null : 14, dc_hidden: hidden || undefined }, p.skin, p.id)
    const nat = (roll.roll_breakdown?.[0] as { results: number[] }).results[0]
    roll.roll_context = { ...roll.roll_context, natural: nat, outcome: hidden ? null : roll.result >= 14 ? 'success' : 'failure', crit: nat === 20 ? 'crit' : nat === 1 ? 'fumble' : null }
    setPanel(roll)
  }
  const damage = () => setPending(PEOPLE.map((p, i) => fake(['2d6+3', '1d8+4', '3d6'][i], ['Dano: Espada', 'Dano: Clava', 'Bola de Fogo'][i], { system: 'dnd5e', kind: 'damage', character: p.character }, p.skin, p.id)))

  return (
    <div style={{ padding: 24, color: '#eee', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => check()}>Teste de outro jogador</button>
      <button onClick={() => check(true)}>Teste com CD oculta</button>
      <button onClick={damage}>Dano de 3 jogadores juntos</button>
      {panel && <DndWatchPanel key={panel.id} roll={panel} player={who.get(panel.user_id)?.player ?? '?'} hurry={false} onDone={() => setPanel(null)} />}
      <DndWatchTray pending={pending} take={take} nameOf={(r) => who.get(r.user_id)?.character ?? '?'} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
