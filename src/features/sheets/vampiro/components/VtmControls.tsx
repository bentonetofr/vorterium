import type { KeyboardEvent } from 'react'
import {
  addDamage, healDamage, humanityBoxes, trackBoxes, trackState, type Track,
} from '../utils/vampiroRules'
import { VTM_HUMANITY_MAX, VTM_HUNGER_MAX } from '../constants/vampiro'

// ────────────────────────────────────────────────────────
// Peças da ficha de Vampiro:
//   • Dots — os pontinhos (atributos, perícias, Potência de Sangue);
//   • DamageTrack — Vitalidade e Força de Vontade: quadradinhos com dano
//     superficial (/) e agravado (X), botões de dano e de cura;
//   • HungerTrack — os 5 de Fome;
//   • HumanityTrack — os 10 de Humanidade, com as manchas pela direita.
// ────────────────────────────────────────────────────────

interface DotsProps {
  value:     number
  max?:      number
  min?:      number
  onChange?: (v: number) => void
  label:     string
  /** Pontos que passam do permitido (ex.: Potência acima do limite da geração) ficam marcados. */
  limit?:    number
  size?:     'sm' | 'md'
}

/** Clicar no último ponto marcado desmarca ele (volta um), sem passar do mínimo. */
export function Dots({ value, max = 5, min = 0, onChange, label, limit, size = 'md' }: DotsProps) {
  const ro = !onChange
  const pick = (i: number) => {
    if (!onChange) return
    const next = i + 1 === value ? i : i + 1
    onChange(Math.max(min, next))
  }
  const onKey = (e: KeyboardEvent) => {
    if (!onChange) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(max, value + 1)) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(min, value - 1)) }
  }
  return (
    <span
      className={`vtm-dots vtm-dots--${size}${ro ? ' vtm-dots--ro' : ''}`}
      role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      tabIndex={ro ? -1 : 0} onKeyDown={onKey}
    >
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i} type="button" tabIndex={-1} disabled={ro}
          className={`vtm-dot${i < value ? ' is-on' : ''}${limit != null && i >= limit && i < value ? ' is-over' : ''}`}
          onClick={() => pick(i)} aria-label={`${label}: ${i + 1}`}
        />
      ))}
    </span>
  )
}

const STATE_LABEL = {
  health:    { impaired: 'Debilitado: −2 dados em testes físicos.', broken: 'Torpor (ou Morte Final, se o golpe foi agravado).' },
  willpower: { impaired: 'Debilitado: −2 dados em testes sociais e mentais.', broken: 'Sem Força de Vontade para gastar.' },
} as const

interface DamageTrackProps {
  kind:     'health' | 'willpower'
  title:    string
  formula:  string
  max:      number
  track:    Track
  bonus:    number
  onTrack:  (t: Track) => void
  onBonus:  (b: number) => void
}

