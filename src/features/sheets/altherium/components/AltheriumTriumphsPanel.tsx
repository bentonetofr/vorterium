import { useContext, useState, type ReactNode } from 'react'
import type { AltheriumRaiz } from '../constants/altherium'
import { AltheriumRecentTriumphs } from './AltheriumRecentTriumphs'
import { TriumphUnit } from './triumphUnit'
import {
  BERSERKER_TRIUMPHS,
  byName,
  TRIUMPH_ACTION_LABELS,
  findBerserkerTriumph,
  type BerserkerTriumphDef,
} from '../constants/altheriumTriumphs'

/** Teto do limite editável (igual ao check da migration 20240201). */
const TRIUMPH_LIMIT_MAX = 99

// ────────────────────────────────────────────────────────
// Aba Triunfos do Berserker — escolhe da lista (até o limite) e paga em FV
// (Pilar: AltheriumPilarTriumphs; Runaskin: AltheriumRunaskinTriumphs). "Usar"
// desconta do recurso no formulário (o salvamento automático persiste) e a
// ficha anuncia o uso no chat e na Atividade da campanha.
// ────────────────────────────────────────────────────────

interface AltheriumTriumphsPanelProps {
  /** Pilar e Runaskin têm painel próprio. */
  raiz:           Exclude<AltheriumRaiz, 'runaskin' | 'pilar'> | null
  triumphIds:     string[]
  /** Limite em vigor (o escolhido pelo jogador ou o automático). */
  limit:          number
  /** Limite pela regra: ⌊(2 + domínios com ponto) ÷ 2⌋. */
  autoLimit:      number
  /** O jogador mudou o limite à mão? */
  limitOverridden: boolean
  /** Novo limite; null = volta pro automático. */
  onLimitChange:  (limit: number | null) => void
  fvCurrent:      number
  onChange:       (ids: string[]) => void
  onSpendFv:      (cost: number, triumphName: string) => void
  /** Ids dos últimos triunfos usados (mais recente primeiro). */
  recent:         string[]
  onRecent:       (id: string) => void
  disabled?:      boolean
  /** Tem todos os triunfos, sem escolher nem limite (era da raiz Mestre, guardada). */
  allOwned?:      boolean
}

