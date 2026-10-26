import { useEffect, useRef, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DiceRoll } from '../../../../shared/types'
import type { RollExtras, RollResult } from '../../../dice/services/diceService'
import { playDiceFlourish } from '../../../dice3d/sound'
import { stageDiceFor } from './diceKinds'
import {
  BARDIC_DICE, REACTIONS, SITUATIONAL_MAX, checkContext, checkFormula, judge, readCheck, tilesTotal,
  type Advantage, type CheckReading, type CheckSpec, type ChosenReaction, type Crit, type Outcome,
} from './checkModel'
import { markRollBusy } from './rollActivity'
import { useDiceStage } from './useDiceStage'
import '../components/DndSheet.css'
import '../components/DndMotion.css'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// Painel de teste no estilo Baldur's Gate 3: a CD no topo, o d20 flutuando
// no meio ("clique no dado para rolar"), os tiles de bônus embaixo somando
// no "Bônus total", vantagem/desvantagem e reações antes de rolar, e no fim
// Sucesso ou Falha com efeito no 20 e no 1. Com Inspiração, dá para rolar
// de novo. O sorteio e a gravação vêm de fora (`perform`).
// ────────────────────────────────────────────────────────

export interface CheckDone {
  roll:    DiceRoll
  reading: CheckReading
  dc:      number | null
  outcome: Outcome
  crit:    Crit
}

interface Props {
  spec:       CheckSpec
  character:  string
  sheetId:    string
  skin:       string
  /** Sorteia a fórmula, monta os extras com a rolagem sorteada e grava. */
  perform:    (formula: string, build: (rolled: RollResult) => RollExtras) => Promise<DiceRoll>
  revealDc?:  (requestId: string) => Promise<number | null>
  inspiration?: { has: boolean; spend: () => void }
  onResult?:  (done: CheckDone) => void
  onClose:    () => void
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const ADV_LABEL: Record<Advantage, string> = { normal: 'Normal', advantage: 'Vantagem', disadvantage: 'Desvantagem' }

export function DndCheckPanel({ spec, character, sheetId, skin, perform, revealDc, inspiration, onResult, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'stage')
  const [phase, setPhase] = useState<'ready' | 'rolling' | 'done'>('ready')
  const [advantage, setAdvantage] = useState<Advantage>(spec.advantage)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [done, setDone] = useState<CheckDone | null>(null)
  const [spin, setSpin] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usedInspiration, setUsedInspiration] = useState(false)
  /** Bônus ou ônus de situação digitado na hora (−2 por estar colado no inimigo, +1 por ajuda...). */
  const [situational, setSituational] = useState(0)

  const reactions = REACTIONS.filter((r) => r.applies.includes(spec.kind))
  const chosen: ChosenReaction[] = Object.entries(picked).map(([key, die]) => ({ key, die }))
  const bonus = tilesTotal(spec.tiles) + situational

  useEffect(() => markRollBusy(), [])   // os testes dos outros esperam este painel fechar
  useEffect(() => { if (stage && phase === 'ready') void stage.idle('d20', skin) }, [stage, phase, skin])

