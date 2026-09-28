import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  copyMyCreatureToCampaign,
  createMyCreature,
  deleteMyCreature,
  getMyCreatures,
  updateMyCreature,
  type PersonalCreatureInput,
} from '../services/personalBestiaryService'
import { getMyCampaigns } from '../../campaigns/services/campaignService'
import { challengeRating, diceAverage, formatNumber } from '../utils/bestiaryCalculations'
import { DAMAGE_DICE_PATTERN } from '../../sheets/altherium/services/altheriumSheetService'
import { Collapse } from '../../../shared/components/Collapse'
import { Select } from '../../../shared/components/Select'
import type { CampaignWithRole, PersonalCreature } from '../../../shared/types'
import '../../../shared/theme/toolPage.css'
import './MyBestiaryPage.css'

// ────────────────────────────────────────────────────────
// Meu bestiário — criaturas da pessoa, fora das campanhas. Entram por
// aqui (à mão) ou pelo "Guardar" do bestiário de uma campanha, e voltam
// pra qualquer campanha Altherium em que ela é mestre.
// ────────────────────────────────────────────────────────

export function MyBestiaryPage() {
  const [creatures, setCreatures] = useState<PersonalCreature[]>([])
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [notice, setNotice]       = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getMyCreatures(), getMyCampaigns()])
      .then(([list, camps]) => {
        setCreatures(list)
        setCampaigns(camps.filter((c) => c.role === 'master' && c.system === 'altherium'))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar seu bestiário.'))
      .finally(() => setLoading(false))
  }, [])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice((cur) => (cur === message ? null : cur)), 3500)
  }

  async function handleCreate(input: PersonalCreatureInput) {
    const created = await createMyCreature(input)
    setCreatures((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)))
    setCreating(false)
    flash(`${created.name} entrou no seu bestiário.`)
  }

  async function handleUpdate(id: string, input: PersonalCreatureInput) {
    const updated = await updateMyCreature(id, input)
    setCreatures((list) => list.map((c) => (c.id === id ? updated : c)))
    setEditingId(null)
    flash('Criatura atualizada.')
  }

  async function handleDelete(id: string) {
    try {
      await deleteMyCreature(id)
      setCreatures((list) => list.filter((c) => c.id !== id))
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Não foi possível excluir a criatura.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCopy(creature: PersonalCreature, campaignId: string) {
    const campaign = campaigns.find((c) => c.id === campaignId)
    try {
      await copyMyCreatureToCampaign(creature, campaignId)
      setCopyingId(null)
      flash(`${creature.name} foi copiada pro bestiário de ${campaign?.name ?? 'campanha'}.`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Não foi possível copiar a criatura.')
    }
  }

  return (
    <div className="tool-page my-bestiary">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Meu bestiário</h1>
          <p className="tool-page__sub">Suas criaturas pra usar em qualquer campanha. Só você vê.</p>
        </div>
        {!creating && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditingId(null); setCreating(true) }}>
            + Nova criatura
          </button>
        )}
      </div>

      <Collapse open={creating}>
        <PersonalCreatureForm onSave={handleCreate} onCancel={() => setCreating(false)} />
      </Collapse>

      {notice && <p className="tool-page__notice" role="status">{notice}</p>}

      {loading ? (
        <div className="tool-page__state"><div className="spinner spinner--sm" /> Carregando…</div>
      ) : error ? (
        <p className="tool-page__error" role="alert">{error}</p>
      ) : creatures.length === 0 ? (
        !creating && (
          <div className="tool-page__empty">
            <p className="tool-page__empty-icon">☠</p>
            <p className="tool-page__empty-title">Nenhuma criatura guardada ainda.</p>
            <p className="tool-page__empty-text">
              Crie uma aqui ou use "Guardar" nos cards do Bestiário de uma campanha Altherium.
            </p>
          </div>
        )
      ) : (
        <div className="my-bestiary__grid anim-stagger">
          {creatures.map((c) => editingId === c.id ? (
            <PersonalCreatureForm key={c.id} initial={c} onSave={(input) => handleUpdate(c.id, input)} onCancel={() => setEditingId(null)} />
          ) : (
            <PersonalCreatureCard
              key={c.id}
              creature={c}
              campaigns={campaigns}
              copying={copyingId === c.id}
              confirmingDelete={deletingId === c.id}
              onCopyToggle={() => setCopyingId((cur) => (cur === c.id ? null : c.id))}
              onCopy={(campaignId) => handleCopy(c, campaignId)}
              onEdit={() => { setCreating(false); setEditingId(c.id) }}
              onDelete={() => setDeletingId(c.id)}
              onConfirmDelete={() => void handleDelete(c.id)}
              onCancelDelete={() => setDeletingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card ────────────────────────────────────────────────

interface CardProps {
  creature:         PersonalCreature
  campaigns:        CampaignWithRole[]
  copying:          boolean
  confirmingDelete: boolean
  onCopyToggle:     () => void
  onCopy:           (campaignId: string) => Promise<void>
  onEdit:           () => void
  onDelete:         () => void
  onConfirmDelete:  () => void
  onCancelDelete:   () => void
}

function PersonalCreatureCard({
  creature, campaigns, copying, confirmingDelete, onCopyToggle, onCopy, onEdit, onDelete, onConfirmDelete, onCancelDelete,
}: CardProps) {
  const average = diceAverage(creature.damage_dice)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)

  async function copy() {
    if (!target) return
    setBusy(true)
    try { await onCopy(target) } finally { setBusy(false) }
  }

  return (
    <article className="tool-card my-creature">
      <header className="my-creature__head">
        <h2 className="tool-card__title">{creature.name}</h2>
        <span className="my-creature__cr">{challengeRating(creature.hp)}</span>
      </header>

      <div className="my-creature__stats">
        <div className="my-creature__stat">
          <span className="tool-label">Vida</span>
          <strong>{creature.hp}</strong>
        </div>
        <div className="my-creature__stat">
          <span className="tool-label">Dano</span>
          <strong>{creature.damage_dice}</strong>
          {average != null && <span className="tool-card__meta">média {formatNumber(average)}</span>}
        </div>
      </div>

      {creature.notes && <p className="my-creature__notes">{creature.notes}</p>}

      {copying && (
        <div className="my-creature__copy">
          {campaigns.length === 0 ? (
            <p className="tool-hint">
              Você ainda não é mestre de nenhuma campanha Altherium. <Link to="/campanhas/nova">Criar campanha</Link>
            </p>
          ) : (
            <>
              <Select
                value={target} onChange={setTarget} aria-label="Campanha de destino"
                options={[{ value: '', label: 'Escolha a campanha…' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void copy()} disabled={!target || busy}>
                {busy ? 'Copiando…' : 'Copiar'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="tool-card__actions">
        {confirmingDelete ? (
          <>
            <span className="tool-hint">Excluir do seu bestiário?</span>
            <button type="button" className="btn btn-ghost btn-sm my-creature__danger" onClick={onConfirmDelete}>Sim</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelDelete}>Não</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm my-creature__primary" onClick={onCopyToggle} aria-expanded={copying}>
              Copiar pra campanha
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>Editar</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>Excluir</button>
          </>
        )}
      </div>
    </article>
  )
}

// ── Formulário ──────────────────────────────────────────

interface FormProps {
  initial?: PersonalCreature
  onSave:   (input: PersonalCreatureInput) => Promise<void>
  onCancel: () => void
}

function PersonalCreatureForm({ initial, onSave, onCancel }: FormProps) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [hp, setHp]         = useState(String(initial?.hp ?? ''))
  const [damage, setDamage] = useState(initial?.damage_dice ?? '')
  const [notes, setNotes]   = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const hpNumber = parseInt(hp, 10)
    const dice = damage.trim().toLowerCase().replace(/\s+/g, '')
    if (!name.trim()) { setError('Dê um nome à criatura.'); return }
    if (!Number.isInteger(hpNumber) || hpNumber < 1 || hpNumber > 9999) { setError('Vida de 1 a 9999.'); return }
    if (!DAMAGE_DICE_PATTERN.test(dice)) { setError('Dano no formato 1d8, 2d6+3, d12-1.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), hp: hpNumber, damage_dice: dice, notes: notes.trim() || null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
      setSaving(false)
    }
  }

  return (
    <form className="tool-card my-creature-form" onSubmit={handleSubmit} noValidate>
      <h2 className="tool-card__title">{initial ? 'Editar criatura' : 'Nova criatura'}</h2>
      <label>
        <span className="tool-label">Nome</span>
        <input type="text" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </label>
      <div className="my-creature-form__row">
        <label>
          <span className="tool-label">Vida</span>
          <input type="number" className="input" min={1} max={9999} value={hp} onChange={(e) => setHp(e.target.value)} disabled={saving} />
        </label>
        <label>
          <span className="tool-label">Dano</span>
          <input type="text" className="input" maxLength={12} placeholder="2d6+3" value={damage} onChange={(e) => setDamage(e.target.value)} disabled={saving} />
        </label>
      </div>
      <label>
        <span className="tool-label">Anotações</span>
        <textarea className="input my-creature-form__notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
      </label>
      <p className="tool-hint">Pra calcular vida e dano pelas fichas do grupo, crie no Bestiário da campanha e use "Guardar".</p>
      {error && <p className="tool-page__error" role="alert">{error}</p>}
      <div className="tool-card__actions my-creature-form__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}
