import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Select } from '../../../../shared/components/Select'
import { Loader } from '../../../../shared/components/Loader'
import type { TdaCreature } from '../../../../shared/types'
import {
  CREATURE_KINDS,
  PRESET_CREATURES,
  type CreatureStats,
  type TdaCreatureKind,
} from '../constants/tdaBestiary'
import {
  createTdaCreature,
  deleteTdaCreature,
  getTdaCreatures,
  updateTdaCreature,
  type TdaCreatureInput,
} from '../services/tdaBestiaryService'
import { useTdaFonts } from '../utils/tdaFonts'
import '../../components/SheetPanel.css'
import './TerraDevastadaAdaptadaSheet.css'

// ────────────────────────────────────────────────────────
// Bestiário do mestre (Terra Devastada Adaptada): referência com os
// infectados e os humanos, e as criaturas da própria campanha (copiadas
// da referência e ajustadas, ou criadas do zero).
// ────────────────────────────────────────────────────────

interface TdaBestiaryPanelProps {
  campaignId: string
}

interface Draft extends CreatureStats {
  /** Sem id = criatura nova. */
  id?: string
}

const KIND_OPTIONS = CREATURE_KINDS.map((k) => ({ value: k.id, label: k.label }))
const EMPTY_DRAFT: Draft = { name: '', kind: 'infectado', damage: 1, toughness: 1, defense: 1, ferocity: 1, notes: '' }

