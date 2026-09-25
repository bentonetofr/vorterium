import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { rollEvensTest } from '../../../dice/services/diceService'
import type { RollBreakdownItem, TdCondition, TdInventoryItem, TdTrait } from '../../../../shared/types'
import {
  HORROR_AFFECTION,
  HORROR_GRAVITY,
  HORROR_INVOLVEMENT,
  HORROR_MAX,
  type HorrorOption,
} from '../constants/terraDevastada'
import { clampHorror, horrorBand, horrorGain, plural, poolSize } from '../utils/tdRules'
import { DiceTray, PoolPicker, picksNet, type Picks } from './TdDice'
import { playRollSound } from './TdTestModal'

// ────────────────────────────────────────────────────────
// Cena de horror: Gravidade + Envolvimento + Ligação afetiva − Horror
// atual = pontos novos (nunca negativo). Opcional: relevar com um teste —
// cada par anula 1 ponto (desvantagens também contam). Ao aplicar, se o
// personagem entrar numa faixa nova, a janela lembra o que anotar e
// deixa anotar ali mesmo.
// ────────────────────────────────────────────────────────

interface TdHorrorModalProps {
  campaignId:  string
  who:         string
  traits:      TdTrait[]
  conditions:  TdCondition[]
  inventory:   TdInventoryItem[]
  horror:      number
  onApply:     (newHorror: number) => void
  onAddCondition: (name: string) => void
  onAddTrait:  (name: string) => void
  onAnnounce:  (message: string) => void
  onClose:     () => void
}

interface Relevo { results: number[]; bonus: number[]; evens: number }

