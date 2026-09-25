import { useEffect, useState } from 'react'
import type { TdCondition, TdInventoryItem, TdTrait } from '../../../../shared/types'
import { SITUATION_LIMIT } from '../constants/terraDevastada'
import { poolSize, plural } from '../utils/tdRules'

// ────────────────────────────────────────────────────────
// Peças do teste: escolher o que conta (PoolPicker) e mostrar os dados
// rolados (DiceTray).
// ────────────────────────────────────────────────────────

/** Peso de cada coisa escolhida: +n ajuda, −n atrapalha. */
export type Picks = Record<string, number>

interface PickSource {
  id:     string
  name:   string
  /** Dados que vale (1 pra característica/condição; letalidade/proteção pros itens). */
  weight: number
  group:  'traits' | 'conditions' | 'items'
  hint?:  string
}

function sources(traits: TdTrait[], conditions: TdCondition[], inventory: TdInventoryItem[]): PickSource[] {
  return [
    ...traits.filter((t) => t.name.trim()).map((t) => ({ id: t.id, name: t.name, weight: 1, group: 'traits' as const })),
    ...conditions.filter((c) => c.name.trim()).map((c) => ({ id: c.id, name: c.name, weight: 1, group: 'conditions' as const })),
    ...inventory
      .filter((i) => i.name.trim() && i.kind !== 'item' && i.level > 0)
      .map((i) => ({
        id: i.id, name: i.name, weight: i.level, group: 'items' as const,
        hint: i.kind === 'arma' ? `Letalidade ${i.level}d` : `Proteção ${i.level}d`,
      })),
  ]
}

/** Soma dos escolhidos (+ situação). */
export function picksNet(picks: Picks, situation: number): number {
  return Object.values(picks).reduce((a, b) => a + b, 0) + situation
}

/** Nomes do que ajudou e do que atrapalhou (pro anúncio no chat). */
export function picksSummary(
  picks: Picks, traits: TdTrait[], conditions: TdCondition[], inventory: TdInventoryItem[],
): { plus: string[]; minus: string[] } {
  const all = sources(traits, conditions, inventory)
  const plus: string[] = []
  const minus: string[] = []
  for (const s of all) {
    const v = picks[s.id]
    if (v > 0) plus.push(s.name.trim())
    else if (v < 0) minus.push(s.name.trim())
  }
  return { plus, minus }
}

interface PoolPickerProps {
  traits:       TdTrait[]
  conditions:   TdCondition[]
  inventory?:   TdInventoryItem[]
  picks:        Picks
  /** Recebe uma atualização (como o setState) — cliques seguidos não se perdem. */
  onPicks:      (update: (prev: Picks) => Picks) => void
  situation:    number
  onSituation:  (value: number) => void
  disabled?:    boolean
  /** Texto de ajuda sobre o que marcar (muda com o tipo de teste). */
  hint?:        string
}

const GROUP_LABELS: Record<PickSource['group'], string> = {
  traits:     'Características fixas',
  conditions: 'Condições',
  items:      'Armas e proteções',
}

