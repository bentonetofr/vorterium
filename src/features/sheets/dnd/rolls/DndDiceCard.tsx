import { useCallback, useEffect, useRef, useState } from 'react'
import { DiceRollerPanel } from '../../../dice/components/DiceRollerPanel'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { getMyDiceSkin, onDiceSkinChange, setMyDiceSkin } from '../../../dice3d/diceSkinService'
import { stageDiceFor } from './diceKinds'
import { DndDiceVitrine } from './DndDiceVitrine'
import { freeContext, freeLabel, readFree, resultsText, type FreeGroup, type FreeReading } from './freeRoll'
import { markRollBusy } from './rollActivity'
import { useDiceStage } from './useDiceStage'
import '../components/DndSheet.css'
import '../components/DndMotion.css'
import './DndRolls.css'
import './DndDiceWindow.css'

// ────────────────────────────────────────────────────────
// O cartão de dados das campanhas de D&D: abre no centro da tela ao clicar na
// bolinha de dados, na moldura dos testes (palco com os dados 3D no alto), com
// o rolador do site embaixo: rolagem rápida, fórmulas (1d20+5, 2#d20+5 para o
// maior de dois, 2@d20+5 para o menor, até 100 dados), rolagem privada e os
// recentes. Rolar joga os dados ali mesmo, no palco, e a mesa vê a rolagem do
// mesmo jeito que vê um teste. Uma segunda aba escolhe o conjunto de dados.
// Não escurece nem embaça o fundo: o site continua visível e usável.
// ────────────────────────────────────────────────────────

type Tab = 'free' | 'skins'

interface Props {
  campaignId:    string
  currentUserId: string
  onClose:       () => void
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const tileLabel = (g: FreeGroup) => (g.keep ? `${g.notation}: ${resultsText(g)} → ${g.subtotal}` : `${g.notation}: ${resultsText(g)}`)

export function DndDiceCard({ campaignId, currentUserId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('free')
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const [skinError, setSkinError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle')
  const [done, setDone] = useState<{ reading: FreeReading; formula: string } | null>(null)
  const [spin, setSpin] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')
  const stageNow = useRef(stage)
  stageNow.current = stage
  const simpleNow = useRef(simple)
  simpleNow.current = simple
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    let alive = true
    void getMyDiceSkin().then((s) => { if (alive) setSkin(s) }).catch(() => { /* fica o padrão */ })
    const off = onDiceSkinChange((s) => { if (alive) setSkin(s) })
    return () => { alive = false; off() }
  }, [])

  // antes da primeira rolagem: um d20 parado no meio do palco
  useEffect(() => { if (stage && phase === 'idle') void stage.idle('d20', skin) }, [stage, phase, skin])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'rolling') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  async function pickSkin(id: string) {
    if (id === skin) return
    const before = skin
    setSkin(id)
    setSkinError(null)
    try { await setMyDiceSkin(id) } catch (err) { setSkin(before); setSkinError(err instanceof Error ? err.message : 'Não foi possível salvar.') }
  }

  const roll = useCallback(async (formula: string, isPrivate: boolean) => {
    setPhase('rolling')
    setDone(null)
    const release = markRollBusy()   // os testes dos outros esperam esta rolagem terminar
    try {
      const rolled = rollParsedFormula(parseDiceFormula(formula), { floor: false })
      const saved = await recordRoll(campaignId, rolled, isPrivate, { label: 'Rolagem livre', skin, noFloor: true, context: freeContext('') })
      const reading = readFree(saved.roll_breakdown ?? [], saved.result)
      const dice = stageDiceFor(saved.roll_breakdown ?? [], skin)
      // o 3D baixa na primeira vez: se a pessoa rolou antes de ele ficar pronto, espera um pouco
      let st = stageNow.current
      for (let i = 0; i < 60 && !st && !simpleNow.current; i++) { await new Promise((r) => setTimeout(r, 75)); st = stageNow.current }
      if (st) await st.roll(dice, { skin })
      else await new Promise<void>((resolve) => {
        const end = performance.now() + 900
        const tick = () => { if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(reading.total); resolve() } }
        tick()
      })
      setDone({ reading, formula })
      setPhase('done')
    } catch (err) {
      setPhase(done ? 'done' : 'idle')
      throw err
    } finally {
      release()
    }
  }, [campaignId, skin, done])

  const reading = done?.reading
  return (
    <div className="ddw-hub">
      <div className="dsh-sheet dcp dcp--free dcp--hub" role="dialog" aria-label="Rolagem de dados">
        <button type="button" className="modal-close dcp__close" onClick={onClose} disabled={phase === 'rolling'} aria-label="Fechar">×</button>

        <div className="dcp__frame">
          <h3 className="dcp__title">Rolagem de dados<span>{done ? freeLabel(done.formula) : 'escolha os dados abaixo'}</span></h3>
          <div className="dcp__stage" aria-live="polite">
            <div ref={stageRef} className="dcp__canvas" data-insets="68,64" aria-hidden="true" />
            {simple && <span className="dcp__simple" aria-hidden="true">{spin ?? 'd20'}</span>}
            {phase === 'idle' && <span className="dcp__hint">Role pelo painel de baixo</span>}
          </div>
          {reading && (
            <div className="dcp__result" role="status">
              <span className="dcp__total">Total <strong>{reading.total}</strong></span>
            </div>
          )}
        </div>

        {reading && (
          <ul className="dcp__tiles" aria-label="Dados">
            {reading.groups.map((g, i) => (
              <li key={`${g.notation}${i}`} className="dcp__tile dcp__tile--reaction" title={resultsText(g)}>
                <span className="dcp__tile-value">{g.subtotal}</span>
                <span className="dcp__tile-badge">d{g.sides}</span>
                <span className="dcp__tile-label">{tileLabel(g)}</span>
              </li>
            ))}
            {reading.modifier !== 0 && (
              <li className="dcp__tile">
                <span className="dcp__tile-value">{signed(reading.modifier)}</span>
                <span className="dcp__tile-badge">+</span>
                <span className="dcp__tile-label">Bônus</span>
              </li>
            )}
          </ul>
        )}

        <div className="ddw">
          <div className="ddw__tabs" role="tablist" aria-label="Seções do cartão de dados">
            {([['free', 'Rolagem'], ['skins', 'Meus dados']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ddw__tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          {tab === 'free'
            ? <DiceRollerPanel campaignId={campaignId} currentUserId={currentUserId} onRoll={() => {}} onRequestRoll={roll} />
            : <div className="ddw__body" role="tabpanel"><DndDiceVitrine skin={skin} error={skinError} onPick={(id) => void pickSkin(id)} /></div>}
        </div>
      </div>
    </div>
  )
}
