import { FormEvent, useEffect, useState } from 'react'
import type { CharacterSheet } from '../../../shared/types'
import type { SheetUpdateData } from '../services/sheetService'

// ────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────

const NOTES_MAX = 2000

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface SimpleSheetFormProps {
  sheet: CharacterSheet
  ownerName?: string            // para mestre ver de quem é a ficha
  onSave: (data: SheetUpdateData) => Promise<void>
  saving: boolean
  saveError: string | null
  saveSuccess: boolean
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function parseNum(val: string | number, min: number, max?: number): number {
  const n = typeof val === 'number' ? val : parseInt(val, 10)
  const clamped = isNaN(n) ? min : Math.max(min, n)
  return max !== undefined ? Math.min(max, clamped) : clamped
}

type FormData = {
  character_name: string
  archetype: string
  level: number
  hp_current: number
  hp_max: number
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  notes: string
}

function sheetToForm(sheet: CharacterSheet): FormData {
  return {
    character_name: sheet.character_name ?? '',
    archetype:      sheet.archetype ?? '',
    level:          sheet.level,
    hp_current:     sheet.hp_current,
    hp_max:         sheet.hp_max,
    strength:       sheet.strength,
    dexterity:      sheet.dexterity,
    constitution:   sheet.constitution,
    intelligence:   sheet.intelligence,
    wisdom:         sheet.wisdom,
    charisma:       sheet.charisma,
    notes:          sheet.notes ?? '',
  }
}

function validateSheet(f: FormData): string | null {
  if (f.character_name.trim().length > 80)
    return 'O nome do personagem deve ter no máximo 80 caracteres.'
  if (f.archetype.trim().length > 80)
    return 'A classe/arquétipo deve ter no máximo 80 caracteres.'
  if (f.level < 1)
    return 'O nível deve ser maior ou igual a 1.'
  if (f.hp_current < 0)
    return 'Os pontos de vida atuais devem ser maiores ou iguais a 0.'
  if (f.hp_max < 1)
    return 'Os pontos de vida máximos devem ser maiores ou iguais a 1.'
  if (f.hp_current > f.hp_max)
    return 'Os pontos de vida atuais não podem ser maiores que os pontos de vida máximos.'
  const attrs = [f.strength, f.dexterity, f.constitution, f.intelligence, f.wisdom, f.charisma]
  if (attrs.some((a) => a < 1 || a > 99))
    return 'Os atributos devem estar entre 1 e 99.'
  if (f.notes.length > NOTES_MAX)
    return `As anotações devem ter no máximo ${NOTES_MAX} caracteres.`
  return null
}

// ────────────────────────────────────────────────────────
// Sub-componente: campo de atributo numérico
// ────────────────────────────────────────────────────────

interface AttrFieldProps {
  label: string
  abbr: string
  value: number
  disabled: boolean
  onChange: (v: number) => void
}

function AttrField({ label, abbr, value, disabled, onChange }: AttrFieldProps) {
  return (
    <div className="sheet-attr">
      <span className="sheet-attr__abbr">{abbr}</span>
      <span className="sheet-attr__label">{label}</span>
      <input
        type="number"
        className="input sheet-attr__input"
        value={value}
        min={1}
        max={99}
        disabled={disabled}
        onChange={(e) => onChange(parseNum(e.target.value, 1, 99))}
        aria-label={label}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function SimpleSheetForm({
  sheet,
  ownerName,
  onSave,
  saving,
  saveError,
  saveSuccess,
}: SimpleSheetFormProps) {
  const [formData, setFormData]           = useState<FormData>(() => sheetToForm(sheet))
  const [validationError, setValidationError] = useState<string | null>(null)

  // Reseta o formulário quando a ficha mudar (mestre troca de ficha)
  useEffect(() => {
    setFormData(sheetToForm(sheet))
    setValidationError(null)
  }, [sheet.id])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setValidationError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validateSheet(formData)
    if (err) { setValidationError(err); return }
    setValidationError(null)
    await onSave({
      character_name: formData.character_name.trim() || null,
      archetype:      formData.archetype.trim() || null,
      level:          formData.level,
      hp_current:     formData.hp_current,
      hp_max:         formData.hp_max,
      strength:       formData.strength,
      dexterity:      formData.dexterity,
      constitution:   formData.constitution,
      intelligence:   formData.intelligence,
      wisdom:         formData.wisdom,
      charisma:       formData.charisma,
      notes:          formData.notes.trim() || null,
    })
  }

  const notesOverLimit = formData.notes.length > NOTES_MAX

  return (
    <form onSubmit={handleSubmit} className="sheet-form" noValidate>
      {/* Identificação do dono (visível para mestre) */}
      {ownerName && (
        <div className="sheet-form__owner">
          <span className="sheet-form__owner-label">Ficha de</span>
          <span className="sheet-form__owner-name">{ownerName}</span>
        </div>
      )}

      {/* ── Identificação ── */}
      <section className="sheet-section">
        <h4 className="sheet-section__title">Identificação</h4>
        <div className="sheet-section__row sheet-section__row--3">
          <div className="auth-field sheet-section__field--grow">
            <label className="label" htmlFor="char-name">Nome do personagem</label>
            <input
              id="char-name"
              type="text"
              className="input"
              placeholder="Nome do personagem"
              value={formData.character_name}
              onChange={(e) => set('character_name', e.target.value)}
              disabled={saving}
              maxLength={80}
            />
          </div>
          <div className="auth-field sheet-section__field--grow">
            <label className="label" htmlFor="char-archetype">Classe / Arquétipo</label>
            <input
              id="char-archetype"
              type="text"
              className="input"
              placeholder="ex: Guerreiro, Ladino..."
              value={formData.archetype}
              onChange={(e) => set('archetype', e.target.value)}
              disabled={saving}
              maxLength={80}
            />
          </div>
          <div className="auth-field sheet-section__field--fixed">
            <label className="label" htmlFor="char-level">Nível</label>
            <input
              id="char-level"
              type="number"
              className="input"
              min={1}
              value={formData.level}
              onChange={(e) => set('level', parseNum(e.target.value, 1))}
              disabled={saving}
            />
          </div>
        </div>
      </section>

      {/* ── Pontos de Vida ── */}
      <section className="sheet-section">
        <h4 className="sheet-section__title">Pontos de Vida</h4>
        <div className="sheet-hp-row">
          <div className="auth-field">
            <label className="label" htmlFor="char-hp-cur">PV Atual</label>
            <input
              id="char-hp-cur"
              type="number"
              className="input sheet-hp-input"
              min={0}
              value={formData.hp_current}
              onChange={(e) => set('hp_current', parseNum(e.target.value, 0))}
              disabled={saving}
            />
          </div>
          <span className="sheet-hp-separator">/</span>
          <div className="auth-field">
            <label className="label" htmlFor="char-hp-max">PV Máximo</label>
            <input
              id="char-hp-max"
              type="number"
              className="input sheet-hp-input"
              min={1}
              value={formData.hp_max}
              onChange={(e) => set('hp_max', parseNum(e.target.value, 1))}
              disabled={saving}
            />
          </div>
          {/* Barra de HP visual */}
          {formData.hp_max > 0 && (
            <div
              className="sheet-hp-bar"
              role="progressbar"
              aria-valuenow={formData.hp_current}
              aria-valuemin={0}
              aria-valuemax={formData.hp_max}
              aria-label="Pontos de vida"
            >
              <div
                className={[
                  'sheet-hp-bar__fill',
                  formData.hp_current <= 0 ? 'sheet-hp-bar__fill--dead'
                  : formData.hp_current / formData.hp_max <= 0.25 ? 'sheet-hp-bar__fill--critical'
                  : formData.hp_current / formData.hp_max <= 0.5 ? 'sheet-hp-bar__fill--low'
                  : '',
                ].join(' ').trim()}
                style={{ width: `${Math.min(100, Math.max(0, (formData.hp_current / formData.hp_max) * 100))}%` }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Atributos ── */}
      <section className="sheet-section">
        <h4 className="sheet-section__title">Atributos</h4>
        <div className="sheet-attrs-grid">
          <AttrField label="Força"        abbr="FOR" value={formData.strength}     disabled={saving} onChange={(v) => set('strength', v)} />
          <AttrField label="Destreza"     abbr="DES" value={formData.dexterity}    disabled={saving} onChange={(v) => set('dexterity', v)} />
          <AttrField label="Constituição" abbr="CON" value={formData.constitution} disabled={saving} onChange={(v) => set('constitution', v)} />
          <AttrField label="Inteligência" abbr="INT" value={formData.intelligence} disabled={saving} onChange={(v) => set('intelligence', v)} />
          <AttrField label="Sabedoria"    abbr="SAB" value={formData.wisdom}       disabled={saving} onChange={(v) => set('wisdom', v)} />
          <AttrField label="Carisma"      abbr="CAR" value={formData.charisma}     disabled={saving} onChange={(v) => set('charisma', v)} />
        </div>
      </section>

      {/* ── Anotações ── */}
      <section className="sheet-section">
        <div className="sheet-section__title-row">
          <h4 className="sheet-section__title" style={{ borderBottom: 'none', marginBottom: 0 }}>Anotações</h4>
          <span className={`sheet-notes-count ${notesOverLimit ? 'sheet-notes-count--over' : ''}`}>
            {formData.notes.length}/{NOTES_MAX}
          </span>
        </div>
        <textarea
          className="input sheet-notes"
          placeholder="Histórico, equipamentos, anotações de sessão..."
          value={formData.notes}
          onChange={(e) => set('notes', e.target.value)}
          disabled={saving}
          rows={5}
        />
      </section>

      {/* ── Feedback ── */}
      {validationError && (
        <div className="sheet-form__feedback sheet-form__feedback--error" role="alert">
          {validationError}
        </div>
      )}
      {saveError && (
        <div className="sheet-form__feedback sheet-form__feedback--error" role="alert">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="sheet-form__feedback sheet-form__feedback--success" role="status">
          Ficha salva com sucesso.
        </div>
      )}

      <div className="sheet-form__actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving
            ? <><span className="spinner spinner--sm" /> Salvando...</>
            : 'Salvar ficha'
          }
        </button>
      </div>
    </form>
  )
}