export function PoolPicker({
  traits, conditions, inventory = [], picks, onPicks, situation, onSituation, disabled = false, hint,
}: PoolPickerProps) {
  const all = sources(traits, conditions, inventory)
  const net = picksNet(picks, situation)
  const pool = poolSize(net)

  // Toque: neutro → ajuda → atrapalha → neutro.
  function cycle(s: PickSource) {
    onPicks((prev) => {
      const current = prev[s.id] ?? 0
      const next = { ...prev }
      if (current === 0) next[s.id] = s.weight
      else if (current > 0) next[s.id] = -s.weight
      else delete next[s.id]
      return next
    })
  }

  const groups = (['traits', 'conditions', 'items'] as const)
    .map((g) => ({ id: g, items: all.filter((s) => s.group === g) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="td-picker">
      {hint && <p className="td-hint">{hint}</p>}

      {groups.length === 0 && (
        <p className="td-hint">A ficha ainda não tem características. Só o dado natural vai rolar.</p>
      )}

      {groups.map((g) => (
        <div key={g.id} className="td-picker__group">
          <span className="td-label">{GROUP_LABELS[g.id]}</span>
          <div className="td-picker__chips">
            {g.items.map((s) => {
              const v = picks[s.id] ?? 0
              const state = v > 0 ? 'plus' : v < 0 ? 'minus' : 'off'
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`td-chip td-chip--${state}`}
                  onClick={() => cycle(s)}
                  disabled={disabled}
                  aria-label={`${s.name}: ${state === 'plus' ? 'ajuda' : state === 'minus' ? 'atrapalha' : 'não conta'}`}
                  title={s.hint}
                >
                  <span className="td-chip__sign" aria-hidden="true">
                    {state === 'plus' ? `+${s.weight}` : state === 'minus' ? `−${s.weight}` : '·'}
                  </span>
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="td-picker__situation">
        <span className="td-label">Situação</span>
        <div className="td-stepper">
          <button
            type="button" className="td-stepper__btn" aria-label="Menos um dado de situação"
            onClick={() => onSituation(Math.max(-SITUATION_LIMIT, situation - 1))}
            disabled={disabled || situation <= -SITUATION_LIMIT}
          >
            −
          </button>
          <span className="td-stepper__value">{situation > 0 ? `+${situation}` : situation}d</span>
          <button
            type="button" className="td-stepper__btn" aria-label="Mais um dado de situação"
            onClick={() => onSituation(Math.min(SITUATION_LIMIT, situation + 1))}
            disabled={disabled || situation >= SITUATION_LIMIT}
          >
            +
          </button>
        </div>
        <span className="td-hint">Posição, surpresa, alvo específico... (−3 a +3)</span>
      </div>

      <div className="td-pool" aria-live="polite">
        <span className="td-pool__dice">{pool.dice}d</span>
        <span className="td-pool__detail">
          1 natural{pool.dice > 1 ? ` + ${plural(pool.dice - 1, 'dado', 'dados')}` : ''}
          {pool.overflow > 0 && ` · ${plural(pool.overflow, 'dado passou', 'dados passaram')} do máximo de 6`}
          {pool.cancelled && ' · as desvantagens anularam os bônus; o dado natural rola mesmo assim'}
        </span>
      </div>
    </div>
  )
}

// ── Bandeja de dados ────────────────────────────────────

// Pontos de cada face num quadro 3×3 (0 = canto sup. esquerdo ... 8).
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function DieFace({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="9" className="td-die__body" />
      {PIPS[value].map((p) => (
        <circle key={p} cx={12 + (p % 3) * 12} cy={12 + Math.floor(p / 3) * 12} r="4.2" className="td-die__pip" />
      ))}
    </svg>
  )
}

interface DiceTrayProps {
  results: number[]
  bonus:   number[]
  /** Sacode os dados por um instante ao aparecer. */
  animate?: boolean
}

export function DiceTray({ results, bonus, animate = true }: DiceTrayProps) {
  const [shaking, setShaking] = useState(animate)
  const [face, setFace] = useState(0)

  useEffect(() => {
    if (!animate) return
    const cycle = window.setInterval(() => setFace((f) => f + 1), 70)
    const stop = window.setTimeout(() => { window.clearInterval(cycle); setShaking(false) }, 520)
    return () => { window.clearInterval(cycle); window.clearTimeout(stop) }
  }, [animate])

  const dice = [
    ...results.map((value, i) => ({ value, extra: false, key: `r${i}` })),
    ...bonus.map((value, i) => ({ value, extra: true, key: `b${i}` })),
  ]

  return (
    <ol className={`td-tray${shaking ? ' td-tray--shaking' : ''}`} aria-label="Dados rolados">
      {dice.map((d, i) => {
        const shown = shaking ? ((face + i * 3) % 6) + 1 : d.value
        const even = !shaking && d.value % 2 === 0
        return (
          <li
            key={d.key}
            className={`td-die${even ? ' td-die--even' : ''}${d.extra ? ' td-die--extra' : ''}${!shaking && d.value === 6 ? ' td-die--six' : ''}`}
            style={{ animationDelay: `${i * 40}ms` }}
            aria-label={`${d.extra ? 'Golpe de sorte: ' : ''}${d.value}${d.value % 2 === 0 ? ', par' : ''}`}
          >
            <DieFace value={shown} />
          </li>
        )
      })}
    </ol>
  )
}
