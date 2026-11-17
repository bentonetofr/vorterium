import { useRef, useState } from 'react'
import {
  EVENS_MAX_DICE,
  QUICK_FORMULAS,
  parseDiceFormula,
  rollDice,
  rollEvensTest,
} from '../services/diceService'
import { formatRelativeTime, useRecentRolls } from '../useRecentRolls'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { isTerraDevastadaFamily } from '../../../shared/constants/systems'
import { rollDualityStaged } from '../../sheets/daggerheart/services/dhRolls'
import { dualityLabel, type DualityResult } from '../../sheets/daggerheart/model/dice'
import type { DiceRoll } from '../../../shared/types'
import { D3_NOTE, rollNote } from '../utils/rollNotes'
import './DiceRollerPanel.css'
import { Loader } from '../../../shared/components/Loader'

/** Dicas dos botões de rolagem rápida que fogem do comum. */
const QUICK_TITLES: Record<string, string> = { '1d2': 'Uma moeda de 2 lados: 1 ou 2', '1d3': `1d3: ${D3_NOTE}` }

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface DiceRollerPanelProps {
  campaignId: string
  currentUserId: string
  /** Chamado com a rolagem assim que ela é registrada — o DiceFab exibe o resultado como notificação. */
  onRoll: (roll: DiceRoll) => void
  /**
   * D&D: em vez de sortear aqui, entrega a fórmula (já conferida) para o cartão de dados
   * rolar no palco 3D. Os botões ficam travados até a promessa terminar, e os recentes recarregam.
   */
  onRequestRoll?: (formula: string, isPrivate: boolean) => Promise<void> | void
}

// Quantas rolagens recentes aparecem no popover — histórico completo
// continua acessível pela aba Atividade da campanha.
const RECENT_ROLLS_LIMIT = 3

// ────────────────────────────────────────────────────────
// Utilitários de display
// ────────────────────────────────────────────────────────

