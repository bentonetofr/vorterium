import { useCallback, useEffect, useState } from 'react'
import {
  DIE_TYPES,
  dieSides,
  getRecentRolls,
  rollDie,
} from '../services/diceService'
import type { DiceRoll, DiceRollWithProfile, DieType } from '../../../shared/types'
import './DiceRollerPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface DiceRollerPanelProps {
  campaignId: string
  currentUserId: string
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5)  return 'agora'
  if (seconds < 60) return `${seconds}s atrás`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function resultClass(result: number, dieType: DieType): string {
  const max = dieSides(dieType)
  if (result === max) return 'dice-result--max'
  if (result === 1)   return 'dice-result--min'
  return ''
}

// ────────────────────────────────────────────────────────
// Sub-componente: botão de dado
// ────────────────────────────────────────────────────────

function DieButton({
  dieType, selected, disabled, onClick,
}: {
  dieType: DieType
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`die-btn ${selected ? 'die-btn--selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Rolar ${dieType}`}
      aria-pressed={selected}
    >
      <span className="die-btn__type">{dieType}</span>
      <span className="die-btn__sides">{dieSides(dieType)} faces</span>
    </button>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function DiceRollerPanel({ campaignId, currentUserId }: DiceRollerPanelProps) {
  const [selectedDie, setSelectedDie] = useState<DieType>('d20')
  const [rolling, setRolling]         = useState(false)
  const [rollError, setRollError]     = useState<string | null>(null)
  const [lastRoll, setLastRoll]       = useState<DiceRoll | null>(null)
  const [animKey, setAnimKey]         = useState(0)

  const [history, setHistory]         = useState<DiceRollWithProfile[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const [histError, setHistError]     = useState<string | null>(null)

  // ── Carrega histórico ──
  const loadHistory = useCallback(async () => {
    try {
      const data = await getRecentRolls(campaignId)
      setHistory(data)
      setHistError(null)
    } catch (err) {
      setHistError(err instanceof Error ? err.message : 'Erro ao carregar histórico.')
    } finally {
      setHistLoading(false)
    }
  }, [campaignId])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── Rolar dado ──
  // O MVP não usa Supabase Realtime. Após rolar, o histórico é atualizado
  // localmente para o próprio usuário. Outros membros verão na próxima recarga.
  async function handleRoll() {
    setRollError(null)
    setRolling(true)
    try {
      const roll = await rollDie(campaignId, selectedDie)
      setLastRoll(roll)
      setAnimKey((k) => k + 1)
      // Atualiza o histórico para refletir a nova rolagem imediatamente
      await loadHistory()
    } catch (err) {
      setRollError(err instanceof Error ? err.message : 'Não foi possível rolar o dado.')
    } finally {
      setRolling(false)
    }
  }

  // ────────────────────────────────────────────────────
  return (
    <section className="dice-panel">
      <header className="dice-panel__header">
        <div className="dice-panel__title-row">
          <span className="dice-panel__icon" aria-hidden="true">⬡</span>
          <h3 className="dice-panel__title">Rolagem de Dados</h3>
        </div>
      </header>

      <div className="dice-panel__body">
        {/* ── Seletor de dado ── */}
        <div className="dice-selector" role="group" aria-label="Selecionar dado">
          {DIE_TYPES.map((d) => (
            <DieButton
              key={d}
              dieType={d}
              selected={selectedDie === d}
              disabled={rolling}
              onClick={() => setSelectedDie(d)}
            />
          ))}
        </div>

        {/* ── Resultado + botão ── */}
        <div className="dice-roll-area">
          <div className="dice-result-wrap">
            {lastRoll ? (
              <div
                key={animKey}
                className={`dice-result ${resultClass(lastRoll.result, lastRoll.die_type)}`}
                aria-live="polite"
                aria-label={`Resultado: ${lastRoll.result} no ${lastRoll.die_type}`}
              >
                <span className="dice-result__die">{lastRoll.die_type}</span>
                <span className="dice-result__number">{lastRoll.result}</span>
                {lastRoll.result === dieSides(lastRoll.die_type) && (
                  <span className="dice-result__label">Crítico!</span>
                )}
                {lastRoll.result === 1 && (
                  <span className="dice-result__label">Falha crítica</span>
                )}
              </div>
            ) : (
              <div className="dice-result dice-result--empty">
                <span className="dice-result__die">{selectedDie}</span>
                <span className="dice-result__placeholder">—</span>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary dice-roll-btn"
            onClick={handleRoll}
            disabled={rolling}
          >
            {rolling
              ? <><span className="spinner spinner--sm" /> Rolando...</>
              : `Rolar ${selectedDie}`
            }
          </button>

          {rollError && (
            <div className="dice-feedback dice-feedback--error" role="alert">
              {rollError}
            </div>
          )}
        </div>

        {/* ── Histórico ── */}
        <div className="dice-history">
          <h4 className="dice-history__title">
            <span aria-hidden="true">◎</span> Histórico
          </h4>

          {histLoading && (
            <div className="dice-history__loading">
              <div className="spinner spinner--sm" />
              <span>Carregando...</span>
            </div>
          )}

          {!histLoading && histError && (
            <div className="dice-feedback dice-feedback--error">{histError}</div>
          )}

          {!histLoading && !histError && history.length === 0 && (
            <p className="dice-history__empty">Nenhuma rolagem ainda. Role um dado!</p>
          )}

          {!histLoading && history.length > 0 && (
            <ul className="dice-history__list" aria-label="Histórico de rolagens">
              {history.map((roll) => {
                const isOwn  = roll.user_id === currentUserId
                const max    = dieSides(roll.die_type)
                const isCrit = roll.result === max
                const isFail = roll.result === 1

                return (
                  <li
                    key={roll.id}
                    className={`dice-history__row ${isOwn ? 'dice-history__row--own' : ''}`}
                  >
                    <span className="dice-history__avatar">
                      {roll.profile.display_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="dice-history__player">
                      {isOwn ? 'Você' : roll.profile.display_name}
                    </span>
                    <span className="dice-history__die">{roll.die_type}</span>
                    <span
                      className={`dice-history__result ${
                        isCrit ? 'dice-history__result--crit'
                        : isFail ? 'dice-history__result--fail'
                        : ''
                      }`}
                    >
                      {roll.result}
                      {isCrit && <span className="dice-history__tag">✦</span>}
                      {isFail && <span className="dice-history__tag">✕</span>}
                    </span>
                    <span className="dice-history__time">
                      {formatRelativeTime(roll.created_at)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
