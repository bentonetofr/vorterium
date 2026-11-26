import { TRAIT_INFO } from '../catalog/rules'
import type { CSSProperties } from 'react'
import { traitValue } from '../model/derive'
import { unmarkedTraits } from '../model/levelUp'
import type { DhSheetData, DhTrait } from '../model/types'
import { DH_TRAITS } from '../model/types'
import { signed } from './DhUi'

// ────────────────────────────────────────────────────────
// A escolha de "+1 em dois atributos desmarcados" como um radar de seis pontas: o hexágono tracejado é o personagem de hoje, o
// dourado é como ele fica com os dois +1. Toque num vértice livre para trocar um dos dois escolhidos (o mais antigo sai); os
// atributos já marcados ficam travados. Sempre há exatamente dois escolhidos, então a escolha nunca fica inválida.
// ────────────────────────────────────────────────────────

const CX = 190
const CY = 168
const R_MAX = 118
const R_MIN = 26
const MIN_V = -1

/** O raio de um valor: a grade vai de -1 até o maior valor do personagem (no mínimo +2), para o desenho sempre preencher o hexágono. */
const radiusOf = (maxV: number) => (v: number) => R_MIN + ((Math.max(MIN_V, Math.min(maxV, v)) - MIN_V) / (maxV - MIN_V)) * (R_MAX - R_MIN)
const point = (i: number, r: number): [number, number] => {
  const a = ((-90 + i * 60) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}
const poly = (rs: number[]) => rs.map((r, i) => point(i, r).map((n) => n.toFixed(1)).join(',')).join(' ')
const path = (rs: number[]) => `M${rs.map((r, i) => point(i, r).map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`

interface Props {
  data: DhSheetData
  /** O nível para o qual está subindo (as marcas dos atributos mudam nos níveis 5 e 8). */
  level: number
  picks: [DhTrait, DhTrait]
  onChange: (picks: [DhTrait, DhTrait]) => void
}

export function DhTraitRadar({ data, level, picks, onChange }: Props) {
  const free = new Set(unmarkedTraits(data, level))
  const now = DH_TRAITS.map((t) => traitValue(data, t))
  const after = DH_TRAITS.map((t, i) => now[i] + (picks.includes(t) ? 1 : 0))
  const maxV = Math.max(2, ...after)
  const radius = radiusOf(maxV)
  const locked = DH_TRAITS.filter((t) => !free.has(t))

  function toggle(t: DhTrait) {
    if (!free.has(t) || picks.includes(t)) return
    onChange([picks[1], t])
  }

  return (
    <div className="dh-radar">
      <svg viewBox="-50 -4 480 352" className="dh-radar__svg" role="group" aria-label="Radar dos atributos: escolha onde entram os dois +1">
        <g className="dh-radar__grid">
          {Array.from({ length: maxV - MIN_V + 1 }, (_, k) => MIN_V + k).map((v) => <polygon key={v} points={poly(DH_TRAITS.map(() => radius(v)))} className={v === 0 ? 'is-zero' : ''} />)}
          {DH_TRAITS.map((_, i) => { const [x, y] = point(i, R_MAX); return <line key={i} x1={CX} y1={CY} x2={x} y2={y} /> })}
        </g>
        <polygon className="dh-radar__now" points={poly(now.map(radius))} />
        <path className="dh-radar__after" d={path(after.map(radius))} style={{ d: `path("${path(after.map(radius))}")` } as CSSProperties} />
        {DH_TRAITS.map((t, i) => {
          const sel = picks.includes(t)
          const isFree = free.has(t)
          const [x, y] = point(i, radius(after[i]))
          const [lx, ly] = point(i, R_MAX + 24)
          const anchor = Math.abs(lx - CX) < 8 ? 'middle' : lx > CX ? 'start' : 'end'
          return (
            <g key={t}>
              <text x={lx + (anchor === 'start' ? -4 : anchor === 'end' ? 4 : 0)} y={ly + (ly < CY - 40 ? -2 : ly > CY + 40 ? 12 : 4)} textAnchor={anchor} className={`dh-radar__label${sel ? ' is-sel' : ''}${isFree ? '' : ' is-lock'}`}>
                {TRAIT_INFO[t].label} {sel ? `${signed(now[i])} → ${signed(after[i])}` : signed(now[i])}
              </text>
              <g className={`dh-radar__v${sel ? ' is-sel' : ''}${isFree ? '' : ' is-lock'}`} role="button" tabIndex={isFree && !sel ? 0 : -1} aria-pressed={sel} aria-disabled={!isFree}
                aria-label={`${TRAIT_INFO[t].label}, valor ${signed(now[i])}${sel ? ', escolhido' : isFree ? ', livre' : ', já marcado'}`}
                onClick={() => toggle(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t) } }}>
                <circle cx={x} cy={y} r={20} className="dh-radar__hit" />
                <circle cx={x} cy={y} r={sel ? 10 : isFree ? 8 : 6} className="dh-radar__dot" />
                {sel && <text x={x} y={y + 4} textAnchor="middle" className="dh-radar__plus">+1</text>}
              </g>
            </g>
          )
        })}
      </svg>
      <ul className="dh-radar__list">
        {picks.map((t) => (
          <li key={t} className="is-ok"><i aria-hidden="true">✓</i><span>{TRAIT_INFO[t].label}</span><small>{signed(traitValue(data, t))} vira {signed(traitValue(data, t) + 1)}</small></li>
        ))}
        <li className="is-hint"><i aria-hidden="true">⇄</i><span>Toque num vértice livre para trocar um dos dois.</span></li>
        {locked.length > 0 && <li className="is-lock"><i aria-hidden="true">⚿</i><span>{locked.map((t) => TRAIT_INFO[t].label).join(' e ')} já {locked.length === 1 ? 'está marcado' : 'estão marcados'}.</span></li>}
      </ul>
    </div>
  )
}
