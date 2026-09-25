import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Collapse } from '../../../shared/components/Collapse'
import { DAMAGE_DICE_PATTERN } from '../../sheets/altherium/services/altheriumSheetService'
import {
  createCreature,
  deleteCreature,
  getBestiary,
  getPartyMembers,
  updateCreature,
  type CreatureInput,
  type PartyMember,
} from '../services/bestiaryService'
import {
  DANGER_PCT_MAX,
  DANGER_PCT_MIN,
  DANGER_TIERS,
  DEFAULT_ROUNDS,
  ROUNDS_MAX,
  ROUNDS_MIN,
  challengeRating,
  dangerTierFor,
  diceAverage,
  formatNumber,
  roundsLabel,
  suggestDice,
  suggestHp,
  targetDamage,
} from '../utils/bestiaryCalculations'
import type { AltheriumCreature, CampaignWithRole } from '../../../shared/types'
import './BestiaryPanel.css'

// ────────────────────────────────────────────────────────
// Bestiário — aba da Mesa da Sessão só do mestre (campanhas Altherium).
// O mestre marca quem está no grupo e o formulário faz as contas da regra
// de criação de inimigos com as fichas: HP pelo dano do grupo × rodadas,
// dano pela vida média × % de perigo, e o dado que chega nesse dano.
// Os valores sugeridos podem ser ajustados à mão antes de salvar.
// ────────────────────────────────────────────────────────

const NAME_MAX  = 80
const NOTES_MAX = 2000
const HP_MAX    = 9999

interface PartySummary {
  count:   number
  damage:  number
  avgHp:   number
}

function dangerLabel(pct: number): string {
  const tier = DANGER_TIERS.find((t) => t.id === dangerTierFor(pct))
  return tier ? `${pct}% (${tier.label})` : `${pct}%`
}

// ── Formulário ───────────────────────────────────────────

interface CreatureFormProps {
  initial?: AltheriumCreature
  party:    PartySummary
  saving:   boolean
  onSave:   (input: CreatureInput) => Promise<void>
  onCancel: () => void
}

