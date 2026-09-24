import { useEffect, useState } from 'react'
import {
  DND_SKILLS,
  type DndCharacterAttack,
  type DndCharacterAttackInput,
  type DndCharacterInventoryInput,
  type DndCharacterInventoryItem,
  type DndCharacterSpell,
  type DndCharacterSpellInput,
  type DndRuleCatalogEntry,
  type DndSheetDetails,
  type DndSkillKey,
} from '../../../shared/types'
import {
  createDndAttack,
  createDndInventoryItem,
  createDndSpell,
  deleteDndAttack,
  deleteDndInventoryItem,
  deleteDndSpell,
  getDndCatalogEntries,
  updateDndAttack,
  updateDndInventoryItem,
  updateDndSpell,
  upsertDndSkill,
} from './services/dndSheetService'
import { formatModifier, getAbilityModifier } from './utils/dndCalculations'
import { Select } from '../../../shared/components/Select'

const SPELL_LEVEL_OPTIONS = Array.from({ length: 10 }, (_, level) => ({
  value: String(level),
  label: level === 0 ? 'Truque' : `Nível ${level}`,
}))

interface DetailsProps {
  sheetId: string
  details: DndSheetDetails
  onDetailsChange: (details: DndSheetDetails) => void
}

function DetailMessage({ error }: { error: string | null }) {
  return error ? <p className="dnd-detail-error" role="alert">{error}</p> : null
}

function replaceItem<T extends { id: string }>(items: T[], next: T): T[] {
  return items.map((item) => item.id === next.id ? next : item)
}

function metadataText(entry: DndRuleCatalogEntry, key: string): string {
  const value = entry.metadata[key]
  return typeof value === 'string' ? value : ''
}

function CatalogStatus({ loading, count }: { loading: boolean; count: number }) {
  if (loading) return <span className="dnd-catalog-status">Carregando catálogo…</span>
  if (!count) return <span className="dnd-catalog-status">Catálogo não aplicado no Supabase</span>
  return <span className="dnd-catalog-status">{count} opções do livro</span>
}