export function AltheriumTriumphsPanel({
  raiz, triumphIds, limit, autoLimit, limitOverridden, onLimitChange, fvCurrent,
  onChange, onSpendFv, recent, onRecent, disabled = false, allOwned = false,
}: AltheriumTriumphsPanelProps) {
  const [lastUsed, setLastUsed] = useState<string | null>(null)
  const unit = useContext(TriumphUnit) ?? 'FV'

  if (raiz === null) {
    return <TriumphsNotice title="Triunfos" message="Escolha uma raiz no cabeçalho para ver os triunfos do personagem." />
  }

  // Berserker
  const ownedIds  = allOwned ? BERSERKER_TRIUMPHS.map((t) => t.id) : triumphIds
  const owned     = ownedIds.map(findBerserkerTriumph).filter((t): t is BerserkerTriumphDef => !!t).sort(byName)
  const available = allOwned ? [] : BERSERKER_TRIUMPHS.filter((t) => !triumphIds.includes(t.id))
  const full      = owned.length >= limit
  const over      = owned.length > limit
  // Recentes: só os que o personagem ainda tem.
  const recentOwned = recent.filter((id) => ownedIds.includes(id))
    .map(findBerserkerTriumph).filter((t): t is BerserkerTriumphDef => !!t)

  function useButton(t: BerserkerTriumphDef) {
    return (
      <button
        type="button" className="alth-triumph__btn alth-triumph__btn--use"
        disabled={disabled || fvCurrent < t.cost}
        title={fvCurrent < t.cost ? `${unit} insuficiente` : undefined}
        onClick={() => {
          onSpendFv(t.cost, t.name)
          onRecent(t.id)
          setLastUsed(`${t.name} usado: −${t.cost} ${unit}.`)
        }}
      >
        Usar
      </button>
    )
  }

  return (
    <section className="alth-card alth-triumphs">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Triunfos do Berserker</h4>
        {!allOwned && (
          <div className={`alth-counter alth-triumphs__limit${over ? ' alth-counter--over' : ''}`}>
            <label htmlFor="alth-triumph-limit">Triunfos:</label>
            <span className="alth-vital-bar__values">
              <span className="alth-vital-bar__max-fixed" title="Triunfos que você tem">{owned.length}</span>
              <span className="alth-vital-bar__sep">/</span>
              <input
                id="alth-triumph-limit"
                type="number"
                className="alth-vital-bar__value-input alth-vital-bar__max-input"
                min={0}
                max={TRIUMPH_LIMIT_MAX}
                value={limit}
                disabled={disabled}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(TRIUMPH_LIMIT_MAX, parseInt(e.target.value, 10) || 0))
                  // igual ao automático = volta pro automático (acompanha os domínios de novo)
                  onLimitChange(n === autoLimit ? null : n)
                }}
                aria-describedby="alth-triumph-limit-hint"
              />
            </span>
            {limitOverridden && (
              <button
                type="button"
                className="alth-movement__auto"
                disabled={disabled}
                onClick={() => onLimitChange(null)}
                title={`Voltar ao automático: ${autoLimit} (2 + domínios com ponto) ÷ 2`}
              >
                automático
              </button>
            )}
          </div>
        )}
      </div>
      {!allOwned && (
        <p id="alth-triumph-limit-hint" className="alth-hint">
          {limitOverridden
            ? `Limite mudado à mão (pela regra seria ${autoLimit}).`
            : 'Limite: (2 + domínios com ponto) ÷ 2, arredondado pra baixo. Dá pra mudar no número acima.'}
        </p>
      )}
      {!allOwned && over && (
        <p className="alth-triumphs__warn" role="alert">
          Você tem mais triunfos do que o limite atual: remova algum, ganhe domínios ou aumente o limite.
        </p>
      )}
      {lastUsed && <p key={lastUsed} className="alth-triumphs__used" role="status">{lastUsed}</p>}

      <AltheriumRecentTriumphs count={recentOwned.length}>
        {recentOwned.map((t) => (
          <BerserkerTriumphCard key={`recent-${t.id}`} triumph={t} owned>{useButton(t)}</BerserkerTriumphCard>
        ))}
      </AltheriumRecentTriumphs>

      <h5 className="alth-triumphs__group">Seus triunfos</h5>
      {owned.length === 0
        ? <p className="alth-triumphs__empty">Nenhum triunfo escolhido ainda. Adicione abaixo.</p>
        : (
          <div className="alth-triumphs__grid">
            {owned.map((t) => (
              <BerserkerTriumphCard key={t.id} triumph={t} owned>
                {useButton(t)}
                {!allOwned && <button
                  type="button" className="alth-triumph__btn alth-triumph__btn--remove"
                  disabled={disabled}
                  onClick={() => onChange(triumphIds.filter((id) => id !== t.id))}
                >
                  Remover
                </button>}
              </BerserkerTriumphCard>
            ))}
          </div>
        )}

      {!allOwned && <h5 className="alth-triumphs__group">Disponíveis</h5>}
      {!allOwned && <div className="alth-triumphs__grid">
        {available.map((t) => (
          <BerserkerTriumphCard key={t.id} triumph={t}>
            <button
              type="button" className="alth-triumph__btn alth-triumph__btn--add"
              disabled={disabled || full}
              title={full ? 'Limite de triunfos atingido' : undefined}
              onClick={() => onChange([...triumphIds, t.id])}
            >
              Adicionar
            </button>
          </BerserkerTriumphCard>
        ))}
      </div>}
    </section>
  )
}

function BerserkerTriumphCard({ triumph: t, owned = false, children }: { triumph: BerserkerTriumphDef; owned?: boolean; children: ReactNode }) {
  const unit = useContext(TriumphUnit) ?? 'FV'
  return (
    <article className={`alth-triumph${owned ? ' alth-triumph--owned' : ''}`}>
      <header className="alth-triumph__head">
        <h5 className="alth-triumph__name">{t.name}</h5>
        <span className="alth-triumph__cost">{t.cost} {unit}</span>
      </header>
      <p className="alth-triumph__desc">{t.description}</p>
      <div className="alth-triumph__chips">
        <span className="alth-triumph__chip">{TRIUMPH_ACTION_LABELS[t.action]}</span>
        <span className="alth-triumph__chip">{t.range}</span>
        <span className="alth-triumph__chip">{t.test ?? 'Sem teste'}</span>
      </div>
      <div className="alth-triumph__actions">{children}</div>
    </article>
  )
}

function TriumphsNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="alth-coming-soon">
      <span className="alth-coming-soon__icon" aria-hidden="true">✦</span>
      <h4 className="alth-coming-soon__title">{title}</h4>
      <p className="alth-coming-soon__message">{message}</p>
    </div>
  )
}