export function DamageTrack({ kind, title, formula, max, track, bonus, onTrack, onBonus }: DamageTrackProps) {
  const boxes = trackBoxes(track, max)
  const state = trackState(track, max)
  const left = boxes.filter((b) => b === 'empty').length
  return (
    <section className={`vtm-track vtm-track--${kind} vtm-track--${state}`} aria-label={title}>
      <header className="vtm-track__head">
        <span className="vtm-track__title">{title}</span>
        <span className="vtm-track__value">{left}<small>/{max}</small></span>
      </header>
      <div className="vtm-boxes" aria-label={`${title}: ${track.superficial} superficial, ${track.aggravated} agravado, de ${max}`}>
        {boxes.map((b, i) => <span key={i} className={`vtm-box vtm-box--${b}`} aria-hidden="true" />)}
      </div>
      <div className="vtm-track__btns">
        <span className="vtm-track__group">
          <span className="vtm-track__group-label">Dano</span>
          <button type="button" className="vtm-chip" onClick={() => onTrack(addDamage(track, max, 'superficial'))} title="Dano superficial (/)">+ /</button>
          <button type="button" className="vtm-chip vtm-chip--agg" onClick={() => onTrack(addDamage(track, max, 'aggravated'))} title="Dano agravado (X)">+ X</button>
        </span>
        <span className="vtm-track__group">
          <span className="vtm-track__group-label">Curar</span>
          <button type="button" className="vtm-chip" disabled={track.superficial <= 0} onClick={() => onTrack(healDamage(track, 'superficial'))} title="Cura 1 superficial">− /</button>
          <button type="button" className="vtm-chip vtm-chip--agg" disabled={track.aggravated <= 0} onClick={() => onTrack(healDamage(track, 'aggravated'))} title="Cura 1 agravado">− X</button>
        </span>
      </div>
      <p className="vtm-track__foot">
        {state !== 'ok'
          ? <strong className="vtm-track__alert">{STATE_LABEL[kind][state]}</strong>
          : <span>{formula}{bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)} (ajuste)` : ''} = {max}</span>}
        <span className="vtm-track__adjust" title="Ajuste manual do máximo (ex.: Fortitude)">
          <button type="button" className="vtm-mini" onClick={() => onBonus(Math.max(-5, bonus - 1))} aria-label={`Diminuir o máximo de ${title}`}>−</button>
          <button type="button" className="vtm-mini" onClick={() => onBonus(Math.min(10, bonus + 1))} aria-label={`Aumentar o máximo de ${title}`}>+</button>
        </span>
      </p>
    </section>
  )
}

const HUNGER_NOTE = [
  'Saciado. Só beber até o fim (matando) zera a Fome.',
  'Fome leve.',
  'A Besta incomoda.',
  'A Besta pressiona.',
  'Faminto: a Besta está à flor da pele.',
  'Fome 5: não dá pra fazer teste de despertar, e o frenesi está perto.',
]

export function HungerTrack({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <section className={`vtm-track vtm-track--hunger${value >= 4 ? ' vtm-track--impaired' : ''}`} aria-label="Fome">
      <header className="vtm-track__head">
        <span className="vtm-track__title">Fome</span>
        <span className="vtm-track__value">{value}<small>/{VTM_HUNGER_MAX}</small></span>
      </header>
      <div className="vtm-drops" role="group" aria-label="Fome">
        {Array.from({ length: VTM_HUNGER_MAX }, (_, i) => (
          <button
            key={i} type="button" className={`vtm-drop${i < value ? ' is-on' : ''}`}
            onClick={() => onChange(i + 1 === value ? i : i + 1)} aria-label={`Fome ${i + 1}`}
          >
            <svg viewBox="0 0 16 20" aria-hidden="true"><path d="M8 1C8 1 2 9 2 13a6 6 0 0 0 12 0C14 9 8 1 8 1z" /></svg>
          </button>
        ))}
      </div>
      <p className="vtm-track__foot"><span>{HUNGER_NOTE[value] ?? ''}</span></p>
    </section>
  )
}

interface HumanityTrackProps {
  humanity:   number
  stains:     number
  onHumanity: (v: number) => void
  onStains:   (v: number) => void
}

export function HumanityTrack({ humanity, stains, onHumanity, onStains }: HumanityTrackProps) {
  const boxes = humanityBoxes(humanity, stains)
  const degen = humanity + stains > VTM_HUMANITY_MAX
  return (
    <section className={`vtm-track vtm-track--humanity${degen ? ' vtm-track--impaired' : ''}`} aria-label="Humanidade">
      <header className="vtm-track__head">
        <span className="vtm-track__title">Humanidade</span>
        <span className="vtm-track__value">{humanity}<small>/{VTM_HUMANITY_MAX}</small></span>
      </header>
      <div className="vtm-boxes vtm-boxes--humanity">
        {boxes.map((b, i) => (
          <button
            key={i} type="button" className={`vtm-hbox vtm-hbox--${b}`}
            onClick={() => onHumanity(i + 1 === humanity ? i : i + 1)} aria-label={`Humanidade ${i + 1}`}
          />
        ))}
      </div>
      <div className="vtm-track__btns">
        <span className="vtm-track__group">
          <span className="vtm-track__group-label">Manchas {stains}</span>
          <button type="button" className="vtm-chip" onClick={() => onStains(Math.min(VTM_HUMANITY_MAX, stains + 1))}>+ mancha</button>
          <button type="button" className="vtm-chip" disabled={stains <= 0} onClick={() => onStains(Math.max(0, stains - 1))}>− mancha</button>
        </span>
      </div>
      <p className="vtm-track__foot">
        {degen
          ? <strong className="vtm-track__alert">As manchas tomaram a Humanidade: Debilitado pela culpa até o teste de remorso.</strong>
          : <span>As manchas entram pela direita. No fim da sessão, quem tem mancha faz o teste de remorso.</span>}
      </p>
    </section>
  )
}
