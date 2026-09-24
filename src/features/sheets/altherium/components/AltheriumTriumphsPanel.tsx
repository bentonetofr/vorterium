import { useState, type ReactNode } from 'react'
import type { AltheriumRaiz } from '../constants/altherium'
import {
  BERSERKER_TRIUMPHS,
  PILAR_TRIUMPHS,
  TRIUMPH_ACTION_LABELS,
  findBerserkerTriumph,
  type BerserkerTriumphDef,
} from '../constants/altheriumTriumphs'

// ────────────────────────────────────────────────────────
// Aba Triunfos — Berserker escolhe da lista (até o limite) e paga em FV;
// Pilar tem todos e paga em cartas; Runaskin fica pra depois. "Usar" só
// desconta do recurso no formulário (persiste com "Salvar ficha").
// ────────────────────────────────────────────────────────

interface AltheriumTriumphsPanelProps {
  raiz:           AltheriumRaiz | null
  triumphIds:     string[]
  limit:          number
  fvCurrent:      number
  cardsCurrent:   number
  onChange:       (ids: string[]) => void
  onSpendFv:      (cost: number) => void
  onSpendCards:   (cost: number) => void
  disabled:       boolean
}

export function AltheriumTriumphsPanel({
  raiz, triumphIds, limit, fvCurrent, cardsCurrent,
  onChange, onSpendFv, onSpendCards, disabled,
}: AltheriumTriumphsPanelProps) {
  const [lastUsed, setLastUsed] = useState<string | null>(null)

  if (raiz === null) {
    return <TriumphsNotice title="Triunfos" message="Escolha uma raiz no cabeçalho para ver os triunfos do personagem." />
  }
  if (raiz === 'runaskin') {
    return <TriumphsNotice title="Runas" message="Os Runaskins descobrem runas em vez de triunfos — chegam numa próxima atualização." />
  }

  if (raiz === 'pilar') {
    return (
      <section className="alth-card alth-triumphs">
        <div className="alth-card__header">
          <h4 className="alth-card__title">Triunfos do Pilar</h4>
          <span className="alth-counter">{cardsCurrent} cartas na mão</span>
        </div>
        <ul className="alth-triumphs__rules">
          <li><strong>Coringa:</strong> vale como qualquer carta.</li>
          <li><strong>Ases:</strong> se forem do seu naipe, valem 2 cartas.</li>
          <li><strong>Ás de espadas:</strong> sucesso instantâneo.</li>
        </ul>
        {lastUsed && <p className="alth-triumphs__used" role="status">{lastUsed}</p>}
        <div className="alth-triumphs__grid">
          {PILAR_TRIUMPHS.map((t) => (
            <article key={t.id} className="alth-triumph">
              <header className="alth-triumph__head">
                <h5 className="alth-triumph__name">{t.name}</h5>
                <span className="alth-triumph__cost alth-triumph__cost--cards">{t.cost} {t.cost === 1 ? 'carta' : 'cartas'}</span>
              </header>
              <p className="alth-triumph__desc">{t.description}</p>
              <div className="alth-triumph__chips">
                <span className="alth-triumph__chip">{TRIUMPH_ACTION_LABELS.bonus}</span>
              </div>
              <div className="alth-triumph__actions">
                <button
                  type="button" className="alth-triumph__btn alth-triumph__btn--use"
                  disabled={disabled || cardsCurrent < t.cost}
                  title={cardsCurrent < t.cost ? 'Cartas insuficientes' : undefined}
                  onClick={() => {
                    onSpendCards(t.cost)
                    setLastUsed(`${t.name} usado — −${t.cost} ${t.cost === 1 ? 'carta' : 'cartas'}. Salve a ficha para registrar.`)
                  }}
                >
                  Usar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  // Berserker
  const owned     = triumphIds.map(findBerserkerTriumph).filter((t): t is BerserkerTriumphDef => !!t)
  const available = BERSERKER_TRIUMPHS.filter((t) => !triumphIds.includes(t.id))
  const full      = owned.length >= limit
  const over      = owned.length > limit

  return (
    <section className="alth-card alth-triumphs">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Triunfos do Berserker</h4>
        <span className={`alth-counter${over ? ' alth-counter--over' : ''}`}>
          Triunfos: {owned.length} / {limit} · FV {fvCurrent}
        </span>
      </div>
      <p className="alth-hint">
        Limite: (2 + domínios com ponto) ÷ 2, arredondado pra baixo.
      </p>
      {over && (
        <p className="alth-triumphs__warn" role="alert">
          Você tem mais triunfos do que o limite atual — remova algum ou ganhe domínios.
        </p>
      )}
      {lastUsed && <p className="alth-triumphs__used" role="status">{lastUsed}</p>}

      <h5 className="alth-triumphs__group">Seus triunfos</h5>
      {owned.length === 0
        ? <p className="alth-triumphs__empty">Nenhum triunfo escolhido ainda — adicione abaixo.</p>
        : (
          <div className="alth-triumphs__grid">
            {owned.map((t) => (
              <BerserkerTriumphCard key={t.id} triumph={t}>
                <button
                  type="button" className="alth-triumph__btn alth-triumph__btn--use"
                  disabled={disabled || fvCurrent < t.cost}
                  title={fvCurrent < t.cost ? 'FV insuficiente' : undefined}
                  onClick={() => {
                    onSpendFv(t.cost)
                    setLastUsed(`${t.name} usado — −${t.cost} FV. Salve a ficha para registrar.`)
                  }}
                >
                  Usar
                </button>
                <button
                  type="button" className="alth-triumph__btn alth-triumph__btn--remove"
                  disabled={disabled}
                  onClick={() => onChange(triumphIds.filter((id) => id !== t.id))}
                >
                  Remover
                </button>
              </BerserkerTriumphCard>
            ))}
          </div>
        )}

      <h5 className="alth-triumphs__group">Disponíveis</h5>
      <div className="alth-triumphs__grid">
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
      </div>
    </section>
  )
}

function BerserkerTriumphCard({ triumph: t, children }: { triumph: BerserkerTriumphDef; children: ReactNode }) {
  return (
    <article className="alth-triumph">
      <header className="alth-triumph__head">
        <h5 className="alth-triumph__name">{t.name}</h5>
        <span className="alth-triumph__cost">{t.cost} FV</span>
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