function signStr(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

const EXAMPLE_FORMULAS = ['2d6+3', '2#d20', '2@d20', '1#d3+4']

/** DaggerHeart: dados da rolagem rápida (sem d2, d3 e d100) e exemplos de fórmula. */
const DH_QUICK = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20']
const DH_EXAMPLES = ['2d8+3', '3d6+2', '1d20', '1d12+4']

/** Os dois dados de uma rolagem de Dualidade gravada (Esperança e Medo), ou null se não for uma. */
function dualityDice(roll: DiceRoll): { hope: number; fear: number; total: number | null } | null {
  if (roll.roll_context?.system !== 'daggerheart' || roll.formula !== '2d12') return null
  const t = roll.roll_breakdown?.[0]
  const r = t && 'results' in t ? (t.results as number[]) : null
  if (!r || r.length < 2) return null
  const m = roll.roll_label?.match(/= (-?\d+) ·/)
  return { hope: r[0], fear: r[1], total: m ? Number(m[1]) : null }
}

const EVENS_POOLS = Array.from({ length: EVENS_MAX_DICE }, (_, i) => i + 1)

export function DiceRollerPanel({ campaignId, currentUserId, onRoll, onRequestRoll }: DiceRollerPanelProps) {
  // Terra Devastada rola testes de pares — atalho de 1d a 6d no topo.
  const { campaign } = useCurrentCampaign()
  const isTerraDevastada = campaign?.id === campaignId && isTerraDevastadaFamily(campaign.system)
  const isDh = campaign?.id === campaignId && campaign.system === 'daggerheart'

  // ── Dualidade (DaggerHeart) ──
  const [dhMod, setDhMod] = useState(0)
  const [dhAdv, setDhAdv] = useState<'vantagem' | 'desvantagem' | null>(null)
  const [dhD20, setDhD20] = useState(false)
  const [dhDiff, setDhDiff] = useState('')
  const [dhResult, setDhResult] = useState<DualityResult | null>(null)

  // ── Rolagem ──
  const [rolling, setRolling]     = useState(false)
  const [rollError, setRollError] = useState<string | null>(null)

  // ── Campo personalizado ──
  const [customFormula, setCustomFormula] = useState('')
  const [formulaError, setFormulaError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Rolagem privada — reseta toda vez que o popover reabre, de propósito ──
  const [isPrivate, setIsPrivate] = useState(false)

  // ── Histórico (carrega e recebe as rolagens dos outros ao vivo) ──
  const { history, loading: histLoading, refreshing: histRefreshing, error: histError, reload: loadHistory } =
    useRecentRolls(campaignId, currentUserId, RECENT_ROLLS_LIMIT)

  async function rollDh() {
    setRollError(null); setRolling(true)
    try {
      const diff = dhDiff.trim() === '' ? null : Number(dhDiff)
      const staged = await rollDualityStaged({
        campaignId, sheetId: null, character: '', label: 'Dualidade', modifier: dhMod,
        advantage: dhAdv, hopeSides: dhD20 ? 20 : 12, difficulty: diff !== null && Number.isFinite(diff) ? diff : null,
      })
      setDhResult(staged.result)
      onRoll(staged.roll)
      await loadHistory(true)
    } catch (err) {
      setRollError(err instanceof Error ? err.message : 'Não foi possível registrar a rolagem.')
    } finally { setRolling(false) }
  }

  // ── Executar rolagem ──
  async function executeRoll(formula: string, evensPool?: number) {
    if (onRequestRoll && evensPool == null) {
      setRollError(null); setFormulaError(null); setRolling(true)
      try { await onRequestRoll(formula, isPrivate); await loadHistory(true) }
      catch (err) { setRollError(err instanceof Error ? err.message : 'Não foi possível registrar a rolagem.') }
      finally { setRolling(false) }
      return
    }
    setRollError(null)
    setFormulaError(null)
    setRolling(true)
    try {
      const roll = evensPool != null
        ? await rollEvensTest(campaignId, evensPool, { isPrivate })
        : await rollDice(campaignId, formula, isPrivate)
      onRoll(roll)
      await loadHistory(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar a rolagem.'
      setRollError(msg)
    } finally {
      setRolling(false)
    }
  }

  // ── Rolagem rápida ──
  function handleQuickRoll(formula: string) {
    executeRoll(formula)
  }

  // ── Validação e rolagem personalizada ──
  function handleCustomRoll() {
    const trimmed = customFormula.trim()
    if (!trimmed) { setFormulaError('Insira uma fórmula.'); return }
    try {
      parseDiceFormula(trimmed)
    } catch (err) {
      setFormulaError(err instanceof Error ? err.message : 'Fórmula inválida.')
      return
    }
    setFormulaError(null)
    executeRoll(trimmed)
  }

  function handleFormulaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !rolling) handleCustomRoll()
  }

  function useExample(formula: string) {
    setCustomFormula(formula)
    setFormulaError(null)
    inputRef.current?.focus()
  }

  // ────────────────────────────────────────────────────
  return (
    <div className="dice-panel__body">

      {/* ── Rolagem privada ── */}
      <label className="dice-private-toggle">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <svg
          className="dice-private-toggle__icon"
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Rolagem privada
      </label>

      {/* ── Dados de Dualidade (DaggerHeart) ── */}
      {isDh && (
        <div className="dice-section dh-duality">
          <h4 className="dice-section__title">Dados de Dualidade</h4>
          <div className="dh-duality__row">
            <span className="dh-duality__dice" aria-hidden="true"><i className="is-hope">12</i><i className="is-fear">12</i></span>
            <label>Modificador
              <span className="dh-duality__step">
                <button type="button" onClick={() => setDhMod((n) => Math.max(-5, n - 1))} aria-label="Diminuir o modificador">−</button>
                <output>{signStr(dhMod)}</output>
                <button type="button" onClick={() => setDhMod((n) => Math.min(12, n + 1))} aria-label="Aumentar o modificador">+</button>
              </span>
            </label>
            <label>Dificuldade
              <input type="number" inputMode="numeric" value={dhDiff} placeholder="—" onChange={(e) => setDhDiff(e.target.value)} />
            </label>
          </div>
          <div className="dh-duality__row">
            <span className="dh-duality__seg" role="group" aria-label="Vantagem ou desvantagem">
              <button type="button" className={dhAdv === 'vantagem' ? 'is-on' : ''} onClick={() => setDhAdv(dhAdv === 'vantagem' ? null : 'vantagem')}>Vantagem</button>
              <button type="button" className={dhAdv === 'desvantagem' ? 'is-on' : ''} onClick={() => setDhAdv(dhAdv === 'desvantagem' ? null : 'desvantagem')}>Desvantagem</button>
            </span>
            <label className="dh-duality__check"><input type="checkbox" checked={dhD20} onChange={(e) => setDhD20(e.target.checked)} /> Esperança em d20</label>
          </div>
          <button type="button" className="btn btn-primary dh-duality__go" onClick={() => void rollDh()} disabled={rolling}>
            {rolling ? 'Rolando…' : 'Rolar Dualidade'}
          </button>
          {dhResult && (
            <div className={`dh-duality__result dh-duality__result--${dhResult.kind}`} role="status">
              <span className="dh-duality__chips"><i className="is-hope">{dhResult.hope}</i><i className="is-fear">{dhResult.fear}</i>{dhResult.advantageDie > 0 && <i className="is-adv">{dhResult.advantage === 'vantagem' ? '+' : '−'}{dhResult.advantageDie}</i>}</span>
              <strong>{dhResult.total}</strong>
              <span>{dualityLabel(dhResult)}</span>
            </div>
          )}
          <p className="dice-custom__examples-label">Esperança maior: você ganha Esperança. Medo maior: o mestre ganha Medo. Dados iguais: sucesso crítico.</p>
        </div>
      )}

      {/* ── Teste de pares (Terra Devastada) ── */}
      {isTerraDevastada && (
        <div className="dice-section">
          <h4 className="dice-section__title">Teste de pares</h4>
          <div className="quick-roll-btns" role="group" aria-label="Teste de pares">
            {EVENS_POOLS.map((n) => (
              <button
                key={n}
                className="quick-roll-btn"
                onClick={() => executeRoll('', n)}
                disabled={rolling}
                aria-label={`Teste de pares com ${n}d6`}
              >
                {n}d
              </button>
            ))}
          </div>
          <p className="dice-custom__examples-label">Conta os pares; todo 6 rola de novo.</p>
        </div>
      )}

      {/* ── Rolagem rápida ── */}
      <div className="dice-section">
        <h4 className="dice-section__title">Rolagem rápida</h4>
        <div className="quick-roll-btns" role="group" aria-label="Rolagem rápida">
          {(isDh ? DH_QUICK : QUICK_FORMULAS).map((f) => (
            <button
              key={f}
              className="quick-roll-btn"
              onClick={() => handleQuickRoll(f)}
              disabled={rolling}
              aria-label={`Rolar ${f}`}
              title={QUICK_TITLES[f]}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rolagem personalizada ── */}
      <div className="dice-section">
        <h4 className="dice-section__title">Rolagem personalizada</h4>
        <div className="dice-custom">
          <div className="dice-custom__input-row">
            <input
              ref={inputRef}
              type="text"
              className={`input dice-custom__text-input ${formulaError ? 'dice-custom__text-input--error' : ''}`}
              placeholder="Digite uma fórmula"
              value={customFormula}
              onChange={(e) => { setCustomFormula(e.target.value); setFormulaError(null) }}
              onKeyDown={handleFormulaKeyDown}
              disabled={rolling}
              aria-label="Fórmula personalizada"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={80}
            />
            <button
              className="btn btn-primary dice-custom__roll-btn"
              onClick={handleCustomRoll}
              disabled={rolling}
            >
              {rolling
                ? <><span className="spinner spinner--sm" /> Rolando...</>
                : 'Rolar'
              }
            </button>
          </div>

          <div className="dice-custom__examples">
            <span className="dice-custom__examples-label">Exemplos:</span>
            {(isDh ? DH_EXAMPLES : EXAMPLE_FORMULAS).map((f) => (
              <button
                key={f}
                type="button"
                className="dice-custom__example-chip"
                onClick={() => useExample(f)}
                disabled={rolling}
              >
                {f}
              </button>
            ))}
          </div>

          {formulaError && (
            <div className="dice-feedback dice-feedback--error" role="alert">
              {formulaError}
            </div>
          )}
        </div>
      </div>

      {/* ── Erro de rolagem ── */}
      {rollError && (
        <div className="dice-feedback dice-feedback--error" role="alert">
          {rollError}
        </div>
      )}

      {/* ── Histórico ── */}
      <div className="dice-section dice-history">
        <div className="dice-history__header">
          <h4
            className="dice-section__title"
            style={{ borderBottom: 'none', marginBottom: 0 }}
          >
            <span aria-hidden="true">◎</span> Recentes
          </h4>
          <button
            className="btn btn-ghost dice-history__refresh-btn"
            onClick={() => loadHistory(true)}
            disabled={histRefreshing || histLoading}
          >
            {histRefreshing
              ? <><span className="spinner spinner--sm" /> Atualizando...</>
              : 'Atualizar'
            }
          </button>
        </div>

        {histLoading && (
          <div className="dice-history__loading">
            <Loader small />
          </div>
        )}

        {!histLoading && histError && (
          <div className="dice-feedback dice-feedback--error">{histError}</div>
        )}

        {!histLoading && !histError && history.length === 0 && (
          <p className="dice-history__empty">Nenhuma rolagem registrada nesta campanha.</p>
        )}

        {!histLoading && history.length > 0 && (
          <>
            <ul className="dice-history__list anim-stagger" aria-label="Histórico de rolagens">
              {history.map((roll) => {
                const isOwn = roll.user_id === currentUserId
                const diceTerms = roll.roll_breakdown?.filter((b) => b.type !== 'modifier') ?? []
                const hasBreakdown = diceTerms.length > 0
                // profile vem null quando o autor não é mais membro da campanha
                // (RLS de profiles exige co-membro atual) — a rolagem continua existindo.
                const authorName = roll.profile?.display_name ?? 'Usuário removido'

                return (
                  <li key={roll.id} className={`dice-history__row ${isOwn ? 'dice-history__row--own' : ''}`}>
                    <div className="dice-history__row-main">
                      <span className="dice-history__avatar" aria-hidden="true">
                        {authorName.charAt(0).toUpperCase()}
                      </span>
                      <span className="dice-history__player">
                        {isOwn ? 'Você' : authorName}
                        {roll.is_private && (
                          <span className="dice-history__private-badge" title="Rolagem privada" aria-label="Rolagem privada">🔒</span>
                        )}
                      </span>
                      {(() => {
                        const dd = dualityDice(roll)
                        return dd ? (
                          <>
                            <span className="dice-history__formula dh-duality__chips"><i className="is-hope">{dd.hope}</i><i className="is-fear">{dd.fear}</i></span>
                            <span className="dice-history__result">{dd.total ?? roll.result}</span>
                          </>
                        ) : (
                          <>
                            <span className="dice-history__formula">{roll.formula ?? roll.die_type}</span>
                            <span className="dice-history__result">{roll.result}</span>
                          </>
                        )
                      })()}
                      <span className="dice-history__time">
                        {formatRelativeTime(roll.created_at)}
                      </span>
                    </div>

                    {rollNote(roll) && <p className="dice-history__note">{rollNote(roll)}</p>}
                    {roll.roll_context?.system === 'daggerheart' && roll.roll_label && <p className="dice-history__note">{roll.roll_label}</p>}

                    {hasBreakdown && (
                      <div className="dice-history__row-detail">
                        {diceTerms.map((t, idx) => {
                          if (t.type === 'sum') {
                            return (
                              <span key={idx}>
                                {t.notation}: {t.results.join(', ')}
                                {idx < diceTerms.length - 1 ? ' · ' : ''}
                              </span>
                            )
                          }
                          if (t.type === 'evens') {
                            return (
                              <span key={idx}>
                                {t.notation}: {t.results.join(', ')}
                                {t.bonus.length > 0 && <> · 6 de novo: {t.bonus.join(', ')}</>}
                                {' → '}{t.subtotal} {t.subtotal === 1 ? 'par' : 'pares'}
                              </span>
                            )
                          }
                          if (t.type === 'keep_highest' || t.type === 'keep_lowest') {
                            return (
                              <span key={idx}>
                                {t.notation}: {t.results.join(', ')} → {t.kept}
                                {idx < diceTerms.length - 1 ? ' · ' : ''}
                              </span>
                            )
                          }
                          return null
                        })}
                        {roll.roll_breakdown?.find((b) => b.type === 'modifier') && (
                          <span>
                            {' · '}{roll.roll_mode === 'evens' ? 'Convicção ' : 'mod'}{signStr((roll.roll_breakdown.find((b) => b.type === 'modifier') as Extract<typeof roll.roll_breakdown[0], { type: 'modifier' }>).value)}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="dice-history__full-log-hint">
              Histórico completo na aba Atividade.
            </p>
          </>
        )}
      </div>

    </div>
  )
}