  async function roll(rerolledFrom?: string) {
    if (phase === 'rolling') return
    setPhase('rolling')
    setError(null)
    try {
      const formula = checkFormula(spec, advantage, chosen, situational)
      const saved = await perform(formula, (rolled) => {
        const r = readCheck(rolled.breakdown, rolled.total)
        return {
          label: spec.label, skin, noFloor: true,
          context: checkContext(spec, { advantage, reactions: chosen, natural: r.natural, total: r.total, character, sheetId, rerolledFrom, situational }),
        }
      })
      const reading = readCheck(saved.roll_breakdown ?? [], saved.result)
      // todos os dados da rolagem rolam: os d20 (os dois, na vantagem) e os das reações (d4, d6...)
      const dice = stageDiceFor(saved.roll_breakdown ?? [], skin)
      if (stage) await stage.roll(dice, { skin })
      else await new Promise<void>((resolve) => {
        const end = performance.now() + 900
        const tick = () => { if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(reading.natural); resolve() } }
        tick()
      })
      let dc = spec.dc
      if (spec.dcHidden && spec.requestId && revealDc) dc = await revealDc(spec.requestId)
      const { outcome, crit } = judge(spec.kind, reading.natural, reading.total, dc)
      // com o palco 3D, o 20 natural já tocou o próprio som de crítico quando o dado parou
      if (crit && !(crit === 'crit' && stage)) playDiceFlourish(crit)
      const result: CheckDone = { roll: saved, reading, dc, outcome, crit }
      setDone(result)
      setPhase('done')
      onResult?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      setPhase('ready')
    }
  }

  function reroll() {
    if (!inspiration?.has || !done) return
    inspiration.spend()
    setUsedInspiration(true)
    const from = done.roll.id
    setDone(null)
    void roll(from)
  }

  const dcText = spec.dcHidden ? (done?.dc != null ? String(done.dc) : '?') : spec.dc != null ? String(spec.dc) : null
  const crit = done?.crit
  const resultClass = done ? `${done.outcome ? ` is-${done.outcome}` : ''}${crit ? ` is-${crit}` : ''}` : ''

  return (
    <ModalOverlay onClose={onClose} closeDisabled={phase === 'rolling'}>
      <div className={`dsh-sheet dcp${resultClass}`} role="dialog" aria-modal="true" aria-labelledby="dcp-title">
        <button type="button" className="modal-close dcp__close" onClick={onClose} disabled={phase === 'rolling'} aria-label="Fechar">×</button>

        <div className="dcp__frame">
          <div className="dcp__dc">
            {dcText ? <><small>Classe de dificuldade</small><strong className={spec.dcHidden && !done ? 'is-hidden' : ''}>{dcText}</strong></> : <small className="dcp__nodc">Sem CD</small>}
          </div>
          <h3 id="dcp-title" className="dcp__title">{spec.label}{character && <span>{character}</span>}</h3>

          <button type="button" className="dcp__stage" onClick={() => { if (phase === 'ready') void roll() }} disabled={phase !== 'ready'}
            aria-label={phase === 'ready' ? `Rolar ${spec.label}` : 'Rolagem'}>
            <div ref={stageRef} className="dcp__canvas" aria-hidden="true" />
            {simple && <span className="dcp__simple" aria-hidden="true">{spin ?? 'd20'}</span>}
            {phase === 'ready' && <span className="dcp__hint">Clique no dado para rolar</span>}
            {crit && <span className={`dcp__fx dcp__fx--${crit}`} aria-hidden="true" />}
          </button>

          {done && (
            <div className="dcp__result" role="status">
              <span className="dcp__natural">{done.reading.d20s.length > 1 ? `${done.reading.d20s.join(' e ')} → ` : ''}<strong>{done.reading.natural}</strong> no d20</span>
              <span className="dcp__total">Total <strong>{done.reading.total}</strong></span>
              {done.outcome && <span className={`dcp__outcome dcp__outcome--${done.outcome}`}>{done.outcome === 'success' ? 'Sucesso' : 'Falha'}</span>}
              {crit === 'crit' && <span className="dcp__critlabel">20 natural!</span>}
              {crit === 'fumble' && <span className="dcp__critlabel dcp__critlabel--bad">1 natural</span>}
              {spec.dcHidden && done.dc == null && <span className="dcp__nodcnote">O mestre não revelou a CD.</span>}
            </div>
          )}
        </div>

        {phase === 'ready' && (
          <div className="dcp__controls">
            {spec.kind !== 'death' && (
              <div className="dsh-seg dcp__adv" role="group" aria-label="Vantagem ou desvantagem">
                {(['disadvantage', 'normal', 'advantage'] as Advantage[]).map((a) => (
                  <button key={a} type="button" className={`dsh-seg__btn${advantage === a ? ' is-on' : ''}`} aria-pressed={advantage === a} onClick={() => setAdvantage(a)}>{ADV_LABEL[a]}</button>
                ))}
              </div>
            )}
            <div className="dcp__situ" role="group" aria-label="Bônus ou ônus de situação" title="Para casos da mesa: por exemplo, o mestre narra −2 no ataque com arco por estar colado no inimigo.">
              <span className="dcp__situ-label">Bônus ou ônus de situação</span>
              <button type="button" className="dsh-mini" onClick={() => setSituational((n) => Math.max(-SITUATIONAL_MAX, n - 1))} aria-label="Diminuir o bônus de situação">−</button>
              <input type="number" inputMode="numeric" className="dcp__situ-input" value={situational} min={-SITUATIONAL_MAX} max={SITUATIONAL_MAX} aria-label="Bônus ou ônus de situação"
                onChange={(e) => { const n = Math.trunc(Number(e.target.value)); setSituational(Number.isFinite(n) ? Math.max(-SITUATIONAL_MAX, Math.min(SITUATIONAL_MAX, n)) : 0) }} />
              <button type="button" className="dsh-mini" onClick={() => setSituational((n) => Math.min(SITUATIONAL_MAX, n + 1))} aria-label="Aumentar o bônus de situação">+</button>
            </div>
            {reactions.length > 0 && (
              <div className="dcp__reactions" role="group" aria-label="Reações">
                {reactions.map((r) => {
                  const on = picked[r.key] != null
                  return (
                    <span key={r.key} className="dcp__reaction">
                      <button type="button" className={`dsh-flag dsh-flag--sm${on ? ' is-on' : ''}`} aria-pressed={on} title={r.hint}
                        onClick={() => setPicked((p) => { const n = { ...p }; if (on) delete n[r.key]; else n[r.key] = r.die; return n })}>
                        {r.label} <b>d{picked[r.key] ?? r.die}</b>
                      </button>
                      {on && r.key === 'bardic' && (
                        <span className="dsh-seg dcp__bardic">
                          {BARDIC_DICE.map((d) => (
                            <button key={d} type="button" className={`dsh-seg__btn${picked.bardic === d ? ' is-on' : ''}`} onClick={() => setPicked((p) => ({ ...p, bardic: d }))}>d{d}</button>
                          ))}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <ul className="dcp__tiles" aria-label="Bônus">
          {spec.tiles.map((t, i) => (
            <li key={t.id} className="dcp__tile" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="dcp__tile-value">{signed(t.value)}</span>
              <span className="dcp__tile-badge">{t.badge}</span>
              <span className="dcp__tile-label">{t.label}</span>
            </li>
          ))}
          {situational !== 0 && (
            <li className="dcp__tile">
              <span className="dcp__tile-value">{signed(situational)}</span>
              <span className="dcp__tile-badge">±</span>
              <span className="dcp__tile-label">Situação</span>
            </li>
          )}
          {chosen.map((r, i) => {
            const def = REACTIONS.find((x) => x.key === r.key)
            const val = done?.reading.reactionValues[i]
            return (
              <li key={r.key} className="dcp__tile dcp__tile--reaction">
                <span className="dcp__tile-value">{val != null ? `+${val}` : `d${r.die}`}</span>
                <span className="dcp__tile-badge">d{r.die}</span>
                <span className="dcp__tile-label">{def?.label}</span>
              </li>
            )
          })}
          {spec.tiles.length === 0 && chosen.length === 0 && situational === 0 && <li className="dcp__tile dcp__tile--empty"><span className="dcp__tile-label">Sem bônus</span></li>}
        </ul>
        <div className="dcp__bonus">Bônus total <strong>{signed(bonus)}</strong>{chosen.length > 0 && <span> + {chosen.map((r) => `d${r.die}`).join(' + ')}</span>}</div>

        {error && <p className="dsh-warn dcp__error">{error}</p>}

        <div className="dcp__actions">
          {phase === 'done' && inspiration?.has && !usedInspiration && (
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={reroll} title="Gasta a Inspiração do personagem">Usar Inspiração e rolar de novo</button>
          )}
          {phase === 'done' && <button type="button" className="dsh-chip" onClick={() => { setDone(null); setSpin(null); setPhase('ready') }}>Rolar outra vez</button>}
          <button type="button" className="dsh-chip" onClick={onClose} disabled={phase === 'rolling'}>{phase === 'done' ? 'Fechar' : 'Cancelar'}</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
