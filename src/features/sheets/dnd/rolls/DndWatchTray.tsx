import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DiceRoll } from '../../../../shared/types'
import type { ThrowHandle } from '../../../dice3d/DiceStage'
import { DEFAULT_SKIN, getSkin } from '../../../dice3d/skins'
import { partsText, stageDiceFor } from './diceKinds'
import { useDiceStage } from './useDiceStage'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// A bandeja vista por quem não rolou: o dano e os outros dados dos outros
// jogadores rolam pela parte de baixo da tela, no conjunto de cada um, TODOS
// AO MESMO TEMPO (cada rolagem na sua faixa do chão). O resultado é de cada
// um: um cartão por rolagem, na cor do conjunto de quem rolou, com o nome,
// o rótulo e o total. A tela 3D só existe enquanto há dados na mesa.
// ────────────────────────────────────────────────────────

const HOLD_MS = 4200

interface Card { roll: DiceRoll; lane: number; phase: 'rolling' | 'shown' | 'leaving' }

interface Props {
  /** Rolagens esperando para rolar. */
  pending: readonly DiceRoll[]
  /** Chamado quando uma rolagem sai da espera e começa a rolar. */
  take:    (id: string) => void
  nameOf:  (roll: DiceRoll) => string
}

export function DndWatchTray({ pending, take, nameOf }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState<Card[]>([])
  const handles = useRef(new Map<string, ThrowHandle>())
  const timers = useRef(new Set<number>())
  const alive = useRef(true)
  const active = pending.length > 0 || cards.length > 0
  const { stage, simple } = useDiceStage(hostRef, 'tray', active)
  const lanes = stage ? stage.laneCount() : 1

  useEffect(() => {
    alive.current = true
    const ts = timers.current
    return () => { alive.current = false; ts.forEach((t) => window.clearTimeout(t)); ts.clear(); handles.current.clear() }
  }, [])

  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => { timers.current.delete(t); if (alive.current) fn() }, ms)
    timers.current.add(t)
  }
  const patch = (id: string, phase: Card['phase']) => setCards((cs) => cs.map((c) => (c.roll.id === id ? { ...c, phase } : c)))

  async function start(roll: DiceRoll, lane: number, count: number) {
    const dice = stageDiceFor(roll.roll_breakdown ?? [], roll.dice_skin ?? DEFAULT_SKIN)
    if (stage && dice.length) {
      const h = await stage.addThrow(dice, { skin: roll.dice_skin ?? DEFAULT_SKIN, lane: { index: lane, count } })
      handles.current.set(roll.id, h)
      await h.done
    } else await new Promise<void>((r) => later(r, 500))
    if (!alive.current) return
    patch(roll.id, 'shown')
    later(() => {
      patch(roll.id, 'leaving')
      later(() => {
        handles.current.get(roll.id)?.remove()
        handles.current.delete(roll.id)
        setCards((cs) => cs.filter((c) => c.roll.id !== roll.id))
      }, 380)
    }, HOLD_MS)
  }

  // uma rolagem da espera entra assim que o motor está pronto e há faixa livre
  useEffect(() => {
    if (!pending.length || (!stage && !simple)) return
    const used = new Set(cards.map((c) => c.lane))
    const lane = Array.from({ length: lanes }, (_, i) => i).find((i) => !used.has(i))
    if (lane === undefined) return
    const roll = pending[0]
    take(roll.id)
    setCards((cs) => [...cs, { roll, lane, phase: 'rolling' }])
    void start(roll, lane, lanes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, cards, stage, simple, lanes])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="dsh-sheet dtray dwtray" aria-live="polite">
      <div ref={hostRef} className="dtray__canvas" aria-hidden="true" />
      <div className="dwtray__cards" style={{ gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))` }}>
        {cards.map(({ roll, lane, phase }) => {
          const skin = getSkin(roll.dice_skin)
          return (
            <div key={roll.id} className={`dwtray__card${phase === 'rolling' ? ' is-rolling' : ''}${phase === 'leaving' ? ' is-leaving' : ''}`}
              style={{ gridColumn: Math.min(lane, lanes - 1) + 1, ['--skin' as string]: skin.glowPower > 0 ? skin.glow : skin.trim }}>
              <span className="dwtray__who"><span aria-hidden="true">◉</span> {nameOf(roll)}{roll.is_private && <span title="Rolagem privada"> 🔒</span>}</span>
              <span className="dtray__label">{roll.roll_label ?? roll.formula ?? roll.die_type}</span>
              <span className="dtray__total">{phase === 'rolling' ? '…' : roll.result}</span>
              {phase !== 'rolling' && <span className="dtray__parts">{partsText(roll)}</span>}
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
