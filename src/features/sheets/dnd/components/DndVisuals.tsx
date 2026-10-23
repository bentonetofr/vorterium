import type { ReactNode } from 'react'
import { xpForLevel } from '../rules/progression'
import { Pips } from './DndControls'
import { useChangeTick } from './motion'

// ────────────────────────────────────────────────────────
// Peças visuais da ficha que trocam parágrafos de explicação por figuras:
// medidor de XP, fórmulas em blocos, etiquetas de valor, selos de estado e
// legendas com as próprias bolinhas.
// ────────────────────────────────────────────────────────

/** Número ou texto que dá um pulinho quando muda (e não ao aparecer). */
export function Bump({ value, children }: { value: unknown; children?: ReactNode }) {
  const tick = useChangeTick(value)
  return <span key={tick} className={tick ? 'dsh-bump' : undefined}>{children ?? String(value)}</span>
}

/** Etiqueta com nome pequeno e valor em destaque: "Deslocamento · 9 m". */
export function StatChip({ label, children, tone, title }: { label: string; children: ReactNode; tone?: 'good' | 'bad' | 'warn'; title?: string }) {
  return (
    <span className={`dsh-statchip${tone ? ` dsh-statchip--${tone}` : ''}`} title={title}>
      <span className="dsh-statchip__label">{label}</span>
      <strong className="dsh-statchip__value">{children}</strong>
    </span>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="dsh-chiprow">{children}</div>
}

/** Selo curto de estado: "Estabilizado", "Sobrecarregado", "Já dá para subir de nível". */
export function StatusPill({ tone = 'neutral', children, title }: { tone?: 'good' | 'bad' | 'warn' | 'neutral'; children: ReactNode; title?: string }) {
  return <span className={`dsh-pill dsh-pill--${tone}`} title={title}>{children}</span>
}

interface XpMeterProps {
  xp:          number
  /** Nível que o XP dá (1 a 20). */
  xpLevel:     number
  /** Nível atual do personagem (soma das classes). */
  level:       number
  toNext:      number | null
}

/** Medidor de experiência: nível atual, barra até o próximo nível e quanto falta. */
export function XpMeter({ xp, xpLevel, level, toNext }: XpMeterProps) {
  const lo = xpForLevel(xpLevel)
  const hi = toNext == null ? lo : xpForLevel(xpLevel + 1)
  const pct = toNext == null ? 100 : Math.max(0, Math.min(100, ((xp - lo) / Math.max(1, hi - lo)) * 100))
  const canLevelUp = xpLevel > level
  return (
    <div className="dsh-xp" role="group" aria-label="Experiência">
      <div className="dsh-xp__levels">
        <span className="dsh-xp__level"><small>Nível pelo XP</small><strong>{xpLevel}</strong></span>
        <div className="dsh-xp__bar" role="progressbar" aria-label="Progresso até o próximo nível" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="dsh-xp__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="dsh-xp__level dsh-xp__level--next"><small>{toNext == null ? 'Máximo' : 'Próximo'}</small><strong>{toNext == null ? '★' : xpLevel + 1}</strong></span>
      </div>
      <div className="dsh-xp__scale">
        <span>{lo.toLocaleString('pt-BR')}</span>
        {toNext != null && <span className="dsh-xp__missing">faltam <strong>{toNext.toLocaleString('pt-BR')}</strong> XP</span>}
        <span>{toNext == null ? 'nível 20' : hi.toLocaleString('pt-BR')}</span>
      </div>
      {canLevelUp && <StatusPill tone="warn">Já dá para subir de nível</StatusPill>}
    </div>
  )
}

/** Legenda das bolinhas de perícia: sem proficiência, proficiente, especialista e meia proficiência. */
export function SkillLegend() {
  return (
    <ul className="dsh-legend" aria-label="Legenda das bolinhas">
      <li><Pips total={2} filled={0} size="sm" label="Sem proficiência" /><span>Sem</span></li>
      <li><Pips total={2} filled={1} size="sm" label="Proficiente" /><span>Proficiente</span></li>
      <li><Pips total={2} filled={2} size="sm" label="Especialista" /><span>Especialista</span></li>
      <li><span className="dsh-legend__half">½</span><span>Meia proficiência</span></li>
    </ul>
  )
}

/** Legenda da recarga dos recursos: DC, DL e AM. */
export function RechargeLegend() {
  return (
    <ul className="dsh-legend" aria-label="Legenda da recarga">
      <li><abbr className="dsh-legend__code" title="Descanso curto">DC</abbr><span>Descanso curto</span></li>
      <li><abbr className="dsh-legend__code" title="Descanso longo">DL</abbr><span>Descanso longo</span></li>
      <li><abbr className="dsh-legend__code" title="Amanhecer">AM</abbr><span>Amanhecer</span></li>
    </ul>
  )
}

export interface BonusTile { label: string; value: ReactNode; tone?: 'good'; wide?: boolean; hint?: string }

/** Grade de tiles (rótulo pequeno em cima, valor grande embaixo): bônus da raça, por exemplo. */
export function BonusTiles({ title, tiles }: { title: string; tiles: BonusTile[] }) {
  return (
    <div className="dsh-bonuses">
      <span className="dsh-bonuses__title">{title}</span>
      <div className="dsh-bonuses__grid">
        {tiles.map((t) => (
          <span key={t.label} className={`dsh-bonus${t.wide ? ' dsh-bonus--wide' : ''}${t.tone ? ` dsh-bonus--${t.tone}` : ''}`} title={t.hint}>
            <small>{t.label}</small>
            <strong>{t.value}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