function CreatureForm({ initial, party, saving, onSave, onCancel }: CreatureFormProps) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [rounds, setRounds]     = useState(initial?.rounds ?? DEFAULT_ROUNDS)
  const [dangerPct, setDanger]  = useState(initial?.danger_pct ?? 25)
  const [notes, setNotes]       = useState(initial?.notes ?? '')
  // Vida e dano seguem a sugestão até a pessoa digitar por cima. Ao editar
  // uma criatura salva, começam com o valor salvo (manual).
  const [hpText, setHpText]     = useState(initial ? String(initial.hp) : '')
  const [hpManual, setHpManual] = useState(Boolean(initial))
  const [diceText, setDiceText] = useState(initial?.damage_dice ?? '')
  const [diceManual, setDiceManual] = useState(Boolean(initial))
  const [error, setError]       = useState<string | null>(null)

  const hpSuggestion   = suggestHp(party.damage, rounds)
  const damageTarget   = targetDamage(party.avgHp, dangerPct)
  const diceSuggestion = damageTarget != null ? suggestDice(damageTarget) : null

  const hpValue   = hpManual ? hpText : hpSuggestion != null ? String(hpSuggestion) : ''
  const diceValue = diceManual ? diceText : diceSuggestion?.dice ?? ''

  const hpNumber    = Number(hpValue)
  const hpValid     = hpValue !== '' && Number.isInteger(hpNumber) && hpNumber >= 1 && hpNumber <= HP_MAX
  const diceClean   = diceValue.replace(/\s+/g, '').toLowerCase()
  const diceAvg     = DAMAGE_DICE_PATTERN.test(diceClean) ? diceAverage(diceClean) : null
  const activeTier  = dangerTierFor(dangerPct)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const cleanName = name.trim()
    if (!cleanName) { setError('Dê um nome à criatura.'); return }
    if (!hpValid) { setError(`A vida deve ser um número inteiro de 1 a ${HP_MAX}.`); return }
    if (diceAvg == null) { setError('Escreva o dano como dados, por exemplo 1d8, 2d6+1 ou d12.'); return }
    try {
      await onSave({
        name:         cleanName,
        hp:           hpNumber,
        damage_dice:  diceClean,
        rounds,
        danger_pct:   dangerPct,
        party_damage: party.damage > 0 ? Math.round(party.damage * 100) / 100 : null,
        party_avg_hp: party.avgHp  > 0 ? Math.round(party.avgHp  * 100) / 100 : null,
        notes:        notes.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a criatura.')
    }
  }

  return (
    <form className="creature-form" onSubmit={handleSubmit} noValidate>
      <h4 className="creature-form__title">{initial ? 'Editar criatura' : 'Nova criatura'}</h4>

      {error && <p className="creature-form__error" role="alert">{error}</p>}

      <div className="creature-form__field">
        <label className="creature-form__label" htmlFor="creature-name">Nome</label>
        <input
          id="creature-name"
          className="input"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          autoFocus
        />
      </div>

      <div className="creature-form__grid">
        {/* Rodadas → HP */}
        <div className="creature-form__field">
          <div className="creature-form__label-row">
            <label className="creature-form__label" htmlFor="creature-rounds">Duração da luta</label>
            <span className="creature-form__value">
              {rounds} {rounds === 1 ? 'rodada' : 'rodadas'} · {roundsLabel(rounds)}
            </span>
          </div>
          <input
            id="creature-rounds"
            type="range"
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            disabled={saving}
          />
          <p className="creature-form__hint">3 rodadas: rápido · 4–5: padrão · 6 ou mais: boss</p>
        </div>

        {/* % de perigo → dano */}
        <div className="creature-form__field">
          <div className="creature-form__label-row">
            <label className="creature-form__label" htmlFor="creature-danger">Perigo</label>
            <span className="creature-form__value">{dangerPct}% da vida média</span>
          </div>
          <div className="creature-form__tiers" role="group" aria-label="Força do inimigo">
            {DANGER_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                className={`creature-tier${activeTier === tier.id ? ' creature-tier--active' : ''}`}
                aria-pressed={activeTier === tier.id}
                onClick={() => setDanger(tier.pct)}
                disabled={saving}
              >
                <span className="creature-tier__name">{tier.label}</span>
                <span className="creature-tier__range">{tier.min}–{tier.max}%</span>
              </button>
            ))}
          </div>
          <input
            id="creature-danger"
            type="range"
            min={DANGER_PCT_MIN}
            max={DANGER_PCT_MAX}
            value={dangerPct}
            onChange={(e) => setDanger(Number(e.target.value))}
            disabled={saving}
          />
        </div>
      </div>

      {/* Contas */}
      <div className="creature-math" aria-live="polite">
        <div className="creature-math__row">
          <span className="creature-math__label">Vida (HP)</span>
          {hpSuggestion != null ? (
            <span className="creature-math__calc">
              dano do grupo {formatNumber(party.damage)} × {rounds} {rounds === 1 ? 'rodada' : 'rodadas'} ={' '}
              <strong>{hpSuggestion}</strong>
              <span className="creature-cr">{challengeRating(hpSuggestion)}</span>
            </span>
          ) : (
            <span className="creature-math__calc creature-math__calc--empty">
              sem armas no grupo, preencha a vida à mão
            </span>
          )}
        </div>
        <div className="creature-math__row">
          <span className="creature-math__label">Dano por rodada</span>
          {damageTarget != null && diceSuggestion ? (
            <span className="creature-math__calc">
              vida média {formatNumber(party.avgHp)} × {dangerPct}% = {formatNumber(damageTarget)} →{' '}
              <strong>{diceSuggestion.dice}</strong>
              <span className="creature-math__avg">média {formatNumber(diceSuggestion.average)}</span>
            </span>
          ) : (
            <span className="creature-math__calc creature-math__calc--empty">
              sem fichas no grupo, preencha o dano à mão
            </span>
          )}
        </div>
      </div>

      {/* Valores finais */}
      <div className="creature-form__grid">
        <div className="creature-form__field">
          <div className="creature-form__label-row">
            <label className="creature-form__label" htmlFor="creature-hp">Vida (HP)</label>
            {!hpManual && hpSuggestion != null && <span className="creature-form__auto">automático</span>}
            {hpManual && hpSuggestion != null && String(hpSuggestion) !== hpText && (
              <button type="button" className="creature-form__reset" onClick={() => setHpManual(false)} disabled={saving}>
                usar sugestão ({hpSuggestion})
              </button>
            )}
          </div>
          <input
            id="creature-hp"
            className={`input${hpValue !== '' && !hpValid ? ' input--error' : ''}`}
            inputMode="numeric"
            value={hpValue}
            onChange={(e) => { setHpText(e.target.value.replace(/\D/g, '')); setHpManual(true) }}
            disabled={saving}
          />
          {hpValid && <p className="creature-form__hint">{challengeRating(hpNumber)}</p>}
        </div>

        <div className="creature-form__field">
          <div className="creature-form__label-row">
            <label className="creature-form__label" htmlFor="creature-dice">Dano</label>
            {!diceManual && diceSuggestion && <span className="creature-form__auto">automático</span>}
            {diceManual && diceSuggestion && diceSuggestion.dice !== diceClean && (
              <button type="button" className="creature-form__reset" onClick={() => setDiceManual(false)} disabled={saving}>
                usar sugestão ({diceSuggestion.dice})
              </button>
            )}
          </div>
          <input
            id="creature-dice"
            className={`input${diceValue !== '' && diceAvg == null ? ' input--error' : ''}`}
            value={diceValue}
            maxLength={12}
            onChange={(e) => { setDiceText(e.target.value); setDiceManual(true) }}
            disabled={saving}
          />
          {diceAvg != null && <p className="creature-form__hint">média {formatNumber(diceAvg)} por ataque</p>}
        </div>
      </div>

      <div className="creature-form__field">
        <label className="creature-form__label" htmlFor="creature-notes">Anotações</label>
        <textarea
          id="creature-notes"
          className="input creature-form__notes"
          value={notes}
          maxLength={NOTES_MAX}
          rows={4}
          onChange={(e) => setNotes(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="creature-form__actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar criatura'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Card ─────────────────────────────────────────────────

interface CreatureCardProps {
  creature:        AltheriumCreature
  confirming:      boolean
  deleting:        boolean
  onEdit:          () => void
  onDelete:        () => void
  onConfirmDelete: () => void
  onCancelDelete:  () => void
}

function CreatureCard({ creature, confirming, deleting, onEdit, onDelete, onConfirmDelete, onCancelDelete }: CreatureCardProps) {
  const average = diceAverage(creature.damage_dice)

  return (
    <article className="creature-card">
      <header className="creature-card__header">
        <div className="creature-card__titles">
          <h4 className="creature-card__name">{creature.name}</h4>
          <span className="creature-cr">{challengeRating(creature.hp)}</span>
        </div>
        <div className="creature-card__actions">
          {confirming ? (
            <>
              <span className="creature-card__confirm">Excluir?</span>
              <button type="button" className="btn btn-ghost creature-card__btn creature-card__btn--danger" onClick={onConfirmDelete} disabled={deleting}>
                {deleting ? 'Excluindo…' : 'Sim'}
              </button>
              <button type="button" className="btn btn-ghost creature-card__btn" onClick={onCancelDelete} disabled={deleting}>
                Não
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost creature-card__btn" onClick={onEdit}>Editar</button>
              <button type="button" className="btn btn-ghost creature-card__btn" onClick={onDelete}>Excluir</button>
            </>
          )}
        </div>
      </header>

      <div className="creature-card__stats">
        <div className="creature-stat">
          <span className="creature-stat__label">Vida</span>
          <span className="creature-stat__value">{creature.hp}</span>
        </div>
        <div className="creature-stat">
          <span className="creature-stat__label">Dano</span>
          <span className="creature-stat__value">{creature.damage_dice}</span>
          {average != null && <span className="creature-stat__sub">média {formatNumber(average)}</span>}
        </div>
      </div>

      <p className="creature-card__meta">
        {creature.rounds} {creature.rounds === 1 ? 'rodada' : 'rodadas'} ({roundsLabel(creature.rounds).toLowerCase()})
        {' · '}perigo {dangerLabel(creature.danger_pct)}
        {creature.party_damage != null && creature.party_avg_hp != null && (
          <> · grupo com dano {formatNumber(creature.party_damage)} e vida média {formatNumber(creature.party_avg_hp)}</>
        )}
      </p>

      {creature.notes && <p className="creature-card__notes">{creature.notes}</p>}
    </article>
  )
}

// ── Painel ───────────────────────────────────────────────

export function BestiaryPanel({ campaign }: { campaign: CampaignWithRole }) {
  const [party, setParty]               = useState<PartyMember[]>([])
  const [partyLoading, setPartyLoading] = useState(true)
  const [partyError, setPartyError]     = useState<string | null>(null)
  // Fichas fora da conta (ex.: a ficha de teste do próprio mestre).
  const [excluded, setExcluded]         = useState<Set<string>>(new Set())

  const [creatures, setCreatures]       = useState<AltheriumCreature[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState<string | null>(null)

  const [creating, setCreating]         = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [feedback, setFeedback]         = useState<string | null>(null)

  const loadParty = useCallback(async () => {
    setPartyLoading(true)
    setPartyError(null)
    try {
      const members = await getPartyMembers(campaign.id)
      setParty(members)
      // Fora da conta por padrão: a ficha do próprio mestre e a de quem
      // saiu da campanha (sem perfil visível) — dá pra marcar de volta.
      setExcluded((prev) => {
        const next = new Set(prev)
        for (const m of members) if (m.userId === campaign.master_id || m.player == null) next.add(m.sheetId)
        return next
      })
    } catch (err) {
      setPartyError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      setPartyLoading(false)
    }
  }, [campaign.id, campaign.master_id])

  useEffect(() => { void loadParty() }, [loadParty])

  useEffect(() => {
    let active = true
    getBestiary(campaign.id)
      .then((list) => { if (active) setCreatures(list) })
      .catch((err) => { if (active) setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o bestiário.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [campaign.id])

  const summary = useMemo<PartySummary>(() => {
    const included = party.filter((m) => !excluded.has(m.sheetId))
    const damage = included.reduce((sum, m) => sum + (m.weapon?.average ?? 0), 0)
    const avgHp = included.length ? included.reduce((sum, m) => sum + m.hp, 0) / included.length : 0
    return { count: included.length, damage, avgHp }
  }, [party, excluded])

  function toggleMember(sheetId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(sheetId)) next.delete(sheetId)
      else next.add(sheetId)
      return next
    })
  }

  function flash(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback((cur) => (cur === message ? null : cur)), 3000)
  }

  async function handleCreate(input: CreatureInput) {
    setSaving(true)
    try {
      const created = await createCreature(campaign.id, input)
      setCreatures((list) => [...list, created])
      setCreating(false)
      flash(`${created.name} entrou no bestiário.`)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string, input: CreatureInput) {
    setSaving(true)
    try {
      const updated = await updateCreature(id, input)
      setCreatures((list) => list.map((c) => (c.id === id ? updated : c)))
      setEditingId(null)
      flash('Criatura atualizada.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteCreature(id)
      setCreatures((list) => list.filter((c) => c.id !== id))
      setDeletingId(null)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Não foi possível excluir a criatura.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bestiary">
      <div className="bestiary__intro">
        <h4 className="bestiary__intro-title">Bestiário</h4>
        <p className="bestiary__intro-sub">
          Crie inimigos com vida e dano calculados a partir das fichas do grupo. Só você vê esta aba.
        </p>
      </div>

      {/* ── Grupo ── */}
      <section className="bestiary-party" aria-labelledby="bestiary-party-title">
        <header className="bestiary-party__head">
          <h5 id="bestiary-party-title" className="bestiary-party__title">Grupo</h5>
          <button type="button" className="btn btn-ghost bestiary-party__refresh" onClick={() => void loadParty()} disabled={partyLoading}>
            {partyLoading ? 'Atualizando…' : 'Atualizar fichas'}
          </button>
        </header>

        {partyError ? (
          <p className="bestiary__error" role="alert">{partyError}</p>
        ) : partyLoading && party.length === 0 ? (
          <div className="bestiary__state"><div className="spinner spinner--sm" /> Carregando fichas…</div>
        ) : party.length === 0 ? (
          <p className="bestiary__empty">Nenhum jogador criou ficha ainda.</p>
        ) : (
          <ul className="bestiary-party__list">
            {party.map((m) => {
              const included = !excluded.has(m.sheetId)
              return (
                <li key={m.sheetId} className={`bestiary-member${included ? '' : ' bestiary-member--off'}`}>
                  <label className="bestiary-member__check">
                    <input type="checkbox" checked={included} onChange={() => toggleMember(m.sheetId)} />
                    <span className="bestiary-member__name">
                      {m.character}
                      <span className="bestiary-member__player">{m.player ?? 'Jogador removido'}</span>
                    </span>
                  </label>
                  <span className="bestiary-member__hp">Vida {m.hp}</span>
                  <span className="bestiary-member__weapon">
                    {m.weapon
                      ? <>{m.weapon.name} <span className="bestiary-member__dice">{m.weapon.dice} · {formatNumber(m.weapon.average)}</span></>
                      : <span className="bestiary-member__none">sem arma</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {party.length > 0 && (
          <footer className="bestiary-party__totals">
            <div className="bestiary-total">
              <span className="bestiary-total__label">Dano do grupo por rodada</span>
              <span className="bestiary-total__value">{formatNumber(summary.damage)}</span>
            </div>
            <div className="bestiary-total">
              <span className="bestiary-total__label">Vida média</span>
              <span className="bestiary-total__value">{formatNumber(summary.avgHp)}</span>
            </div>
            <div className="bestiary-total">
              <span className="bestiary-total__label">Na conta</span>
              <span className="bestiary-total__value">{summary.count}</span>
            </div>
          </footer>
        )}
      </section>

      {/* ── Nova criatura ── */}
      {!creating && !editingId && (
        <button
          type="button"
          className="btn btn-primary bestiary__new"
          onClick={() => { setDeletingId(null); setCreating(true) }}
        >
          + Nova criatura
        </button>
      )}

      <Collapse open={creating}>
        <CreatureForm party={summary} saving={saving} onSave={handleCreate} onCancel={() => setCreating(false)} />
      </Collapse>

      {feedback && <p className="bestiary__feedback" role="status">{feedback}</p>}

      {/* ── Criaturas ── */}
      {loading ? (
        <div className="bestiary__state"><div className="spinner spinner--sm" /> Carregando bestiário…</div>
      ) : loadError ? (
        <p className="bestiary__error" role="alert">{loadError}</p>
      ) : creatures.length === 0 ? (
        !creating && <p className="bestiary__empty">Nenhuma criatura no bestiário ainda.</p>
      ) : (
        <div className="bestiary__list anim-stagger">
          {creatures.map((creature) =>
            editingId === creature.id ? (
              <CreatureForm
                key={creature.id}
                initial={creature}
                party={summary}
                saving={saving}
                onSave={(input) => handleUpdate(creature.id, input)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <CreatureCard
                key={creature.id}
                creature={creature}
                confirming={deletingId === creature.id}
                deleting={deleting}
                onEdit={() => { setCreating(false); setDeletingId(null); setEditingId(creature.id) }}
                onDelete={() => setDeletingId(creature.id)}
                onConfirmDelete={() => void handleDelete(creature.id)}
                onCancelDelete={() => setDeletingId(null)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