export function TdaBestiaryPanel({ campaignId }: TdaBestiaryPanelProps) {
  useTdaFonts()
  const [creatures, setCreatures] = useState<TdaCreature[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [draft, setDraft]         = useState<Draft | null>(null)
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    try {
      setCreatures(await getTdaCreatures(campaignId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o bestiário.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) { setError('Dê um nome à criatura.'); return }
    const input: TdaCreatureInput = {
      name, kind: draft.kind,
      damage: clamp(draft.damage, 1, 6), toughness: clamp(draft.toughness, 1, 12),
      defense: clamp(draft.defense, 1, 6), ferocity: clamp(draft.ferocity, 1, 6),
      notes: draft.notes.trim() || null,
    }
    setSaving(true)
    try {
      if (draft.id) await updateTdaCreature(draft.id, input)
      else await createTdaCreature(campaignId, input)
      setDraft(null)
      setError(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a criatura.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(c: TdaCreature) {
    if (!window.confirm(`Excluir "${c.name}" do bestiário?`)) return
    try {
      await deleteTdaCreature(c.id)
      setCreatures((prev) => prev.filter((x) => x.id !== c.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a criatura.')
    }
  }

  const infected = PRESET_CREATURES.filter((c) => c.kind === 'infectado')
  const others   = PRESET_CREATURES.filter((c) => c.kind !== 'infectado')

  return (
    <section className="sheet-panel tda-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">☠</span>
          <h3 className="sheet-panel__title">Bestiário</h3>
          <span className="tda-panel__tag">Infectados e humanos</span>
        </div>
      </header>

      <div className="sheet-panel__body tda-bestiary">
        <p className="tda-bestiary__intro">
          <strong>Dano</strong> é o que o golpe tira da Vida (1 a 6; 6 mata de uma vez).{' '}
          <strong>Resistência</strong> é quanto dano a criatura aguenta: uma arma com dano igual ou maior mata em um acerto,
          menor vai acumulando. <strong>Defesa</strong> é a meta pra acertá-la e <strong>Ferocidade</strong> é a meta pra
          esquivar dela (teste de pares do jogador). Os danos dos infectados são os da regra; o resto são números sugeridos, ajuste como quiser.
        </p>

        {error && <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>}

        <div className="tda-bestiary__section">
          <h4 className="tda-card__title">Infectados</h4>
          <div className="tda-bestiary__grid">
            {infected.map((c) => (
              <CreatureCard key={c.id} creature={c}
                actions={<button type="button" className="tda-btn" onClick={() => setDraft({ ...c })}>Copiar pra campanha</button>} />
            ))}
          </div>
        </div>

        <div className="tda-bestiary__section">
          <h4 className="tda-card__title">Humanos e animais</h4>
          <div className="tda-bestiary__grid">
            {others.map((c) => (
              <CreatureCard key={c.id} creature={c}
                actions={<button type="button" className="tda-btn" onClick={() => setDraft({ ...c })}>Copiar pra campanha</button>} />
            ))}
          </div>
        </div>

        <div className="tda-bestiary__section">
          <div className="tda-card__header">
            <h4 className="tda-card__title">Da campanha <span className="tda-card__subtitle">só você vê</span></h4>
            {!draft && (
              <button type="button" className="tda-btn tda-btn--primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
                + Nova criatura
              </button>
            )}
          </div>

          {draft && (
            <div className="tda-creature-form">
              <label className="tda-field">
                <span className="tda-label">Nome</span>
                <input
                  type="text" className="input" maxLength={80} value={draft.name} placeholder="Ex.: Estalador do porão"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <div className="tda-field">
                <span className="tda-label">Tipo</span>
                <Select
                  listClassName="tda-select-list"
                  value={draft.kind} options={KIND_OPTIONS} aria-label="Tipo"
                  onChange={(v) => setDraft({ ...draft, kind: v as TdaCreatureKind })}
                />
              </div>
              <div className="tda-creature-form__row">
                <NumberField label="Dano" value={draft.damage} min={1} max={6} onChange={(v) => setDraft({ ...draft, damage: v })} />
                <NumberField label="Resistência" value={draft.toughness} min={1} max={12} onChange={(v) => setDraft({ ...draft, toughness: v })} />
                <NumberField label="Defesa" value={draft.defense} min={1} max={6} onChange={(v) => setDraft({ ...draft, defense: v })} />
                <NumberField label="Ferocidade" value={draft.ferocity} min={1} max={6} onChange={(v) => setDraft({ ...draft, ferocity: v })} />
              </div>
              <label className="tda-field">
                <span className="tda-label">Anotações</span>
                <textarea
                  className="input tda-textarea" rows={3} maxLength={2000} value={draft.notes}
                  placeholder="Comportamento, fraquezas, o que solta ao morrer..."
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={() => setDraft(null)} disabled={saving}>Cancelar</button>
                <button type="button" className="tda-btn tda-btn--primary" onClick={() => void save()} disabled={saving}>
                  {saving ? 'Salvando…' : draft.id ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}

          {loading && <div className="sheet-loading"><Loader small /></div>}
          {!loading && creatures.length === 0 && !draft && (
            <p className="tda-hint">Nenhuma criatura da campanha ainda. Copie uma das de cima ou crie do zero.</p>
          )}
          <div className="tda-bestiary__grid">
            {creatures.map((c) => (
              <CreatureCard key={c.id} creature={{ ...c, notes: c.notes ?? '' }}
                actions={(
                  <>
                    <button type="button" className="tda-btn" onClick={() => setDraft({ ...c, notes: c.notes ?? '' })}>Editar</button>
                    <button type="button" className="tda-btn tda-btn--danger" onClick={() => void remove(c)}>Excluir</button>
                  </>
                )} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CreatureCard({ creature, actions }: { creature: CreatureStats; actions: ReactNode }) {
  const kind = CREATURE_KINDS.find((k) => k.id === creature.kind)?.label ?? 'Outro'
  const cls = creature.kind === 'infectado' ? '' : creature.kind === 'humano' ? ' tda-creature--human' : creature.kind === 'animal' ? ' tda-creature--animal' : ' tda-creature--outro'
  return (
    <article className={`tda-creature${cls}`}>
      <div className="tda-creature__head">
        <h5 className="tda-creature__name">{creature.name}</h5>
        <span className="tda-creature__kind">{kind}</span>
      </div>
      <div className="tda-creature__stats">
        <Stat label="Dano" value={creature.damage} danger />
        <Stat label="Resist." value={creature.toughness} />
        <Stat label="Defesa" value={creature.defense} />
        <Stat label="Ferocid." value={creature.ferocity} />
      </div>
      {creature.notes && <p className="tda-creature__notes">{creature.notes}</p>}
      <div className="tda-creature__actions">{actions}</div>
    </article>
  )
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`tda-stat${danger ? ' tda-stat--danger' : ''}`}>
      <span className="tda-stat__value">{value}</span>
      <span className="tda-stat__label">{label}</span>
    </div>
  )
}

function NumberField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void
}) {
  return (
    <label className="tda-field">
      <span className="tda-label">{label}</span>
      <input
        type="number" className="input" min={min} max={max} value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min, min, max))}
      />
    </label>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}