export function TdHorrorModal({
  campaignId, who, traits, conditions, inventory, horror,
  onApply, onAddCondition, onAddTrait, onAnnounce, onClose,
}: TdHorrorModalProps) {
  const [gravity, setGravity]         = useState<string | null>(null)
  const [involvement, setInvolvement] = useState<string | null>(null)
  const [affection, setAffection]     = useState('nenhuma')
  const [relevar, setRelevar]         = useState(false)
  const [picks, setPicks]             = useState<Picks>({})
  const [situation, setSituation]     = useState(0)
  const [rolling, setRolling]         = useState(false)
  const [relevo, setRelevo]           = useState<Relevo | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [appliedTo, setAppliedTo]     = useState<{ from: number; to: number } | null>(null)
  const [note, setNote]               = useState('')
  const [noted, setNoted]             = useState(false)

  const pts = (list: HorrorOption[], id: string | null) => list.find((o) => o.id === id)?.points ?? 0
  const ready = gravity != null && involvement != null
  const scene = pts(HORROR_GRAVITY, gravity) + pts(HORROR_INVOLVEMENT, involvement) + pts(HORROR_AFFECTION, affection)
  const gain = horrorGain(scene, horror)
  const cancelled = relevo ? Math.min(gain, relevo.evens) : 0
  const finalGain = Math.max(0, gain - cancelled)
  const next = clampHorror(horror + finalGain)

  async function rollRelevar() {
    setError(null)
    setRolling(true)
    try {
      const pool = poolSize(picksNet(picks, situation))
      const roll = await rollEvensTest(campaignId, pool.dice)
      const evens = roll.roll_breakdown?.find(
        (b): b is Extract<RollBreakdownItem, { type: 'evens' }> => b.type === 'evens',
      )
      if (!evens) throw new Error('Não foi possível ler a rolagem.')
      setRelevo({ results: evens.results, bonus: evens.bonus, evens: evens.subtotal })
      playRollSound()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      setRolling(false)
    }
  }

  function apply() {
    if (!ready || appliedTo) return
    onApply(next)
    setAppliedTo({ from: horror, to: next })
    const relevou = relevo ? ` (relevou ${cancelled})` : ''
    onAnnounce(
      finalGain > 0
        ? `${who} passou por uma cena de horror: +${finalGain} de Horror${relevou}, agora ${next}.`
        : `${who} passou por uma cena de horror sem se abalar${relevou}. Horror ${horror}.`,
    )
  }

  // Faixa nova ao subir: lembra o que anotar.
  const fromBand = appliedTo ? horrorBand(appliedTo.from) : null
  const toBand = appliedTo ? horrorBand(appliedTo.to) : null
  const newBand = appliedTo && toBand && fromBand && toBand.min > fromBand.min ? toBand : null

  function addNote() {
    const name = note.trim()
    if (!name || !newBand) return
    if (newBand.gain === 'condicao') onAddCondition(name)
    else onAddTrait(name)
    setNoted(true)
  }

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className="alth-modal__window td-modal td-horror" role="dialog" aria-modal="true" aria-labelledby="td-horror-title">
        <header className="alth-modal__header">
          <h4 id="td-horror-title" className="alth-modal__title td-modal__title">Cena de horror</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="td-modal__body">
          {!appliedTo && (
            <>
              <OptionList title="Gravidade" options={HORROR_GRAVITY} value={gravity} onChange={setGravity} />
              <OptionList title="Envolvimento" options={HORROR_INVOLVEMENT} value={involvement} onChange={setInvolvement} />
              <OptionList
                title="Ligação afetiva (só a mais forte)" options={HORROR_AFFECTION}
                value={affection} onChange={setAffection}
              />

              <div className="td-horror__sum" aria-live="polite">
                {ready ? (
                  <>
                    <span>
                      Cena {scene} − Horror atual {horror} = <strong>{plural(gain, 'ponto novo', 'pontos novos')}</strong>
                    </span>
                    {gain === 0 && <span className="td-hint">A mente já viu coisa pior: esse horror não afeta.</span>}
                  </>
                ) : (
                  <span className="td-hint">Escolha a gravidade e o envolvimento.</span>
                )}
              </div>

              {ready && gain > 0 && (
                <div className="td-horror__relevar">
                  <label className="td-check">
                    <input
                      type="checkbox" checked={relevar} disabled={!!relevo}
                      onChange={(e) => setRelevar(e.target.checked)}
                    />
                    Relevar o horror com um teste (cada par anula 1 ponto)
                  </label>

                  {relevar && !relevo && (
                    <>
                      <PoolPicker
                        traits={traits} conditions={conditions} inventory={inventory}
                        picks={picks} onPicks={setPicks}
                        situation={situation} onSituation={setSituation}
                        hint="Marque o que ajuda a resistir (+) e o que faz você se entregar ao horror (−)."
                      />
                      <div className="td-actions">
                        <button type="button" className="td-btn" onClick={() => void rollRelevar()} disabled={rolling}>
                          {rolling ? 'Rolando…' : `Rolar ${poolSize(picksNet(picks, situation)).dice}d`}
                        </button>
                      </div>
                    </>
                  )}

                  {relevo && (
                    <>
                      <DiceTray results={relevo.results} bonus={relevo.bonus} />
                      <p className="td-hint td-hint--center">
                        {relevo.evens > 0
                          ? `${plural(relevo.evens, 'par', 'pares')}: anula ${plural(cancelled, 'ponto', 'pontos')}.`
                          : 'Nenhum par: não conseguiu relevar.'}
                      </p>
                    </>
                  )}
                </div>
              )}

              {error && <p className="td-warn" role="alert">{error}</p>}

              <div className="td-actions">
                <button type="button" className="td-btn" onClick={onClose} disabled={rolling}>Cancelar</button>
                <button type="button" className="td-btn td-btn--primary" onClick={apply} disabled={!ready || rolling}>
                  {finalGain > 0 ? `Aplicar +${finalGain} de Horror` : 'Registrar a cena'}
                </button>
              </div>
            </>
          )}

          {appliedTo && toBand && (
            <>
              <div className={`td-result${appliedTo.to > appliedTo.from ? ' td-result--falha' : ''}`} role="status">
                <span className="td-result__number">{appliedTo.to}</span>
                <span className="td-result__label">de Horror (máx. {HORROR_MAX}) · {toBand.title}</span>
                <span className="td-hint">{toBand.effect}</span>
              </div>

              {newBand?.gain && !noted && (
                <div className="td-field">
                  <span className="td-label">
                    {newBand.gain === 'condicao' ? 'Anotar a condição de medo' : `Anotar a perturbação ${newBand.gain === 'perturbacao-leve' ? 'leve' : 'grave'}`}
                  </span>
                  <div className="td-add-row">
                    <input
                      type="text" className="input" maxLength={80}
                      placeholder={newBand.gain === 'condicao' ? 'Ex.: Horrorizado' : newBand.gain === 'perturbacao-leve' ? 'Ex.: Pesadelos constantes' : 'Ex.: Paranoia grave'}
                      value={note} onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote() } }}
                    />
                    <button type="button" className="td-btn" onClick={addNote} disabled={!note.trim()}>Anotar</button>
                  </div>
                </div>
              )}
              {noted && <p className="td-hint td-hint--center">Anotado na ficha.</p>}

              <div className="td-actions">
                <button type="button" className="td-btn td-btn--primary" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

interface OptionListProps {
  title:    string
  options:  HorrorOption[]
  value:    string | null
  onChange: (id: string) => void
}

function OptionList({ title, options, value, onChange }: OptionListProps) {
  return (
    <fieldset className="td-options">
      <legend className="td-label">{title}</legend>
      {options.map((o) => (
        <label key={o.id} className={`td-option${value === o.id ? ' td-option--active' : ''}`}>
          <input type="radio" name={title} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span className="td-option__label">{o.label}</span>
          <span className="td-option__points">+{o.points}</span>
        </label>
      ))}
    </fieldset>
  )
}
