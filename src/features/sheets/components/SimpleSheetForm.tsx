import { FormEvent, useEffect, useState } from 'react'
import type { CharacterSheet } from '../../../shared/types'
import type { SheetUpdateData } from '../services/sheetService'

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

function parseNum(val: string | number, min: number): number {
  const n = typeof val === 'number' ? val : parseInt(val, 10)
  return isNaN(n) ? min : Math.max(min, n)
}

// ────────────────────────────────────────────────────────
// Sub-componente: campo de atributo numérico
// ────────────────────────────────────────────────────────

interface AttrFieldProps {
  label: string
  abbr: string
  value: number
  min: number
  disabled: boolean
  onChange: (v: number) => void
}

function AttrField({ label, abbr, value, min, disabled, onChange }: AttrFieldProps) {
  return (
    <div className="sheet-attr">
      <span className="sheet-attr__abbr">{abbr}</span>
      <span className="sheet-attr__label">{label}</span>
      <input
        type="number"
        className="input sheet-attr__input"
        value={value}
        min={min}
        disabled={disabled}
        onChange={(e) => onChange(parseNum(e.target.value, min))}
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
  const [formData, setFormData] = useState({
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
  })

  // Reseta o formulário quando a ficha mudar (mestre troca de ficha)
  useEffect(() => {
    setFormData({
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
    })
  }, [sheet.id])

  function set<K extends keyof typeof formData>(key: K, value: typeof formData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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

  return (
    <form onSubmit={handleSubmit} className="sheet-form" noValidate>
      {/* Identificação do dono (visível para mestre) */}
      {ownerName && (
        <div className="sheet-form__owner">
          <span className="sheet-form__owner-label">Ficha de</span>
          <span className="sheet-form__owner-name">{ownerName}</span>
        </div>
      )}

      {/* ── Identidade ── */}
      <section className="sheet-section">
        <h4 className="sheet-section__title">Personagem</h4>
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
        </div>
      </section>

      {/* ── Atributos ── */}
      <section className="sheet-section">
        <h4 className="sheet-section__title">Atributos</h4>
        <div className="sheet-attrs-grid">
          <AttrField label="Força"        abbr="FOR" value={formData.strength}     min={1} disabled={saving} onChange={(v) => set('strength', v)} />
          <AttrField label="Destreza"     abbr="DES" value={formData.dexterity}    min={1} disabled={saving} onChange={(v) => set('dexterity', v)} />
          <AttrField label="Constituição" abbr="CON" value={formData.constitution} min={1} disabled={saving} onChange={(v) => set('constitution', v)} />
          <AttrField label="Inteligência" abbr="INT" value={formData.intelligence} min={1} disabled={saving} onChange={(v) => set('intelligence', v)} />
          <AttrField label="Sabedoria"    abbr="SAB" value={formData.wisdom}       min={1} disabled={saving} onChange={(v) => set('wisdom', v)} />
          <AttrField label="Carisma"      abbr="CAR" value={formData.charisma}     min={1} disabled={saving} onChange={(v) => set('charisma', v)} />
        </div>
      </section>

      {/* ── Anotações ── */}
      <section className="sheet-section">
        <h4 className="sheet-section__title">Anotações</h4>
        <textarea
          className="input sheet-notes"
          placeholder="Histórico, equipamentos, anotações de sessão..."
          value={formData.notes}
          onChange={(e) => set('notes', e.target.value)}
          disabled={saving}
          rows={5}
        />
      </section>

      {/* ── Feedback + botão ── */}
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
