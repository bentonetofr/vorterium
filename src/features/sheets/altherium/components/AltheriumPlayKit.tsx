import { type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import './AltheriumPlay.css'

// ────────────────────────────────────────────────────────
// Peças comuns das janelas de jogo da ficha de Altherium (Atacar, Explorar,
// Descansar, Furtividade...): a janela, grupos de escolha, interruptores com
// o valor em dados, marcadores e os ícones dos botões de ação.
// ────────────────────────────────────────────────────────

interface WinProps {
  title:    string
  subtitle?: ReactNode
  /** Faixa de abas logo abaixo do título (o painel de Explorar troca de janela por aqui). */
  nav?:     ReactNode
  /** Janela larga, para organizar em duas colunas e caber sem rolar. */
  wide?:    boolean
  onClose:  () => void
  busy?:    boolean
  children: ReactNode
}

/** Janela do jogo: título, fechar e rolagem. O fundo embaçado é o ModalOverlay. */
export function Win({ title, subtitle, nav, wide = false, onClose, busy = false, children }: WinProps) {
  return (
    <ModalOverlay onClose={onClose} closeDisabled={busy}>
      <div className={`alth-modal__window alth-win${wide ? ' alth-win--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="alth-modal__header">
          <div className="alth-win__heading">
            <h4 className="alth-modal__title">{title}</h4>
            {subtitle && <span className="alth-win__subtitle">{subtitle}</span>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </header>
        {nav && <div className="alth-win__nav">{nav}</div>}
        <div className="alth-win__body">{children}</div>
      </div>
    </ModalOverlay>
  )
}

/** Duas colunas lado a lado (uma só no celular): a janela cabe inteira na tela, sem rolar. */
export function Cols({ children }: { children: ReactNode }) {
  return <div className="alth-cols">{children}</div>
}

export function Col({ children }: { children: ReactNode }) {
  return <div className="alth-col">{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="alth-win__field">
      <span className="alth-win__label">{label}</span>
      {children}
      {hint && <span className="alth-win__hint">{hint}</span>}
    </div>
  )
}

interface ChipsProps<T extends string> {
  value:    T
  options:  { id: T; label: string; sub?: string; disabled?: boolean }[]
  onChange: (v: T) => void
  label:    string
}

/** Escolha de uma opção entre poucas (botões lado a lado). */
export function Chips<T extends string>({ value, options, onChange, label }: ChipsProps<T>) {
  return (
    <div className="alth-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id} type="button" role="radio" aria-checked={value === o.id} disabled={o.disabled}
          className={`alth-chip${value === o.id ? ' alth-chip--on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          <span>{o.label}</span>
          {o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  )
}

interface ToggleProps {
  on:       boolean
  onChange: (on: boolean) => void
  label:    string
  /** "+1 dado", "−1 dado", "+2"... */
  delta?:   string
  tone?:    'good' | 'bad'
  hint?:    string
  disabled?: boolean
}

/** Interruptor de um modificador de situação, com o valor ao lado. */
export function Toggle({ on, onChange, label, delta, tone, hint, disabled }: ToggleProps) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} title={hint}
      className={`alth-toggle${on ? ' alth-toggle--on' : ''}${tone ? ` alth-toggle--${tone}` : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="alth-toggle__label">{label}</span>
      {delta && <b className="alth-toggle__delta">{delta}</b>}
    </button>
  )
}

/** Resumo da conta de dados antes de rolar ("2d10 · fica o maior + 4"). */
export function Formula({ dice, keep, bonus, note }: { dice: number; keep: 'highest' | 'lowest'; bonus: number; note?: ReactNode }) {
  return (
    <div className="alth-formula" aria-live="polite">
      <strong className="alth-formula__big">
        {dice}<span>d10</span> · {keep === 'highest' ? 'maior' : 'menor'} {bonus >= 0 ? '+' : '−'}{Math.abs(bonus)}
      </strong>
      {note && <small>{note}</small>}
    </div>
  )
}

interface PipsProps {
  value:    number
  max:      number
  onChange?: (n: number) => void
  tone?:    'gold' | 'danger' | 'mystic'
  label:    string
}

/** Marcadores de contagem pequena (Fichas de Exploração, níveis de Fome). */
export function Pips({ value, max, onChange, tone = 'gold', label }: PipsProps) {
  return (
    <span className={`alth-pips alth-pips--${tone}`} role="img" aria-label={`${label}: ${value} de ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value
        return onChange
          ? (
            <button
              key={i} type="button" className={`alth-pip${on ? ' alth-pip--on' : ''}`}
              aria-label={`${label}: ${i + 1}`} onClick={() => onChange(value === i + 1 ? i : i + 1)}
            />
          )
          : <i key={i} className={`alth-pip${on ? ' alth-pip--on' : ''}`} />
      })}
    </span>
  )
}

// ── Ícones dos botões de ação (traço simples, herdam a cor do texto) ──

const PATHS: Record<string, ReactNode> = {
  attack:  <><path d="M14.5 4.5 19.5 4.5 19.5 9.5 9 20l-4-4z" /><path d="m7 14 3 3M4 20l3-3" /></>,
  defend:  <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />,
  parry:   <><path d="M5 19 17 7M14 4h6v6" /><path d="m8 12 4 4M4 20l2-2" /></>,
  damage:  <><path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z" /></>,
  stealth: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></>,
  explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  rest:    <><path d="M3 20 12 5l9 15z" /><path d="M9.5 20 12 15l2.5 5" /></>,
  mind:    <><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 3 3 3 0 0 0 1.5 5A3 3 0 0 0 9 20h1V4z" /><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 3 3 3 0 0 1-1.5 5A3 3 0 0 1 15 20h-1V4z" /></>,
  test:    <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" /><circle cx="15" cy="15" r="1" /><circle cx="12" cy="12" r="1" /></>,
  death:   <><path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3z" /><circle cx="9.5" cy="11" r="1" /><circle cx="14.5" cy="11" r="1" /></>,
  turn:    <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v5h-5" /></>,
}

export function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg className="alth-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.test}
    </svg>
  )
}