function SkillEditor({ sheetId, details, onDetailsChange, draft }: DetailsProps & {
  draft: Record<string, string>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const skills = new Map(details.skills.map((skill) => [skill.skill_key, skill]))

  async function toggle(skillKey: DndSkillKey, field: 'proficient' | 'expertise', value: boolean) {
    const current = skills.get(skillKey)
    const proficient = field === 'proficient' ? value : current?.proficient ?? false
    const expertise = field === 'expertise' ? value : current?.expertise ?? false
    setBusy(skillKey)
    setError(null)
    try {
      const saved = await upsertDndSkill(sheetId, skillKey, proficient, expertise)
      onDetailsChange({ ...details, skills: replaceItem(details.skills, saved).concat(details.skills.some((item) => item.id === saved.id) ? [] : [saved]) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a perícia.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dnd-tab-content">
      <div className="dnd-detail-heading">
        <div>
          <p className="dnd-section-title">Perícias</p>
          <p className="dnd-detail-hint">Marque proficiência ou especialização. O bônus é calculado automaticamente.</p>
        </div>
      </div>
      <DetailMessage error={error} />
      <div className="dnd-skills-editor">
        {DND_SKILLS.map((skill) => {
          const current = skills.get(skill.key)
          const score = Number(draft[skill.ability] ?? 10)
          const abilityBonus = getAbilityModifier(score)
          const proficiencyBonus = Number(draft.proficiency_bonus ?? 2)
          const bonus = abilityBonus + (current?.proficient ? proficiencyBonus : 0) + (current?.expertise ? proficiencyBonus : 0)
          return (
            <div key={skill.key} className="dnd-skill-editor-row">
              <span className="dnd-skill-editor-row__name">{skill.label}</span>
              <span className="dnd-skill-editor-row__ability">{skill.ability.slice(0, 3).toUpperCase()}</span>
              <span className="dnd-skill-editor-row__bonus">{formatModifier(bonus)}</span>
              <label className="dnd-detail-check">
                <input
                  type="checkbox"
                  checked={current?.proficient ?? false}
                  disabled={busy === skill.key}
                  onChange={(event) => void toggle(skill.key, 'proficient', event.target.checked)}
                />
                Prof.
              </label>
              <label className="dnd-detail-check">
                <input
                  type="checkbox"
                  checked={current?.expertise ?? false}
                  disabled={busy === skill.key || !current?.proficient}
                  onChange={(event) => void toggle(skill.key, 'expertise', event.target.checked)}
                />
                Exp.
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AttacksEditor({ sheetId, details, onDetailsChange }: DetailsProps) {
  const empty: DndCharacterAttackInput = { name: '', attack_bonus: '', damage: '', damage_type: '', notes: '', catalog_entry_key: null, sort_order: details.attacks.length }
  const [newAttack, setNewAttack] = useState(empty)
  const [edits, setEdits] = useState<Record<string, Partial<DndCharacterAttackInput>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<DndRuleCatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  useEffect(() => {
    getDndCatalogEntries(['weapon'])
      .then(setCatalog)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar as armas.'))
      .finally(() => setCatalogLoading(false))
  }, [])

  function selectWeapon(entryKey: string) {
    const entry = catalog.find((item) => item.entry_key === entryKey)
    if (!entry) return
    setNewAttack((current) => ({
      ...current,
      catalog_entry_key: entry.entry_key,
      name: entry.name,
      damage: metadataText(entry, 'damage'),
      damage_type: metadataText(entry, 'damage_type'),
      notes: [entry.description, metadataText(entry, 'cost'), ((entry.metadata.properties as string[] | undefined) ?? []).join(', ')].filter(Boolean).join(' · '),
    }))
  }

  async function addAttack() {
    if (!newAttack.name.trim()) { setError('Informe o nome do ataque.'); return }
    setBusy('new')
    setError(null)
    try {
      const saved = await createDndAttack(sheetId, { ...newAttack, name: newAttack.name.trim() })
      onDetailsChange({ ...details, attacks: [...details.attacks, saved] })
      setNewAttack({ ...empty, sort_order: details.attacks.length + 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível adicionar o ataque.') }
    finally { setBusy(null) }
  }

  async function saveAttack(attack: DndCharacterAttack) {
    const patch = edits[attack.id]
    if (!patch) return
    setBusy(attack.id)
    setError(null)
    try {
      const saved = await updateDndAttack(attack.id, patch)
      onDetailsChange({ ...details, attacks: replaceItem(details.attacks, saved) })
      setEdits((current) => { const next = { ...current }; delete next[attack.id]; return next })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar o ataque.') }
    finally { setBusy(null) }
  }

  async function removeAttack(attack: DndCharacterAttack) {
    setBusy(attack.id)
    setError(null)
    try {
      await deleteDndAttack(attack.id)
      onDetailsChange({ ...details, attacks: details.attacks.filter((item) => item.id !== attack.id) })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover o ataque.') }
    finally { setBusy(null) }
  }

  return (
    <div className="dnd-tab-content">
      <p className="dnd-section-title">Ataques</p>
      <DetailMessage error={error} />
      <div className="dnd-detail-form dnd-detail-form--attack">
        <Select
          className="dnd-edit-input" plain onChange={selectWeapon} aria-label="Arma do catálogo"
          options={[{ value: '', label: 'Escolher arma do catálogo' }, ...catalog.map((entry) => ({ value: entry.entry_key, label: entry.name }))]}
        />
        <input className="dnd-edit-input" placeholder="Nome (ex.: Espada longa)" value={newAttack.name} onChange={(e) => setNewAttack({ ...newAttack, name: e.target.value })} />
        <input className="dnd-edit-input" placeholder="Bônus" value={newAttack.attack_bonus} onChange={(e) => setNewAttack({ ...newAttack, attack_bonus: e.target.value })} />
        <input className="dnd-edit-input" placeholder="Dano" value={newAttack.damage} onChange={(e) => setNewAttack({ ...newAttack, damage: e.target.value })} />
        <input className="dnd-edit-input" placeholder="Tipo" value={newAttack.damage_type} onChange={(e) => setNewAttack({ ...newAttack, damage_type: e.target.value })} />
        <button type="button" className="btn btn-primary" onClick={() => void addAttack()} disabled={busy !== null}>Adicionar</button>
        <CatalogStatus loading={catalogLoading} count={catalog.length} />
      </div>
      {details.attacks.length === 0 && <p className="dnd-detail-empty">Nenhum ataque cadastrado.</p>}
      <div className="dnd-detail-list">
        {details.attacks.map((attack) => {
          const value = <K extends keyof DndCharacterAttackInput>(key: K) => edits[attack.id]?.[key] ?? attack[key]
          return (
            <div key={attack.id} className="dnd-detail-card">
              <div className="dnd-detail-card__grid dnd-detail-card__grid--attack">
                <input className="dnd-edit-input" value={String(value('name'))} onChange={(e) => setEdits({ ...edits, [attack.id]: { ...edits[attack.id], name: e.target.value } })} />
                <input className="dnd-edit-input" placeholder="Bônus" value={String(value('attack_bonus'))} onChange={(e) => setEdits({ ...edits, [attack.id]: { ...edits[attack.id], attack_bonus: e.target.value } })} />
                <input className="dnd-edit-input" placeholder="Dano" value={String(value('damage'))} onChange={(e) => setEdits({ ...edits, [attack.id]: { ...edits[attack.id], damage: e.target.value } })} />
                <input className="dnd-edit-input" placeholder="Tipo" value={String(value('damage_type'))} onChange={(e) => setEdits({ ...edits, [attack.id]: { ...edits[attack.id], damage_type: e.target.value } })} />
              </div>
              <div className="dnd-detail-card__actions">
                <button type="button" className="btn btn-ghost" onClick={() => void saveAttack(attack)} disabled={busy !== null || !edits[attack.id]}>Salvar</button>
                <button type="button" className="btn btn-ghost dnd-detail-danger" onClick={() => void removeAttack(attack)} disabled={busy !== null}>Remover</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InventoryEditor({ sheetId, details, onDetailsChange }: DetailsProps) {
  const empty: DndCharacterInventoryInput = { name: '', quantity: 1, weight: 0, equipped: false, notes: '', catalog_entry_key: null, sort_order: details.inventory.length }
  const [newItem, setNewItem] = useState(empty)
  const [edits, setEdits] = useState<Record<string, Partial<DndCharacterInventoryInput>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<DndRuleCatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  useEffect(() => {
    getDndCatalogEntries(['item', 'armor', 'tool'])
      .then(setCatalog)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar os itens.'))
      .finally(() => setCatalogLoading(false))
  }, [])

  function selectInventoryEntry(entryKey: string) {
    const entry = catalog.find((item) => item.entry_key === entryKey)
    if (!entry) return
    const properties = (entry.metadata.properties as string[] | undefined) ?? []
    const cost = metadataText(entry, 'cost')
    setNewItem((current) => ({
      ...current,
      catalog_entry_key: entry.entry_key,
      name: entry.name,
      weight: typeof entry.metadata.weight === 'number' ? entry.metadata.weight : current.weight,
      notes: [cost, ...properties].filter(Boolean).join(' · '),
    }))
  }

  async function addItem() {
    if (!newItem.name.trim()) { setError('Informe o nome do item.'); return }
    setBusy('new'); setError(null)
    try {
      const saved = await createDndInventoryItem(sheetId, { ...newItem, name: newItem.name.trim() })
      onDetailsChange({ ...details, inventory: [...details.inventory, saved] })
      setNewItem({ ...empty, sort_order: details.inventory.length + 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível adicionar o item.') }
    finally { setBusy(null) }
  }

  async function saveItem(item: DndCharacterInventoryItem) {
    const patch = edits[item.id]
    if (!patch) return
    setBusy(item.id); setError(null)
    try {
      const saved = await updateDndInventoryItem(item.id, patch)
      onDetailsChange({ ...details, inventory: replaceItem(details.inventory, saved) })
      setEdits((current) => { const next = { ...current }; delete next[item.id]; return next })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar o item.') }
    finally { setBusy(null) }
  }

  async function removeItem(item: DndCharacterInventoryItem) {
    setBusy(item.id); setError(null)
    try {
      await deleteDndInventoryItem(item.id)
      onDetailsChange({ ...details, inventory: details.inventory.filter((entry) => entry.id !== item.id) })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover o item.') }
    finally { setBusy(null) }
  }

  return (
    <div className="dnd-tab-content">
      <p className="dnd-section-title">Inventário</p>
      <DetailMessage error={error} />
      <div className="dnd-detail-form dnd-detail-form--inventory">
        <Select
          className="dnd-edit-input" plain onChange={selectInventoryEntry} aria-label="Item do catálogo"
          options={[{ value: '', label: 'Escolher item do catálogo' }, ...catalog.map((entry) => ({ value: entry.entry_key, label: entry.name }))]}
        />
        <input className="dnd-edit-input" placeholder="Nome do item" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
        <input className="dnd-edit-input" type="number" min="1" placeholder="Qtd." value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
        <input className="dnd-edit-input" type="number" min="0" step="0.1" placeholder="Peso" value={newItem.weight} onChange={(e) => setNewItem({ ...newItem, weight: Number(e.target.value) })} />
        <label className="dnd-detail-check"><input type="checkbox" checked={newItem.equipped} onChange={(e) => setNewItem({ ...newItem, equipped: e.target.checked })} /> Equipado</label>
        <button type="button" className="btn btn-primary" onClick={() => void addItem()} disabled={busy !== null}>Adicionar</button>
        <CatalogStatus loading={catalogLoading} count={catalog.length} />
      </div>
      {details.inventory.length === 0 && <p className="dnd-detail-empty">Nenhum item cadastrado.</p>}
      <div className="dnd-detail-list">
        {details.inventory.map((item) => {
          const value = <K extends keyof DndCharacterInventoryInput>(key: K) => edits[item.id]?.[key] ?? item[key]
          return (
            <div key={item.id} className="dnd-detail-card">
              <div className="dnd-detail-card__grid dnd-detail-card__grid--inventory">
                <input className="dnd-edit-input" value={String(value('name'))} onChange={(e) => setEdits({ ...edits, [item.id]: { ...edits[item.id], name: e.target.value } })} />
                <input className="dnd-edit-input" type="number" min="1" value={String(value('quantity'))} onChange={(e) => setEdits({ ...edits, [item.id]: { ...edits[item.id], quantity: Number(e.target.value) } })} />
                <input className="dnd-edit-input" type="number" min="0" step="0.1" value={String(value('weight'))} onChange={(e) => setEdits({ ...edits, [item.id]: { ...edits[item.id], weight: Number(e.target.value) } })} />
                <label className="dnd-detail-check"><input type="checkbox" checked={Boolean(value('equipped'))} onChange={(e) => setEdits({ ...edits, [item.id]: { ...edits[item.id], equipped: e.target.checked } })} /> Equipado</label>
              </div>
              <div className="dnd-detail-card__actions">
                <button type="button" className="btn btn-ghost" onClick={() => void saveItem(item)} disabled={busy !== null || !edits[item.id]}>Salvar</button>
                <button type="button" className="btn btn-ghost dnd-detail-danger" onClick={() => void removeItem(item)} disabled={busy !== null}>Remover</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpellsEditor({ sheetId, details, onDetailsChange }: DetailsProps) {
  const empty: DndCharacterSpellInput = { name: '', spell_level: 0, school: '', casting_time: '', spell_range: '', duration: '', concentration: false, ritual: false, prepared: false, description: '', sort_order: details.spells.length }
  const [newSpell, setNewSpell] = useState(empty)
  const [edits, setEdits] = useState<Record<string, Partial<DndCharacterSpellInput>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function addSpell() {
    if (!newSpell.name.trim()) { setError('Informe o nome da magia.'); return }
    setBusy('new'); setError(null)
    try {
      const saved = await createDndSpell(sheetId, { ...newSpell, name: newSpell.name.trim() })
      onDetailsChange({ ...details, spells: [...details.spells, saved] })
      setNewSpell({ ...empty, sort_order: details.spells.length + 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível adicionar a magia.') }
    finally { setBusy(null) }
  }

  async function saveSpell(spell: DndCharacterSpell) {
    const patch = edits[spell.id]
    if (!patch) return
    setBusy(spell.id); setError(null)
    try {
      const saved = await updateDndSpell(spell.id, patch)
      onDetailsChange({ ...details, spells: replaceItem(details.spells, saved) })
      setEdits((current) => { const next = { ...current }; delete next[spell.id]; return next })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar a magia.') }
    finally { setBusy(null) }
  }

  async function removeSpell(spell: DndCharacterSpell) {
    setBusy(spell.id); setError(null)
    try {
      await deleteDndSpell(spell.id)
      onDetailsChange({ ...details, spells: details.spells.filter((item) => item.id !== spell.id) })
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover a magia.') }
    finally { setBusy(null) }
  }

  return (
    <div className="dnd-tab-content">
      <p className="dnd-section-title">Magias</p>
      <DetailMessage error={error} />
      <div className="dnd-detail-form dnd-detail-form--spell">
        <input className="dnd-edit-input" placeholder="Nome da magia" value={newSpell.name} onChange={(e) => setNewSpell({ ...newSpell, name: e.target.value })} />
        <Select
          className="dnd-edit-input" plain value={String(newSpell.spell_level)} aria-label="Nível da magia"
          onChange={(v) => setNewSpell({ ...newSpell, spell_level: Number(v) })}
          options={SPELL_LEVEL_OPTIONS}
        />
        <input className="dnd-edit-input" placeholder="Escola" value={newSpell.school} onChange={(e) => setNewSpell({ ...newSpell, school: e.target.value })} />
        <input className="dnd-edit-input" placeholder="Tempo / alcance" value={newSpell.casting_time} onChange={(e) => setNewSpell({ ...newSpell, casting_time: e.target.value })} />
        <button type="button" className="btn btn-primary" onClick={() => void addSpell()} disabled={busy !== null}>Adicionar</button>
      </div>
      {details.spells.length === 0 && <p className="dnd-detail-empty">Nenhuma magia cadastrada.</p>}
      <div className="dnd-detail-list">
        {details.spells.map((spell) => {
          const value = <K extends keyof DndCharacterSpellInput>(key: K) => edits[spell.id]?.[key] ?? spell[key]
          return (
            <div key={spell.id} className="dnd-detail-card">
              <div className="dnd-detail-card__topline">
                <strong>{spell.name}</strong>
                <span>{spell.spell_level === 0 ? 'Truque' : `Nível ${spell.spell_level}`}</span>
              </div>
              <div className="dnd-detail-card__grid dnd-detail-card__grid--spell">
                <input className="dnd-edit-input" value={String(value('name'))} onChange={(e) => setEdits({ ...edits, [spell.id]: { ...edits[spell.id], name: e.target.value } })} />
                <Select
                  className="dnd-edit-input" plain value={String(value('spell_level'))} aria-label="Nível da magia"
                  onChange={(v) => setEdits({ ...edits, [spell.id]: { ...edits[spell.id], spell_level: Number(v) } })}
                  options={SPELL_LEVEL_OPTIONS}
                />
                <input className="dnd-edit-input" placeholder="Escola" value={String(value('school'))} onChange={(e) => setEdits({ ...edits, [spell.id]: { ...edits[spell.id], school: e.target.value } })} />
                <input className="dnd-edit-input" placeholder="Tempo / alcance" value={String(value('casting_time'))} onChange={(e) => setEdits({ ...edits, [spell.id]: { ...edits[spell.id], casting_time: e.target.value } })} />
                <label className="dnd-detail-check"><input type="checkbox" checked={Boolean(value('prepared'))} onChange={(e) => setEdits({ ...edits, [spell.id]: { ...edits[spell.id], prepared: e.target.checked } })} /> Preparada</label>
                <label className="dnd-detail-check"><input type="checkbox" checked={Boolean(value('concentration'))} onChange={(e) => setEdits({ ...edits, [spell.id]: { ...edits[spell.id], concentration: e.target.checked } })} /> Concentração</label>
              </div>
              <div className="dnd-detail-card__actions">
                <button type="button" className="btn btn-ghost" onClick={() => void saveSpell(spell)} disabled={busy !== null || !edits[spell.id]}>Salvar</button>
                <button type="button" className="btn btn-ghost dnd-detail-danger" onClick={() => void removeSpell(spell)} disabled={busy !== null}>Remover</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DndSkillsEditor(props: DetailsProps & { draft: Record<string, string> }) {
  return <SkillEditor {...props} />
}

export function DndAttacksEditor(props: DetailsProps) {
  return <AttacksEditor {...props} />
}

export function DndInventoryEditor(props: DetailsProps) {
  return <InventoryEditor {...props} />
}

export function DndSpellsEditor(props: DetailsProps) {
  return <SpellsEditor {...props} />
}
